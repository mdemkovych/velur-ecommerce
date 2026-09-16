import { NextResponse } from "next/server";
import { reorderProducts } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { productOrderSchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/revalidate";

/**
 * Bulk product catalog display order update endpoint.
 *
 * NOTE: (§7.1, §9.4) Updates position ordering integers atomically and invalidates catalog cache.
 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = productOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed order" },
      { status: 400 },
    );
  }

  const moved = await reorderProducts(parsed.data.ids);

  await logAudit({
    actor: admin.id,
    action: "PRODUCTS_REORDERED",
    target: "catalog",
    ip: clientIp(request),
    details: { moved },
  });

  revalidateCatalog();
  return NextResponse.json({ ok: true, moved });
}

