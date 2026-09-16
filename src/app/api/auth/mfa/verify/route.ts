import { NextResponse } from "next/server";
import { z } from "zod";
import { getPendingSessionUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { clearAttempts, isOverLimit, recordAttempt } from "@/lib/rateLimit";

/**
 * TOTP verification endpoint elevating session to AAL2.
 *
 * NOTE: (§3.2, §3.4) Enforces per-account rate limits, verifies TOTP challenge via Supabase Auth, and logs MFA_VERIFIED / MFA_FAILED audit entries.
 */

const bodySchema = z.object({
  factorId: z.string().trim().max(64).optional(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The code is six digits"),
});

/** NOTE: (§3.2) Account-level rate limiting rules for TOTP verification. */
const MFA_RULES = [
  {
    rule: { key: "mfa-burst", limit: 5, windowSeconds: 15 * 60 },
    message: "Too many attempts. Try again in 15 minutes.",
  },
  {
    rule: { key: "mfa-day", limit: 20, windowSeconds: 24 * 60 * 60 },
    message: "Too many failed attempts today. Use account recovery.",
  },
] as const;

export async function POST(request: Request) {
  // MUST NOT: accept this as a sign-in on its own; the code proves the second factor,
  // never the first, so a password session is the floor.
  const user = await getPendingSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed code" },
      { status: 400 },
    );
  }

  const ip = clientIp(request);

  // NOTE: (§3.2) Account-level rate limit inspection.
  for (const { rule, message } of MFA_RULES) {
    if (!(await isOverLimit(user.id, rule))) continue;
    await logAudit({
      actor: user.id,
      action: "MFA_FAILED",
      target: user.email,
      ip,
      details: { reason: "rate-limited", rule: rule.key },
    });
    return NextResponse.json(
      { error: message },
      { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } },
    );
  }

  const supabase = await getSupabaseServerClient();

  let factorId = parsed.data.factorId;
  if (!factorId) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    factorId = factors?.totp?.find((factor) => factor.status === "verified")?.id;
  }
  if (!factorId) {
    return NextResponse.json({ error: "Two-factor sign-in is not set up" }, { status: 409 });
  }

  // NOTE: (§3.4) Challenge and verify TOTP code with Supabase Auth.
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: parsed.data.code,
  });

  if (error) {
    await Promise.all(MFA_RULES.map(({ rule }) => recordAttempt(user.id, rule)));
    await logAudit({ actor: user.id, action: "MFA_FAILED", target: user.email, ip });
    return NextResponse.json({ error: "Wrong code. Try again." }, { status: 401 });
  }

  await Promise.all(MFA_RULES.map(({ rule }) => clearAttempts(user.id, rule)));
  await logAudit({ actor: user.id, action: "MFA_VERIFIED", target: user.email, ip });

  return NextResponse.json({ ok: true });
}

