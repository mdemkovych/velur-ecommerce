"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearToast,
  openDrawer,
  selectLastAddedProduct,
  selectToastKind,
  selectToastTimestamp,
} from "@/store/shopSlice";

const AUTO_DISMISS_MS = 3500;

const TITLES = {
  cart: "Added to the basket",
  wishlist: "Added to the wishlist",
} as const;

/**
 * Floating confirmation toast for adding products to cart or wishlist.
 *
 * Pinned below header and auto-dismisses after timeout.
 */
export default function AddedToast() {
  const dispatch = useAppDispatch();
  const product = useAppSelector(selectLastAddedProduct);
  const kind = useAppSelector(selectToastKind);
  const timestamp = useAppSelector(selectToastTimestamp);

  useEffect(() => {
    if (!product || !timestamp) return;
    const timer = setTimeout(() => dispatch(clearToast()), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [product, timestamp, dispatch]);

  if (!product || !timestamp || !kind) return null;

  return (
    <div
      key={timestamp}
      className="pointer-events-none fixed inset-x-0 top-[var(--header-h)] z-50 flex justify-end px-4 pt-2 sm:px-8 md:px-10"
    >
      <div
        role="status"
        aria-live="polite"
        className="animate-in fade-in slide-in-from-top-2 pointer-events-auto w-full border border-black bg-white text-black duration-200 sm:w-80"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <svg
            className="w-4 h-4 shrink-0 text-black"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>

          <button
            type="button"
            onClick={() => {
              dispatch(clearToast());
              dispatch(openDrawer(kind));
            }}
            className="flex-1 text-left text-xs font-bold uppercase tracking-wider text-black hover:underline cursor-pointer"
          >
            {TITLES[kind]}
          </button>

          <button
            type="button"
            onClick={() => dispatch(clearToast())}
            className="text-ink-3 hover:text-black transition-colors cursor-pointer shrink-0"
            aria-label="Close notification"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          aria-hidden
          className="h-0.5 bg-black animate-toast-countdown"
          style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
        />
      </div>
    </div>
  );
}

