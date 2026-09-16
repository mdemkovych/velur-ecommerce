import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCategories, getPublishedProducts } from "@/lib/db";
import { getAppUrl } from "@/lib/appUrl";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, catalogItemListJsonLd } from "@/lib/seo";
import ProductCard from "@/components/ProductCard";
import BackToTopButton from "@/components/BackToTopButton";
import ScrollActiveIntoView from "@/components/ScrollActiveIntoView";

export const revalidate = 60;

/**
 * The catalogue's own category control, as a link rather than a menu item.
 *
 * NOTE: (§7.1) The painted box is the toolbar's, down to the 36px height, and
 * the 44px a tap target needs is transparent padding around it — so the two
 * screens read as one control rather than two sizes of the same idea.
 */
const CHIP_TAP = "group inline-flex shrink-0 items-center py-1";

const CHIP_BOX =
  "flex h-9 items-center whitespace-nowrap border px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all min-[380px]:px-3 min-[380px]:tracking-[0.14em] tablet:px-4 tablet:text-[11px] tablet:font-semibold tablet:tracking-[0.2em]";

const CHIP_IDLE =
  "border-neutral-200 bg-white text-ink-2 group-hover:border-black group-hover:text-black tablet:border-neutral-300";

/** Resolves a category and the products filed under it, or nothing. */
async function readCategory(slug: string) {
  const [categories, products] = await Promise.all([
    getPublishedCategories(),
    getPublishedProducts(),
  ]);
  const category = categories.find((entry) => entry.slug === slug);
  if (!category) return null;
  return {
    category,
    categories,
    products: products.filter((product) => product.category === slug),
  };
}

/**
 * Pre-generates a route per category.
 *
 * NOTE: (§7.3) A category added later is rendered on first request and cached,
 * the same fallback the product route relies on.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const categories = await getPublishedCategories();
  return categories.map(({ slug }) => ({ slug }));
}

/**
 * Generates the category page's title, description and canonical URL.
 *
 * NOTE: (§7.3) Copy is derived from the category's own name: the model carries
 * no description, and prose written here would be copy no manager can edit.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await readCategory(slug);
  if (!found) return { title: "Category not found" };

  const { nameUk } = found.category;
  return {
    title: nameUk,
    description: `${nameUk} – the catalogue of VELUR, a Ukrainian premium cosmetics brand.`,
    alternates: { canonical: `/catalog/category/${slug}` },
  };
}

/**
 * Category listing: one indexable address per category, filtered on the server.
 *
 * NOTE: (§7.1, §7.3) Reads the cached catalogue and narrows it in memory, so a
 * category costs no query of its own.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await readCategory(slug);
  if (!found) notFound();

  const { category, categories, products } = found;
  const baseUrl = getAppUrl();

  return (
    <main className="flex-1 bg-white text-black">
      <JsonLd data={catalogItemListJsonLd(products, baseUrl, category.nameUk)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: "Home", url: "/" },
            { name: "Catalogue", url: "/catalog" },
            { name: category.nameUk, url: `/catalog/category/${category.slug}` },
          ],
          baseUrl,
        )}
      />

      {/* NOTE: (§7.3) The category's name is the page's heading; on screen it is
          carried by the breadcrumb and the active chip rather than by a title. */}
      <h1 className="sr-only">{category.nameUk} — VELUR</h1>

      <nav aria-label="Site navigation" className="w-full px-4 pt-5 pb-4 sm:px-8 sm:pt-7 md:px-10">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-montserrat text-[10px] font-semibold tracking-[0.18em] text-ink-3 uppercase sm:text-[11px]">
          <li>
            <Link
              href="/"
              className="-my-3 inline-flex min-h-11 items-center transition-colors hover:text-black"
            >
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href="/catalog"
              className="-my-3 inline-flex min-h-11 items-center transition-colors hover:text-black"
            >
              Catalogue
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-black" aria-current="page">
            {category.nameUk}
          </li>
        </ol>
      </nav>

      {/* NOTE: (§7.1) The catalogue's toolbar, with the categories laid out as
          links: a category page has no other way out of the category it shows. */}
      <div className="sticky top-[var(--header-h)] z-40 w-full border-y border-neutral-200 bg-white">
        <div className="flex h-14 w-full items-center gap-2.5 px-4 sm:px-8 md:gap-6 md:px-10">
          {/* Below tablet the label would take a quarter of the row from the
              categories, which are the part that does something. */}
          <p className="hidden shrink-0 font-cormorant text-black tablet:block tablet:border-r tablet:border-line tablet:pr-5 tablet:text-base tablet:font-bold tablet:tracking-[0.14em] tablet:uppercase lg:pr-6 lg:text-lg lg:tracking-[0.18em]">
            Collection
          </p>

          <nav
            id="category-strip"
            aria-label="Categories"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:gap-2.5"
          >
            <Link href="/catalog" className={CHIP_TAP}>
              <span className={`${CHIP_BOX} ${CHIP_IDLE}`}>All products</span>
            </Link>
            {categories.map((entry) => {
              const isCurrent = entry.slug === category.slug;
              return (
                <Link
                  key={entry.slug}
                  href={`/catalog/category/${entry.slug}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={CHIP_TAP}
                >
                  <span
                    className={`${CHIP_BOX} ${
                      isCurrent ? "border-black bg-black text-white" : CHIP_IDLE
                    }`}
                  >
                    {entry.nameUk}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <section className="w-full px-3.5 pt-5 pb-10 sm:px-8 sm:pt-7 md:px-10 lg:pt-10 lg:pb-14">
        {products.length > 0 ? (
          <div className="grid grid-cols-2 items-stretch gap-2.5 tablet:grid-cols-3 sm:gap-5 md:gap-6 xl:grid-cols-4">
            {products.map((product) => (
              <div key={product.id} className="flex h-full flex-col">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-black px-6 py-16 text-center sm:py-24">
            <p className="font-[family-name:var(--font-tenor-sans)] text-xl font-bold uppercase sm:text-2xl">
              Nothing in this category yet
            </p>
            <Link
              href="/catalog"
              className="mt-5 inline-flex min-h-11 items-center border border-black px-4 text-xs font-bold tracking-wider uppercase transition-colors hover:bg-black hover:text-white"
            >
              See the whole catalogue
            </Link>
          </div>
        )}
      </section>

      <ScrollActiveIntoView containerId="category-strip" />
      <BackToTopButton />
    </main>
  );
}
