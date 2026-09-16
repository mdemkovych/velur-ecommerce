"use client";

import { useState, useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectIsDrawerOpen } from "@/store/shopSlice";

/**
 * Floating back-to-top button that stops where the page's own flow ends.
 */
export default function BackToTopButton() {
  const isDrawerOpen = useAppSelector(selectIsDrawerOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 350);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible || isDrawerOpen) return null;

  return (
    /* Sticky rather than fixed with a measured offset: the compositor keeps it in place
       through a fast scroll, where a scroll handler always paints a frame late and the
       button visibly slides onto the footer and back. */
    <div className="pointer-events-none sticky bottom-0 z-40 h-0">
      <button
        onClick={scrollToTop}
        className="pointer-events-auto absolute right-4 bottom-8 flex h-9 w-9 cursor-pointer items-center justify-center border border-black bg-white text-black transition-colors duration-200 hover:bg-black hover:text-white sm:right-10 sm:h-11 sm:w-11 sm:bg-black sm:text-white sm:hover:bg-white sm:hover:text-black"
        aria-label="Back to top"
        title="Back to top"
      >
      <svg
        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
          d="M5 15l7-7 7 7"
        />
      </svg>
      </button>
    </div>
  );
}

