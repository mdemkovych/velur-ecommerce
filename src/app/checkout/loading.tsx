/**
 * Skeleton loading placeholder matching two-column checkout layout geometry.
 *
 * NOTE: (§7.1) Prevents layout shifts during checkout basket hydration.
 */
export default function CheckoutLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="border-b border-neutral-200 h-14" />
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 space-y-8 border-r border-neutral-200">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section} className="space-y-4">
              <div className="h-6 w-1/3 bg-neutral-100 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-[46px] bg-neutral-100 animate-pulse" />
                <div className="h-[46px] bg-neutral-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-5 bg-neutral-50 p-6 sm:p-10 lg:p-14 space-y-6">
          <div className="h-6 w-1/2 bg-neutral-200 animate-pulse" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3.5">
              <div className="w-14 h-16 bg-neutral-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-3/4 bg-neutral-200 animate-pulse" />
                <div className="h-3 w-1/4 bg-neutral-200 animate-pulse" />
              </div>
            </div>
          ))}
          <div className="h-12 w-full bg-neutral-200 animate-pulse" />
        </div>
      </div>
    </main>
  );
}

