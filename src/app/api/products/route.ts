import { NextResponse } from "next/server";
import { createProduct, getAllProducts, ProductWriteError } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { productSchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/revalidate";

/**
 * Products collection endpoint for administrative listing and product creation.
 *
 * NOTE: (§2.3, §2.4, §8.1, §9.4) Restricted to staff; emits PRODUCT_CREATED audit log and triggers catalog tag revalidation.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json(await getAllProducts());
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed product data" },
      { status: 400 },
    );
  }

  let product;
  try {
    product = await createProduct(parsed.data);
  } catch (err) {
    if (err instanceof ProductWriteError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Product creation failed:", err);
    return NextResponse.json({ error: "The product could not be created." }, { status: 500 });
  }

  await logAudit({
    actor: admin.id,
    action: "PRODUCT_CREATED",
    target: product.id,
    ip: clientIp(request),
    details: { nameUk: product.nameUk, price: product.price },
  });

  revalidateCatalog();
  return NextResponse.json(product, { status: 201 });
}

