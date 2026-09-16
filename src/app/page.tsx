import { Metadata } from "next";
import HeroBanners from "@/components/HeroBanners";
import { getActiveBanners } from "@/lib/db";

// Title and description come from the root layout: the home page states exactly
// what the site states, and two copies of one sentence drift the moment one is edited.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 3600;

/**
 * Storefront home page displaying promotional campaign hero banner.
 *
 * NOTE: (§8.3, §9.4) Static ISR with 1-hour cache TTL and tag/path on-demand revalidation upon banner updates.
 */
export default async function HomePage() {
  const banners = await getActiveBanners();

  return (
    <main className="flex-1 overflow-hidden bg-white text-black">
      {/* NOTE: (§7.3) The one heading on the page that a banner edit cannot change. */}
      <h1 className="sr-only">
        VELUR – Ukrainian cosmetics for body and face care
      </h1>
      <HeroBanners banners={banners} />
    </main>
  );
}

