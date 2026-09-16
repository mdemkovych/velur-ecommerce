"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { IMAGE_QUALITY } from "@/lib/media";
import { bannerTitleScale, BANNER_PHOTO_COUNT, type Banner } from "@/lib/types";

/** Inline SVG placeholder preventing layout shifts before hero images load. */
const HERO_BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjEwIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2VmZWFlNCIvPjwvc3ZnPg==";

const GRID = "grid-cols-1 tablet:grid-cols-2 lg:grid-cols-3";
const SIZES = "(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 33vw";
const REVEAL = ["block", "hidden tablet:block", "hidden lg:block"] as const;
const REVEAL_CEILING_MS = 900;

const noSubscribe = () => () => {};

/**
 * Homepage hero promotional carousel with responsive multi-cell layout and autoscroll.
 *
 * NOTE: (§8.3) Renders up to 3 banner images across responsive breakpoints with synchronized reveal.
 */
export default function HeroBanners({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const [tally, setTally] = useState({ index: 0, count: 0 });
  const [visiblePhotos, setVisiblePhotos] = useState(BANNER_PHOTO_COUNT);

  const loaded = tally.index === current ? tally.count : 0;

  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 43.75rem)");
    const desktop = window.matchMedia("(min-width: 64rem)");
    const sync = () => setVisiblePhotos(desktop.matches ? 3 : tablet.matches ? 2 : 1);
    sync();
    tablet.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      tablet.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  const [ceilingFor, setCeilingFor] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setCeilingFor(current), REVEAL_CEILING_MS);
    return () => clearTimeout(timer);
  }, [current]);

  const revealed = !hydrated || ceilingFor === current || loaded >= visiblePhotos;

  useEffect(() => {
    if (banners.length < 2) return;
    const wide = window.matchMedia("(min-width: 64rem)");
    let timer: ReturnType<typeof setInterval> | undefined;

    const sync = () => {
      clearInterval(timer);
      timer = undefined;
      if (!wide.matches) return;
      timer = setInterval(() => setCurrent((prev) => (prev + 1) % banners.length), 7000);
    };

    sync();
    wide.addEventListener("change", sync);
    return () => {
      clearInterval(timer);
      wide.removeEventListener("change", sync);
    };
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[Math.min(current, banners.length - 1)];
  const photos = banner.images.slice(0, BANNER_PHOTO_COUNT);

  return (
    <section className="relative flex h-[calc(100svh-var(--header-h)-var(--hero-peek))] min-h-[480px] w-full items-center justify-center overflow-hidden border-b border-black bg-black text-white">
      <div
        className={`absolute inset-0 grid h-full w-full transition-opacity duration-500 ${GRID} ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
      >
        {photos.map((src, idx) => (
          <div key={src} className={`relative h-full w-full overflow-hidden ${REVEAL[idx]}`}>
            <Image
              src={src}
              alt=""
              fill
              priority={idx === 0 && current === 0}
              onLoad={() =>
                setTally((prev) =>
                  prev.index === current
                    ? { index: current, count: prev.count + 1 }
                    : { index: current, count: 1 },
                )
              }
              placeholder="blur"
              blurDataURL={HERO_BLUR}
              className="object-cover object-center"
              sizes={SIZES}
              quality={IMAGE_QUALITY}
            />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/45 to-black/25 lg:from-black/64 lg:via-black/21 lg:to-black/13" />
          </div>
        ))}
      </div>

      {banners.length > 1 && loaded > 0 && (
        <div aria-hidden className={`pointer-events-none absolute inset-0 grid h-full w-full opacity-0 ${GRID}`}>
          {banners[(current + 1) % banners.length].images
            .slice(0, BANNER_PHOTO_COUNT)
            .map((src, idx) => (
              <div key={src} className={`relative h-full w-full ${REVEAL[idx]}`}>
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes={SIZES}
                  quality={IMAGE_QUALITY}
                  className="object-cover object-center"
                />
              </div>
            ))}
        </div>
      )}

      <div className="relative z-30 mx-auto flex w-full max-w-7xl justify-center px-6 py-12 sm:px-10">
        <div className="flex w-full max-w-[640px] flex-col items-center gap-6 text-center lg:h-[380px] lg:justify-between lg:gap-0 lg:border lg:border-white/20 lg:bg-black/34 lg:px-14 lg:py-12 lg:backdrop-blur-md">
          {banner.subtitle && (
            <div className="flex h-9 shrink-0 items-center justify-center lg:h-auto">
              <p className="font-montserrat text-xs font-semibold tracking-[0.22em] whitespace-pre-line text-white/85 uppercase sm:text-sm sm:tracking-[0.26em] lg:font-bold lg:tracking-[0.32em] lg:text-neutral-200">
                {banner.subtitle}
              </p>
            </div>
          )}

          <div className="flex h-24 items-center justify-center px-2 tablet:h-28 lg:h-auto lg:my-auto">
            {/* A slogan a manager rewrites is not the page's heading (§7.3). */}
            <p
              className={`font-montserrat leading-[1.18] font-bold tracking-tight whitespace-pre-line text-white uppercase ${bannerTitleScale(banner.title)}`}
            >
              {banner.title}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-4 sm:gap-6">
            {banner.ctaLabel && banner.ctaHref && (
              <Link
                href={banner.ctaHref}
                className="font-montserrat inline-flex w-full items-center justify-center border border-white bg-white px-8 py-3.5 text-[11px] font-bold tracking-[0.2em] text-black uppercase transition-all duration-300 hover:bg-black hover:text-white sm:w-auto sm:text-xs lg:tracking-[0.25em]"
              >
                {banner.ctaLabel}
              </Link>
            )}

            {banner.ctaSecondaryLabel && banner.ctaSecondaryHref && (
              <Link
                href={banner.ctaSecondaryHref}
                className="font-montserrat hidden items-center justify-center border border-white/60 bg-black/50 px-8 py-3.5 text-xs font-bold tracking-[0.22em] text-white uppercase transition-all duration-300 hover:border-white hover:bg-white hover:text-black tablet:inline-flex"
              >
                {banner.ctaSecondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {banners.length > 1 && (
        <div className="absolute right-2 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-1 sm:right-8 sm:bottom-6 sm:gap-2">
          <div className="flex items-center">
            {banners.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setCurrent(idx)}
                className="flex h-11 cursor-pointer items-center px-1"
                aria-label={`Banner ${idx + 1}`}
                aria-current={idx === current ? "true" : undefined}
              >
                <span
                  aria-hidden
                  className={`block h-[3px] transition-all duration-300 ${
                    idx === current ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setCurrent((prev) => (prev === 0 ? banners.length - 1 : prev - 1))}
              className="group flex h-11 w-11 cursor-pointer items-center justify-center"
              aria-label="Previous banner"
            >
              <span className="flex h-8 w-8 items-center justify-center bg-black/45 text-white backdrop-blur-[2px] transition-colors group-hover:bg-white group-hover:text-black sm:h-9 sm:w-9">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCurrent((prev) => (prev + 1) % banners.length)}
              className="group flex h-11 w-11 cursor-pointer items-center justify-center"
              aria-label="Next banner"
            >
              <span className="flex h-8 w-8 items-center justify-center bg-black/45 text-white backdrop-blur-[2px] transition-colors group-hover:bg-white group-hover:text-black sm:h-9 sm:w-9">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

