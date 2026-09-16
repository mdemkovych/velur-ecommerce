"use client";

import { useEffect } from "react";

/**
 * Brings the element marked `aria-current="page"` inside `containerId` into view.
 *
 * NOTE: (§7.1) The category strip is one scrolling row, and the active category
 * sits wherever its editorial position puts it — off the right edge on a narrow
 * screen. Renders nothing, so the strip itself stays server-rendered markup.
 *
 * @param containerId Id of the horizontally scrolling element.
 */
export default function ScrollActiveIntoView({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    const active = container?.querySelector('[aria-current="page"]');
    if (!container || !active) return;
    // `nearest` on both axes: it moves the row only when the element is out of
    // sight, and never scrolls the page around it.
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [containerId]);

  return null;
}
