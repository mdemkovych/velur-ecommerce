"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MAX_PRODUCT_IMAGES, type Product } from "@/lib/types";
import { isVideoUrl, posterFor, primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleWishlist, selectIsWishlisted } from "@/store/shopSlice";
import { cn } from "@/lib/cn";

interface ProductGalleryProps {
  product: Product;
  images: string[];
  name: string;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Gallery video player with custom playback controls and scrubber.
 *
 * NOTE: (§6.3) Preload set to none to preserve bucket egress; plays only upon user engagement.
 */
function GalleryVideo({ src, isActive }: { src: string; isActive: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || isActive) return;

    el.pause();
    el.currentTime = 0;
  }, [isActive]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const seek = (fraction: number) => {
    const el = ref.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = fraction * el.duration;
    setElapsed(el.currentTime);
  };

  const playedPercent = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div className="relative h-full w-full">
      <video
        ref={ref}
        src={src}
        loop
        muted
        playsInline
        preload="none"
        poster={posterFor(src)}
        disablePictureInPicture
        controlsList="nofullscreen nodownload noremoteplayback"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="h-full w-full object-contain"
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the clip" : "Play the clip"}
        className={cn(
          "absolute inset-0 z-10 flex cursor-pointer items-center justify-center transition-opacity duration-200",
          playing && "opacity-0 hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <span className="flex h-14 w-14 items-center justify-center bg-black/60 text-white transition-colors duration-200 hover:bg-black/80">
          {playing ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 translate-x-px" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-1.5 bg-gradient-to-t from-black/45 to-transparent px-1.5 pt-6 tablet:gap-2 tablet:px-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center text-white transition-opacity hover:opacity-70"
        >
          {playing ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 translate-x-px" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <span className="font-montserrat shrink-0 text-[10px] font-medium tabular-nums text-white/90">
          {formatClock(elapsed)}
        </span>

        <input
          type="range"
          min={0}
          max={1000}
          value={duration > 0 ? Math.round((elapsed / duration) * 1000) : 0}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Playback position"
          className="video-scrub h-9 min-w-0 flex-1"
          style={{ "--played": `${playedPercent}%` } as React.CSSProperties}
        />

        <span className="font-montserrat hidden shrink-0 text-[10px] font-medium tabular-nums text-white/60 tablet:inline">
          {formatClock(duration)}
        </span>

        <button
          type="button"
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            el.muted = !el.muted;
            setMuted(el.muted);
          }}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
          className="flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center text-white transition-opacity hover:opacity-70"
        >
          {muted ? (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M17 9l4 6M21 9l-4 6" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Main product gallery with swipeable thumbnail track and high-resolution viewport.
 *
 * NOTE: (§6.2) Renders 4:5 aspect ratio images and video previews with wishlist bookmarking.
 */
export default function ProductGallery({ product, images, name }: ProductGalleryProps) {
  const dispatch = useAppDispatch();
  const isWishlisted = useAppSelector(selectIsWishlisted(product.id));

  const shown = images.length > 0 ? images : [primaryMedia(null)];
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx((prev) => (prev === idx ? prev : Math.min(shown.length - 1, Math.max(0, idx))));
  }, [shown.length]);

  const goTo = useCallback((idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  }, []);

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleWishlist({ product }));
  };

  const hasMany = shown.length > 1;

  return (
    <div className="grid w-full grid-cols-12 gap-2 tablet:gap-4">
      {hasMany && (
        <div
          style={{ gridTemplateRows: `repeat(${MAX_PRODUCT_IMAGES}, minmax(0, 1fr))` }}
          className="col-span-2 grid gap-2.5 tablet:gap-5"
          role="tablist"
          aria-label="Product views"
        >
          {shown.map((media, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goTo(idx)}
                className={`relative min-h-0 w-full cursor-pointer overflow-hidden bg-photo-bg transition-opacity duration-300 ${
                  isActive ? "opacity-100" : "opacity-40 hover:opacity-100"
                }`}
                aria-label={`View ${idx + 1}`}
              >
                {isVideoUrl(media) ? (
                  <>
                    <video
                      src={media}
                      muted
                      playsInline
                      preload="none"
                      poster={posterFor(media)}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <Image
                    src={media}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    quality={IMAGE_QUALITY}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className={`relative col-span-10 ${hasMany ? "" : "col-start-2"}`}>
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none"
        >
          {shown.map((media, idx) => (
            <div
              key={idx}
              className="relative aspect-[4/5] w-full shrink-0 basis-full snap-center overflow-hidden bg-photo-bg"
            >
              {isVideoUrl(media) ? (
                <GalleryVideo src={media} isActive={activeIdx === idx} />
              ) : (
                <Image
                  src={media}
                  alt={shown.length > 1 ? `${name} — photo ${idx + 1}` : name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 700px) 100vw, (max-width: 1024px) 55vw, 560px"
                  quality={IMAGE_QUALITY}
                  priority={idx === 0}
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleToggleWishlist}
          className="absolute top-2 right-2 z-20 flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-3 text-black"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg
            className="h-6 w-6"
            fill={isWishlisted ? "black" : "none"}
            stroke="currentColor"
            strokeWidth="1.3"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {hasMany && (
          <div className="pointer-events-none absolute top-2 left-2 z-20 bg-white/80 px-2 py-1 text-[10px] font-medium tracking-[0.12em] tabular-nums backdrop-blur-[2px]">
            <span className="text-ink-2">{String(activeIdx + 1).padStart(2, "0")}</span>
            <span className="text-ink-3"> / {String(shown.length).padStart(2, "0")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

