import { NextResponse } from "next/server";
import { BannerWriteError, createBanner, getAllBanners } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { bannerSchema } from "@/lib/validation";
import { revalidateHome } from "@/lib/revalidate";

/**
 * Home hero banner collection endpoint for admin panel.
 *
 * NOTE: (§8.3, §9.4) Handles hero carousel banner listing and creation (enforcing max 3 active banner limit).
 */

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json(await getAllBanners());
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = bannerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed banner data" },
      { status: 400 },
    );
  }

  let banner;
  try {
    banner = await createBanner(parsed.data);
  } catch (err) {
    if (err instanceof BannerWriteError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Banner creation failed:", err);
    return NextResponse.json({ error: "The banner could not be created." }, { status: 500 });
  }

  await logAudit({
    actor: admin.id,
    action: "BANNER_CREATED",
    target: banner.id,
    ip: clientIp(request),
    details: { title: banner.title, photos: banner.images.length },
  });

  revalidateHome();
  return NextResponse.json(banner, { status: 201 });
}

