"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

export interface ConfirmRequest {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Whether the confirmed action is destructive (renders primary button in red). */
  destructive?: boolean;
}

/**
 * Promise-based confirmation dialog hook replacing native window.confirm modals.
 *
 * NOTE: (§8.1, §8.4) Provides accessible modal overlay for destructive admin operations.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const settle = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      settle.current?.(false);
      settle.current = resolve;
      setRequest(next);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    settle.current?.(ok);
    settle.current = null;
    setRequest(null);
  }, []);

  const dialog = request ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
      className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85svh] w-full max-w-md space-y-5 overflow-y-auto border border-neutral-200 bg-white p-6"
      >
        <div className="space-y-1.5">
          <h2 className="text-sm font-bold tracking-[0.15em] text-black uppercase">
            {request.title}
          </h2>
          {request.body && (
            <p className="text-xs leading-relaxed text-ink-2">{request.body}</p>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`flex-1 cursor-pointer py-2.5 text-xs font-bold tracking-wider text-white uppercase transition-colors ${
              request.destructive ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-neutral-800"
            }`}
          >
            {request.confirmLabel ?? "Yes"}
          </button>
          <button
            type="button"
            onClick={() => close(false)}
            className="cursor-pointer border border-neutral-300 px-4 py-2.5 text-xs font-bold tracking-wider text-ink-2 uppercase transition-colors hover:border-black hover:text-black"
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}

