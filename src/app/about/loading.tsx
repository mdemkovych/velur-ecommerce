/**
 * Loading skeleton for the brand editorial page.
 */
export default function AboutLoading() {
  return (
    <main className="flex-1 bg-white max-w-4xl mx-auto px-6 sm:px-10 py-16 space-y-6">
      <div className="h-3 w-32 bg-neutral-100 animate-pulse" />
      <div className="h-10 w-2/3 bg-neutral-100 animate-pulse" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-4 w-full bg-neutral-100 animate-pulse" />
      ))}
    </main>
  );
}

