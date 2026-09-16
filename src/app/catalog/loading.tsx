/**
 * Skeleton loading placeholder matching catalog product grid geometry.
 *
 * NOTE: (§7.1) Prevents cumulative layout shifts during client route transitions.
 */
export default function CatalogLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="border-b border-neutral-200 bg-white sticky top-[var(--header-h)] z-40 w-full h-14" />
      <section className="w-full px-6 sm:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-[4/5] bg-neutral-100 animate-pulse" />
              <div className="h-[74px] sm:h-[82px] px-3.5 sm:px-4 pt-3 space-y-2">
                <div className="h-3 w-3/4 bg-neutral-100 animate-pulse" />
                <div className="h-3 w-1/3 bg-neutral-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

