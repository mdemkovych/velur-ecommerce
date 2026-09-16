import { getAllProducts, getCategories } from "@/lib/db";
import { ProductsView } from "./ProductsView";

/**
 * Server page pre-rendering initial catalogue products and categories.
 *
 * NOTE: (§8.1, §8.4) Loads full product list and category definitions for initial SSR paint.
 */
export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);

  return <ProductsView initialProducts={products} initialCategories={categories} />;
}

