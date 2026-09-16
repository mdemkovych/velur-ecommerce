"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary for the storefront.
 *
 * NOTE: (§9.7) Logs client errors while hiding internal stack traces from shoppers.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center bg-white text-black">
      <div className="mx-auto w-full max-w-lg px-6 py-24 sm:py-32 lg:py-40">
        <p className="type-eyebrow text-ink-3">Error</p>

        <h1 className="type-h1 mt-3">Something went wrong</h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-base">
          Something unexpected went wrong. Try again — if it keeps happening,
          write to us and quote the code below.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-ink-3">Code: {error.digest}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-black bg-black px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-neutral-800"
          >
            Try again
          </button>
          <Link
            href="/catalog"
            className="inline-flex min-h-11 items-center justify-center border border-black bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-black transition-all duration-200 hover:bg-black hover:text-white"
          >
            To the catalogue
          </Link>
        </div>
      </div>
    </main>
  );
}

