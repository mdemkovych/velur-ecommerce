import type { ReactNode } from "react";

export type ToastTone = "error" | "success" | "info" | "plain";

const TONES: Record<ToastTone, string> = {
  /** The brand's own voice: white on black hairline. For confirmations. */
  plain: "border-black bg-white text-black",
  error: "border-red-300 bg-red-50 text-red-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  info: "border-neutral-300 bg-white text-ink-2",
};

interface Props {
  tone?: ToastTone;
  /**
   * A CSS length for the top edge — usually `var(--header-h)` or
   * `var(--admin-header-h)`, and `calc()` where a second bar sits under the
   * header. Inline rather than a class because it is a value, not a variant.
   */
  offset: string;
  /** Rendered as the close control when given; without it the toast has none. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * `alert` interrupts a screen reader, `status` waits for a pause. An error a
   * person has just caused by pressing a button is worth interrupting for; a
   * confirmation is not.
   */
  role?: "alert" | "status";
  children: ReactNode;
}

/**
 * Top-aligned notification banner pinned below header navigation.
 *
 * NOTE: (§8.2) Shared by the storefront and the panel, because a notice behaves
 * the same in both. Input styling is not shared that way.
 */
export function Toast({
  tone = "info",
  offset,
  onDismiss,
  dismissLabel = "Close message",
  role = "status",
  children,
}: Props) {
  return (
    // Full-width container with right-aligned content matching grid gutters.
    <div
      style={{ top: offset }}
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-end px-4 pt-2 sm:px-8 md:px-10"
    >
      <div
        role={role}
        aria-live={role === "alert" ? "assertive" : "polite"}
        className={`animate-toast-in pointer-events-auto w-full border sm:w-96 ${TONES[tone]}`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-xs leading-relaxed">{children}</div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="-my-2.5 -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center opacity-70 transition-opacity hover:opacity-100"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

