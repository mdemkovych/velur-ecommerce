"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { LAST_ORDER_STORAGE_KEY, OrderPlaced, type PlacedOrder } from "../OrderPlaced";
import { clearCheckoutDraft } from "../types";
import type { PaymentOutcome } from "../OrderPlaced";

/**
 * Client-side success renderer hydrating order summary lines from session storage.
 *
 * NOTE: (§3.1, §4.1) Displays order receipt while keeping customer PII out of URL parameters.
 */

const subscribe = () => () => {};
const readStored = () => sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
const readServerStored = () => null;

export function SuccessContent({
  orderId,
  outcome,
}: {
  orderId: string;
  outcome: PaymentOutcome;
}) {
  const raw = useSyncExternalStore(subscribe, readStored, readServerStored);

  let stored: PlacedOrder | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as PlacedOrder) : null;
    if (parsed && (!orderId || parsed.id === orderId)) stored = parsed;
  } catch {
    // Storage read error fallback.
  }

  const storedId = stored?.id;
  const isFinished = outcome === "paid" || outcome === "cancelled";

  useEffect(() => {
    if (!storedId || !isFinished) return;

    const raw = sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (!raw) return;
    try {
      const current = JSON.parse(raw) as PlacedOrder;
      if (current.id !== storedId || current.settled) return;
      sessionStorage.setItem(
        LAST_ORDER_STORAGE_KEY,
        JSON.stringify({ ...current, settled: true }),
      );
      clearCheckoutDraft();
    } catch {
      // Storage read error fallback.
    }
  }, [storedId, isFinished]);

  if (!stored && (!orderId || outcome === "unknown")) {
    return (
      <main className="flex flex-1 items-center bg-white text-black">
        <div className="mx-auto w-full max-w-lg px-6 py-12 sm:max-w-2xl sm:px-8 sm:py-14 lg:max-w-3xl lg:py-16">
          <p className="type-eyebrow text-ink-3">Nothing to show</p>
          <h1 className="type-h1 mt-3">Nothing here</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-base">
            This page shows the confirmation of an order just placed. If you
            placed one, it has been accepted — we sent you the number during
            checkout.
          </p>
          <Link
            href="/catalog"
            className="mt-8 inline-flex min-h-11 items-center justify-center border border-black bg-black px-6 py-3 text-[11px] font-bold tracking-[0.18em] text-white uppercase transition-all duration-200 hover:bg-neutral-800"
          >
            To the catalogue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <OrderPlaced
      order={stored ?? { id: orderId, total: 0, paymentMethod: "mono" }}
      outcome={outcome}
    />
  );
}

