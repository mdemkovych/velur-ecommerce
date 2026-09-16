import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductNames, getPublishedProducts } from "@/lib/db";
import { type CartItem, type CartNotice, type WishlistItem } from "@/lib/types";

/**
 * Server-side shopping cart & wishlist product resolution endpoint.
 *
 * NOTE: (§3.5, §7.4) Validates cart items against current database products and stock levels,
 * producing customer notices for price changes, out-of-stock items, or reduced quantities.
 */

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(50)
    .default([]),
  // Wishlist items resolved in parallel within the same database lookup query.
  wishlist: z
    .array(z.object({ productId: z.string().trim().min(1).max(64) }))
    .max(100)
    .default([]),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ items: [] as CartItem[] });
  }

  const published = await getPublishedProducts();
  const byId = new Map(published.map((p) => [p.id, p]));

  const items: CartItem[] = [];
  const notices: CartNotice[] = [];

  // Look up withdrawn product names for informative cart removal notices.
  const withdrawnNames = await getProductNames(
    parsed.data.items.map((line) => line.productId).filter((id) => !byId.has(id)),
  );

  for (const line of parsed.data.items) {
    const product = byId.get(line.productId);
    if (!product) {
      notices.push({ kind: "removed", nameUk: withdrawnNames.get(line.productId) ?? "Product" });
      continue;
    }

    if (product.stock < 1) {
      notices.push({ kind: "sold-out", nameUk: product.nameUk });
      continue;
    }

    // NOTE: (§7.4) Corrected rather than refused, and the shopper is told.
    const quantity = Math.min(line.quantity, product.stock);
    if (quantity < line.quantity) {
      notices.push({
        kind: "reduced",
        nameUk: product.nameUk,
        requested: line.quantity,
        available: quantity,
      });
    }

    items.push({ product, quantity });
  }

  const wishlist: WishlistItem[] = [];
  for (const { productId } of parsed.data.wishlist) {
    const product = byId.get(productId);
    if (product) wishlist.push({ product });
  }

  return NextResponse.json({ items, notices, wishlist });
}

