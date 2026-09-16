import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrder, claimInvoice, getOrderById, registerPaymentAttempt } from "@/lib/db";
import { MonobankUnavailableError, createInvoice, isMonobankConfigured, voidInvoice } from "@/lib/monobank";
import { getAppUrl } from "@/lib/appUrl";
import { verifyPaymentToken } from "@/lib/paymentToken";

/**
 * Monobank invoice generation endpoint.
 *
 * NOTE: (§3.1) Enforces per-order payment attempt limits, voids prior invoices, claims new invoice atomically, and returns acquiring payment URL.
 */

const bodySchema = z.object({
  orderId: z.string().trim().min(1).max(64),
  paymentToken: z.string().trim().min(1).max(256),
});

export async function POST(request: Request) {
  if (!isMonobankConfigured()) {
    return NextResponse.json(
      { error: "Online payment is temporarily unavailable" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "No order given" }, { status: 400 });
  }

  // NOTE: (§3.1, §4.7) Verifies HMAC checkout token authorization.
  if (!(await verifyPaymentToken(parsed.data.paymentToken, parsed.data.orderId))) {
    return NextResponse.json(
      {
        error:
          "This order has expired, so it can no longer be paid. " +
          "The goods went back on sale — place the order again.",
      },
      { status: 403 },
    );
  }

  const order = await getOrderById(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "The order is already paid" }, { status: 409 });
  }

  // NOTE: (§3.1) Increments payment attempt counter (max 5) before external Monobank invocation.
  if (!(await registerPaymentAttempt(order.id))) {
    return NextResponse.json(
      { error: "Too many payment attempts. Place the order again." },
      { status: 429 },
    );
  }

  // NOTE: (§3.1) Voids previous invoice before creating a replacement.
  if (!(await voidInvoice(order.invoiceId))) {
    return NextResponse.json(
      { error: "The previous payment page could not be closed. Try again in a minute." },
      { status: 503 },
    );
  }

  try {
    // NOTE: (§3.1) Uses configured base URL for acquiring webhook callbacks.
    const invoice = await createInvoice(order, getAppUrl(request));

    if (!(await claimInvoice(order.id, order.invoiceId, invoice.invoiceId))) {
      await voidInvoice(invoice.invoiceId);
      return NextResponse.json(
        { error: "The payment page is already open in another tab. Use that one." },
        { status: 409 },
      );
    }

    return NextResponse.json({ pageUrl: invoice.pageUrl });
  } catch (err) {
    // NOTE: (§4.4) Cancels order on unrecoverable invoice creation failures.
    await cancelOrder(order.id, "PENDING_PAYMENT");

    if (err instanceof MonobankUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Monobank invoice error:", err);
    return NextResponse.json({ error: "The invoice could not be created" }, { status: 500 });
  }
}

