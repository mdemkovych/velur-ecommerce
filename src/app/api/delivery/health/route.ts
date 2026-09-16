import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isNovaPoshtaConfigured, probeNovaPoshta } from "@/lib/novaposhta";

/**
 * Administrative health probe endpoint for Nova Poshta integration.
 *
 * NOTE: (§5.1, §8.1) Validates API key reachability without executing full directory synchronization.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!isNovaPoshtaConfigured()) {
    return NextResponse.json({
      configured: false,
      reachable: false,
      hint: "NOVA_POSHTA_API_KEY is not set",
    });
  }

  const reachable = await probeNovaPoshta();

  return NextResponse.json({
    configured: true,
    reachable,
    hint: reachable
      ? "The key works"
      : "The key is set but the directory did not answer — check the key and the server logs",
  });
}

