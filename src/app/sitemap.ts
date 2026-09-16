import type { MetadataRoute } from "next";
import { getPublishedCategories, getPublishedProductRevisions } from "@/lib/db";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Generates XML sitemap including static storefront pages and dynamic product catalog entries.
 *
 * NOTE: (§7.3) Omits internal admin/checkout paths and lists public catalog items with priority ratings.
 * `lastModified` is carried only where a real timestamp exists — a legal page
 * stamped with today's date claims a revision that never happened.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const [products, categories] = await Promise.all([
    getPublishedProductRevisions(),
    getPublishedCategories(),
  ]);

  const newest = products.reduce<Date | undefined>(
    (latest, product) =>
      !latest || product.updatedAt > latest ? product.updatedAt : latest,
    undefined,
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1, lastModified: newest },
    { url: `${base}/catalog`, changeFrequency: "daily", priority: 0.9, lastModified: newest },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contacts`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/delivery`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/returns`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/offer`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${base}/catalog/category/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: newest,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${base}/catalog/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: product.updatedAt,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
