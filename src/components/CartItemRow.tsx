"use client";

import Image from "next/image";
import Link from "next/link";
import { CartItem, cartLinePrice, cartLineRegularPrice } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import { removeFromCart, updateQuantity } from "@/store/shopSlice";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";

interface CartItemRowProps {
  item: CartItem;
  /** Callback to close drawer when navigating to a product page */
  onClose?: () => void;
}

/**
 * Single item row within the Cart Drawer.
 *
 * NOTE: (§2.6) Displays product thumbnail, quantity controls, unit price, and total line calculation.
 */
export default function CartItemRow({ item, onClose }: CartItemRowProps) {
  const dispatch = useAppDispatch();
  const { product, quantity } = item;

  // MUST NOT: read product.price here; it ignores a running promotion, and the basket
  // would show one figure while the order charges another.
  const unitPrice = cartLinePrice(item);
  const regular = cartLineRegularPrice(item);
  const isDiscounted = regular !== undefined;
  const subtotal = unitPrice * quantity;

  const maxStock = product.stock;

  return (
    <div className="flex items-start gap-3 py-5 first:pt-4 last:pb-4 sm:gap-4 sm:py-6">
      {/* Product Thumbnail */}
      <Link
        href={`/catalog/${product.slug}`}
        onClick={onClose}
        className="relative block h-20 w-16 shrink-0 cursor-pointer overflow-hidden border border-neutral-200 bg-photo-bg transition-opacity hover:opacity-70 sm:h-24 sm:w-20"
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

      {/* Info & Controls Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
        <div className="flex justify-between items-start gap-3">
          <Link
            href={`/catalog/${product.slug}`}
            onClick={onClose}
            className="hover:opacity-70 transition-opacity cursor-pointer min-w-0"
          >
            <h3 className="font-montserrat line-clamp-2 text-sm font-medium leading-snug text-balance text-black sm:text-base">
              {product.nameUk}
            </h3>
            <p className="font-montserrat mt-0.5 truncate text-xs font-light text-ink-3">
              {product.name}
            </p>
          </Link>

          <div className="flex min-w-[5.25rem] shrink-0 flex-col items-end text-right tabular-nums">
            <div className="flex items-baseline justify-end gap-1.5">
              {isDiscounted && (
                <span className="font-montserrat text-xs font-light text-ink-3 line-through">
                  {regular! * quantity} ₴
                </span>
              )}
              <span
                className={`font-montserrat text-sm sm:text-base font-semibold ${
                  isDiscounted ? "text-[var(--color-sale)]" : "text-black"
                }`}
              >
                {subtotal} ₴
              </span>
            </div>
            <span className="font-montserrat min-h-[15px] pt-0.5 text-[11px] font-medium text-ink-3">
              {quantity > 1 ? `${quantity} × ${unitPrice} ₴` : ""}
            </span>
          </div>
        </div>

        {/* Bottom Row: Compact Stepper + Remove Button */}
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center border border-neutral-300 bg-white">
            <button
              type="button"
              onClick={() =>
                dispatch(updateQuantity({ productId: product.id, quantity: quantity - 1 }))
              }
              className="w-7 h-7 text-xs font-bold flex items-center justify-center hover:bg-neutral-100 transition-colors cursor-pointer text-black"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="font-montserrat text-xs font-semibold w-6 text-center text-black">
              {quantity}
            </span>
            <button
              type="button"
              disabled={quantity >= maxStock}
              onClick={() =>
                dispatch(updateQuantity({ productId: product.id, quantity: quantity + 1 }))
              }
              className="w-7 h-7 text-xs font-bold flex items-center justify-center hover:bg-neutral-100 transition-colors cursor-pointer text-black disabled:opacity-30"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => dispatch(removeFromCart({ productId: product.id }))}
            className="text-[10px] font-semibold text-ink-3 hover:text-black uppercase tracking-[0.2em] transition-colors cursor-pointer"
          >
            REMOVE
          </button>
        </div>
      </div>
    </div>
  );
}

