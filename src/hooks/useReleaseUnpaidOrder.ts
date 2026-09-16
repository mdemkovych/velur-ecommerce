"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { addCartNotice, restoreCart } from "@/store/shopSlice";
import { resolveCart } from "@/store/resolveCart";
import { LAST_ORDER_STORAGE_KEY, type PlacedOrder } from "@/app/checkout/OrderPlaced";
import { hasReleasableOrder } from "@/app/checkout/types";

/**
 * Manages order cancellation and cart item restoration when customer navigates back from payment gateway.
 *
 * NOTE: (§3.1, §4.5) Handles back-forward cache restoration via pageshow event, advisory release requests, and scroll reset.
 */
export function useReleaseUnpaidOrder(onRestored: () => void): { isReleasing: boolean } {
  const dispatch = useAppDispatch();

  // Stores callback in ref to prevent effect re-runs on render.
  const onPageRestored = useRef(onRestored);
  useEffect(() => {
    onPageRestored.current = onRestored;
  });

  // Indicates active release and cart restoration operation.
  const [isReleasing, setIsReleasing] = useState(hasReleasableOrder);

  // NOTE: (§3.1, §4.5) Initiates unpick and release request for abandoned orders.
  useEffect(() => {
    const controller = new AbortController();
    let running = false;

    // Temporarily sets manual scroll restoration during checkout return.
    const returnToTop = () => {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
    };

    const releaseUnpaidOrder = async (): Promise<void> => {
      const raw = sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
      if (!raw) {
        setIsReleasing(false);
        return;
      }

      let stored: PlacedOrder;
      try {
        stored = JSON.parse(raw) as PlacedOrder;
      } catch {
        sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
        setIsReleasing(false);
        return;
      }

      const { id, paymentToken, settled } = stored;
      if (!id || !paymentToken) {
        setIsReleasing(false);
        return;
      }

      // Skips release logic if order has already been settled.
      if (settled) {
        setIsReleasing(false);
        return;
      }

      if (running) return;
      running = true;
      setIsReleasing(true);
      returnToTop();

      try {
        const res = await fetch("/api/orders/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: id, paymentToken }),
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          lines?: { productId: string; quantity: number }[];
          settled?: boolean;
        };

        if (res.ok && data.lines) {
          sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);

          const { items, notices } = await resolveCart(data.lines, { signal: controller.signal });
          dispatch(
            restoreCart({
              items,
              notices: [...notices, { kind: "order-released", orderId: id }],
            }),
          );
          returnToTop();
          return;
        }

        if (data.settled) {
          window.location.replace(
            `/checkout/success?orderId=${encodeURIComponent(id)}&t=${encodeURIComponent(
              paymentToken,
            )}`,
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Failed to release the unpaid order:", err);
        dispatch(addCartNotice({ kind: "order-release-failed", orderId: id }));
      } finally {
        running = false;
        setIsReleasing(false);
      }
    };

    void releaseUnpaidOrder();

    // NOTE: (§3.1) Handles back-forward cache restoration on pageshow.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      onPageRestored.current();
      void releaseUnpaidOrder();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      controller.abort();
      window.removeEventListener("pageshow", onPageShow);
      if ("scrollRestoration" in history) history.scrollRestoration = "auto";
    };
  }, [dispatch]);

  return { isReleasing };
}

