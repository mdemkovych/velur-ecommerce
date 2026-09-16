"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { dismissCartNotices, selectCartNotices } from "@/store/shopSlice";
import type { CartNotice } from "@/lib/types";

/**
 * Displays user alerts for server-side cart adjustments (stock reduction, item removal, or released order return).
 *
 * NOTE: (§3.1, §3.5, §4.5, §7.4) Renders in quiet mode inside drawer or assertive alert banner on checkout page.
 */
function describe(notice: CartNotice): string {
  switch (notice.kind) {
    case "removed":
      return `«${notice.nameUk}» is no longer available and was removed from the basket.`;
    case "sold-out":
      return `«${notice.nameUk}» has sold out and was removed from the basket.`;
    case "reduced":
      return `«${notice.nameUk}»: ${notice.available} pcs left, the basket quantity was reduced from ${notice.requested}.`;
    case "order-released":
      return `Order ${notice.orderId} was cancelled because the payment did not complete. The items are back in the basket — change what you need and order again.`;
    case "order-release-failed":
      return `Order ${notice.orderId} could not be returned to the basket — the connection seems to have gone. The order is kept and the goods are held for you: reload the page to try again.`;
  }
}

/** Formats heading text based on most critical active notice. */
function heading(notices: CartNotice[]): string {
  if (notices.some((n) => n.kind === "order-released")) return "Order cancelled";
  if (notices.some((n) => n.kind === "order-release-failed")) {
    return "The order could not be returned";
  }
  return "The basket changed";
}

export default function CartNotices({ tone = "quiet" }: { tone?: "quiet" | "alert" }) {
  const notices = useAppSelector(selectCartNotices);
  const dispatch = useAppDispatch();

  if (notices.length === 0) return null;

  const isAlert = tone === "alert";

  const body = (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className={
        isAlert
          ? "flex items-start gap-3 border-l-4 border-l-[var(--color-sale)] border border-red-200 bg-red-50 px-4 py-3.5"
          : "mx-5 mt-4 flex items-start gap-3 border border-neutral-300 bg-neutral-50 px-4 py-3"
      }
    >
      <ul className="flex-1 space-y-1.5">
        {isAlert && (
          <li className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-sale)]">
            {heading(notices)}
          </li>
        )}
        {notices.map((notice, i) => (
          <li
            key={`${notice.kind}-${i}`}
            className={`text-[12px] leading-snug ${isAlert ? "text-red-900" : "text-neutral-700"}`}
          >
            {describe(notice)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => dispatch(dismissCartNotices())}
        aria-label={isAlert ? "Understood, continue to checkout" : "Hide the message"}
        className={
          isAlert
            ? "font-montserrat -mt-0.5 shrink-0 cursor-pointer border border-red-300 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-red-900 uppercase transition-colors hover:bg-red-100"
            : "-mt-0.5 shrink-0 cursor-pointer text-lg leading-none text-ink-3 transition-colors hover:text-black"
        }
      >
        {isAlert ? "Understood" : "×"}
      </button>
    </div>
  );

  if (!isAlert) return body;

  return (
    <div className="sticky top-[calc(var(--header-h)+3.5rem+1px)] z-30 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-8 md:px-10">{body}</div>
    </div>
  );
}

