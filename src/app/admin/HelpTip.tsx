"use client";

import { useState, type ReactNode } from "react";

/**
 * Interactive contextual tooltip popup with touch blur-to-dismiss support.
 *
 * NOTE: (§8.1) Provides field instructions on hover and mobile click without disrupting layout flow.
 */
export function HelpTip({
  children,
  align = "end",
}: {
  children: ReactNode;
  align?: "block" | "end";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`group shrink-0 ${align === "block" ? "" : "relative"}`}>
      <button
        type="button"
        aria-label="Explanation"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex h-5 w-5 items-center justify-center border border-neutral-300 text-[10px] font-bold text-ink-2 transition-colors hover:border-black hover:text-black cursor-help"
      >
        ?
      </button>
      <span
        className={`pointer-events-none absolute top-full z-20 border border-neutral-200 bg-white p-3 text-left text-xs leading-relaxed text-ink-2 transition-opacity group-hover:visible group-hover:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        } ${
          align === "block"
            ? "inset-x-4 -mt-3 w-auto"
            : "right-0 mt-2 w-[min(18rem,calc(100vw-3rem))]"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

