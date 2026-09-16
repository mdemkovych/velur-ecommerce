"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SELLER_HOURS, SELLER_PHONE, SELLER_PHONE_HREF, SELLER_TELEGRAM } from "@/lib/storeContent";

const STORAGE_KEY = "velur:contact-hidden";
/** The nudge that tucks the circle away, and the point a tap stops being a tap. */
const DISMISS_PX = 14;
const DRAG_SLOP = 5;

/**
 * Whether the visitor tucked the circle away, read through a store rather than an
 * effect so the answer is known at the first client render and the circle does not
 * appear only to vanish.
 */
const hiddenStore = (() => {
  const listeners = new Set<() => void>();
  let lastRaw: string | null = null;
  let value = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): boolean {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw !== lastRaw) {
          lastRaw = raw;
          value = raw === "1";
        }
      } catch {
        // A visitor who blocks storage keeps the circle, it just never stays tucked.
      }
      return value;
    },
    getServerSnapshot(): boolean {
      return false;
    },
    write(next: boolean) {
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        lastRaw = null;
        value = next;
      }
      listeners.forEach((listener) => listener());
    },
  };
})();

/**
 * Floating contact circle, the panel it opens, and the tab it tucks into.
 *
 * The panel is a disclosure, not a modal: no backdrop, no scroll lock, the page
 * stays usable behind it.
 */
export default function ContactWidget() {
  const pathname = usePathname() ?? "";
  const hidden = useSyncExternalStore(
    hiddenStore.subscribe,
    hiddenStore.getSnapshot,
    hiddenStore.getServerSnapshot
  );

  // Which page the panel was opened on, rather than a plain boolean: a navigation
  // then closes it by itself, with no effect reaching in to reset the flag.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  /** How far the circle has been dragged towards the edge, for the swipe-away. */
  const [nudge, setNudge] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  // Which way the gesture went in its first few pixels, settled once: read afresh on
  // every move, a sideways push that arcs down at the end throws away its own travel.
  const axisRef = useRef<"none" | "x" | "y">("none");
  const movedRef = useRef(false);
  // How far the circle has travelled, kept outside state so that letting go can read
  // it from an event handler rather than from inside a state updater, which runs
  // during render and cannot notify the store.
  const nudgeRef = useRef(0);

  const refocusRef = useRef(false);
  const close = useCallback((returnFocus: boolean) => {
    setOpenedOn(null);
    refocusRef.current = returnFocus;
  }, []);

  // The circle is not in the tree while the panel stands in its place, so focus can
  // only go back to it once it has been rendered again.
  useEffect(() => {
    if (open || !refocusRef.current) return;
    refocusRef.current = false;
    circleRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // The circle keeps its corner: it is either pushed towards the edge or let go,
  // never carried around the screen.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const start = dragRef.current;
      if (!start) return;
      const delta = start.x - event.clientX;
      const downwards = Math.abs(start.y - event.clientY);
      if (Math.abs(delta) > DRAG_SLOP) movedRef.current = true;
      // Sideways only: a thumb sliding down past the corner clears a nudge this short
      // by accident.
      if (axisRef.current === "none" && Math.max(Math.abs(delta), downwards) > DRAG_SLOP) {
        axisRef.current = Math.abs(delta) > downwards ? "x" : "y";
      }
      const next = axisRef.current === "y" ? 0 : Math.max(0, delta);
      nudgeRef.current = next;
      setNudge(next);
    };
    const onUp = () => {
      if (dragRef.current === null) return;
      dragRef.current = null;
      axisRef.current = "none";
      const travelled = nudgeRef.current;
      nudgeRef.current = 0;
      setNudge(0);
      if (travelled >= DISMISS_PX) {
        setOpenedOn(null);
        hiddenStore.write(true);
      }
      // The click that follows this pointerup is the one to drop; anything later —
      // an Enter on the focused circle, say — never reaches a pointerdown to clear
      // the flag, and would be swallowed for the rest of the session.
      if (movedRef.current) setTimeout(() => (movedRef.current = false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;

  return (
    /* A zero-height rail that catches nothing: sticky rather than fixed, so the
       compositor holds it through a fast scroll and the page's own flow — which ends
       at the footer — is what stops it. One subtree, so a press anywhere else counts
       as outside.
       MUST NOT: give it a negative margin to "remove" its height. h-0 is already no
       height, and a negative one shortens the parent instead: -mt-11 inside main took
       44px off the catalogue and dropped its last row onto the footer. */
    <div ref={rootRef} className="pointer-events-none sticky bottom-0 z-40 h-0">
      {hidden ? (
        /* The tab shares the circle's rail so the two stop at the same height when
           the page runs out; as its own sticky element it kept going to the bottom. */
        <button
          type="button"
          onClick={() => {
            // The drag that tucked the circle away ends in a click, and the tab has by
            // then taken its place under the cursor: unguarded, it puts the circle
            // straight back and the gesture looks as though it never worked.
            if (movedRef.current) return;
            hiddenStore.write(false);
          }}
          aria-label="Show the contact button"
          className="contact-fab pointer-events-auto absolute bottom-[23px] left-0 flex h-11 w-8 -translate-x-1/4 cursor-pointer items-center justify-center border border-black/15 bg-white/55 text-black backdrop-blur-xl transition-colors hover:bg-white/75 sm:bottom-[39px]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 translate-x-1"
            aria-hidden
          >
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      ) : open ? (
        <div
          ref={panelRef}
          id="contact-panel"
          className="pointer-events-auto absolute right-4 bottom-4 left-4 border border-black/15 bg-white/75 p-4 pt-11 backdrop-blur-2xl sm:p-6 sm:pt-6 sm:right-auto sm:bottom-8 sm:left-1/2 sm:w-[90vw] sm:-translate-x-1/2"
        >
          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Close"
            className="absolute top-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center text-black/50 transition-colors hover:text-black"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {/* The panel takes 80% of the screen from sm up, but the controls keep the
              width they had: stretched across it they would read as a banner rather
              than as two things to press. */}
          <div className="flex items-center justify-center">
            {/* The mark fills the flanks the wider panel opened up, at an opacity that
                keeps it a watermark: at full strength two of them either side of the
                controls read as a third and fourth thing to press. */}
            {/* The marks wait for room of their own: below this the flanks are narrower
                than the mark, and it arrives squeezed against the buttons. */}
            <div className="hidden flex-1 justify-center min-[900px]:-ml-6 min-[900px]:flex">
              <Image
                src="/velur_mark.svg"
                alt=""
                width={300}
                height={276}
                aria-hidden
                unoptimized
                className="h-20 w-auto object-contain opacity-20 lg:h-28"
              />
            </div>
            <div className="w-full sm:w-[26rem] sm:shrink-0 min-[900px]:w-[26rem]">
            <div className="w-full">
              <a
              href={SELLER_TELEGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="font-montserrat flex min-h-11 items-center justify-center border border-black bg-black px-4 text-[11px] font-semibold tracking-[0.15em] text-white uppercase transition-colors hover:bg-white hover:text-black sm:text-xs"
            >
              Message on Telegram
            </a>
            </div>
            <div className="mt-4 border-t border-black/15 pt-4">
            <a
              href={`tel:${SELLER_PHONE_HREF}`}
              className="font-montserrat flex min-h-11 items-center justify-center border border-black px-4 text-[11px] font-semibold tracking-[0.15em] text-black uppercase transition-colors hover:bg-black hover:text-white sm:text-xs"
            >
              Call
            </a>
            <p className="mt-2 text-center text-[11px] leading-[1.5] text-ink-2 sm:text-xs">
              {SELLER_PHONE}
              <br />
              {SELLER_HOURS}
            </p>
            </div>
            </div>
            <div className="hidden flex-1 justify-center min-[900px]:-mr-6 min-[900px]:flex">
              <Image
                src="/velur_mark.svg"
                alt=""
                width={300}
                height={276}
                aria-hidden
                unoptimized
                className="h-20 w-auto object-contain opacity-20 lg:h-28"
              />
            </div>
          </div>
        </div>
      ) : (
        /* White at 70% over a blur rather than a solid fill: the reset leaves no shadow
           to lift the circle off the page, so the blur is what separates it from
           whatever it happens to be sitting on. Dragging it towards the edge tucks it
           away; a pointer that travelled more than a few pixels is a drag, and its
           click is dropped so the panel does not open on the way out. */
        <button
          ref={circleRef}
          type="button"
          onPointerDown={(event) => {
            dragRef.current = { x: event.clientX, y: event.clientY };
            axisRef.current = "none";
            movedRef.current = false;
          }}
          onClick={() => {
            if (movedRef.current) return;
            setOpenedOn(pathname);
          }}
          aria-expanded={false}
          aria-controls="contact-panel"
          aria-label="Contact us"
          title="Contact us"
          style={{
            transform: `translateX(-${nudge}px)`,
            opacity: nudge > 0 ? Math.max(0.3, 1 - nudge / (DISMISS_PX * 2)) : 1,
          }}
          className="contact-fab pointer-events-auto absolute bottom-4 left-4 flex h-[58px] w-[58px] cursor-pointer touch-none items-center justify-center border border-black/15 bg-white/55 text-black backdrop-blur-xl transition-colors hover:bg-white/75 sm:bottom-8 sm:left-8"
        >
          {/* A handset rather than a speech bubble: the panel's first action is a call,
              and a bubble promises a chat window that is not what opens. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
