import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isNovaPoshtaConfigured, searchWarehouses } from "@/lib/novaposhta";

/**
 * Nova Poshta warehouse / branch autocomplete endpoint for resolved city.
 *
 * NOTE: (§1.2, §5.1, §5.3) Returns branches and parcel-lockers from local Postgres directory or upstream API fallback.
 */

// Bounds the search string; the directory is local (§3.2).
const querySchema = z.object({
  cityRef: z.string().trim().max(64).default(""),
  q: z.string().trim().max(100).default(""),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    cityRef: request.nextUrl.searchParams.get("cityRef") ?? "",
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!isNovaPoshtaConfigured()) {
    return NextResponse.json({ configured: false, warehouses: [] });
  }

  const { available, items } = await searchWarehouses(parsed.data.cityRef, parsed.data.q);
  return NextResponse.json({ configured: true, available, warehouses: items });
}

