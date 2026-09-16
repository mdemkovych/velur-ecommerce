"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Image from "next/image";
import { Card, hintCls, Icon, Notice } from "./ui";
import {
  isVideoUrl,
  MEDIA_KIND_FIELD,
  POSTER_FIELD,
  posterFor,
  IMAGE_QUALITY,
  type MediaKind,
} from "@/lib/media";

const MAX_VIDEO_SECONDS = 20;

const MAX_IMAGE_MB = 4;
const MAX_VIDEO_MB = 4;

/**
 * Extracts first video frame client-side to generate a WebP thumbnail poster.
 *
 * NOTE: (§6.2, §6.5) Pre-extracts poster frame before server payload ingestion.
 */
function captureFirstFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    probe.playsInline = true;

    const done = (value: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };

    probe.onloadeddata = () => {
      probe.currentTime = Math.min(0.1, probe.duration || 0.1);
    };
    probe.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = probe.videoWidth;
        canvas.height = probe.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width) return done(null);
        ctx.drawImage(probe, 0, 0);
        canvas.toBlob((blob) => done(blob), "image/webp", 0.9);
      } catch {
        done(null);
      }
    };
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

/** Measures video playback duration client-side via video element. */
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

interface Props {
  images: string[];
  max: number;
  title?: string;
  hint?: ReactNode;
  allowVideo?: boolean;
  kind?: MediaKind;
  error?: string;
  onChange: Dispatch<SetStateAction<string[]>>;
}

/**
 * Multi-asset drag-and-drop media uploader supporting image and short video files.
 *
 * NOTE: (§6.2, §6.5, §8.3) Supports drag reordering, primary asset selection, and upload error feedback.
 */
export function MediaUploader({
  images,
  onChange,
  max,
  title = "Photographs and clips",
  hint = (
    <>
      The first image is the primary one: it appears on the catalogue card.
      <span className="hidden sm:inline"> The order can be dragged.</span>
      <span className="sm:hidden"> The star on a photograph makes it primary.</span>
    </>
  ),
  allowVideo = true,
  kind = "product",
  error,
}: Props) {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (strip) strip.scrollTo({ left: strip.scrollWidth, behavior: "smooth" });
  }, [images.length]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      setUploadError(null);

      const isVideo = file.type.startsWith("video/");
      const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > limitMb * 1024 * 1024) {
        setUploadError(
          `The file is too large — ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
            `At most ${limitMb} MB. Compress it or pick another.`,
        );
        return;
      }

      if (isVideo) {
        const seconds = await readVideoDuration(file);
        if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
          setUploadError(
            `The clip is too long — ${Math.round(seconds)} s. At most ${MAX_VIDEO_SECONDS} s.`,
          );
          return;
        }
      }

      setUploadingSlot(slotIndex);
      const formData = new FormData();
      formData.append("file", file);
      formData.append(MEDIA_KIND_FIELD, kind);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.status === 413) {
          setUploadError(`The file is too large to upload. At most ${MAX_IMAGE_MB} MB.`);
          return;
        }
        if (!res.ok || data.error || !data.url) {
          setUploadError(data.error ?? "The file could not be uploaded.");
          return;
        }
        const url = data.url;

        if (isVideo) {
          const frame = await captureFirstFrame(file);
          if (frame) {
            const posterForm = new FormData();
            posterForm.append("file", frame, "poster.webp");
            posterForm.append(POSTER_FIELD, url);
            await fetch("/api/upload", { method: "POST", body: posterForm }).catch(() => null);
          }
        }

        onChange((prev) => {
          const next = [...prev];
          if (slotIndex < next.length) next[slotIndex] = url;
          else next.push(url);
          return next;
        });
      } catch {
        setUploadError("Connection failed. Try again.");
      } finally {
        setUploadingSlot(null);
      }
    },
    [onChange, kind],
  );

  const removeImage = (index: number) => {
    onChange((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    onChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOver.current;
    dragItem.current = null;
    dragOver.current = null;
    setDraggingSlot(null);
    if (from !== null && to !== null && from !== to) moveImage(from, to);
  };

  return (
    <Card
      title={title}
      hint={hint}
      headerRight={
        images.length > 0 ? (
          <span className="shrink-0 text-[11px] font-semibold whitespace-nowrap text-ink-3 tabular-nums">
            {images.length} / {max}
          </span>
        ) : undefined
      }
    >
      {error && (
        <div data-invalid="true">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      {isVideoUrl(images[0]) && (
        <Notice kind="error">
          A clip stands first. The catalogue card, the basket and the order summary
          all show the first item, and a clip will not draw there — put a photograph
          first or remove the clip.
        </Notice>
      )}

      <div ref={stripRef} className="flex gap-3 overflow-x-auto pb-1 scroll-smooth">
        {Array.from({ length: Math.max(images.length, Math.min(images.length + 1, max)) }).map(
          (_, slotIdx) => {
            const src = images[slotIdx] ?? null;
            const isEmpty = src === null;
            const isPrimary = slotIdx === 0 && !isEmpty;
            const isExcess = !isEmpty && slotIdx >= max;
            const isLoading = uploadingSlot === slotIdx;

            return (
              <div
                key={slotIdx}
                draggable={!isEmpty}
                onDragStart={() => {
                  dragItem.current = slotIdx;
                  setDraggingSlot(slotIdx);
                }}
                onDragEnter={() => {
                  if (!isEmpty) dragOver.current = slotIdx;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`relative z-0 aspect-[4/5] w-[calc((100%-1.5rem)/3)] min-w-[104px] shrink-0 overflow-hidden transition-opacity ${
                  !isEmpty ? "cursor-move" : ""
                } ${draggingSlot === slotIdx ? "opacity-40" : ""} ${
                  isEmpty
                    ? "border-2 border-dashed border-neutral-300 bg-neutral-50"
                    : isExcess
                      ? "border-2 border-red-400"
                      : "border border-neutral-200"
                }`}
              >
                {isEmpty ? (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[slotIdx]?.click()}
                    className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 text-ink-3 transition-colors hover:text-black"
                  >
                    {isLoading ? (
                      <span className="h-4 w-4 animate-spin border border-neutral-400 border-t-neutral-700" />
                    ) : (
                      <>
                        <span className="text-xl font-light leading-none">+</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Add</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    {isVideoUrl(src) ? (
                      <video
                        src={src}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        preload="none"
                        poster={posterFor(src)}
                      />
                    ) : (
                      <Image
                        src={src}
                        alt={`Photo ${slotIdx + 1}`}
                        fill
                        className="object-cover"
                        sizes="160px"
                        quality={IMAGE_QUALITY}
                      />
                    )}

                    {isPrimary && !isExcess && (
                      <span className="absolute inset-x-0 top-0 z-10 bg-black/85 px-1.5 py-1 text-center text-[9px] font-bold tracking-wider text-white uppercase">
                        Primary
                      </span>
                    )}

                    {isExcess && (
                      <span className="absolute inset-x-0 top-0 z-10 bg-red-600 py-1 pr-9 pl-1.5 text-[9px] font-bold tracking-wider text-white uppercase">
                        Extra
                      </span>
                    )}

                    {isLoading && (
                      <span className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
                        <span className="h-4 w-4 animate-spin border border-neutral-300 border-t-black" />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[slotIdx]?.click()}
                      title="Replace the photograph"
                      aria-label={`Replace photo ${slotIdx + 1}`}
                      className="group absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
                    >
                      <span className="bg-black/50 px-1.5 py-0.5 text-[8px] font-bold tracking-normal text-white/85 uppercase transition-colors group-hover:bg-black/85 group-hover:text-white sm:px-2 sm:py-1 sm:text-[9px] sm:tracking-wider">
                        Replace
                      </span>
                    </button>

                    {!isPrimary && !isVideoUrl(src) && (
                      <button
                        type="button"
                        onClick={() => moveImage(slotIdx, 0)}
                        title="Make it primary"
                        aria-label="Make it primary"
                        className="absolute top-1.5 right-1.5 z-20 flex h-8 w-8 cursor-pointer items-center justify-center bg-black/70 text-xs text-white transition-colors hover:bg-white hover:text-black sm:h-10 sm:w-10 sm:text-sm"
                      >
                        ★
                      </button>
                    )}

                    <div className="absolute right-1.5 bottom-1.5 z-20">
                      <button
                        type="button"
                        onClick={() => removeImage(slotIdx)}
                        title="Delete the photograph"
                        aria-label="Delete the photograph"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center bg-black/70 text-white transition-colors hover:bg-red-600 sm:h-10 sm:w-10"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={(el) => {
                    fileInputRefs.current[slotIdx] = el;
                  }}
                  type="file"
                  accept={
                    allowVideo
                      ? "image/jpeg,image/png,image/webp,image/avif,video/mp4"
                      : "image/jpeg,image/png,image/webp,image/avif"
                  }
                  onChange={(e) => void handleUpload(e, slotIdx)}
                  className="hidden"
                />
              </div>
            );
          },
        )}
      </div>

      {uploadError && <Notice>{uploadError}</Notice>}

      <p className={hintCls}>
        {kind === "banner"
          ? `Photographs up to ${MAX_IMAGE_MB} MB, keeping their own proportions.`
          : `Photographs up to ${MAX_IMAGE_MB} MB, cropped to 4:5.`}
        {allowVideo && (
          <>
            {" "}
            Clips — MP4, up to {MAX_VIDEO_MB} MB and {MAX_VIDEO_SECONDS} s.
          </>
        )}
      </p>
    </Card>
  );
}

