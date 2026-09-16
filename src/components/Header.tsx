"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import HeaderShopActions from "./HeaderShopActions";
import { useScrollLock } from "@/hooks/useScrollLock";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalogue" },
  { href: "/about", label: "About" },
];

const MARQUEE_ITEMS = [
  "VELUR BEAUTY",
  "A PREMIUM COSMETICS BRAND",
  "CARE AS A DAILY RITUAL",
  "MADE IN UKRAINE",
];

/** Determines whether current route matches navigation item. */
function isActiveLink(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Marquee announcement runner component. */
function MarqueeRun({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center font-montserrat text-[10px] font-bold uppercase tracking-[0.3em] whitespace-nowrap"
      aria-hidden={hidden || undefined}
    >
      {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
        <span key={idx} className="flex items-center">
          <span className="mx-6">{item}</span>
          <span className="text-neutral-500">•</span>
        </span>
      ))}
    </div>
  );
}

/** Primary site header with marquee, navigation links, and mobile menu overlay. */
export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Must be called before any conditional return (Rules of Hooks)
  useScrollLock(mobileOpen);

  // Resets mobile menu state during render on route transition.
  const [pathAtRender, setPathAtRender] = useState(pathname);
  if (pathname !== pathAtRender) {
    setPathAtRender(pathname);
    setMobileOpen(false);
  }

  // Hide on admin and auth pages — they have their own navigation
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) return null;

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <div className="hidden h-8 items-center overflow-hidden border-b border-black bg-black text-white select-none w-full lg:flex">
        <div className="animate-marquee flex">
          <MarqueeRun />
          <MarqueeRun hidden />
        </div>
      </div>

      <div className="border-b border-black bg-white w-full">
        <div className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:gap-6 lg:px-10">
          <div className="flex shrink-0 items-center justify-start">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-ml-2 flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center text-black transition-opacity hover:opacity-70 lg:hidden"
              aria-label={mobileOpen ? "Close the menu" : "Menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <path d="M3 7h18M3 12h18M3 17h18" />
                </svg>
              )}
            </button>

            <Link
              href="/"
              className="hidden items-center py-1 transition-opacity hover:opacity-85 lg:flex"
              aria-label="VELUR — home"
            >
              <Image
                src="/velur_logo.svg"
                alt="VELUR"
                width={1148}
                height={276}
                className="h-10 w-auto object-contain"
                priority
                unoptimized
              />
            </Link>
          </div>

          <div className="flex min-w-0 items-center lg:justify-center">
            <Link
              href="/"
              className="flex items-center py-1 transition-opacity hover:opacity-85 lg:hidden"
              aria-label="VELUR — home"
            >
              <Image
                src="/velur_mark.svg"
                alt="VELUR"
                width={300}
                height={276}
                className="h-9 w-auto object-contain [backface-visibility:hidden] tablet:hidden"
                priority
                unoptimized
              />
              <Image
                src="/velur_logo.svg"
                alt="VELUR"
                width={1148}
                height={276}
                className="hidden h-8 w-auto object-contain tablet:block"
                priority
                unoptimized
              />
            </Link>

            <nav className="hidden items-center gap-8 lg:flex xl:gap-12">
              {navLinks.map((link) => {
                const isActive = isActiveLink(pathname ?? "", link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`font-[family-name:var(--font-tenor-sans)] -my-2 whitespace-nowrap py-3 text-sm uppercase tracking-[0.22em] transition-all ${
                      isActive
                        ? "border-b-2 border-black font-bold text-black"
                        : "font-semibold text-black hover:border-b-2 hover:border-black"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end lg:ml-0">
            <HeaderShopActions />
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-50 flex flex-col overflow-y-auto bg-white p-6 sm:p-8 lg:hidden">
          <nav className="flex flex-col">
            {navLinks.map((link) => {
              const isActive = isActiveLink(pathname ?? "", link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block border-b py-4 text-lg uppercase tracking-[0.12em] transition-colors duration-200 ${
                    isActive
                      ? "border-black font-semibold text-black"
                      : "border-neutral-200 font-medium text-ink-2 hover:text-black"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

