"use client";

import { useState } from "react";
import { chargedPrice, regularPrice, type Product } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, selectCartItems } from "@/store/shopSlice";

interface AddToCartButtonProps {
  product: Product;
}

/**
 * Product detail page purchase console (price, quantity stepper, add-to-cart action).
 *
 * NOTE: (§7.4) Counts what the basket already holds, so the two cannot exceed stock together.
 */
export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [hitCeiling, setHitCeiling] = useState(false);

  const inCart =
    cartItems.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const maxStock = Math.max(0, product.stock - inCart);
  const unitPrice = chargedPrice(product);
  const regular = regularPrice(product);
  const isOnSale = regular !== undefined;
  const isOutOfStock = maxStock === 0;

  const handleDecrement = () => {
    setHitCeiling(false);
    setQty((q) => Math.max(1, q - 1));
  };

  const handleIncrement = () => {
    if (qty >= maxStock) {
      setHitCeiling(true);
      return;
    }
    setQty((q) => Math.min(maxStock, q + 1));
  };

  function handleClick() {
    if (isOutOfStock) return;
    dispatch(addToCart({ product, quantity: qty }));
    setQty(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex items-baseline gap-3 flex-wrap">
        {isOnSale && (
          <span className="font-montserrat text-2xl sm:text-3xl font-light text-ink-3 line-through">
            {regular} ₴
          </span>
        )}
        <span
          className={`font-montserrat text-3xl sm:text-4xl font-light ${
            isOnSale ? "text-[var(--color-sale)]" : "text-black"
          }`}
        >
          {unitPrice} ₴
        </span>
      </div>

      <div
        className={`grid ${
          isOutOfStock || added ? "grid-cols-1" : "grid-cols-[84px_minmax(0,1fr)] sm:grid-cols-[96px_1fr]"
        } gap-2 items-stretch transition-all duration-300 sm:gap-3`}
      >
        {/* Quantity Stepper [ -  1  + ] */}
        {!isOutOfStock && !added && (
          <div className="flex h-12 items-center justify-between border border-black bg-white px-1.5 text-black animate-in fade-in duration-200 sm:h-13 sm:px-2.5">
            <button
              onClick={handleDecrement}
              className="w-6 h-full text-sm font-bold flex items-center justify-center hover:bg-neutral-100 cursor-pointer transition-colors"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-xs sm:text-sm font-bold tabular-nums tracking-wider">
              {qty}
            </span>
            <button
              onClick={handleIncrement}
              className={`w-6 h-full text-sm font-bold flex items-center justify-center hover:bg-neutral-100 cursor-pointer transition-colors ${
                qty >= maxStock ? "text-neutral-300" : ""
              }`}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        )}

        {/* Editorial Add to Cart / Confirmation Button */}
        <button
          onClick={handleClick}
          disabled={isOutOfStock}
          className={`flex h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap border px-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-300 sm:h-13 sm:gap-2.5 sm:px-4 sm:text-xs sm:tracking-[0.16em] ${
            isOutOfStock
              ? "bg-neutral-200 text-ink-2 border-neutral-200 cursor-not-allowed w-full"
              : added
              ? "w-full bg-white text-black border-black cursor-pointer"
              : "cursor-pointer border-transparent bg-[var(--color-brand-dark)] text-white hover:bg-black"
          }`}
        >
          {isOutOfStock ? (
            <span className="tracking-[0.12em] sm:tracking-[0.2em]">OUT OF STOCK</span>
          ) : added ? (
            <span className="flex items-center justify-center gap-2.5 animate-in fade-in zoom-in-95 duration-200 w-full">
              <svg
                className="w-4 h-4 shrink-0 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="tracking-[0.14em] sm:tracking-[0.2em]">ADDED TO BASKET</span>
            </span>
          ) : (
            <>
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="tracking-[0.12em] sm:tracking-[0.16em] truncate">+ ADD TO BASKET</span>
            </>
          )}
        </button>
      </div>

      {hitCeiling && !isOutOfStock && (
        <p className="mt-3 text-[11px] font-semibold text-[var(--color-sale)] tracking-wide">
          {inCart > 0
            ? `That is all there is: ${inCart} pcs already in your basket.`
            : `${maxStock} pcs left`}
        </p>
      )}
    </div>
  );
}

