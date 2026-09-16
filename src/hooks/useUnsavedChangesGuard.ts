"use client";

import { useEffect } from "react";

/**
 * NOTE: (§8.2) Both exits a manager takes: closing the tab and clicking an
 * internal link.
 *
 * Prompts user confirmation before navigating away from dirty administrative forms.
 *
 * Attaches window beforeunload handler for browser exits and capturing click handler for internal SPA links.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string): void {
  // Native browser prompt on window beforeunload.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Captures internal client-side navigation clicks.
  useEffect(() => {
    if (!isDirty) return;

    const guard = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (new URL(href, window.location.href).pathname === window.location.pathname) return;

      if (!window.confirm(message)) e.preventDefault();
    };

    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [isDirty, message]);
}

