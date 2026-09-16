"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Legal compliance and informational route links.
 *
 * NOTE: (§3.1) Required by merchant acquiring terms (offer, privacy, delivery, returns, contacts).
 */
const LEGAL_LINKS = [
  { href: "/contacts", label: "Contacts" },
  { href: "/delivery", label: "Delivery and payment" },
  { href: "/returns", label: "Exchange and returns" },
  { href: "/offer", label: "Public offer" },
  { href: "/privacy", label: "Privacy policy" },
] as const;

/** Global storefront footer with brand mark, social links, legal navigation, and copyright. */
export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) return null;

  return (
    <footer className="mt-auto border-t border-black bg-white w-full">
      <div className="w-full px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-h-11 shrink-0 items-center transition-opacity hover:opacity-85"
          >
            <Image
              src="/velur_logo.svg"
              alt="VELUR"
              width={1148}
              height={276}
              className="h-7 w-auto object-contain sm:h-9"
              unoptimized
            />
          </Link>

          <a
            href="https://instagram.com/velur.brand"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-ink-2 transition-colors hover:text-black"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span>@velur.brand</span>
          </a>
        </div>

        <nav className="mt-5 border-t border-neutral-200 pt-3 sm:mt-8">
          <div className="flex flex-col items-center text-xs font-medium text-ink-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:gap-x-8">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-10 items-center whitespace-nowrap transition-colors hover:text-black sm:min-h-11"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-3 border-t border-neutral-200 pt-4 text-[9px] font-medium tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase sm:pt-5 sm:text-[10px] sm:tracking-[0.14em]">
          <p>© 2026 VELUR. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

