import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Legacy Monobank return URL redirect handler.
 *
 * NOTE: (§3.1) Forwards payment callback parameters to /checkout/success via 303 redirect.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const from = new URL(request.url);
  const to = new URL("/checkout/success", getAppUrl());

  const orderId = from.searchParams.get("orderId");
  const token = from.searchParams.get("t");
  if (orderId) to.searchParams.set("orderId", orderId);
  if (token) to.searchParams.set("t", token);

  return NextResponse.redirect(to, { status: 303 });
}

