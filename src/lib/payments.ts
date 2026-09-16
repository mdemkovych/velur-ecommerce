import "server-only";
import { flagOrderForReview, getOrderById, markOrderPaid } from "./db";
import { verifyPaidCallback, type MonobankStatusPayload } from "./monobank";
import { logAudit } from "./auditLogger";
import { isMailConfigured, sendOrderPaidEmail } from "./mail";
import { isTelegramConfigured, notifyNewOrder } from "./telegram";
import { isTurboSmsConfigured, sendOrderPaidSms } from "./turbosms";
import type { Order } from "./types";

/**
 * Centralized payment application and state transition coordinator.
 *
 * NOTE: (§3.1) Exclusive entry point for marking orders as PAID. Enforces unified security checks
 * across both asynchronous Monobank webhooks and synchronous reconciliation sweeps.
 */

/** Originating channel for confirmed payment. */
export type PaymentSource = "webhook" | "expiry-sweep";

export type PaymentOutcome =
  | { applied: true; order: Order }
  /** `review` means the order now carries a flag for a person to resolve. */
  | { applied: false; reason: string; review: boolean };

/**
 * Executes one-time side effects upon initial transition to PAID.
 *
 * NOTE: (§3.1, §9.2, §9.3) Dispatches the customer's letter and SMS, sends the Telegram
 * staff alert, and records the immutable ORDER_PAID audit event.
 *
 * NOTE: (§9.3) The three go together rather than in turn: each carries its own
 * timeout, and three of those in sequence outlast the webhook Monobank waits on.
 */
async function onOrderPaid(order: Order, source: PaymentSource): Promise<void> {
  const actor = source === "webhook" ? "monobank-webhook" : "system";

  const [emailed, notified, texted] = await Promise.all([
    sendOrderPaidEmail(order),
    notifyNewOrder(order),
    sendOrderPaidSms(order),
  ]);

  await logAudit({
    actor,
    action: "ORDER_PAID",
    target: order.id,
    details: {
      invoiceId: order.invoiceId,
      total: order.total,
      email: emailed ? "sent" : isMailConfigured() ? "failed" : "not configured",
      telegram: notified ? "sent" : isTelegramConfigured() ? "failed" : "not configured",
      sms: texted ? "sent" : isTurboSmsConfigured() ? "failed" : "not configured",
      ...(source === "expiry-sweep"
        ? { source: "expiry sweep — Monobank reported success, no webhook arrived" }
        : {}),
    },
  });
}

/**
 * Validates and applies payment callback or sweep payload to an order.
 *
 * NOTE: (§3.1, §3.5) Enforces strict amount matching, currency check (980 UAH), invoiceId matching,
 * and flags anomalies (PAYMENT_MISMATCH, PAYMENT_AFTER_CANCEL) for human review.
 *
 * @param orderId Target order identifier.
 * @param payload Monobank status callback object.
 * @param source Processing channel ('webhook' or 'expiry-sweep').
 * @param ip Optional client IP for audit logging.
 * @returns Applied state or reason for rejection with review requirement flag.
 */
export async function applyPayment(
  orderId: string,
  payload: MonobankStatusPayload,
  source: PaymentSource,
  ip?: string,
): Promise<PaymentOutcome> {
  // NOTE: (§3.1) Enforces strict success status check to guard against reversed/refunded events.
  if (payload.status !== "success") {
    return { applied: false, reason: `status ${payload.status ?? "unknown"}`, review: false };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    await logAudit({
      actor: source === "webhook" ? "monobank-webhook" : "system",
      action: "PAYMENT_UNKNOWN_ORDER",
      target: orderId,
      ip,
      details: { invoiceId: payload.invoiceId, amount: payload.amount },
    });
    return { applied: false, reason: "unknown order", review: false };
  }

  // NOTE: (§3.1, §4.5) Flags late payment on already cancelled/returned orders for manual staff review.
  if (order.status === "CANCELLED" || order.status === "RETURNED") {
    console.error(`Payment received for ${order.status} order ${order.id}`);
    await flagOrderForReview(
      order.id,
      `Payment arrived for an order with status «${order.status}». The money is here and the goods went back on the shelf — this needs a decision.`,
    );
    await logAudit({
      actor: source === "webhook" ? "monobank-webhook" : "system",
      action: "PAYMENT_AFTER_CANCEL",
      target: order.id,
      ip,
      details: { invoiceId: payload.invoiceId, status: order.status, amount: payload.amount },
    });
    return { applied: false, reason: `order is ${order.status}`, review: true };
  }

  // NOTE: (§3.1) Validates expected order total and invoice consistency.
  const check = verifyPaidCallback(order, payload);
  if (!check.ok) {
    console.error(`Monobank payment mismatch for ${order.id}: ${check.reason}`);
    await flagOrderForReview(
      order.id,
      `Payment did not match what was expected: ${check.reason}. The order was not marked paid.`,
    );
    await logAudit({
      actor: source === "webhook" ? "monobank-webhook" : "system",
      action: "PAYMENT_MISMATCH",
      target: order.id,
      ip,
      details: { invoiceId: payload.invoiceId, reason: check.reason },
    });
    return { applied: false, reason: check.reason, review: true };
  }

  // MUST NOT: call markOrderPaid from anywhere else; every source meets these checks first (§3.1).
  const paid = await markOrderPaid(order.id, payload.invoiceId);
  if (!paid) {
    // NOTE: (§3.1) Idempotent transition guard handles concurrent webhooks/sweeps.
    return { applied: false, reason: "already paid", review: false };
  }

  await onOrderPaid(paid, source);
  return { applied: true, order: paid };

}
