import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Current authenticated staff session info endpoint.
 *
 * NOTE: (§3.4) Returns current session user entity from getSessionUser().
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ authenticated: Boolean(user), user });
}

