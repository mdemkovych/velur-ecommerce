import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrder, getOrderById } from "@/lib/db";
import { getInvoiceStatus, isMonobankConfigured, voidInvoice } from "@/lib/monobank";
import { verifyPaymentToken } from "@/lib/paymentToken";
import { logAudit } from "@/lib/auditLogger";

/**
 * Customer order cancellation and stock release endpoint.
 *
 * NOTE: (§4.5) Voids active Monobank invoice, restores reserved stock, and releases cart items back for shopper editing.
 */

const bodySchema = z.object({
  orderId: z.string().trim().min(1).max(64),
  paymentToken: z.string().trim().min(1).max(256),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "No order given" }, { status: 400 });
  }

  const { orderId, paymentToken } = parsed.data;

  // NOTE: (§3.1, §4.7) Verifies HMAC payment token before inspecting or mutating order.
  if (!(await verifyPaymentToken(paymentToken, orderId))) {
    return NextResponse.json(
      {
        error:
          "This order has expired — there is nothing left to cancel. " +
          "The goods went back on sale; the order can be placed again.",
      },
      { status: 403 },
    );
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "The order is no longer awaiting payment", settled: true }, { status: 409 });
  }

  if (!isMonobankConfigured()) {
    return NextResponse.json(
      { error: "The order has been accepted — a manager will be in touch." },
      { status: 409 },
    );
  }

  if (order.invoiceId) {
    const status = await getInvoiceStatus(order.invoiceId);
    if (status === "success" || status === "processing" || status === "hold") {
      return NextResponse.json(
        {
          error: "The bank is already processing the payment — wait a few seconds and reload.",
          settled: true,
        },
        { status: 409 },
      );
    }
  }

  // NOTE: (§3.1) Voids invoice at Monobank prior to resetting order stock in database.
  if (order.invoiceId && isMonobankConfigured()) {
    await voidInvoice(order.invoiceId);
  }

  const cancelled = await cancelOrder(order.id, "PENDING_PAYMENT");
  if (!cancelled) {
    return NextResponse.json({ error: "The order status changed. Reload the page.", settled: true }, { status: 409 });
  }

  // NOTE: (§2.7) Audit log for customer action excludes IP for shopper privacy.
  await logAudit({
    actor: "customer",
    action: "ORDER_RELEASED_BY_CUSTOMER",
    target: cancelled.id,
    // MUST NOT: add an ip here; the actor is a shopper, and §2.7 keeps a customer's
    // address out of the journal.
    details: { total: cancelled.total, invoiceId: order.invoiceId },
  });

  return NextResponse.json({
    lines: cancelled.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  });
}

