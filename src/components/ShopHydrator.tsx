"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  hydrateShop,
  markShopHydrated,
  readStoredCart,
  readStoredWishlist,
} from "@/store/shopSlice";
import { resolveCart } from "@/store/resolveCart";

/**
 * Restores cart and wishlist items from localStorage identifiers on initial client mount.
 *
 * NOTE: (§3.5, §7.4) Initiates server reconciliation via resolveCart to ensure fresh pricing and stock availability.
 */
export default function ShopHydrator() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const lines = readStoredCart();
    const favourites = readStoredWishlist();
    if (lines.length === 0 && favourites.length === 0) {
      dispatch(markShopHydrated());
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const { items, notices, wishlist } = await resolveCart(lines, {
          favourites,
          signal: controller.signal,
        });

        dispatch(hydrateShop({ items, wishlist, notices }));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to restore the basket:", err);
          dispatch(markShopHydrated());
        }
      }
    })();

    return () => controller.abort();
  }, [dispatch]);

  return null;
}

