import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
 import { requireOwner } from "@/lib/auth";
 import { getSupabaseAdminClient } from "@/lib/supabase";
 import { clientIp, logAudit } from "@/lib/auditLogger";

/**
 * Owner-restricted Multi-Factor Authentication reset endpoint for staff members.
 *
 * NOTE: (§3.4, §8.1) Deletes enrolled TOTP factors for a staff member via Supabase Admin API when authenticator access is lost.
 * Disallows owner self-reset to protect owner accounts.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Only the owner may reset 2FA" }, { status: 403 });
  }

  const { id } = await props.params;

  if (id === owner.id) {
    return NextResponse.json(
      {
        error:
          "Your own two-factor sign-in is reset on the Security page, where a code " +
          "from the app is required. If the phone is lost, Supabase access is needed.",
      },
      { status: 400 },
    );
  }

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();

  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(id);
  if (lookupError || !found?.user) {
    console.error("MFA reset: could not read the account", lookupError);
    return NextResponse.json({ error: "The account could not be read" }, { status: 502 });
  }

  const factors = found.user.factors ?? [];
  if (factors.length === 0) {
    return NextResponse.json({ error: "This user has no 2FA set up" }, { status: 409 });
  }

  for (const factor of factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: id });
    if (error) {
      console.error("MFA reset failed:", error);
      return NextResponse.json({ error: "2FA could not be reset" }, { status: 502 });
    }
  }

  await logAudit({
    actor: owner.id,
    action: "MFA_RESET",
    target: target.email,
    ip: clientIp(request),
    details: { factorsRemoved: factors.length },
  });

  return NextResponse.json({ ok: true, removed: factors.length });
}

