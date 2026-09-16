import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthState } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";

/**
 * Staff Multi-Factor Authentication state inspection and de-enrolment endpoint.
 *
 * NOTE: (§3.4) Provides factor status verification (GET) and secure factor de-enrolment requiring active TOTP code challenge (DELETE).
 */
export async function GET() {
  const state = await getAuthState();
  if (!state) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json({ hasFactor: state.hasFactor, mfaSatisfied: state.mfaSatisfied });
}

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The code is six digits"),
});

/**
 * Removes verified TOTP factor from the current session after validating a fresh TOTP challenge.
 *
 * NOTE: (§3.4) Requires both an active MFA session and a live TOTP code to prevent unauthorized factor removal.
 */
export async function DELETE(request: Request) {
  const state = await getAuthState();
  if (!state || !state.mfaSatisfied) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed code" },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((row) => row.status === "verified");
  if (!factor) {
    return NextResponse.json({ error: "Two-factor sign-in is not set up" }, { status: 409 });
  }

  const { error: codeError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (codeError) {
    await logAudit({
      actor: state.user.id,
      action: "MFA_FAILED",
      target: state.user.email,
      ip: clientIp(request),
      details: { during: "unenrol" },
    });
    return NextResponse.json({ error: "Wrong code." }, { status: 401 });
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) {
    console.error("MFA unenrol failed:", error);
    return NextResponse.json({ error: "It could not be switched off." }, { status: 500 });
  }

  await logAudit({
    actor: state.user.id,
    action: "MFA_DISABLED",
    target: state.user.email,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

