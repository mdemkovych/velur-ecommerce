import { NextResponse } from "next/server";
import { anonymizeOldOrders, ORDER_RETENTION_YEARS } from "@/lib/db";
import { logAudit } from "@/lib/auditLogger";
import { timingSafeEquals } from "@/lib/signing";

/**
 * Periodic cron task erasing personal customer data from orders exceeding retention deadline.
 *
 * NOTE: (§3.6.1) Anonymizes customer PII on orders older than ORDER_RETENTION_YEARS (3 years) to comply with GDPR & Ukrainian privacy regulations.
 */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the retention sweep");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Authenticates CRON_SECRET using timingSafeEquals().
  const offered = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEquals(offered, secret)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const erased = await anonymizeOldOrders();

  // NOTE: (§2.7, §3.6.1) Records audit log without storing erased PII.
  if (erased > 0) {
    await logAudit({
      actor: "system",
      action: "ORDERS_ANONYMIZED",
      target: `${erased}`,
      details: { erased, retentionYears: ORDER_RETENTION_YEARS },
    });
  }

  return NextResponse.json({ erased });
}

