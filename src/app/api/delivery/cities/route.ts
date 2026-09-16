import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isNovaPoshtaConfigured, searchCities } from "@/lib/novaposhta";

/**
 * City autocomplete endpoint for checkout delivery search.
 *
 * NOTE: (§1.2, §5.1, §5.3) Queries local database directory with upstream Nova Poshta API fallback.
 */

// Bounds the search string; the directory is local, so no external budget is at stake (§3.2).
const querySchema = z.object({ q: z.string().trim().max(100).default("") });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!isNovaPoshtaConfigured()) {
    return NextResponse.json({ configured: false, cities: [] });
  }

  // NOTE: (§5.1) "available" indicates directory responsiveness, allowing fallback to manual input when offline.
  const { available, items } = await searchCities(parsed.data.q);
  return NextResponse.json({ configured: true, available, cities: items });
}

