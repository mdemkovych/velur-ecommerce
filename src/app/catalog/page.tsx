import type { Metadata } from "next";
import { getPublishedCategories, getPublishedProducts } from "@/lib/db";
import { JsonLd } from "@/components/JsonLd";
import { catalogItemListJsonLd } from "@/lib/seo";
import { getAppUrl } from "@/lib/appUrl";
import CatalogView from "./CatalogView";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "The VELUR catalogue — body and face care, gift sets. A Ukrainian premium cosmetics brand.",
  alternates: { canonical: "/catalog" },
};

export const revalidate = 60;

/**
 * Server-rendered catalog page fetching published products and category lists.
 *
 * NOTE: (§2.4, §7.1, §9.4) Emits static catalog view with 60-second ISR TTL and on-demand tag revalidation.
 */
export default async function CatalogPage() {
  const [products, categories] = await Promise.all([getPublishedProducts(), getPublishedCategories()]);
  return (
    <>
      <JsonLd data={catalogItemListJsonLd(products, getAppUrl())} />
      <CatalogView products={products} categoryList={categories} />
    </>
  );
}

