import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getOrderStats } from "@/lib/db";

/**
 * Order dashboard summary statistics endpoint.
 *
 * NOTE: (§8.4) Aggregates order counts and turnover metrics computed at Europe/Kyiv midnight boundaries.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json(await getOrderStats());
}

