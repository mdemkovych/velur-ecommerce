import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";

/**
 * Signs out authenticated user and invalidates Supabase session.
 *
 * NOTE: (§3.4) Revokes refresh token at Supabase Auth and logs LOGOUT audit entry.
 */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (user) {
    await logAudit({ actor: user.id, action: "LOGOUT", target: user.email, ip: clientIp(request) });
  }

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}

