import "server-only";

/**
 * Resolves the canonical base application URL for callbacks and redirects.
 *
 * NOTE: (§3.1) Resolved strictly from environment configuration in production
 * to prevent callback URL hijacking via spoofed Origin/Host headers.
 *
 * @param request Optional request used only for development fallback origin.
 * @returns Fully qualified base URL string without trailing slash.
 */
export function getAppUrl(request?: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL is not set — cannot build payment callback URLs");
  }

  return request ? new URL(request.url).origin : "http://localhost:3000";
}

