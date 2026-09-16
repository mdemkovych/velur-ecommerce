import "server-only";
import { prisma } from "../prisma";

/**
 * GDPR/Ukrainian law personal data erasure and anonymization engine.
 *
 * NOTE: (§3.6.1) Erases customer PII from orders older than ORDER_RETENTION_YEARS (3 years) while retaining financial totals and item history.
 */

/** NOTE: (§3.6.1) Legal retention period (3 years from creation date). */
export const ORDER_RETENTION_YEARS = 3;

/** Placeholder string substituting erased personal fields. */
const ERASED = "—";

/**
 * Anonymizes personal data on expired orders in batches.
 *
 * NOTE: (§3.6.1) Replaces PII with redacted placeholder ("—"), nullifies addresses/comments, and sets anonymizedAt timestamp.
 *
 * @param now Reference timestamp.
 * @param batchSize Batch size limit per transaction loop (default: 500).
 * @returns Total count of anonymized order records.
 */
export async function anonymizeOldOrders(
  now: Date = new Date(),
  batchSize = 500,
): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - ORDER_RETENTION_YEARS);

  let erased = 0;

  for (;;) {
    const batch = await prisma.order.findMany({
      where: { createdAt: { lt: cutoff }, anonymizedAt: null },
      select: { id: true },
      take: batchSize,
    });
    if (batch.length === 0) break;

    const { count } = await prisma.order.updateMany({
      where: { id: { in: batch.map((row) => row.id) }, anonymizedAt: null },
      data: {
        firstName: ERASED,
        lastName: ERASED,
        phone: ERASED,
        email: ERASED,
        // Nullable, so these two leave nothing behind at all. `comment` is free
        // text a customer could have put anything into, a second telephone
        // number included.
        address: null,
        comment: null,
        anonymizedAt: now,
      },
    });

    erased += count;
    // A batch that changed nothing while rows still match would loop for ever.
    if (count === 0) break;
  }

  return erased;
}
