import "server-only";
import { getOrderById } from "./db";
import { getInvoiceStatus } from "./monobank";
import { verifyPaymentToken } from "./paymentToken";
import type { PaymentOutcome } from "@/app/checkout/OrderPlaced";

/**
 * Server-side payment outcome resolver for the checkout thank-you screen.
 *
 * NOTE: (§3.1) Validates paymentToken against order status and live Monobank invoice inquiry.
 * Read-only evaluation prevents client manipulation of displayed payment states.
 *
 * @param orderId Human-readable order identifier.
 * @param token HMAC payment token.
 * @returns Resolved outcome state ('paid', 'pending', 'processing', 'failed', 'cancelled', 'unknown').
 */
export async function resolvePaymentOutcome(
  orderId: string | undefined,
  token: string | undefined,
): Promise<PaymentOutcome> {
  if (!orderId || !(await verifyPaymentToken(token, orderId))) return "unknown";

  const order = await getOrderById(orderId);
  if (!order) return "unknown";

  if (order.status !== "PENDING_PAYMENT") {
    // NOTE: (§3.1) Final status reached; avoids redundant Monobank API roundtrips.
    return order.status === "CANCELLED" ? "cancelled" : "paid";
  }

  // NOTE: (§3.1) Non-invoiced orders represent pending payment state.
  if (!order.invoiceId) return "pending";

  switch (await getInvoiceStatus(order.invoiceId)) {
    case "success":
      return "paid";

    case "processing":
    case "hold":
      // NOTE: (§3.1) Payment is in-flight at the acquiring bank.
      return "processing";

    case "created":
      // NOTE: (§3.1) The shopper reached the bank's page and left without
      // attempting anything. Kept apart from a refusal so that changing one
      // does not silently change the other.
      return "failed";

    case "failure":
    case "expired":
    case "reversed":
      // NOTE: (§3.1) The bank declined, the invoice lapsed, or the money was
      // sent back. Nothing is in flight, so a retry is safe.
      return "failed";

    default:
      // NOTE: (§3.1) No answer from the bank: a timeout or an unknown status.
      // MUST NOT: group this with "failed"; that offers a retry, and a retry voids
      // the previous invoice, whose fate could not be established.
      return "processing";
  }
}

