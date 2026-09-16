import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { getProductById, getPublishedProductSlugs } from "@/lib/db";
import AddToCartButton from "@/components/AddToCartButton";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { getAppUrl } from "@/lib/appUrl";
import ProductGallery from "@/components/ProductGallery";
import ProductAccordions from "@/components/ProductAccordions";

export const revalidate = 60;

/**
 * Pre-generates static parameter routes for published product slugs.
 *
 * NOTE: (§7.1, §9.4) Enables static prerendering with dynamic fallback for newly added products.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getPublishedProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Generates Open Graph metadata and canonical URLs for product detail pages.
 *
 * NOTE: (§7.3) Injects SEO title, description, and primary product imagery.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductById(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: `${product.nameUk} — ${product.name}`,
    description: product.tagline || product.description.slice(0, 160),
    alternates: { canonical: `/catalog/${product.slug}` },
    openGraph: {
      title: `${product.nameUk} | VELUR`,
      description: product.tagline || product.description.slice(0, 160),
      images: [{ url: product.image }],
      type: "website",
    },
  };
}

/**
 * Product detail page rendering 4:5 image gallery, specifications, set composition, and purchase console.
 *
 * NOTE: (§2.3, §6.2, §7.3) Emits structured Product and Breadcrumb JSON-LD schemas.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductById(slug);
  if (!product) notFound();

  const images = product.media.length > 0 ? product.media : [];
  const baseUrl = getAppUrl();

  return (
    <main className="flex-1 bg-white text-black">
      <JsonLd data={productJsonLd(product, baseUrl)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: "Home", url: "/" },
            { name: "Catalogue", url: "/catalog" },
            { name: product.nameUk, url: `/catalog/${product.slug}` },
          ],
          baseUrl,
        )}
      />
      <section className="max-w-7xl mx-auto px-4 sm:px-8 md:px-10 py-6 sm:py-10 md:py-16">
        <Link
          href="/catalog"
          className="-my-1 mb-2 inline-flex items-center gap-2 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3 transition-colors hover:text-black md:hidden"
        >
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          <span>Catalogue</span>
        </Link>

        <div className="grid grid-cols-1 tablet:grid-cols-12 gap-6 tablet:gap-8 lg:gap-16 items-start">
          <div className="order-1 tablet:order-1 tablet:col-span-7 lg:col-span-6 h-full">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
              <ProductGallery product={product} images={images} name={product.name} />
            </div>
          </div>

          <div className="order-2 tablet:order-2 tablet:col-span-5 lg:col-span-6 flex flex-col justify-between">
            <div>
              <div className="mb-6 lg:mb-8">
                <div className="mb-4 hidden md:block">
                  <Link
                    href="/catalog"
                    className="-my-2 inline-block py-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-ink-3 hover:text-black transition-colors"
                  >
                    BACK TO THE CATALOGUE
                  </Link>
                </div>

                <h1 className="font-montserrat mb-2 text-xl font-semibold uppercase leading-[1.25] tracking-[0.02em] text-balance text-black sm:text-2xl sm:tracking-wide lg:text-[32px]">
                  {product.nameUk}
                </h1>

                <p className="font-montserrat mb-4 text-sm font-light text-ink-3 sm:text-base">
                  {product.name}
                </p>

                <div>
                  <AddToCartButton product={product} />

                  {product.stock === 0 && (
                    <div className="mt-4 p-5 bg-neutral-50 border border-neutral-200 space-y-3">
                      <div className="flex items-center gap-2 text-neutral-800 font-semibold text-xs uppercase tracking-wider">
                        <svg className="w-4 h-4 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span>Tell me when it is back</span>
                      </div>
                      <p className="text-xs text-ink-2 leading-relaxed">
                        Leave your email and we will let you know the moment this product is back in stock.
                      </p>
                      <form action="#" className="flex gap-2 pt-1">
                        <input
                          type="email"
                          required
                          placeholder="Your email…"
                          className="flex-1 border border-neutral-300 px-3 py-2 text-xs bg-white focus:border-black transition-colors"
                        />
                        <button
                          type="submit"
                          className="bg-black text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden wide:block">
                <ProductAccordions
                  description={product.description}
                  components={product.components}
                  tagline={product.tagline}
                  specifications={product.specifications}
                  usage={product.usage}
                  packaging={product.packaging}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="block wide:hidden mt-8 sm:mt-12">
          <ProductAccordions
            description={product.description}
            components={product.components}
            tagline={product.tagline}
            specifications={product.specifications}
            usage={product.usage}
            packaging={product.packaging}
          />
        </div>
      </section>
    </main>
  );
}

