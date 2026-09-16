import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

/**
 * 404 Not Found fallback view for unmatched routes.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center bg-white text-black">
      <div className="mx-auto w-full max-w-lg px-6 py-24 sm:py-32 lg:py-40">
        <p className="type-eyebrow text-ink-3">Error 404</p>

        <h1 className="type-h1 mt-3">Page not found</h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-base">
          This page does not seem to exist, has moved, or the address has a typo.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/catalog"
            className="inline-flex min-h-11 items-center justify-center border border-black bg-black px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-neutral-800"
          >
            To the catalogue
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-black bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-black transition-all duration-200 hover:bg-black hover:text-white"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

