/**
 * Product media processing helpers and URL utilities.
 *
 * NOTE: (§6.2, §6.3) Encapsulates video detection, poster derivation, and media classification.
 */

const VIDEO_URL = /\.(mp4|webm|ogg|mov)($|\?)/i;

/**
 * Checks whether the given URL points to a video container format.
 *
 * @param url Asset URL string.
 * @returns True if URL matches video extension pattern or data:video prefix.
 */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return VIDEO_URL.test(url) || url.startsWith("data:video");
}

export const MEDIA_PLACEHOLDER = "/images/placeholder.svg";

/**
 * Returns the primary media item URL or safe placeholder fallback.
 *
 * @param url Candidate media URL.
 * @returns Non-empty asset URL string.
 */
export function primaryMedia(url: string | undefined | null): string {
  return url && url.trim() ? url : MEDIA_PLACEHOLDER;
}

/**
 * Derives the video poster image URL from the video asset path.
 *
 * NOTE: (§6.2) Matches the uploaded companion `.poster.webp` generated during video ingestion.
 *
 * @param videoUrl Public URL of the video file.
 * @returns Poster image URL or undefined if input is not a video.
 */
export function posterFor(videoUrl: string | undefined | null): string | undefined {
  if (!videoUrl || !isVideoUrl(videoUrl)) return undefined;
  return videoUrl.replace(/\.[a-z0-9]+($|\?)/i, ".poster.webp$1");
}

/** NOTE: (§6.2) Global WebP quality setting listed in next.config.ts. */
export const IMAGE_QUALITY = 98;

/** Multipart form field identifier for poster generation target. */
export const POSTER_FIELD = "posterFor";

/** NOTE: (§6.3) Media classification: 4:5 cropped product photos vs uncropped banners. */
export const MEDIA_KINDS = ["product", "banner"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_FIELD = "kind";

