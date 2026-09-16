import { useEffect } from "react";

/**
 * Locks document body scrolling and compensates for scrollbar layout shift when modal/drawer opens.
 *
 * Measures scrollbar width dynamically to prevent horizontal layout jumping.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { body, documentElement: html } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const existing = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${existing + scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [locked]);
}

