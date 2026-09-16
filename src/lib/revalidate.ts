import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Centralized cache invalidation for storefront surfaces.
 *
 * NOTE: (§9.4) Dispatches tag and route invalidations to synchronize cached
 * storefront pages with database mutations.
 */

export const CATALOG_TAG = "catalog-products";

/**
 * Invalidates catalog pages and cached product data.
 */
export function revalidateCatalog(): void {
  revalidatePath("/catalog");
  revalidatePath("/catalog/[slug]", "page");
  revalidatePath("/catalog/category/[slug]", "page");
  revalidateTag(CATALOG_TAG, "seconds");
}

/**
 * Invalidates home page hero banner cache.
 */
export function revalidateHome(): void {
  revalidatePath("/");
}

