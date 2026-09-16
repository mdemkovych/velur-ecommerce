import type { ReactNode, SelectHTMLAttributes } from "react";

import { HelpTip } from "./HelpTip";
export { HelpTip };

/**
 * Shared form primitives for the admin panel.
 *
 * NOTE: (§8.2) Panel pages build from these rather than restyling inputs, and
 * these do not travel to the storefront.
 */

/**
 * Props for numeric text input fields (prices, stock, quantities).
 *
 * Text rather than number, so a scroll over a focused field cannot change a price.
 */
export const wholeNumberInput = {
  type: "text" as const,
  inputMode: "numeric" as const,
  autoComplete: "off",
};

/** Filters out non-digit characters from string input. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Admin page title typographic class. */
export const pageTitleCls =
  "font-montserrat text-lg font-bold uppercase tracking-[0.14em] text-black sm:text-xl";

/** Admin input label typographic class. */
export const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2";

/** Admin metadata typographic class. */
export const metaCls = "text-xs text-ink-2";

/**
 * Standard vector icon renderer for administrative action buttons and notices.
 */
export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name:
    | "warning"
    | "chat"
    | "parcel"
    | "note"
    | "check"
    | "trash"
    | "hide"
    | "show"
    | "pencil"
    | "archive"
    | "unarchive";
  className?: string;
}) {
  const paths: Record<typeof name, string> = {
    warning: "M12 4.5 2.8 20h18.4L12 4.5Zm0 5.5v5m0 3h.01",
    chat: "M20 12a7 7 0 0 1-7 7H8l-4 3v-4.6A7 7 0 0 1 4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7Z",
    parcel: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5m0 0 9-4.5m-9 4.5V21",
    note: "M5 3h9l5 5v13H5V3Zm9 0v5h5M8.5 13h7M8.5 17h4",
    check: "m5 13 4 4L19 7",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    hide: "M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.4 9.4 0 0112 5c5 0 9 4.5 9 7a12 12 0 01-2.4 3.3M6.2 6.9A12.5 12.5 0 003 12c0 2.5 4 7 9 7a9 9 0 003.6-.7",
    pencil: "M4 20h4l10-10a2.8 2.8 0 10-4-4L4 16v4Zm10-14 4 4",
    show: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z",
    archive: "M3.5 7.5h17M5 7.5V20h14V7.5M4 4h16v3.5H4V4Zm8 6v6m0 0 2.5-2.5M12 16l-2.5-2.5",
    unarchive: "M3.5 7.5h17M5 7.5V20h14V7.5M4 4h16v3.5H4V4Zm8 16v-6m0 0 2.5 2.5M12 14l-2.5 2.5",
  };

  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Form field explanatory note typographic class. */
export const hintCls = "text-xs leading-relaxed text-ink-2";

/**
 * Standard form input styling helper handling error highlight states.
 */
export function fieldCls(hasError = false): string {
  return [
    "w-full border px-3 py-2.5 text-base text-black sm:text-sm",
    "placeholder:text-ink-3 bg-white transition-colors",
    hasError
      ? "border-red-500 focus:border-red-600"
      : "border-neutral-300 focus:border-neutral-600",
  ].join(" ");
}

export const inputCls = fieldCls();

export const shortInputCls = `${inputCls} sm:max-w-[11rem]`;

export const textareaCls = `${inputCls} resize-none leading-relaxed`;

export function textareaClsFor(hasError = false): string {
  return `${fieldCls(hasError)} resize-none leading-relaxed`;
}

/**
 * Custom dropdown select component with styled chevron indicator.
 */
export function Select({
  hasError = false,
  compact = false,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={
          compact
            ? `w-full cursor-pointer appearance-none border bg-white py-1.5 pr-8 pl-2.5 text-[11px] font-bold tracking-wider text-black uppercase transition-colors ${
                hasError ? "border-red-500" : "border-neutral-300 hover:border-black focus:border-neutral-600"
              } ${className}`
            : `${fieldCls(hasError)} cursor-pointer appearance-none font-medium pr-9 ${className}`
        }
      />
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2 ${
          compact ? "right-2" : "right-3"
        }`}
      >
        <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * Form field wrapper organizing label, input, error, and hint descriptions.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-red-600">{error}</p>
      ) : (
        hint && <p className={hintCls}>{hint}</p>
      )}
    </div>
  );
}

/**
 * Status banner notice component for administrative forms and tables.
 */
export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    info: "bg-neutral-50 border-neutral-200 text-ink-2",
  }[kind];

  return (
    <p role={kind === "error" ? "alert" : "status"} className={`border p-3 text-xs leading-relaxed ${styles}`}>
      {children}
    </p>
  );
}

/**
 * Container panel card with optional header, description hint, and action slots.
 */
export function Card({
  title,
  hint,
  headerRight,
  children,
}: {
  title?: string;
  hint?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-neutral-200">
      {title && (
        <div className="relative space-y-1 border-b border-neutral-100 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 text-xs font-bold tracking-[0.15em] text-black uppercase">
                {title}
              </h2>
              {hint && (
                <span className="sm:hidden">
                  <HelpTip align="block">{hint}</HelpTip>
                </span>
              )}
            </span>
            {headerRight}
          </div>
          {hint && <p className={`${hintCls} hidden sm:block`}>{hint}</p>}
        </div>
      )}
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

/**
 * Standardized page header component for administrative views.
 */
export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${
        hint ? "pb-3 sm:pb-0" : ""
      }`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className={`${pageTitleCls} min-w-0`}>{title}</h1>
          {hint && (
            <span className="sm:hidden">
              <HelpTip align="block">{hint}</HelpTip>
            </span>
          )}
        </div>
        {hint && <p className={`${hintCls} hidden max-w-4xl sm:block`}>{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export const PAGE_GUTTER = "px-4 sm:px-10";

/**
 * Standardized content container providing page gutters and layout constraints.
 */
export function PageBody({
  children,
  className = "",
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={`w-full ${PAGE_GUTTER} py-10 sm:py-14 ${narrow ? "mx-auto max-w-[1600px]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

