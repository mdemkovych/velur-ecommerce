"use client";

import Link from "next/link";
import Image from "next/image";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectCartItems,
  selectCartTotal,
  selectIsDrawerOpen,
  selectWishlistItems,
  selectActiveDrawerTab,
  closeDrawer,
  setActiveTab,
  removeFromWishlist,
  moveToCart,
} from "@/store/shopSlice";
import { useScrollLock } from "@/hooks/useScrollLock";
import CartItemRow from "./CartItemRow";
import CartNotices from "./CartNotices";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { chargedPrice, regularPrice } from "@/lib/types";

/**
 * Slide-over navigation drawer housing both Cart and Wishlist tabs.
 *
 * NOTE: (§3.5, §7.4) Displays product items, quantity modifiers, subtotal, and direct checkout link.
 */
export default function SideDrawer() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectIsDrawerOpen);
  const cartItems = useAppSelector(selectCartItems);
  const wishlistItems = useAppSelector(selectWishlistItems);
  const total = useAppSelector(selectCartTotal);
  const activeTab = useAppSelector(selectActiveDrawerTab);

  // Lock main page body scroll when side drawer is open
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleClose = () => dispatch(closeDrawer());

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity duration-300 animate-in fade-in"
        onClick={handleClose}
      />

      <div className="pointer-events-none fixed inset-y-0 inset-x-0 flex justify-end">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col border-l border-neutral-200 bg-white text-black animate-in slide-in-from-right duration-300 sm:max-w-[540px]">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 sm:px-6 py-3.5 sm:py-4">
            <h2 className="font-montserrat text-base font-medium uppercase tracking-[0.14em] text-black sm:text-lg">
              {activeTab === "cart" ? "Basket" : "Wishlist"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-black transition-opacity hover:opacity-70"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Tabs Navigation Bar (Cart vs Wishlist with subtle inline icons) */}
          <div className="grid grid-cols-2 border-b border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => dispatch(setActiveTab("cart"))}
              className={`flex cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-[11px] uppercase tracking-[0.14em] transition-all ${
                activeTab === "cart"
                  ? "border-black font-semibold text-black"
                  : "border-transparent font-medium text-ink-3 hover:text-black"
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span>Basket ({totalCartCount})</span>
            </button>

            <button
              type="button"
              onClick={() => dispatch(setActiveTab("wishlist"))}
              className={`flex cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-[11px] uppercase tracking-[0.14em] transition-all ${
                activeTab === "wishlist"
                  ? "border-black font-semibold text-black"
                  : "border-transparent font-medium text-ink-3 hover:text-black"
              }`}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>Wishlist ({wishlistItems.length})</span>
            </button>
          </div>

          {activeTab === "cart" && <CartNotices />}

          {/* Dynamic Scrollable Section Content Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 divide-y divide-neutral-100">
            {activeTab === "cart" ? (
              /* CART TAB CONTENT */
              cartItems.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <p className="font-montserrat text-sm font-medium uppercase tracking-[0.16em] text-ink-3">
                    Your basket is empty
                  </p>
                  <p className="font-montserrat mx-auto max-w-sm text-xs font-light leading-relaxed tracking-wide text-ink-2 sm:text-sm">
                    Pick your favourite care products from the catalogue for your daily beauty ritual.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/catalog"
                      onClick={handleClose}
                      className="inline-block bg-black px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all hover:bg-neutral-800"
                    >
                      Browse the catalogue
                    </Link>
                  </div>
                </div>
              ) : (
                cartItems.map((item) => (
                  <CartItemRow key={item.product.id} item={item} onClose={handleClose} />
                ))
              )
            ) : (
              /* WISHLIST TAB CONTENT */
              wishlistItems.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <p className="font-montserrat text-sm font-medium uppercase tracking-[0.16em] text-ink-3">
                    Your wishlist is empty
                  </p>
                  <p className="font-montserrat mx-auto max-w-sm text-xs font-light leading-relaxed tracking-wide text-ink-2 sm:text-sm">
                    Save what you like by tapping the ♡ on a product card.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/catalog"
                      onClick={handleClose}
                      className="inline-block bg-black px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all hover:bg-neutral-800"
                    >
                      Browse the catalogue
                    </Link>
                  </div>
                </div>
              ) : (
                wishlistItems.map(({ product }) => {
                  const price = chargedPrice(product);
                  const regular = regularPrice(product);
                  const soldOut = product.stock === 0;
                  const href = `/catalog/${product.slug}`;

                  return (
                  <div
                    key={product.id}
                    className="py-6 first:pt-4 last:pb-4 flex gap-4 items-start"
                  >
                    <Link
                      href={href}
                      onClick={handleClose}
                      className="relative block h-24 w-20 shrink-0 cursor-pointer overflow-hidden border border-neutral-200 bg-photo-bg transition-opacity hover:opacity-70"
                    >
                      <Image
                        src={primaryMedia(product.image)}
                        alt={product.nameUk}
                        fill
                        className="object-cover"
                        sizes="96px"
                        quality={IMAGE_QUALITY}
                      />
                    </Link>

                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                      <div className="flex justify-between items-start gap-3">
                        <Link
                          href={href}
                          onClick={handleClose}
                          className="hover:opacity-70 transition-opacity cursor-pointer min-w-0"
                        >
                          <h3 className="font-montserrat line-clamp-2 text-sm font-medium leading-snug text-black sm:text-base">
                            {product.nameUk}
                          </h3>
                          <p className="font-montserrat mt-0.5 hidden truncate text-xs font-light text-ink-3 sm:block">
                            {product.name}
                          </p>
                        </Link>

                        <div className="flex flex-col items-end shrink-0 text-right space-y-0.5 pt-0.5">
                          {regular !== undefined && (
                            <span className="font-montserrat text-xs text-ink-3 font-light line-through leading-none">
                              {regular} ₴
                            </span>
                          )}
                          <span
                            className={`font-montserrat text-sm sm:text-base font-semibold leading-snug ${
                              regular !== undefined ? "text-[var(--color-sale)]" : "text-black"
                            }`}
                          >
                            {price} ₴
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3">
                        {soldOut ? (
                          <span className="font-montserrat text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-3 border border-neutral-200 px-3 py-2">
                            OUT OF STOCK
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => dispatch(moveToCart({ product }))}
                            className="font-montserrat inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase bg-black text-white px-3 py-2 hover:bg-neutral-800 transition-all cursor-pointer"
                          >
                            <span>+ Add to basket</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            dispatch(removeFromWishlist({ productId: product.id }))
                          }
                          className="min-h-11 cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-black"
                        >
                          REMOVE
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })
              )
            )}
          </div>

          {/* Subtotal Footer (Cart tab only) */}
          {activeTab === "cart" && cartItems.length > 0 && (
            <div className="space-y-4 border-t border-neutral-200 bg-white p-6">
              <div className="space-y-2 text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase sm:text-[11px] sm:tracking-[0.14em]">
                <div className="flex justify-between gap-4">
                  <span>Items</span>
                  <span className="font-montserrat shrink-0 font-semibold text-black">{total} ₴</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Delivery</span>
                  <span className="shrink-0 text-right text-[10px] font-normal tracking-normal whitespace-nowrap text-ink-2 normal-case sm:text-[11px]">
                    At the carrier&apos;s own rates
                  </span>
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-4 border-t border-neutral-200 pt-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black">
                  To pay
                </span>
                <span className="font-montserrat shrink-0 text-xl font-semibold text-black sm:text-2xl">
                  {total} ₴
                </span>
              </div>

              <Link
                href="/checkout"
                onClick={handleClose}
                className="block w-full bg-black py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all hover:bg-neutral-800"
              >
                Place the order
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

