import type { NextConfig } from "next";

/** True only on the dev server. `'unsafe-eval'` rides on this and nowhere else (§11). */
const isDev = process.env.NODE_ENV === "development";

/**
 * The origin product media is served from (§6), derived from `SUPABASE_URL`
 * rather than written out so a moved project cannot leave a stale hostname here.
 *
 * Both the image optimiser and the CSP have to be told about it by name:
 * `next/image` refuses to optimise a host it was not given, and `img-src 'self'`
 * means the browser declines to paint the picture at all.
 *
 * Read at build time, like everything in this file, so the variable has to be
 * set before the deployment builds rather than when it runs. Absent, the entries
 * are simply not added and the policy stays as strict as it was.
 */
const supabaseOrigin = (() => {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    console.warn("SUPABASE_URL is not a valid URL — Supabase media will be blocked by CSP");
    return null;
  }
})();

/**
 * Content Security Policy.
 *
 * `script-src` keeps `'unsafe-inline'`: Next injects an inline bootstrap script
 * on every page, and the nonce alternative needs every page request routed
 * through `src/proxy.ts`, whose matcher is deliberately narrow (§11). Every
 * directive that does not depend on that is set strictly.
 *
 * No third-party origin is allowed. `next/font` self-hosts the faces, Monobank
 * is reached server-side, and Vercel Analytics is served from this origin on the
 * deployment, which `'self'` already covers.
 */
const CSP = [
  "default-src 'self'",
  // `va.vercel-scripts.com` serves the debug build of `@vercel/analytics`, and
  // only in development; the deployment loads the script from this origin.
  // Refused, it logged two CSP violations on every page load.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  // Clips are stored beside the photographs, and `media-src` has no fallback of
  // its own: without it a video falls through to `default-src 'self'` and the
  // product page shows a player that plays nothing.
  `media-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  // Card entry happens on Monobank's own page; nothing here may be framed.
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Safari applies this to localhost as well, where Chromium exempts it: on a
  // plain-HTTP dev server every stylesheet, script and font is then requested
  // over https and fails, leaving a blank page.
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Keeps the demo deployment out of search results, beside `src/app/robots.ts`.
 * robots.txt asks a crawler not to fetch; this is what keeps a URL that is
 * already known (a link the client shared) from being indexed anyway.
 */
const NOINDEX_HEADERS =
  process.env.DEMO_NOINDEX === "1"
    ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
    : [];

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Sent in production only. A browser that pins localhost to HTTPS breaks every
  // dev server on this machine, and the pin outlives the project.
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  /** Stops the dev server generating assistant instruction files in the repository root. */
  agentRules: false,

  /*
   * Drops the default `X-Powered-By: Next.js`. Not a vulnerability, and the
   * framework is obvious from the markup anyway; it is a free line in a
   * scanner's report, which is what turns a generic sweep into a targeted one
   * the day a Next.js advisory is published.
   */
  poweredByHeader: false,
  images: {
    /*
     * Next refuses a `quality` it has not been told about, so every value any
     * surface asks for has to appear here. The one in use is `IMAGE_QUALITY`
     * (`lib/media.ts`), which is also where the measurements and the reason for
     * it live; the lower values stay listed so nothing still asking for one
     * breaks.
     */
    qualities: [75, 90, 95, 98],
    /*
     * A year, because a stored photograph never changes.
     *
     * This is how long Vercel keeps an optimised variant before going back to
     * Supabase Storage, and every trip there is egress on a quota the shop pays
     * for (§6.5). Left to the default, the optimiser revalidates far more often
     * than the files ever change.
     *
     * Safe only because filenames are random and never reused: an edited
     * photograph is a new upload under a new name, never the same URL with
     * different bytes. There is nothing for a long cache to go stale against.
     *
     * Photographs only. A clip is fetched from the bucket with nothing in front
     * of it, so video costs egress on every play, which is why §6.2 caps it at
     * 4MB and 20 seconds.
     */
    minimumCacheTTL: 31536000,
    // Narrow on purpose: one host, https only, and only the public storage path
    // of this project. A wildcard here would let any Supabase project's files be
    // proxied through our own image optimiser.
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: "https" as const,
            hostname: new URL(supabaseOrigin).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS, ...NOINDEX_HEADERS] }];
  },
};

export default nextConfig;
