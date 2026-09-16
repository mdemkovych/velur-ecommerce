import { NextResponse } from "next/server";
import crypto from "crypto";
import sharp, { type Metadata, type Sharp } from "sharp";
import { requireAdmin } from "@/lib/auth";
import { MediaStorageError, storeMedia } from "@/lib/storage";
import {
  isVideoUrl,
  MEDIA_KIND_FIELD,
  MEDIA_KINDS,
  POSTER_FIELD,
  type MediaKind,
} from "@/lib/media";

/**
 * Administrative media upload endpoint for product photography, banner imagery, and video clips.
 *
 * NOTE: (§6.2, §6.3, §6.5) Enforces Sharp 4:5 center-crop, WebP re-encoding, EXIF auto-rotation, MP4 magic byte sniffing, and Supabase Storage persistence.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// NOTE: (§6.2) Platform request body limits (4 MB).
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

// NOTE: (§6.2) Maximum output width for 4:5 product master photography (2048x2560).
const OUTPUT_MAX_WIDTH = 2048;
const OUTPUT_QUALITY = 100;

// NOTE: (§6.3) Clip poster thumbnail constraints.
const POSTER_MAX_WIDTH = 800;
const POSTER_QUALITY = 75;

// NOTE: (§6.2) 4:5 aspect ratio with center crop.
const OUTPUT_ASPECT = { w: 4, h: 5 } as const;

// Plate background color matching --color-photo-bg in globals.css.
const PHOTO_PLATE = { r: 0xf5, g: 0xf5, b: 0xf5, alpha: 1 } as const;

/** Reads and validates media kind from form data. */
function readMediaKind(value: FormDataEntryValue | null): MediaKind {
  return MEDIA_KINDS.includes(value as MediaKind) ? (value as MediaKind) : "product";
}

const BANNER_MAX_WIDTH = 2400;

/** Generates random cryptographically secure filename. */
function generateFilename(extension: string): string {
  return `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${extension}`;
}

// NOTE: (§6.1) The extension comes from these bytes, never from the sent type.
function sniffVideoExtension(buffer: Buffer): ".mp4" | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(4, 8).toString("latin1") === "ftyp") return ".mp4";
  return null;
}

// NOTE: (§6.3) `metadata()` reports the file as stored, so the size is read after orientation.
function orientedSize(meta: Metadata): { width: number; height: number } {
  const width = meta.width ?? OUTPUT_MAX_WIDTH;
  const height = meta.height ?? OUTPUT_MAX_WIDTH;
  const isQuarterTurned = (meta.orientation ?? 1) >= 5;
  return isQuarterTurned ? { width: height, height: width } : { width, height };
}

// NOTE: (§6.2) Performs center crop to 4:5 aspect ratio.
async function cropToOutputAspect(image: Sharp): Promise<Buffer> {
  const meta = await image.metadata();

  const { width: sourceWidth, height: sourceHeight } = orientedSize(meta);

  const boxWidth = Math.max(
    1,
    Math.round(
      Math.min(
        OUTPUT_MAX_WIDTH,
        sourceWidth,
        (sourceHeight * OUTPUT_ASPECT.w) / OUTPUT_ASPECT.h,
      ),
    ),
  );
  const boxHeight = Math.round((boxWidth * OUTPUT_ASPECT.h) / OUTPUT_ASPECT.w);

  return image
    .resize({
      width: boxWidth,
      height: boxHeight,
      fit: "cover",
      position: "centre",
      background: PHOTO_PLATE,
    })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer();
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was sent" }, { status: 400 });
    }

    const posterFor = form.get(POSTER_FIELD);
    const isPoster = typeof posterFor === "string" && isVideoUrl(posterFor);

    // MUST NOT: treat file.type as evidence; it is a client-supplied header, and what
    // decides an image is the sharp re-encode, a clip its ftyp bytes. A new format
    // needs its own content check before it reaches this list.
    const looksLikeImage = IMAGE_TYPES.includes(file.type);
    const looksLikeVideo = file.type.startsWith("video/");
    if (!looksLikeImage && !looksLikeVideo) {
      return NextResponse.json(
        { error: "JPG, PNG, WebP, AVIF and MP4 are supported" },
        { status: 400 },
      );
    }

    const maxBytes = looksLikeVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `The file is too large. At most ${maxBytes / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    const input = Buffer.from(await file.arrayBuffer());

    if (looksLikeVideo) {
      const extension = sniffVideoExtension(input);
      if (!extension) {
        return NextResponse.json(
          { error: "Video is accepted in MP4 only" },
          { status: 400 },
        );
      }

      const filename = generateFilename(extension);
      return NextResponse.json({ url: await storeMedia(filename, input, "video/mp4") });
    }

    const upright = sharp(input).rotate();

    if (isPoster) {
      const still = await upright
        .resize({
          width: POSTER_MAX_WIDTH,
          height: Math.round((POSTER_MAX_WIDTH * OUTPUT_ASPECT.h) / OUTPUT_ASPECT.w),
          fit: "cover",
          position: "centre",
          background: PHOTO_PLATE,
        })
        .webp({ quality: POSTER_QUALITY })
        .toBuffer();

      const name = (posterFor as string).split("/").pop()!.split("?")[0];
      const posterName = name.replace(/\.[a-z0-9]+$/i, ".poster.webp");
      return NextResponse.json({ url: await storeMedia(posterName, still, "image/webp") });
    }

    const output =
      readMediaKind(form.get(MEDIA_KIND_FIELD)) === "banner"
        ? await upright
            .resize({ width: BANNER_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: OUTPUT_QUALITY })
            .toBuffer()
        : await cropToOutputAspect(upright);

    const filename = generateFilename(".webp");
    return NextResponse.json({ url: await storeMedia(filename, output, "image/webp") });
  } catch (err) {
    if (err instanceof MediaStorageError) {
      return NextResponse.json(
        { error: "The file could not be saved to storage. Try again in a minute." },
        { status: 502 },
      );
    }
    console.error("Upload failed:", err);
    return NextResponse.json({ error: "The file could not be processed" }, { status: 500 });
  }
}

