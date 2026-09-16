import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Generates robots.txt search engine crawler directives.
 *
 * NOTE: (§3.4, §8.1) Disallows admin, auth, checkout, and API routes from public indexing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();

  if (process.env.DEMO_NOINDEX === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/checkout", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

