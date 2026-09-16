"use client";

import { useState } from "react";
import Image from "next/image";
import { IMAGE_QUALITY } from "@/lib/media";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { restoreCart } from "@/store/shopSlice";
import { resolveCart } from "@/store/resolveCart";
import type { PaymentMethod } from "@/lib/types";

// MUST NOT: replace this with an endpoint returning an order by id; ids are short
// and dated, so anything readable by id is readable by guessing (§3.1).
export const LAST_ORDER_STORAGE_KEY = "velur_last_order";

export interface PlacedOrderLine {
  nameUk: string;
  quantity: number;
  /** Line total in whole hryvnia (unit price * quantity). */
  sum: number;
  /** Primary media asset URL. */
  image: string;
}

const VISIBLE_LINES = 3;

const BUTTON_BASE =
  "inline-flex min-h-11 w-full items-center justify-center px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-200 sm:w-auto sm:flex-1";
const BUTTON_PRIMARY = `${BUTTON_BASE} border border-black bg-black text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60`;
const BUTTON_SECONDARY = `${BUTTON_BASE} border border-black bg-white text-black hover:bg-neutral-50`;

/** Payment outcome states resolved from Monobank return status. */
export type PaymentOutcome =
  | "paid"
  | "processing"
  | "pending"
  | "failed"
  | "cancelled"
  | "unknown";

export interface PlacedOrder {
  id: string;
  total: number;
  paymentMethod: PaymentMethod;
  /** Placed order line items stored in session memory (§3.1). */
  lines?: PlacedOrderLine[];
  /** Formatted delivery recipient destination. */
  deliveryTo?: string;
  /** HMAC-signed order payment token (§3.1). */
  paymentToken?: string;
  /** Whether the order state has reached terminal settlement. */
  settled?: boolean;
}

/**
 * Order confirmation receipt and status display component.
 *
 * NOTE: (§3.1, §4.1, §4.5) Handles payment retry, release back into cart, and multi-state confirmation copy.
 */
export function OrderPlaced({
  order,
  outcome = "pending",
}: {
  order: PlacedOrder;
  outcome?: PaymentOutcome;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [showAllLines, setShowAllLines] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const canRetry = outcome === "failed" && Boolean(order.paymentToken);

  async function retryPayment() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/monobank/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, paymentToken: order.paymentToken }),
      });
      const data = await res.json();

      if (res.ok && data.pageUrl) {
        window.location.href = data.pageUrl;
        return;
      }

      setRetryError(data.error ?? "The payment page could not be opened. Try again later.");
    } catch {
      setRetryError("The bank could not be reached. Check your connection and try again.");
    }
    setIsRetrying(false);
  }

  const canCancel = outcome === "failed" && Boolean(order.paymentToken);

  async function cancelOrder() {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/orders/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, paymentToken: order.paymentToken }),
      });
      const data = (await res.json()) as {
        lines?: { productId: string; quantity: number }[];
        error?: string;
      };

      if (res.ok && data.lines) {
        sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);

        const { items, notices } = await resolveCart(data.lines);
        dispatch(
          restoreCart({
            items,
            notices: [...notices, { kind: "order-released", orderId: order.id }],
          }),
        );
        router.push("/checkout");
        return;
      }

      setCancelError(data.error ?? "The order could not be cancelled. Try again.");
    } catch {
      setCancelError("The shop could not be reached. Check your connection and try again.");
    }
    setIsCancelling(false);
  }

  const lines = order.lines ?? [];
  const shownLines = showAllLines ? lines : lines.slice(0, VISIBLE_LINES);
  const hiddenCount = lines.length - shownLines.length;

  return (
    <main className="flex flex-1 items-center bg-white text-black">
      <div className="mx-auto w-full max-w-lg px-6 py-12 sm:max-w-2xl sm:px-8 sm:py-14 lg:max-w-3xl lg:py-16">
        <p className="type-eyebrow text-ink-3">
          {outcome === "paid"
            ? "Payment confirmed"
            : outcome === "failed"
              ? "Payment not completed"
              : outcome === "processing"
                ? "Waiting for the bank"
                : outcome === "cancelled"
                  ? "Order cancelled"
                  : outcome === "unknown"
                    ? "Order"
                    : "Order accepted"}
        </p>

        <h1 className="type-h1 mt-3">
          {outcome === "failed"
            ? "The order is awaiting payment"
            : outcome === "processing"
              ? "Payment is being processed"
              : outcome === "cancelled"
                ? "The payment window has passed"
                : outcome === "unknown"
                  ? "Your order"
                  : "Thank you for your order"}
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-base">
          {outcome === "paid"
            ? "The payment went through. We are preparing your order and will tell you as soon as it is handed to the carrier."
            : outcome === "failed"
              ? "Payment was not completed — the order is kept and the goods are held for you. You can try paying again or wait for a call from a manager."
              : outcome === "processing"
                ? "We have not had confirmation from the bank yet. If you have just paid, reload the page in a minute and the status will appear on its own. There is nothing to pay again."
              : outcome === "unknown"
                ? "The link to this order has expired, so the payment state is no longer shown here. If the payment went through, the order is already being prepared. If it was not completed, the order was cancelled, the goods went back on sale, and it can be placed again."
              : outcome === "cancelled"
                ? "The payment was not completed in time, so the order was cancelled and the goods went back on sale. If you still want them, place the order again."
                : "We will confirm the payment and get in touch about dispatch. Keep the order number: it is the quickest way for us to find your order."}
        </p>

        {lines.length > 0 && (
          <>
            <ul className="mt-8 divide-y divide-neutral-200 border-t border-neutral-200">
              {shownLines.map((line, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="relative block h-16 w-14 shrink-0 overflow-hidden border border-neutral-200 bg-photo-bg">
                      <Image
                        src={line.image}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="56px"
                        quality={IMAGE_QUALITY}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug text-balance text-black">
                        {line.nameUk}
                      </span>
                      <span className="font-montserrat block text-xs text-ink-3">
                        {line.quantity} pcs
                      </span>
                    </span>
                  </span>
                  <span className="font-montserrat min-w-[4.5rem] shrink-0 text-right text-sm font-semibold text-black tabular-nums">
                    {line.sum} ₴
                  </span>
                </li>
              ))}
            </ul>

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllLines(true)}
                className="link-underline font-montserrat mt-3 inline-flex min-h-11 cursor-pointer items-center text-[11px] font-bold tracking-[0.18em] text-black uppercase"
              >
                Show all items ({lines.length})
              </button>
            )}
          </>
        )}

        <dl
          className={`space-y-2 border-y border-neutral-200 py-4 text-sm ${
            lines.length > 0 ? "border-t-0 mt-4" : "mt-8"
          }`}
        >
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">Order number</dt>
            <dd className="font-montserrat font-semibold text-black">{order.id}</dd>
          </div>
          {order.deliveryTo && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-3">Delivery</dt>
              <dd className="text-right text-black">{order.deliveryTo}</dd>
            </div>
          )}
          {order.total > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Total</dt>
              <dd className="font-montserrat font-semibold text-black tabular-nums">
                {order.total} ₴
              </dd>
            </div>
          )}
        </dl>

        {retryError && (
          <p
            role="alert"
            className="mt-8 border border-red-200 bg-red-50 p-3 text-[11px] leading-relaxed text-red-700"
          >
            {retryError}
          </p>
        )}

        {isConfirmingCancel ? (
          <div className={`space-y-4 ${cancelError ? "mt-4" : "mt-8"}`}>
            <p className="text-sm leading-relaxed text-ink-2">
              Order {order.id} will be cancelled and the items will return to your basket.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsConfirmingCancel(false)}
                disabled={isCancelling}
                className={BUTTON_PRIMARY}
              >
                Keep the order
              </button>
              <button
                type="button"
                onClick={cancelOrder}
                disabled={isCancelling}
                className={BUTTON_SECONDARY}
              >
                {isCancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col gap-3 sm:flex-row ${retryError || cancelError ? "mt-4" : "mt-8"}`}>
            {canRetry && (
              <button type="button" onClick={retryPayment} disabled={isRetrying} className={BUTTON_PRIMARY}>
                {isRetrying ? "Opening the payment page…" : "Try paying again"}
              </button>
            )}

            {canCancel ? (
              <button
                type="button"
                onClick={() => setIsConfirmingCancel(true)}
                className={canRetry ? BUTTON_SECONDARY : BUTTON_PRIMARY}
              >
                Cancel the order
              </button>
            ) : (
              <Link href="/catalog" className={canRetry ? BUTTON_SECONDARY : BUTTON_PRIMARY}>
                Back to the catalogue
              </Link>
            )}
          </div>
        )}

        {cancelError && (
          <p
            role="alert"
            className="mt-4 border border-red-200 bg-red-50 p-3 text-[11px] leading-relaxed text-red-700"
          >
            {cancelError}
          </p>
        )}
      </div>
    </main>
  );
}

