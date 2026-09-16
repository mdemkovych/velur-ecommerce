import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientIp } from "@/lib/clientIp";
import { isRateLimited, type RateLimitRule } from "@/lib/rateLimit";
import { PENDING_PAYMENT_TTL_MINUTES } from "@/lib/types";
import { hardenSessionCookie } from "@/lib/sessionCookie";

/**
 * Next.js Edge proxy handling rate limiting, session refresh, and early administrative access guards.
 *
 * NOTE: (§3.2, §3.4, §9.7) Evaluates IP-based rate limiting rules, refreshes Supabase auth cookies, and enforces MFA assurance level checks.
 */

const RULES: { match: (path: string, method: string) => boolean; rule: RateLimitRule; message: string }[] = [
  {
    match: (p, m) => p === "/api/auth/login" && m === "POST",
    rule: { key: "login", limit: 5, windowSeconds: 60 },
    message: "Too many sign-in attempts. Wait a minute.",
  },
  {
    // NOTE: (§3.2) IP-level rate limiting for MFA verification attempts.
    match: (p, m) => p === "/api/auth/mfa/verify" && m === "POST",
    rule: { key: "mfa", limit: 10, windowSeconds: 60 },
    message: "Too many attempts. Wait a minute.",
  },
  {
    // NOTE: (§3.2, §4.4) Checkout placement rate limit window aligned with PENDING_PAYMENT_TTL_MINUTES.
    match: (p, m) => p === "/api/orders" && m === "POST",
    rule: { key: "checkout", limit: 30, windowSeconds: PENDING_PAYMENT_TTL_MINUTES * 60 },
    message:
      `Too many checkout attempts. Try again in ${PENDING_PAYMENT_TTL_MINUTES} minutes.`,
  },
  {
    match: (p) => p === "/api/monobank/create-invoice",
    rule: { key: "payment", limit: 5, windowSeconds: 60 },
    message: "Too many payment attempts. Wait a minute.",
  },
  {
    match: (p) => p === "/checkout/success",
    rule: { key: "payment-return", limit: 20, windowSeconds: 60 },
    message: "Too many requests. Try again in a minute.",
  },
  {
    match: (p) => p === "/api/monobank/return",
    rule: { key: "payment-return-legacy", limit: 30, windowSeconds: 60 },
    message: "Too many requests. Try again in a minute.",
  },
  {
    match: (p, m) => p === "/api/orders/release" && m === "POST",
    rule: { key: "order-release", limit: 10, windowSeconds: 60 },
    message: "Too many requests. Try again in a minute.",
  },
  {
    match: (p, m) => p === "/api/cart/resolve" && m === "POST",
    rule: { key: "cart", limit: 30, windowSeconds: 60 },
    message: "Too many requests. Wait a minute.",
  },
  {
    match: (p) => p === "/api/monobank/webhook",
    rule: { key: "webhook", limit: 120, windowSeconds: 60 },
    message: "Rate limit exceeded",
  },
  {
    // NOTE: (§3.2) Nova Poshta delivery directory lookup rate limiting.
    match: (p) => p.startsWith("/api/delivery/"),
    rule: { key: "delivery", limit: 300, windowSeconds: 60 },
    message:
      "The request limit for the Nova Poshta directory is exceeded. Try again in a minute " +
      "or type the address by hand.",
  },
  {
    match: (p) => p === "/api/upload",
    rule: { key: "upload", limit: 30, windowSeconds: 60 },
    message: "Too many uploads. Wait a minute.",
  },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const matched = RULES.find((entry) => entry.match(pathname, method));
  if (matched && (await isRateLimited(clientIp(request), matched.rule))) {
    const headers = { "Retry-After": String(matched.rule.windowSeconds) };

    if (!pathname.startsWith("/api/")) {
      return new NextResponse(matched.message, {
        status: 429,
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({ error: matched.message }, { status: 429, headers });
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, hardenSessionCookie(options));
          }
        },
      },
    },
  );

  // NOTE: (§3.4) Uses getUser() to validate authenticated user and write refreshed session cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.startsWith("/admin") && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // NOTE: (§3.4) Enforces AAL2 assurance corridor for /admin routes requiring multi-factor authentication.
  if (user && pathname.startsWith("/admin") && pathname !== "/admin/security") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel !== "aal2") {
      return NextResponse.redirect(new URL("/admin/security", request.url));
    }
  }

  return response;
}

export const config = {
  // NOTE: (§9.7) The paths this proxy runs before; every one of them costs an edge invocation.
  matcher: ["/admin/:path*", "/api/:path*", "/checkout/success"],
};

