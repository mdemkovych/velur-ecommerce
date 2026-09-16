"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { chargedPrice, regularPrice, type Product } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, selectCartItems, toggleWishlist, selectIsWishlisted } from "@/store/shopSlice";
import { getBadge } from "@/lib/getBadge";
import { cn } from "@/lib/cn";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { useHasMounted } from "@/hooks/useHasMounted";

interface ProductCardProps {
  product: Product;
}

/**
 * Catalog grid product card displaying media, badges, wishlist toggle, and quick-add controls.
 *
 * NOTE: (§2.3, §2.6, §7.1) Renders responsive 4:5 visual ratio and price formatting.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const [added, setAdded] = useState(false);

  const isWishlisted = useAppSelector(selectIsWishlisted(product.id));
  const hasMounted = useHasMounted();
  const showsWishlisted = hasMounted && isWishlisted;

  const price = chargedPrice(product);
  const regular = regularPrice(product);
  const isOnSale = regular !== undefined;

  const inCart = cartItems
    .filter((i) => i.product.id === product.id)
    .reduce((sum, i) => sum + i.quantity, 0);
  const soldOut = product.stock === 0;
  const allInCart = !soldOut && product.stock - inCart <= 0;
  const maxAddable = Math.max(0, product.stock - inCart);

  const [rawQty, setRawQty] = useState(1);
  const qty = Math.min(Math.max(1, rawQty), Math.max(1, maxAddable));

  const step = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setRawQty(Math.min(Math.max(1, qty + delta), Math.max(1, maxAddable)));
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(addToCart({ product, quantity: qty }));
    setRawQty(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleWishlist({ product }));
  };

  const badge = getBadge(product);
  const href = `/catalog/${product.slug}`;

  return (
    <div className="radius-card group relative flex h-full flex-col overflow-hidden border border-neutral-200 bg-white transition-colors duration-300 hover:border-black">
      <Link
        href={href}
        className="relative block aspect-[4/5] flex-auto overflow-hidden bg-photo-bg"
      >
        <Image
          src={primaryMedia(product.image)}
          alt={product.nameUk}
          fill
          className={cn(
            "object-cover transition-opacity duration-300",
            soldOut && "grayscale opacity-50",
          )}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          quality={IMAGE_QUALITY}
        />
        {soldOut && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
      </Link>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        {badge ? (
          <span
            className={cn(
              "min-w-0 text-[11px] leading-tight font-medium tracking-[0.12em] text-balance lowercase",
              badge.variant === "sale" ? "text-[var(--color-sale)]" : "text-black",
            )}
          >
            {badge.text.toLowerCase()}
          </span>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleToggleWishlist}
          className="pointer-events-auto -mt-1 shrink-0 cursor-pointer border-0 bg-transparent p-1 text-black"
          aria-label={showsWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          title={showsWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg
            className="h-5 w-5"
            fill={showsWishlisted ? "black" : "none"}
            stroke="currentColor"
            strokeWidth="1.3"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <div className="relative bg-white px-3 pb-3.5 pt-3 sm:px-4 sm:pb-4">
        <Link href={href} className="block">
          <h3 className="font-montserrat line-clamp-2 text-xs font-medium leading-snug text-balance text-black sm:text-sm">
            {product.nameUk}
          </h3>

          <div className="mt-1 flex items-baseline justify-between gap-2">
            <p className="font-montserrat hidden min-w-0 truncate text-[11px] font-light text-ink-3 sm:block">
              {product.name}
            </p>

            <div className="flex shrink-0 items-baseline gap-1.5">
              {isOnSale && (
                <span className="font-montserrat text-[11px] font-light text-ink-3 line-through sm:text-xs">
                  {regular} ₴
                </span>
              )}
              <span
                className={cn(
                  "font-montserrat text-sm font-semibold",
                  isOnSale ? "text-[var(--color-sale)]" : "text-black",
                )}
              >
                {price} ₴
              </span>
            </div>
          </div>
        </Link>

        <div className="mt-3 hidden tablet:block">
          <div className="flex items-stretch gap-1.5">
            {!soldOut && !allInCart && (
              <div className="flex shrink-0 items-center border border-line-2 bg-white">
                <button
                  type="button"
                  onClick={(e) => step(e, -1)}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-8 w-7 cursor-pointer items-center justify-center text-sm font-bold text-black transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                >
                  −
                </button>
                <span className="min-w-4 text-center text-[11px] font-bold tabular-nums text-black">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => step(e, 1)}
                  disabled={qty >= maxAddable}
                  aria-label="Increase quantity"
                  className="flex h-8 w-7 cursor-pointer items-center justify-center text-sm font-bold text-black transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                >
                  +
                </button>
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={soldOut || allInCart}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 truncate border px-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-200 xl:text-[11px]",
                soldOut
                  ? "cursor-not-allowed border-neutral-200 bg-neutral-200 text-ink-2"
                  : allInCart
                    ? "cursor-not-allowed border-neutral-300 bg-white text-ink-2"
                    : added
                      ? "cursor-pointer border-black bg-white text-black"
                      : "cursor-pointer border-transparent bg-[var(--color-brand-dark)] text-white hover:bg-black",
              )}
            >
              <span className="truncate">
                {soldOut
                  ? "None"
                  : allInCart
                    ? "All in the basket"
                    : added
                      ? "Added"
                      : "Add to basket"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

