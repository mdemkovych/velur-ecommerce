/**
 * Shared cookie option hardening for Supabase auth tokens.
 *
 * NOTE: (§3.4) Forces `httpOnly: true` and `sameSite: lax` to protect admin credentials
 * against XSS token leakage and cross-site request forgery.
 */

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  [key: string]: unknown;
}

/**
 * Enforces secure defaults on session cookie options.
 *
 * @param options Base options from Supabase SSR.
 * @returns Hardened cookie options with httpOnly and sameSite policies.
 */
export function hardenSessionCookie<T extends CookieOptions | undefined>(
  options: T,
): CookieOptions {
  return {
    ...(options ?? {}),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}

