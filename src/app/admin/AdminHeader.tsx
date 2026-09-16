"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface Props {
  onLogout: () => void;
}

const SECTIONS = [
  { href: "/admin/products", label: "Catalogue" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/banners", label: "Banners" },
  { href: "/admin/audit", label: "Journal" },
  { href: "/admin/security", label: "Security" },
] as const;

/**
 * Global navigation header for the administrative back-office.
 *
 * NOTE: (§8.1, §8.4) Provides responsive navigation between products, orders, banners, audit log, team, and security settings.
 */
export function AdminHeader({ onLogout }: Props) {
  const pathname = usePathname();
  const isTeamOpen = pathname.startsWith("/admin/team");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-10 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center lg:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close the menu" : "Open the menu"}
            className="-ml-2 flex h-11 w-11 cursor-pointer items-center justify-center text-black lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              {isMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        <Link
          href="/admin"
          className="col-start-2 flex min-w-0 items-center justify-center transition-opacity hover:opacity-85 lg:col-start-1 lg:justify-start"
          title="To the control panel"
        >
          <Image
            src="/velur_logo.svg"
            alt="VELUR"
            width={1148}
            height={276}
            className="h-8 w-auto shrink-0 object-contain lg:h-10"
            priority
            unoptimized
          />
        </Link>

        <nav className="col-start-2 hidden lg:block">
          <div className="flex items-center justify-center gap-10">
          {SECTIONS.map((section) => {
            const isActive = pathname.startsWith(section.href);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase transition-colors",
                    isActive
                      ? "text-black underline decoration-2 underline-offset-8"
                      : "text-ink-3 hover:text-black",
                  )}
                >
                  {section.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="col-start-3 flex items-center justify-end gap-2">
          <Link
            href="/admin/team"
            aria-label="Team and admins"
            aria-current={isTeamOpen ? "page" : undefined}
            title="Team and admins"
            className={cn(
              "flex h-10 w-10 cursor-pointer items-center justify-center border transition-all",
              isTeamOpen
                ? "border-black bg-black text-white"
                : "border-neutral-300 bg-white text-ink-2 hover:border-black hover:text-black",
            )}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </Link>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Leave the panel"
            title="Leave the panel"
            className="flex h-10 w-10 cursor-pointer items-center justify-center border border-neutral-300 bg-white text-ink-2 transition-all hover:border-black hover:text-black"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 17l5-5-5-5M20 12H9M12 3H5v18h7" />
            </svg>
          </button>
        </div>

      </div>

      {isMenuOpen && (
        <div className="absolute inset-x-0 top-full border-y border-neutral-200 bg-white lg:hidden">
          <nav className="flex flex-col px-4 py-1">
            {SECTIONS.map((section) => {
              const isActive = pathname.startsWith(section.href);
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center border-b border-neutral-100 text-xs font-semibold tracking-[0.16em] uppercase transition-colors last:border-b-0",
                    isActive ? "text-black" : "text-ink-2",
                  )}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

