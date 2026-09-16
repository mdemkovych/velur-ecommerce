import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/db";
import { logAudit, logAuditThrottled } from "@/lib/auditLogger";
import { isNovaPoshtaConfigured, probeNovaPoshta } from "@/lib/novaposhta";
import { getInvoiceState, isMonobankConfigured, voidInvoice } from "@/lib/monobank";
import { applyPayment } from "@/lib/payments";
import { timingSafeEquals } from "@/lib/signing";

/**
 * Periodic cron task releasing unpaid expired order reservations.
 *
 * NOTE: (§3.1, §4.4, §4.5) Sweeps stale orders past reservation TTL, verifies status with Monobank to rescue late payments,
 * voids uncollected invoices, and restocks catalog quantities.
 */

export const maxDuration = 300;
const DEADLINE_MARGIN_MS = 60_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the expiry job");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEquals(offered, secret)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // NOTE: (§4.4) Skips execution when Monobank merchant integration is unconfigured.
  const paymentsConfigured = isMonobankConfigured();

  const deadline = Date.now() + (maxDuration * 1000 - DEADLINE_MARGIN_MS);

  const { expired, rescued, waiting, batchFull, stoppedEarly } = paymentsConfigured
    ? await expireStaleOrders(deadline, async (order) => {
        // NOTE: (§3.1, §4.4) Last-chance invoice status verification rescues paid orders with lost webhooks.
        const state = await getInvoiceState(order.invoiceId!);

        if (!state || state.status === "processing" || state.status === "hold") {
          return "wait";
        }

        if (state.status !== "success") return null;

        const outcome = await applyPayment(order.id, state, "expiry-sweep");
        if (!outcome.applied) return "wait";

        console.error(`Order ${order.id} was paid but never received a webhook`);
        return outcome.order;
      })
    : { expired: [], rescued: [], waiting: [], batchFull: false, stoppedEarly: false };

  for (const order of expired) {
    // NOTE: (§4.5) Voids invoice at Monobank upon order expiry.
    await voidInvoice(order.invoiceId);

    await logAudit({
      actor: "system",
      action: "ORDER_EXPIRED",
      target: order.id,
      details: { reason: "unpaid past the reservation window", total: order.total },
    });
  }

  // NOTE: (§5.1) Periodic delivery directory probe emits throttled alerts on connection failures.
  const deliveryDirectoryOk = isNovaPoshtaConfigured() ? await probeNovaPoshta() : null;
  if (deliveryDirectoryOk === false) {
    await logAuditThrottled(
      {
        actor: "system",
        action: "NOVA_POSHTA_UNAVAILABLE",
        target: "delivery-directory",
        details: { hint: "the key is set but the directory does not answer — check whether it has expired" },
      },
      60 * 60 * 1000,
    );
  }

  return NextResponse.json({
    expired: expired.length,
    ids: expired.map((order) => order.id),
    rescued: rescued.length,
    rescuedIds: rescued.map((order) => order.id),
    waiting: waiting.length,
    waitingIds: waiting.map((order) => order.id),
    batchFull,
    stoppedEarly,
    reservationSweep: paymentsConfigured ? "active" : "skipped: online payment not configured",
    deliveryDirectoryOk,
  });
}

