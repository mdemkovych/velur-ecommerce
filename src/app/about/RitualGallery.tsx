"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The ritual, in reading order: the evening, the morning, the gesture, then the
 * packing. The same photographs carry the hero, where they are cropped to narrow
 * columns behind the heading rather than shown whole.
 */
const RITUAL_PHOTOS = [
  { src: "/banner-01.jpg", alt: "Women on a balcony at golden hour, holding gift boxes" },
  { src: "/banner-02.jpg", alt: "A woman in a robe by a sunlit window" },
  { src: "/banner-03.jpg", alt: "Cream smoothed onto a forearm" },
  { src: "/banner-04.jpg", alt: "Hands packing a gift box on a workshop table" },
  { src: "/banner-05.jpg", alt: "Jars, ribbon and scissors on a workbench, from above" },
  { src: "/banner-06.jpg", alt: "A ribbon being tied on a gift box" },
];

/** A swipeable strip below lg, three across above it. */
export default function RitualGallery() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState({ width: 0, left: 0 });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.scrollWidth === 0) return;
    setBar({
      width: el.clientWidth / el.scrollWidth,
      left: el.scrollLeft / el.scrollWidth,
    });
  }, []);

  // The bar needs its width before anybody scrolls, and that fraction changes with
  // the viewport.
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div>
      {/* Below lg the six swipe rather than stack, which would run the section past
          two screens; the bar under the strip is what says it moves. A slide is a
          third of the width on a phone and a quarter from tablet, capped there so
          that a wider screen brings more photographs into view rather than growing
          the ones already in it. From 820px — where the section outgrows the prose's
          own longest line — it moves beside the text and keeps two rows, still swiped,
          a pair at a time. Only at lg does the whole set fit without scrolling. */}
      <ul
        ref={trackRef}
        onScroll={measure}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scrollbar-none min-[820px]:grid min-[820px]:grid-flow-col min-[820px]:auto-cols-[calc((100%-0.75rem)/2)] min-[820px]:grid-rows-[auto_auto] min-[820px]:gap-3 lg:auto-cols-auto lg:grid-cols-3 lg:overflow-visible"
      >
        {RITUAL_PHOTOS.map((photo) => (
          <li
            key={photo.src}
            className="relative aspect-[4/5] w-[calc((100%-1.25rem)/3)] shrink-0 snap-start overflow-hidden min-[700px]:w-[calc((100%-1.875rem)/4)] min-[700px]:max-w-44 min-[820px]:w-auto min-[820px]:max-w-none"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover object-center"
              sizes="(max-width: 700px) 32vw, (max-width: 820px) 180px, (max-width: 1024px) 150px, 140px"
            />
          </li>
        ))}
      </ul>

      <div aria-hidden className="relative mt-4 h-0.5 w-full bg-black/15 lg:hidden">
        <span
          className="absolute top-0 h-0.5 bg-black transition-[left] duration-100"
          style={{ width: `${bar.width * 100}%`, left: `${bar.left * 100}%` }}
        />
      </div>
    </div>
  );
}
