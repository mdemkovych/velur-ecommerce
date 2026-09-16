import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { clientIp } from "./clientIp";
import type { AuditAction } from "./types";

/**
 * Append-only security and operational audit trail.
 *
 * NOTE: (§2.7, §3.4) Writes immutable event logs to database table for staff actions, auth events, and payment anomalies.
 */

export interface AuditEntry {
  /** User uuid for staff accounts, or system actor label (e.g. "monobank-webhook", "system"). */
  actor: string;
  action: AuditAction;
  target: string;
  ip?: string;
  details?: Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function entryData(entry: AuditEntry, actorId: string | null) {
  return {
    actorId,
    actorLabel: entry.actor,
    action: entry.action,
    target: entry.target,
    ip: entry.ip,
    details: entry.details as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Appends an audit entry with fail-safe error handling.
 *
 * NOTE: (§2.7) Audit failures are caught and logged to prevent interrupting originating operations.
 *
 * @param entry Audit entry payload.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const actorId = UUID.test(entry.actor) ? entry.actor : null;

  try {
    await prisma.auditLog.create({ data: entryData(entry, actorId) });
  } catch (err) {
    if (actorId) {
      try {
        await prisma.auditLog.create({ data: entryData(entry, null) });
        return;
      } catch {
        // Fall through to error logging below.
      }
    }
    console.error("Audit log write failed:", err);
  }
}

/**
 * Appends an audit entry only if no identical event was recorded within the given window.
 *
 * NOTE: (§2.7) For a condition that persists rather than an event that happened.
 *
 * @param entry Audit entry payload.
 * @param windowMs Deduplication window in milliseconds.
 */
export async function logAuditThrottled(
  entry: AuditEntry,
  windowMs: number,
): Promise<void> {
  try {
    const recent = await prisma.auditLog.findFirst({
      where: {
        action: entry.action,
        target: entry.target,
        timestamp: { gt: new Date(Date.now() - windowMs) },
      },
      select: { id: true },
    });
    if (recent) return;
  } catch (err) {
    console.error("Audit throttle check failed:", err);
  }

  await logAudit(entry);
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/** Page size for audit log review. */
export const AUDIT_PAGE_SIZE = 50;

export interface AuditRecord {
  id: string;
  timestamp: string;
  actorLabel: string;
  actorName?: string;
  action: string;
  target: string;
  ip?: string;
  details?: unknown;
}

export interface AuditQuery {
  action?: string;
  /** Substring filter on target column (order number, product id, user email). */
  search?: string;
  /** Primary key cursor of the last displayed row. */
  cursor?: string;
  /** NOTE: (§2.7) Constrained action list for MANAGER role; omitted for OWNER. */
  visibleActions?: readonly AuditAction[];
}

/**
 * Queries paginated audit records with role-based visibility rules.
 *
 * NOTE: (§2.7) Restricts visible actions and redacts IP addresses when queried by MANAGER role.
 *
 * @param query Filter parameters and pagination cursor.
 * @returns Paginated entries and next cursor.
 */
export async function listAudit(
  query: AuditQuery,
): Promise<{ entries: AuditRecord[]; nextCursor: string | null }> {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(query.search ? { target: { contains: query.search, mode: "insensitive" } } : {}),
      // MUST NOT: write `action` from two spreads; the second replaces the first, and a
      // manager's chosen filter vanishes while an owner sees nothing wrong.
      ...(query.visibleActions
        ? {
            action: {
              in: query.action
                ? query.visibleActions.filter((a) => a === query.action)
                : [...query.visibleActions],
            },
          }
        : query.action
          ? { action: query.action }
          : {}),
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE_SIZE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: { actor: { select: { name: true } } },
  });

  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;

  return {
    entries: page.map((row) => ({
      id: row.id,
      timestamp: row.timestamp.toISOString(),
      actorLabel: row.actorLabel,
      actorName: row.actor?.name,
      action: row.action,
      target: row.target,
      ip: query.visibleActions ? undefined : (row.ip ?? undefined),
      details: row.details ?? undefined,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * Deletes a single audit entry with immutable trail protection.
 *
 * NOTE: (§2.7) Entries recording AUDIT_ENTRY_DELETED are protected against deletion to prevent covert trail erasure.
 *
 * @param id Entry identifier.
 * @returns True if deleted; false if not found or protected.
 */
export async function deleteAuditEntry(id: string): Promise<boolean> {
  const { count } = await prisma.auditLog.deleteMany({
    where: { id, action: { not: "AUDIT_ENTRY_DELETED" } },
  });
  return count > 0;
}

export { clientIp };
export type { AuditAction };

