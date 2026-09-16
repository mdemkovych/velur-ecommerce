/**
 * Resolves client IP address for rate limiting and security audit logging.
 *
 * NOTE: (§3.2) Platform-verified headers (Vercel, Cloudflare) take precedence
 * over client-mutable `x-forwarded-for` to prevent rate-limit spoofing.
 *
 * @param request Request containing headers map.
 * @returns Resolved IP string or "unknown".
 */
export function clientIp(request: { headers: { get(name: string): string | null } }): string {
  const trusted =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  if (trusted?.trim()) return trusted.trim();

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

