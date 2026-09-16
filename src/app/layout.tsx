import type { Metadata } from "next";
import { Montserrat, Cormorant_Garamond, Tenor_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import SideDrawer from "@/components/SideDrawer";
import ContactWidget from "@/components/ContactWidget";
import ShopHydrator from "@/components/ShopHydrator";
import AddedToast from "@/components/AddedToast";
import { Analytics } from "@vercel/analytics/next";

/** Primary UI sans-serif font. */
const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-montserrat",
});

/** Editorial serif heading font. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-cormorant",
});

/** Navigation and label sans-serif font. */
const tenorSans = Tenor_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-tenor-sans",
});

const SITE_DESCRIPTION =
  "VELUR – a Ukrainian premium cosmetics brand. For the woman who chooses herself every day.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "VELUR – your daily beauty ritual",
    template: "%s | VELUR",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: "VELUR",
    locale: "uk_UA",
    type: "website",
    title: "VELUR – your daily beauty ritual",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "VELUR – your daily beauty ritual",
    description: SITE_DESCRIPTION,
  },
};

/**
 * Root application HTML layout and global context provider wrapper.
 *
 * NOTE: (§7.3, §9.7) Injects global JSON-LD organization schema, Google Fonts, and Redux client boundaries.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${cormorant.variable} ${tenorSans.variable} h-full`}
    >
      <body className="font-[family-name:var(--font-montserrat)] min-h-full flex flex-col antialiased">
        <JsonLd data={organizationJsonLd(process.env.APP_URL || "http://localhost:3000")} />
        <JsonLd data={websiteJsonLd(process.env.APP_URL || "http://localhost:3000")} />
        <Providers>
          <ShopHydrator />
          <ScrollToTop />
          <Header />
          <SideDrawer />
          <AddedToast />
          {/* A plain block, never a flex column: sticky needs a containing block that
              ends where the footer begins, and that is all this is for.
              MUST NOT: give this display:flex. main carries flex-1, whose zero basis
              would then size it from free space instead of content, and the last row
              of the catalogue lands on the footer. */}
          <div className="grow">
            {children}
            <ContactWidget />
          </div>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

