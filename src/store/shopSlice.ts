import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  CartItem,
  cartLinePrice,
  CartNotice,
  Product,
  StoredCartLine,
  StoredWishlistLine,
  WishlistItem,
} from "@/lib/types";
import { RootState } from "./store";

/** Toast notification category. */
export type ToastKind = "cart" | "wishlist";

interface ShopState {
  items: CartItem[];
  wishlist: WishlistItem[];
  activeTab: "cart" | "wishlist";
  isDrawerOpen: boolean;
  lastAddedProduct: Product | null;
  toastKind: ToastKind | null;
  toastTimestamp: number | null;
  cartNotices: CartNotice[];
  /** NOTE: (§7.4) Indicates whether stored cart items have completed initial server reconciliation. */
  hydrated: boolean;
}

const initialState: ShopState = {
  items: [],
  wishlist: [],
  activeTab: "cart",
  isDrawerOpen: false,
  lastAddedProduct: null,
  toastKind: null,
  toastTimestamp: null,
  cartNotices: [],
  hydrated: false,
};

export const CART_STORAGE_KEY = "velur_cart_lines";
export const WISHLIST_STORAGE_KEY = "velur_wishlist_ids";

/** NOTE: (§3.5) Persists raw item identifiers and quantities to localStorage; prices resolve fresh from server. */
const saveToLocalStorage = (items: CartItem[], wishlist: WishlistItem[]) => {
  if (typeof window === "undefined") return;
  try {
    const lines: StoredCartLine[] = items.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    }));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    const favourites: StoredWishlistLine[] = wishlist.map(({ product }) => ({
      productId: product.id,
    }));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(favourites));
  } catch (err) {
    console.error("Failed to save to localStorage:", err);
  }
};

/** Reads stored cart item lines from localStorage. */
export function readStoredCart(): StoredCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    const merged = new Map<string, number>();
    for (const entry of parsed) {
      const line = entry as Partial<StoredCartLine>;
      if (typeof line?.productId !== "string" || typeof line?.quantity !== "number") continue;
      merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  } catch {
    return [];
  }
}

/** Reads stored wishlist product IDs from localStorage. */
export function readStoredWishlist(): StoredWishlistLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    const ids = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry === "string") ids.add(entry);
      else {
        const line = entry as Partial<StoredWishlistLine>;
        if (typeof line?.productId === "string") ids.add(line.productId);
      }
    }

    return [...ids].map((productId) => ({ productId }));
  } catch {
    return [];
  }
}

/** NOTE: (§7.4) Corrected rather than refused, and the correction is shown. */
function addLine(state: ShopState, product: Product, addQty: number): void {
  const stock = product.stock;
  const existing = state.items.find((item) => item.product.id === product.id);

  const requested = (existing?.quantity ?? 0) + addQty;
  const quantity = Math.min(requested, stock);

  if (quantity <= 0) return;

  if (existing) existing.quantity = quantity;
  else state.items.push({ product, quantity });

  if (requested > stock) {
    state.cartNotices = [
      ...state.cartNotices.filter(
        (n) => !(n.kind === "reduced" && n.nameUk === product.nameUk),
      ),
      { kind: "reduced", nameUk: product.nameUk, requested, available: stock },
    ];
  }
}

const shopSlice = createSlice({
  name: "shop",
  initialState,
  reducers: {
    markShopHydrated(state) {
      state.hydrated = true;
    },

    hydrateShop(
      state,
      action: PayloadAction<{
        items: CartItem[];
        wishlist: WishlistItem[];
        notices?: CartNotice[];
      }>,
    ) {
      state.items = action.payload.items;
      state.wishlist = action.payload.wishlist;
      state.cartNotices = action.payload.notices ?? [];
      state.hydrated = true;
      saveToLocalStorage(state.items, state.wishlist);
    },

    /** NOTE: (§4.5) Merges released order items back into active cart without overwriting existing selections. */
    restoreCart(
      state,
      action: PayloadAction<{ items: CartItem[]; notices?: CartNotice[] }>,
    ) {
      for (const restored of action.payload.items) {
        const existing = state.items.find((i) => i.product.id === restored.product.id);
        if (!existing) {
          state.items.push(restored);
          continue;
        }

        existing.quantity = Math.min(
          Math.max(existing.quantity, restored.quantity),
          restored.product.stock,
        );
        existing.product = restored.product;
      }

      state.cartNotices = action.payload.notices ?? [];
      saveToLocalStorage(state.items, state.wishlist);
    },

    addCartNotice(state, action: PayloadAction<CartNotice>) {
      state.cartNotices = [...state.cartNotices, action.payload];
    },

    dismissCartNotices(state) {
      state.cartNotices = [];
    },

    addToCart(
      state,
      action: PayloadAction<Product | { product: Product; quantity?: number }>,
    ) {
      const payloadObj =
        "product" in action.payload
          ? action.payload
          : { product: action.payload, quantity: 1 };
      const product = payloadObj.product;

      addLine(state, product, payloadObj.quantity ?? 1);

      state.lastAddedProduct = product;
      state.toastKind = "cart";
      state.toastTimestamp = Date.now();
      saveToLocalStorage(state.items, state.wishlist);
    },

    removeFromCart(state, action: PayloadAction<{ productId: string }>) {
      const { productId } = action.payload;
      state.items = state.items.filter((item) => item.product.id !== productId);
      saveToLocalStorage(state.items, state.wishlist);
    },

    updateQuantity(
      state,
      action: PayloadAction<{ productId: string; quantity: number }>,
    ) {
      const { productId, quantity } = action.payload;
      const isLine = (item: CartItem) => item.product.id === productId;

      if (quantity <= 0) {
        state.items = state.items.filter((item) => !isLine(item));
      } else {
        const existing = state.items.find(isLine);
        if (existing) {
          existing.quantity = Math.min(quantity, existing.product.stock);
        }
      }
      saveToLocalStorage(state.items, state.wishlist);
    },

    clearCart(state) {
      state.items = [];
      saveToLocalStorage(state.items, state.wishlist);
    },

    toggleWishlist(state, action: PayloadAction<{ product: Product }>) {
      const { product } = action.payload;
      const existsIndex = state.wishlist.findIndex((line) => line.product.id === product.id);
      if (existsIndex >= 0) {
        state.wishlist.splice(existsIndex, 1);
      } else {
        state.wishlist.push({ product });
        state.lastAddedProduct = product;
        state.toastKind = "wishlist";
        state.toastTimestamp = Date.now();
      }
      saveToLocalStorage(state.items, state.wishlist);
    },

    removeFromWishlist(state, action: PayloadAction<{ productId: string }>) {
      const { productId } = action.payload;
      state.wishlist = state.wishlist.filter((line) => line.product.id !== productId);
      saveToLocalStorage(state.items, state.wishlist);
    },

    moveToCart(state, action: PayloadAction<{ product: Product }>) {
      const { product } = action.payload;
      addLine(state, product, 1);
      state.wishlist = state.wishlist.filter((line) => line.product.id !== product.id);
      state.activeTab = "cart";
      saveToLocalStorage(state.items, state.wishlist);
    },

    setActiveTab(state, action: PayloadAction<"cart" | "wishlist">) {
      state.activeTab = action.payload;
    },

    openDrawer(state, action: PayloadAction<"cart" | "wishlist" | undefined>) {
      state.isDrawerOpen = true;
      if (action.payload) {
        state.activeTab = action.payload;
      }
    },

    closeDrawer(state) {
      state.isDrawerOpen = false;
    },

    toggleDrawer(state) {
      state.isDrawerOpen = !state.isDrawerOpen;
    },

    clearToast(state) {
      state.lastAddedProduct = null;
      state.toastKind = null;
      state.toastTimestamp = null;
    },
  },
});

// Backward-compatible alias exports
export const openCart = shopSlice.actions.openDrawer;
export const closeCart = shopSlice.actions.closeDrawer;
export const toggleCart = shopSlice.actions.toggleDrawer;

export const {
  hydrateShop,
  markShopHydrated,
  restoreCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  toggleWishlist,
  removeFromWishlist,
  moveToCart,
  addCartNotice,
  dismissCartNotices,
  setActiveTab,
  openDrawer,
  closeDrawer,
  toggleDrawer,
  clearToast,
} = shopSlice.actions;

/** Selectors. */
export const selectCartItems = (state: RootState): CartItem[] => state.shop.items;

/** NOTE: (§7.4) Returns hydration status. */
export const selectShopHydrated = (state: RootState): boolean => state.shop.hydrated;

export const selectWishlistItems = (state: RootState): WishlistItem[] =>
  state.shop.wishlist;

export const selectWishlistCount = (state: RootState): number =>
  state.shop.wishlist.length;

export const selectIsWishlisted = (productId: string) => (state: RootState): boolean =>
  state.shop.wishlist.some((line) => line.product.id === productId);

export const selectActiveDrawerTab = (state: RootState): "cart" | "wishlist" =>
  state.shop.activeTab;

export const selectCartTotal = (state: RootState): number =>
  state.shop.items.reduce(
    (sum, item) => sum + cartLinePrice(item) * item.quantity,
    0
  );

export const selectCartNotices = (state: RootState): CartNotice[] => state.shop.cartNotices;

export const selectCartItemCount = (state: RootState): number =>
  state.shop.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectIsDrawerOpen = (state: RootState): boolean =>
  state.shop.isDrawerOpen;

// Backward-compatible alias selector
export const selectIsCartOpen = selectIsDrawerOpen;

export const selectLastAddedProduct = (state: RootState): Product | null =>
  state.shop.lastAddedProduct;

export const selectToastTimestamp = (state: RootState): number | null =>
  state.shop.toastTimestamp;

export const selectToastKind = (state: RootState): ToastKind | null =>
  state.shop.toastKind;

export default shopSlice.reducer;

