import "server-only";
import { prisma } from "../prisma";
import { MAX_ACTIVE_BANNERS } from "../types";
import type { Banner } from "../types";

/**
 * Hero banner database persistence layer.
 *
 * NOTE: (§8.3) Manages hero banner storage, positioning swaps, and active carousel limit enforcement (max 3).
 */

function toBanner(row: {
  id: string; title: string; subtitle: string | null;
  images: string[]; ctaLabel: string | null; ctaHref: string | null;
  ctaSecondaryLabel: string | null; ctaSecondaryHref: string | null;
  isActive: boolean; position: number;
}): Banner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    images: row.images,
    ctaLabel: row.ctaLabel ?? undefined,
    ctaHref: row.ctaHref ?? undefined,
    ctaSecondaryLabel: row.ctaSecondaryLabel ?? undefined,
    ctaSecondaryHref: row.ctaSecondaryHref ?? undefined,
    isActive: row.isActive,
    position: row.position,
  };
}

/**
 * Retrieves active hero banners for the storefront carousel.
 *
 * @returns Array of up to MAX_ACTIVE_BANNERS active banners sorted by position.
 */
export async function getActiveBanners(): Promise<Banner[]> {
  const rows = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: MAX_ACTIVE_BANNERS,
  });
  return rows.map(toBanner);
}

/** Retrieves all banners for the admin panel. */
export async function getAllBanners(): Promise<Banner[]> {
  const rows = await prisma.banner.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toBanner);
}

export async function getBannerById(id: string): Promise<Banner | undefined> {
  const row = await prisma.banner.findUnique({ where: { id } });
  return row ? toBanner(row) : undefined;
}

export interface BannerInput {
  title: string;
  subtitle?: string;
  images: string[];
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  isActive: boolean;
}

/** Raised when a banner cannot be written. */
export class BannerWriteError extends Error {}

/**
 * Enforces active banner threshold constraint (max 3 active banners simultaneously).
 */
async function assertActiveRoom(isActive: boolean, excludeId?: string): Promise<void> {
  if (!isActive) return;
  const live = await prisma.banner.count({
    where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (live >= MAX_ACTIVE_BANNERS) {
    throw new BannerWriteError(
      `${live} banners are already switched on, which is all the home page holds. ` +
        "Switch one off to switch this one on.",
    );
  }
}

export async function createBanner(input: BannerInput): Promise<Banner> {
  await assertActiveRoom(input.isActive);

  const last = await prisma.banner.findFirst({ orderBy: { position: "desc" } });

  const row = await prisma.banner.create({
    data: {
      title: input.title,
      subtitle: input.subtitle ?? null,
      images: input.images,
      ctaLabel: input.ctaLabel ?? null,
      ctaHref: input.ctaHref ?? null,
      ctaSecondaryLabel: input.ctaSecondaryLabel ?? null,
      ctaSecondaryHref: input.ctaSecondaryHref ?? null,
      isActive: input.isActive,
      position: (last?.position ?? 0) + 1,
    },
  });
  return toBanner(row);
}

/**
 * Updates banner content and returns list of dropped media URLs for storage cleanup.
 */
export async function updateBanner(
  id: string,
  input: BannerInput,
): Promise<{ banner: Banner; dropped: string[] }> {
  const before = await prisma.banner.findUnique({ where: { id }, select: { images: true } });
  if (!before) throw new BannerWriteError("Banner not found.");

  await assertActiveRoom(input.isActive, id);

  const row = await prisma.banner.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle ?? null,
      images: input.images,
      ctaLabel: input.ctaLabel ?? null,
      ctaHref: input.ctaHref ?? null,
      ctaSecondaryLabel: input.ctaSecondaryLabel ?? null,
      ctaSecondaryHref: input.ctaSecondaryHref ?? null,
      isActive: input.isActive,
    },
  });

  const kept = new Set(input.images);
  return { banner: toBanner(row), dropped: before.images.filter((u) => !kept.has(u)) };
}

/**
 * Hard deletes banner record and returns associated image URLs for storage bucket deletion.
 */
export async function deleteBanner(id: string): Promise<string[] | undefined> {
  const row = await prisma.banner.findUnique({ where: { id }, select: { images: true } });
  if (!row) return undefined;

  await prisma.banner.delete({ where: { id } });
  return row.images;
}

/**
 * Swaps ordering positions between adjacent banners.
 */
export async function moveBanner(id: string, direction: "up" | "down"): Promise<boolean> {
  const all = await prisma.banner.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, position: true },
  });
  const at = all.findIndex((b) => b.id === id);
  if (at === -1) return false;

  const swapWith = direction === "up" ? at - 1 : at + 1;
  if (swapWith < 0 || swapWith >= all.length) return false;

  const a = all[at];
  const b = all[swapWith];
  await prisma.$transaction([
    prisma.banner.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.banner.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  return true;
}

