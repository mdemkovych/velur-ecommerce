import { NextResponse } from "next/server";
import { z } from "zod";
import { BannerWriteError, deleteBanner, getBannerById, moveBanner, updateBanner } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { removeMedia } from "@/lib/storage";
import { bannerSchema } from "@/lib/validation";
import { revalidateHome } from "@/lib/revalidate";

/**
 * Single banner management endpoint for updating content, reordering, and deletion.
 *
 * NOTE: (§8.3, §9.4) Cleans up orphan banner photographs from storage after successful updates or deletions.
 */

const moveSchema = z.object({ move: z.enum(["up", "down"]) });

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const body = await request.json().catch(() => null);

  const move = moveSchema.safeParse(body);
  if (move.success) {
    if (!(await moveBanner(id, move.data.move))) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    revalidateHome();
    return NextResponse.json({ success: true });
  }

  const parsed = bannerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed banner data" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await updateBanner(id, parsed.data);
  } catch (err) {
    if (err instanceof BannerWriteError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Banner update failed:", err);
    return NextResponse.json({ error: "The banner could not be saved." }, { status: 500 });
  }

  await removeMedia(result.dropped);

  await logAudit({
    actor: admin.id,
    action: "BANNER_UPDATED",
    target: id,
    ip: clientIp(request),
    details: { title: result.banner.title, photos: result.banner.images.length },
  });

  revalidateHome();
  return NextResponse.json(result.banner);
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const existing = await getBannerById(id);
  const images = await deleteBanner(id);
  if (images === undefined) {
    return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  }

  await removeMedia(images);

  await logAudit({
    actor: admin.id,
    action: "BANNER_DELETED",
    target: id,
    ip: clientIp(request),
    details: { title: existing?.title },
  });

  revalidateHome();
  return NextResponse.json({ success: true });
}

