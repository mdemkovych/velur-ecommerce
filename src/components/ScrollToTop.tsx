"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Client-side scroll restoration handler resetting window position on route changes.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname]);

  return null;
}

