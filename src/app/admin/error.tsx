"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageBody, PageHeader } from "./ui";

/**
 * Isolated error boundary for administrative views.
 *
 * NOTE: (§8.1, §9.7) Retains admin shell navigation and reports client crash digest.
 */
export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled admin route error:", error);
  }, [error]);

  return (
    <PageBody narrow className="space-y-6">
      <PageHeader title="Something went wrong" />

      <div className="space-y-4 border border-neutral-200 bg-white p-6">
        <p className="text-sm leading-relaxed text-ink-2">
          Something unexpected went wrong on this screen. Order and product data
          are untouched — the failure is in rendering the page.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">
          Try reloading. If it keeps happening, pass the code below to a
          developer — it says what actually failed.
        </p>

        {error.digest ? (
          <p className="font-mono text-[11px] text-ink-3">Error code: {error.digest}</p>
        ) : (
          <p className="font-mono text-[11px] break-all text-ink-3">{error.message}</p>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-black bg-black px-6 py-3 text-[11px] font-bold tracking-[0.18em] text-white uppercase transition-colors hover:bg-neutral-800"
          >
            Try again
          </button>
          <Link
            href="/admin/orders"
            className="inline-flex min-h-11 items-center justify-center border border-black bg-white px-6 py-3 text-[11px] font-bold tracking-[0.18em] text-black uppercase transition-colors hover:bg-black hover:text-white"
          >
            To the orders
          </Link>
        </div>
      </div>
    </PageBody>
  );
}

