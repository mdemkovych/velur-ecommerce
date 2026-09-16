"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectCartItemCount,
  openDrawer,
} from "@/store/shopSlice";

/**
 * Storefront header action buttons for opening Wishlist and Cart drawers.
 */
export default function HeaderShopActions() {
  const dispatch = useAppDispatch();
  const cartCount = useAppSelector(selectCartItemCount);

  return (
    <div className="flex items-center lg:gap-2">
      {/* Wishlist Heart Icon (Borderless & Countless) */}
      <button
        type="button"
        onClick={() => dispatch(openDrawer("wishlist"))}
        aria-label="Wishlist"
        className="flex h-11 w-10 cursor-pointer items-center justify-center text-black transition-opacity hover:opacity-70 lg:w-11"
        title="Wishlist"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => dispatch(openDrawer("cart"))}
        aria-label={`Basket (${cartCount})`}
        className="flex h-11 w-10 cursor-pointer items-center justify-center border border-transparent bg-transparent text-black transition-all duration-200 hover:opacity-70 lg:w-auto lg:gap-2 lg:border-black lg:bg-white lg:px-3.5 lg:hover:opacity-100 lg:hover:bg-black lg:hover:text-white"
        title="Basket"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>

        {cartCount > 0 && (
          <span className="hidden text-sm font-semibold leading-none tabular-nums lg:inline">
            {cartCount}
          </span>
        )}
      </button>
    </div>
  );
}

