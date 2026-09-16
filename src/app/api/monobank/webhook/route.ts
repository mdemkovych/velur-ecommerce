import { NextResponse } from "next/server";
import { verifyWebhookSignature, type MonobankStatusPayload } from "@/lib/monobank";
import { applyPayment } from "@/lib/payments";
import { logAudit } from "@/lib/auditLogger";
import { clientIp } from "@/lib/clientIp";

/**
 * Monobank acquiring webhook receiver endpoint.
 *
 * NOTE: (§3.1) Validates ECDSA webhook signature, records non-completed payment attempts, and invokes applyPayment() on successful charges.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const ip = clientIp(request);

  if (!(await verifyWebhookSignature(rawBody, request.headers.get("x-sign")))) {
    console.warn("Rejected Monobank webhook with invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: MonobankStatusPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const { reference, invoiceId, status } = payload;
  if (!reference) {
    return NextResponse.json({ status: "ignored" });
  }

  if (status !== "success") {
    // NOTE: (§3.1) Logs audit trail for failed or reversed payment callbacks.
    if (status === "failure" || status === "reversed") {
      await logAudit({
        actor: "monobank-webhook",
        action: "PAYMENT_NOT_COMPLETED",
        target: reference,
        ip,
        details: { invoiceId, status },
      });
    }
    return NextResponse.json({ status: "ignored" });
  }

  // NOTE: (§3.1) Settles order and emits confirmation email inside applyPayment().
  const outcome = await applyPayment(reference, payload, "webhook", ip);

  return NextResponse.json({ status: outcome.applied ? "ok" : "ignored" });
}

