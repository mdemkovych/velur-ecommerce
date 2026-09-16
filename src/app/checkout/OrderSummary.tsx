"use client";

import { useState } from "react";
import Image from "next/image";
import { cartLinePrice, cartLineRegularPrice, type CartItem } from "@/lib/types";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";

interface Props {
  items: CartItem[];
  total: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  submitLabel: string;
}

function pluralizeItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "ITEM";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ITEMS";
  return "ITEMS";
}

/**
 * Checkout order summary sidebar displaying basket lines, subtotal, and responsive toggle.
 *
 * NOTE: (§2.6, §3.5) Calculates line items and discounts, collapsing into top accordion on mobile.
 */
export function OrderSummary({
  items,
  total,
  canSubmit,
  isSubmitting,
  submitLabel,
}: Props) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const isScrollable = items.length > 3;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-6 sm:p-10 xl:sticky xl:top-[152px] xl:space-y-8 xl:p-14">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 border-b border-neutral-200 pb-3 text-left sm:min-h-11 xl:pointer-events-none xl:cursor-default"
      >
        <h2 className="type-h3 text-black">Order details</h2>

        <span className="flex shrink-0 items-center gap-3">
          <span
            className={`font-montserrat text-sm font-semibold text-black tabular-nums xl:hidden ${
              isOpen ? "hidden" : "inline"
            }`}
          >
            {total} ₴
          </span>
          <span className="font-montserrat text-xs font-semibold text-ink-3">
            {count} {pluralizeItems(count)}
          </span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform duration-200 xl:hidden ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      <div className={`space-y-8 pt-8 xl:block xl:pt-0 ${isOpen ? "block" : "hidden"}`}>
      <div
        className={
          isScrollable
            ? "max-h-[300px] overflow-y-auto pr-3 custom-visible-scrollbar divide-y divide-neutral-200"
            : "divide-y divide-neutral-200"
        }
      >
        {items.map((item) => {
          const { product, quantity } = item;
          const unitPrice = cartLinePrice(item);
          const regular = cartLineRegularPrice(item);
          const isDiscounted = regular !== undefined;
          return (
            <div
              key={product.id}
              className="flex items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden border border-neutral-200 bg-photo-bg">
                  <Image
                    src={primaryMedia(product.image)}
                    alt={product.nameUk}
                    fill
                    className="object-contain"
                    sizes="56px"
                    quality={IMAGE_QUALITY}
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h4 className="font-montserrat line-clamp-2 text-sm leading-snug font-medium text-balance text-black">
                    {product.nameUk}
                  </h4>
                  <p className="font-montserrat text-xs font-medium text-ink-2">
                    {quantity} pcs
                  </p>
                </div>
              </div>
              <div className="flex min-w-[4.5rem] shrink-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right tabular-nums">
                {isDiscounted && (
                  <span className="font-montserrat text-xs font-light text-ink-3 line-through">
                    {regular! * quantity} ₴
                  </span>
                )}
                <span
                  className={`font-montserrat text-sm font-semibold sm:text-base ${
                    isDiscounted ? "text-[var(--color-sale)]" : "text-black"
                  }`}
                >
                  {unitPrice * quantity} ₴
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-ink-2 sm:text-[11px]">
          <span className="tracking-[0.18em] uppercase">Items total</span>
          <span className="font-montserrat text-black font-medium">{total} ₴</span>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-ink-2 sm:text-[11px]">
          <span className="tracking-[0.18em] uppercase">Delivery</span>
          <span className="font-montserrat shrink-0 text-right text-[10px] font-normal tracking-normal whitespace-nowrap text-ink-2 normal-case sm:text-[11px]">
            At the carrier&apos;s own rates
          </span>
        </div>

        <div className="border-t border-neutral-200 pt-4 flex items-baseline justify-between">
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-black">
            Order total
          </span>
          <span className="font-montserrat text-xl sm:text-2xl font-bold text-black">
            {total} ₴
          </span>
        </div>

        <div className="hidden xl:block">
          <SubmitOrder
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            submitLabel={submitLabel}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * Primary checkout submission trigger with pending spin animation and state validation.
 */
export function SubmitOrder({
  canSubmit,
  isSubmitting,
  submitLabel,
}: Pick<Props, "canSubmit" | "isSubmitting" | "submitLabel">) {
  return (
    <div className="space-y-4">
      <button
        type="submit"
        // NOTE: (§3.7) Locked on the first click, so an order cannot be placed twice.
        disabled={isSubmitting}
        aria-disabled={!canSubmit}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 py-4 text-xs font-bold tracking-[0.2em] uppercase transition-all duration-200 ${
          isSubmitting
            ? "cursor-not-allowed bg-neutral-200 text-ink-2"
            : canSubmit
              ? "bg-black text-white hover:bg-neutral-800"
              : "bg-neutral-200 text-ink-2 hover:bg-neutral-300"
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="h-4 w-4 animate-spin border-2 border-white/30 border-t-white" />
            <span>Processing…</span>
          </>
        ) : (
          <span>{submitLabel}</span>
        )}
      </button>
    </div>
  );
}

