import { NextResponse } from "next/server";
import { createCategory, CategoryWriteError, getCategories } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { categorySchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/revalidate";

/**
 * Product category collection and management endpoint.
 *
 * NOTE: (§2.4, §8.1, §9.4) Admin-only endpoint for listing and creating product categories with Next.js cache revalidation.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json(await getCategories());
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed category data" },
      { status: 400 },
    );
  }

  let category;
  try {
    category = await createCategory(parsed.data);
  } catch (err) {
    if (err instanceof CategoryWriteError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Category creation failed:", err);
    return NextResponse.json({ error: "The category could not be created." }, { status: 500 });
  }

  await logAudit({
    actor: admin.id,
    action: "CATEGORY_CREATED",
    target: category.slug,
    ip: clientIp(request),
    details: { nameUk: category.nameUk },
  });

  revalidateCatalog();
  return NextResponse.json(category, { status: 201 });
}

