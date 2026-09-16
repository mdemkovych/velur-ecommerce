import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logAudit } from "@/lib/auditLogger";
import { timingSafeEquals } from "@/lib/signing";
import {
  lastCompletedSync,
  runInFlight,
  syncEntity,
  type NpEntity,
  type SyncProgress,
} from "@/lib/novaposhtaSync";

/**
 * Scheduled cron task incrementally syncing Nova Poshta cities and branches into local database.
 *
 * NOTE: (§5.3) Uses direct unpooled database connection, tracks pagination state in np_sync, and bounds execution against serverless deadline.
 */

export const runtime = "nodejs";
export const maxDuration = 300;
const DEADLINE_MARGIN_MS = 45_000;
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

const ENTITIES: NpEntity[] = ["cities", "warehouses"];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the directory sync");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEquals(offered, secret)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const apiKey = process.env.NOVA_POSHTA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ skipped: "NOVA_POSHTA_API_KEY is not set" });
  }

  // NOTE: (§5.3, §9.1) Uses direct database connection to avoid saturating transaction pool during large batch writes.
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("DIRECT_URL is not set — cannot sync the Nova Poshta directory");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });

  const deadline = Date.now() + (maxDuration * 1000 - DEADLINE_MARGIN_MS);

  try {
    if (!(await runInFlight(prisma))) {
      const completed = await lastCompletedSync(prisma);
      if (completed && Date.now() - completed.getTime() < REFRESH_AFTER_MS) {
        return NextResponse.json({
          skipped: "directory is current",
          lastCompleted: completed.toISOString(),
        });
      }
    }

    const results: SyncProgress[] = [];
    for (const entity of ENTITIES) {
      if (Date.now() >= deadline) break;
      results.push(await syncEntity(prisma, entity, { apiKey, deadline }));
    }

    const finished = results.filter((r) => r.done);
    // NOTE: (§2.7, §5.3) Emits audit log per completed entity sync.
    for (const result of finished) {
      await logAudit({
        actor: "system",
        action: "NOVA_POSHTA_SYNCED",
        target: `np-${result.entity}`,
        details: { rows: result.total, entity: result.entity },
      });
    }

    return NextResponse.json({
      results,
      complete: results.length === ENTITIES.length && results.every((r) => r.done),
    });
  } catch (err) {
    console.error("Nova Poshta directory sync failed:", err);
    await logAudit({
      actor: "system",
      action: "NOVA_POSHTA_UNAVAILABLE",
      target: "delivery-directory",
      details: { hint: "the directory sync was interrupted", error: String(err) },
    });
    return NextResponse.json({ error: "The sync failed" }, { status: 502 });
  } finally {
    await prisma.$disconnect();
  }
}

