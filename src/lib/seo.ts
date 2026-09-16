import { SELLER, SELLER_EMAIL, SELLER_PHONE_HREF } from "@/lib/storeContent";
import { isVideoUrl } from "@/lib/media";
import { chargedPrice, type Product } from "@/lib/types";

/**
 * Schema.org JSON-LD structured data generators.
 *
 * NOTE: (§7.3) Generates semantic metadata for Organization, Product, and Breadcrumb structures.
 */

const ORG_ID = "#organization";

/**
 * Builds Schema.org Organization structured data.
 *
 * @param baseUrl Canonical application base URL.
 */
export function organizationJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/${ORG_ID}`,
    name: "VELUR",
    // NOTE: (§7.3) The Cyrillic spelling of a name the shop writes only in Latin.
    alternateName: "Velur",
    legalName: SELLER.name,
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    image: `${baseUrl}/opengraph-image.png`,
    description:
      "A Ukrainian premium cosmetics brand: body and face care, and gift sets.",
    email: SELLER_EMAIL,
    telephone: SELLER_PHONE_HREF,
    vatID: SELLER.taxId,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ternopil",
      addressCountry: "UA",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: SELLER_PHONE_HREF,
      email: SELLER_EMAIL,
      availableLanguage: ["uk"],
    },
    sameAs: ["https://instagram.com/velur.brand"],
  };
}

/**
 * Builds Schema.org WebSite structured data.
 *
 * NOTE: (§7.3) Names the site itself and ties it to the organisation, which is
 * what lets a brand search resolve to one entity rather than to a page.
 *
 * No `potentialAction` search box: Google retired that result in 2023, so the
 * markup would describe a feature nothing renders.
 *
 * @param baseUrl Canonical application base URL.
 */
export function websiteJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: "VELUR",
    url: baseUrl,
    inLanguage: "uk-UA",
    publisher: { "@id": `${baseUrl}/${ORG_ID}` },
  };
}

/**
 * Builds Schema.org ItemList structured data for the catalogue listing.
 *
 * NOTE: (§7.3) Declares the order the page actually renders, so the listing is
 * read as one collection rather than as unrelated links.
 *
 * @param products Products in the order the page lists them.
 * @param baseUrl Canonical application base URL.
 * @param name Listing title, so a category names itself rather than the shop.
 */
export function catalogItemListJsonLd(
  products: readonly Pick<Product, "slug" | "nameUk">[],
  baseUrl: string,
  name = "VELUR catalogue",
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.nameUk,
      url: `${baseUrl}/catalog/${product.slug}`,
    })),
  };
}

/** NOTE: (§7.3) Horizon Google asks an offer to carry, not a promise about price. */
const PRICE_HORIZON_DAYS = 365;

/** NOTE: (§4.5) The statutory window the returns page publishes. */
const RETURN_WINDOW_DAYS = 14;

/**
 * Builds Schema.org Product structured data.
 *
 * NOTE: (§2.6, §7.3) Availability and promotional price are derived directly from
 * product state to ensure consistency between rendered markup and structured data.
 *
 * MUST NOT: pass `product.media` straight into `image`. The column mixes
 * photographs and clips (§6.4), and one `.mp4` there invalidates the whole
 * Product block, taking the price and the availability out of the search result.
 *
 * @param product Product entity.
 * @param baseUrl Canonical application base URL.
 */
export function productJsonLd(product: Product, baseUrl: string) {
  const url = `${baseUrl}/catalog/${product.slug}`;
  const price = chargedPrice(product);
  const photos = product.media.filter((item) => !isVideoUrl(item));
  const priceValidUntil = new Date(Date.now() + PRICE_HORIZON_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameUk,
    alternateName: product.name || undefined,
    description: product.tagline || product.description,
    image: photos.length > 0 ? photos : undefined,
    sku: product.slug,
    brand: { "@type": "Brand", name: "VELUR" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "UAH",
      price: String(price),
      priceValidUntil,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "VELUR" },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "UA",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: RETURN_WINDOW_DAYS,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnShippingFees",
      },
    },
  };
}

export function breadcrumbJsonLd(
  trail: readonly { name: string; url: string }[],
  baseUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${baseUrl}${step.url}`,
    })),
  };
}
