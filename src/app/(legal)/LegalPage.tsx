import type { ReactNode } from "react";

/**
 * Shared container layout for public legal agreements and compliance documentation.
 *
 * NOTE: (§3.1, §7.3) Monobank acquiring compliance layout formatted with justified typography and hyphenation.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 bg-white text-black">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
        <h1 className="type-h1">{title}</h1>
        {intro && (
          <p className="mt-4 hyphens-auto text-justify text-sm leading-relaxed text-ink-2 sm:text-base">
            {intro}
          </p>
        )}

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink-2 hyphens-auto text-justify sm:text-base">
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * Numbered legal clause section with standardized heading styling.
 */
export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="type-h3 text-black">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

