import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { loginSchema } from "@/lib/validation";
import { clearAttempts, isOverLimit, recordAttempt } from "@/lib/rateLimit";
import { isAdminRole } from "@/lib/types";

/**
 * Server-side authentication endpoint verifying staff credentials and creating session.
 *
 * NOTE: (§1.2, §3.2, §3.4) Validates credentials against Supabase Auth, verifies active staff role in database,
 * applies account-level rate limiting, and emits LOGIN_SUCCESS / LOGIN_FAILED audit entries.
 */

/** NOTE: (§3.2) Account-targeted rate limiting rules (burst & daily windows). */
const LOGIN_EMAIL_RULES = [
  {
    rule: { key: "login-email-burst", limit: 5, windowSeconds: 15 * 60 },
    message: "Too many sign-in attempts for this account. Try again in 15 minutes.",
  },
  {
    rule: { key: "login-email-day", limit: 20, windowSeconds: 24 * 60 * 60 },
    message:
      "Too many failed sign-ins for this account today. " +
      "Reset the password or try tomorrow.",
  },
] as const;

/** Records a failed authentication attempt across configured rate limiting windows. */
async function recordFailedAttempt(account: string): Promise<void> {
  await Promise.all(LOGIN_EMAIL_RULES.map(({ rule }) => recordAttempt(account, rule)));
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an email and a password" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(request);

  // NOTE: (§3.2) Pre-check account rate limits before performing credential verification.
  // MUST NOT: swap this for isRateLimited; that counts successful sign-ins too, and
  // twenty in a day would lock the owner out of her own shop.
  const account = email.trim().toLowerCase();
  for (const { rule, message } of LOGIN_EMAIL_RULES) {
    if (!(await isOverLimit(account, rule))) continue;

    await logAudit({
      actor: "anonymous",
      action: "LOGIN_FAILED",
      target: email,
      ip,
      details: { reason: "rate-limited", rule: rule.key },
    });
    return NextResponse.json(
      { error: message },
      { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    await recordFailedAttempt(account);
    await logAudit({ actor: "anonymous", action: "LOGIN_FAILED", target: email, ip });
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  // NOTE: (§3.4, §8.1) Verify staff role and active status in app_users table.
  const profile = await prisma.appUser.findUnique({ where: { id: data.user.id } });
  if (!profile || !profile.isActive || !isAdminRole(profile.role)) {
    await recordFailedAttempt(account);
    await supabase.auth.signOut();
    await logAudit({
      actor: profile?.id ?? "anonymous",
      action: "LOGIN_FAILED",
      target: email,
      ip,
      details: {
        reason: profile ? "not-active-or-not-staff" : "no-profile",
        supabaseUserId: data.user.id,
      },
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  await Promise.all(LOGIN_EMAIL_RULES.map(({ rule }) => clearAttempts(account, rule)));

  // NOTE: (§3.4) Inspect Multi-Factor Authentication assurance level requirements.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = aal?.nextLevel === "aal2";

  await logAudit({
    actor: profile.id,
    action: "LOGIN_SUCCESS",
    target: profile.email,
    ip,
    ...(mfaRequired ? { details: { mfaPending: true } } : {}),
  });

  return NextResponse.json({
    mfaRequired,
    user: { id: profile.id, email: profile.email, name: profile.name, role: profile.role },
  });
}

