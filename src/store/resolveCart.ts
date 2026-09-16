import type {
  CartItem,
  CartNotice,
  StoredCartLine,
  StoredWishlistLine,
  WishlistItem,
} from "@/lib/types";

/**
 * Reconciles client-stored cart and wishlist item IDs against live server catalog.
 *
 * NOTE: (§3.5, §7.4) Dispatches POST /api/cart/resolve with cart lines and wishlist IDs, returning current products and price/stock adjustment notices.
 */
export async function resolveCart(
  lines: StoredCartLine[],
  options: { favourites?: StoredWishlistLine[]; signal?: AbortSignal } = {},
): Promise<{ items: CartItem[]; notices: CartNotice[]; wishlist: WishlistItem[] }> {
  const favourites = options.favourites ?? [];
  if (lines.length === 0 && favourites.length === 0) {
    return { items: [], notices: [], wishlist: [] };
  }

  const res = await fetch("/api/cart/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: lines, wishlist: favourites }),
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`Cart resolve failed: ${res.status}`);

  const data = (await res.json()) as {
    items: CartItem[];
    notices?: CartNotice[];
    wishlist?: WishlistItem[];
  };
  return { items: data.items, notices: data.notices ?? [], wishlist: data.wishlist ?? [] };
}

