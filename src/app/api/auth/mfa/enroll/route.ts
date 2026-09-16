import { NextResponse } from "next/server";
import { getPendingSessionUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";

/**
 * Multi-Factor Authentication (TOTP) enrolment initiation endpoint.
 *
 * NOTE: (§3.4) Cleans up unverified stale factors and returns new TOTP QR code & secret under MFA_ISSUER brand tag.
 */

/** Brand name displayed in authenticator apps. */
const MFA_ISSUER = "VELUR";

export async function POST(request: Request) {
  const user = await getPendingSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();

  // NOTE: (§3.4) Clean up unverified abandoned factor registrations before minting a new one.
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    console.error("MFA enrol: could not list existing factors:", listError);
    return NextResponse.json(
      { error: `The existing factors could not be read: ${listError.message}` },
      { status: 503 },
    );
  }

  for (const factor of existing?.totp ?? []) {
    if (factor.status === "verified") continue;
    const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (cleanupError) console.error("MFA enrol: stale factor not removed:", cleanupError);
  }

  // NOTE: (§3.4) Enroll new TOTP factor with MFA_ISSUER tag.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: MFA_ISSUER,
  });

  if (error || !data) {
    console.error("MFA enrol failed:", error);
    return NextResponse.json(
      { error: `Enrolment could not be started: ${error?.message ?? "unknown reason"}` },
      { status: 503 },
    );
  }

  await logAudit({
    actor: user.id,
    action: "MFA_ENROL_STARTED",
    target: user.email,
    ip: clientIp(request),
  });

  return NextResponse.json({
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  });
}

