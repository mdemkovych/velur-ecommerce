import "server-only";
import { getSupabaseAdminClient } from "./supabase";
import { posterFor } from "./media";

/**
 * Supabase Storage bucket operations for product media.
 *
 * NOTE: (§6.5) Handled exclusively through server-side /api/upload route with sharp re-encoding.
 */
export const MEDIA_BUCKET = "product-media";

/** Raised when bucket upload fails. */
export class MediaStorageError extends Error {}

/**
 * Stores a processed media file in the product storage bucket.
 *
 * NOTE: (§6.5) Upsert is disabled to prevent accidental collisions on randomized filenames.
 *
 * @param filename Target path inside the bucket.
 * @param body File data buffer.
 * @param contentType MIME type string.
 * @returns Public URL string of the stored asset.
 */
export async function storeMedia(
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdminClient();

  // WORKAROUND: Copy Buffer to Uint8Array to prevent undici fetch failures with SharedArrayBuffer views.
  const bytes = new Uint8Array(body);

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filename, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("Supabase Storage upload failed:", error);
    throw new MediaStorageError(error.message);
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Extracts relative bucket storage path from a full public asset URL.
 *
 * @param url Full public asset URL.
 * @returns Relative path within bucket, or null if URL belongs to external/static assets.
 */
export function bucketPathFor(url: string): string | null {
  const base = process.env.SUPABASE_URL?.trim();
  if (!base || !url.startsWith(base)) return null;

  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const path = url.slice(at + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * Deletes unreferenced media assets and associated video posters from the bucket.
 *
 * NOTE: (§6.5) Fail-safe cleanup: logs failures without throwing to prevent blocking business entity saves.
 *
 * @param urls Array of public asset URLs to delete.
 */
export async function removeMedia(urls: string[]): Promise<void> {
  const withPosters = urls.flatMap((url) => {
    const poster = posterFor(url);
    return poster ? [url, poster] : [url];
  });

  const paths = withPosters.map(bucketPathFor).filter((p): p is string => p !== null);
  if (paths.length === 0) return;

  try {
    const { error } = await getSupabaseAdminClient().storage.from(MEDIA_BUCKET).remove(paths);
    if (error) console.error("Supabase Storage cleanup failed:", error, paths);
  } catch (err) {
    console.error("Supabase Storage cleanup error:", err, paths);
  }
}

