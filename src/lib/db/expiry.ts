import "server-only";
import { prisma } from "../prisma";
import { cancelOrder, getOrderById } from "./orders";
import type { Order } from "../types";

/**
 * Scheduled order cancellation sweep releasing unspent stock reservations.
 *
 * NOTE: (§4.4) Periodically cancels PENDING_PAYMENT orders past their expiresAt timestamp.
 * Includes optional payment rescue check to avoid cancelling paid orders with dropped webhooks.
 */

const EXPIRY_BATCH_SIZE = 100;

/**
 * Sweeps and cancels stale unpaid orders within an execution deadline.
 *
 * NOTE: (§4.4) Batched at 100 items; verifies payment state with tryRescue before triggering cancellation.
 *
 * @param deadline Timestamp in ms after which loop terminates gracefully.
 * @param tryRescue Optional callback checking bank payment status prior to cancellation.
 * @returns Partitioned summary of expired, rescued, and waiting orders.
 */
export async function expireStaleOrders(
  deadline: number,
  tryRescue?: (order: Order) => Promise<Order | "wait" | null>,
): Promise<{
  expired: Order[];
  rescued: Order[];
  waiting: Order[];
  /** The batch was full, so more may be waiting for the next run. */
  batchFull: boolean;
  /** The deadline arrived first. Distinct from a finished batch on purpose (§4.4). */
  stoppedEarly: boolean;
}> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    orderBy: { expiresAt: "asc" },
    // NOTE: (§4.4) Bounded batch query prevents runaway process starvation.
    take: EXPIRY_BATCH_SIZE,
    select: { id: true },
  });

  const expired: Order[] = [];
  const rescued: Order[] = [];
  const waiting: Order[] = [];

  let stoppedEarly = false;

  for (const { id } of stale) {
    // NOTE: (§4.4) Evaluates deadline boundary between orders to ensure atomic order processing.
    if (Date.now() >= deadline) {
      stoppedEarly = true;
      break;
    }

    if (tryRescue) {
      const order = await getOrderById(id);
      // NOTE: (§4.4) Re-verifies fresh status to avoid races against incoming webhooks.
      if (!order || order.status !== "PENDING_PAYMENT") continue;

      if (order.invoiceId) {
        const outcome = await tryRescue(order);
        if (outcome === "wait") {
          waiting.push(order);
          continue;
        }
        if (outcome) {
          rescued.push(outcome);
          continue;
        }
      }
    }

    // NOTE: (§4.4, §4.5) Atomic status-guarded cancellation restores warehouse stock.
    const order = await cancelOrder(id, "PENDING_PAYMENT");
    if (order) expired.push(order);
  }


  return {
    expired,
    rescued,
    waiting,
    batchFull: stale.length === EXPIRY_BATCH_SIZE,
    stoppedEarly,
  };
}
