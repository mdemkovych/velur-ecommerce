import { NextResponse } from "next/server";
import {
  deleteProductForever,
  getProductById,
  ProductWriteError,
  restoreProduct,
  softDeleteProduct,
  updateProduct,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { productSchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/revalidate";
import { removeMedia } from "@/lib/storage";

/**
 * Single product management endpoint supporting public storefront inspection, updates, and soft/hard deletions.
 *
 * NOTE: (§2.3, §2.4, §2.5, §6.5, §9.4) Allows admins to view soft-deleted records, updates product details with orphan media removal,
 * and handles permanent deletion under transaction safety checks.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const isAdmin = Boolean(await requireAdmin());
  const product = await getProductById((await props.params).id, {
    includeDeleted: isAdmin,
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const existing = await getProductById(id, { includeDeleted: true });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed product data" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await updateProduct(existing.id, parsed.data);
  } catch (err) {
    if (err instanceof ProductWriteError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Product update failed:", err);
    return NextResponse.json({ error: "The product could not be saved." }, { status: 500 });
  }

  // NOTE: (§6.5) Removes orphan media files from Supabase Storage after the write.
  // MUST NOT: move this before the write; a storage failure would then undo a save
  // the manager already saw succeed.
  await removeMedia(result.dropped);

  const updated = result.product;
  await logAudit({
    actor: admin.id,
    action: "PRODUCT_UPDATED",
    target: id,
    ip: clientIp(request),
    details: { nameUk: updated.nameUk, price: updated.price, stock: updated.stock },
  });

  revalidateCatalog();
  return NextResponse.json(updated);
}

/** NOTE: (§2.5) Soft-delete and permanent delete handler with orphan media cleanup. */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const params = new URL(request.url).searchParams;
  const restore = params.get("restore") === "true";

  if (params.get("forever") === "true") {
    const { outcome, dropped } = await deleteProductForever(id);
    if (outcome === "missing") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (outcome === "ordered") {
      return NextResponse.json(
        { error: "This product has been ordered before, so it can only be hidden." },
        { status: 409 },
      );
    }
    if (outcome === "in-set") {
      return NextResponse.json(
        {
          error:
            "This product is part of a set — take it out of the set first, " +
            "then delete it.",
        },
        { status: 409 },
      );
    }

    // NOTE: (§6.5) Deletes media from Supabase Storage after the row is gone.
    await removeMedia(dropped);

    await logAudit({
      actor: admin.id,
      action: "PRODUCT_DELETED",
      target: id,
      ip: clientIp(request),
      details: { permanent: true, mediaRemoved: dropped.length },
    });
    revalidateCatalog();
    return NextResponse.json({ success: true });
  }

  const changed = await (restore ? restoreProduct(id) : softDeleteProduct(id));

  if (!changed) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await logAudit({
    actor: admin.id,
    action: restore ? "PRODUCT_RESTORED" : "PRODUCT_DELETED",
    target: id,
    ip: clientIp(request),
  });

  revalidateCatalog();
  return NextResponse.json({ success: true });
}

