import { NextResponse } from "next/server";
import { CategoryWriteError, updateCategory } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
 import { clientIp, logAudit } from "@/lib/auditLogger";
 import { categoryRenameSchema } from "@/lib/validation";
 import { revalidateCatalog } from "@/lib/revalidate";

/**
 * Category renaming and slug update endpoint.
 *
 * NOTE: (§2.4, §9.4) Updates Ukrainian display title or Latin slug with cascading product updates and cache invalidation.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id?: string; slug: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { slug } = await props.params;
  const parsed = categoryRenameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed name" },
      { status: 400 },
    );
  }

  let category;
  try {
    category = await updateCategory(slug, parsed.data);
  } catch (err) {
    if (err instanceof CategoryWriteError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Category rename failed:", err);
    return NextResponse.json({ error: "The category could not be renamed." }, { status: 500 });
  }

  await logAudit({
    actor: admin.id,
    action: "CATEGORY_UPDATED",
    target: category.slug,
    ip: clientIp(request),
    details: { nameUk: category.nameUk, slug: category.slug },
  });

  revalidateCatalog();
  return NextResponse.json(category);
}

