/**
 * Skeleton loading placeholder matching product detail page layout geometry.
 *
 * NOTE: (§7.1) Prevents cumulative layout shifts during product detail transitions.
 */
export default function ProductLoading() {
  return (
    <main className="flex-1 bg-white">
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-10 lg:gap-16 items-start">
          <div className="md:col-span-6">
            <div className="aspect-[4/5] bg-neutral-100 animate-pulse" />
          </div>
          <div className="md:col-span-6 space-y-5 pt-4">
            <div className="h-3 w-40 bg-neutral-100 animate-pulse" />
            <div className="h-8 w-3/4 bg-neutral-100 animate-pulse" />
            <div className="h-4 w-1/3 bg-neutral-100 animate-pulse" />
            <div className="h-10 w-1/4 bg-neutral-100 animate-pulse" />
            <div className="h-14 w-full bg-neutral-100 animate-pulse" />
            <div className="space-y-3 pt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 border-b border-neutral-200" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

