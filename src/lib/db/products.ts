import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CATALOG_TAG } from "../revalidate";
import type { AdminProduct, ManualBadge, Product, SpecPair } from "../types";

/**
 * Catalog database persistence and query layer.
 *
 * NOTE: (§2.3, §2.4, §2.5, §7.1, §9.4) Manages products, set components, categories, manual ordering, and soft/hard deletions.
 */

/** Everything a card or a product page needs, in one round trip. */
const productShape = {
  include: {
    category: true,
    // NOTE: (§2.3) Component items bundled in a product set.
    components: {
      orderBy: { position: "asc" },
      include: { component: { select: { id: true, slug: true, nameUk: true, media: true } } },
    },
  },
} satisfies Prisma.ProductDefaultArgs;

type ProductRow = Prisma.ProductGetPayload<typeof productShape>;

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameUk: row.nameUk,
    tagline: row.tagline,
    description: row.description,
    usage: row.usage,
    specifications: (row.specifications as SpecPair[] | null) ?? [],
    category: row.category.slug,
    categoryNameUk: row.category.nameUk,
    media: row.media,
    image: row.media[0] ?? "",
    price: row.price,
    promotionalPrice: row.promotionalPrice ?? undefined,
    stock: row.stock,
    badge: (row.badge as ManualBadge | null) ?? undefined,
    packaging: row.packaging,
    isDeleted: row.isDeleted,
    components: row.components.map((c) => ({
      productId: c.component.id,
      slug: c.component.slug,
      nameUk: c.component.nameUk,
      image: c.component.media[0] ?? "",
      quantity: c.quantity,
    })),
  };
}

/** NOTE: (§7.1) Default catalog sorting: position ASC, createdAt DESC. */
const catalogOrder = [{ position: "asc" }, { createdAt: "desc" }] satisfies
  Prisma.ProductOrderByWithRelationInput[];

async function readPublishedProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { isDeleted: false },
    orderBy: catalogOrder,
    ...productShape,
  });
  return rows.map(toProduct);
}

/** NOTE: (§9.4) Catalog cache TTL (60s) synchronized across SSR catalog routes. */
const CATALOG_TTL_SECONDS = 60;

/**
 * NOTE: (§9.4) Next.js unstable_cache wrapper tagged with CATALOG_TAG for on-demand revalidation.
 */
export const getPublishedProducts = unstable_cache(
  readPublishedProducts,
  ["published-products"],
  { revalidate: CATALOG_TTL_SECONDS, tags: [CATALOG_TAG] },
);

/**
 * Queries published product slugs for static generation.
 *
 * NOTE: (§2.4) Excludes soft-deleted records.
 */
export async function getPublishedProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { isDeleted: false },
    orderBy: catalogOrder,
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/**
 * Queries published slugs with the moment each product last changed.
 *
 * NOTE: (§7.3) Feeds `lastModified` in the sitemap, which is the one place a
 * real timestamp is worth a query; the catalogue view type stays without one.
 */
export async function getPublishedProductRevisions(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  return prisma.product.findMany({
    where: { isDeleted: false },
    orderBy: catalogOrder,
    select: { slug: true, updatedAt: true },
  });
}

/**
 * Administrative product list query including order attachment indicator and soft-deleted records.
 *
 * NOTE: (§2.5, §7.1)
 */
export async function getAllProducts(): Promise<AdminProduct[]> {
  const rows = await prisma.product.findMany({
    orderBy: catalogOrder,
    ...productShape,
    include: { ...productShape.include, _count: { select: { orderItems: true } } },
  });

  return rows.map((row) => ({
    ...toProduct(row),
    hasOrders: row._count.orderItems > 0,
  }));
}

/** Looks up a product by slug or database ID. */
export async function getProductById(
  idOrSlug: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Product | undefined> {
  if (!idOrSlug) return undefined;
  const key = decodeURIComponent(idOrSlug);

  const row = await prisma.product.findFirst({
    where: { OR: [{ slug: key }, { id: key }] },
    ...productShape,
  });
  if (!row) return undefined;
  if (row.isDeleted && !options.includeDeleted) return undefined;
  return toProduct(row);
}

export interface CategoryInput {
  slug: string;
  nameUk: string;
}

/** Raised when a category cannot be written. */
export class CategoryWriteError extends Error {}

/** NOTE: (§2.4) Creates category with manual Latin slug and Ukrainian name. */
export async function createCategory(input: CategoryInput): Promise<{ slug: string; nameUk: string }> {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new CategoryWriteError(
      `A category at the address «${input.slug}» already exists — it is «${existing.nameUk}».`,
    );
  }

  const last = await prisma.category.findFirst({ orderBy: { position: "desc" } });

  const created = await prisma.category.create({
    data: { slug: input.slug, nameUk: input.nameUk, position: (last?.position ?? 0) + 1 },
    select: { slug: true, nameUk: true },
  });
  return created;
}

/** NOTE: (§8.3) Updates category slug and Ukrainian title. */
export async function updateCategory(
  slug: string,
  input: { nameUk: string; slug?: string },
): Promise<{ slug: string; nameUk: string }> {
  const nextSlug = input.slug?.trim() || slug;

  if (nextSlug !== slug) {
    const taken = await prisma.category.findUnique({ where: { slug: nextSlug } });
    if (taken) {
      throw new CategoryWriteError(`A category named «${nextSlug}» already exists.`);
    }
  }

  const { count } = await prisma.category.updateMany({
    where: { slug },
    data: { nameUk: input.nameUk, slug: nextSlug },
  });
  if (count === 0) throw new CategoryWriteError(`Category «${slug}» was not found.`);
  return { slug: nextSlug, nameUk: input.nameUk };
}

/** NOTE: (§7.4) Batch resolves product names for cart hydration. Includes soft-deleted items. */
export async function getProductNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const rows = await prisma.product.findMany({
    where: { OR: [{ id: { in: ids } }, { slug: { in: ids } }] },
    select: { id: true, slug: true, nameUk: true },
  });

  const names = new Map<string, string>();
  for (const row of rows) {
    names.set(row.id, row.nameUk);
    names.set(row.slug, row.nameUk);
  }
  return names;
}

/** NOTE: (§12.4) Reads active categories sorted by position. */
export async function getCategories(): Promise<{ slug: string; nameUk: string }[]> {
  return readCategories();
}

/** Categories in editorial order, as the storefront and the panel both list them. */
function readCategories(): Promise<{ slug: string; nameUk: string }[]> {
  return prisma.category.findMany({
    orderBy: { position: "asc" },
    select: { slug: true, nameUk: true },
  });
}

/**
 * The category list as the storefront reads it, cached under the catalogue tag.
 *
 * NOTE: (§9.4) Dropped by `revalidateCatalog()`, which every category write
 * calls, so a new or renamed category still appears at once.
 *
 * MUST NOT: serve a public page addressed by a URL segment from the uncached
 * `getCategories()`. `/catalog/category/<anything>` renders on demand and no
 * rate limit covers it, so each unknown slug would be a Postgres round trip on
 * the pool the checkout shares — a catalogue crawl could starve the orders.
 */
export const getPublishedCategories = unstable_cache(
  readCategories,
  ["published-categories"],
  { revalidate: CATALOG_TTL_SECONDS, tags: [CATALOG_TAG] },
);

export interface ProductComponentInput {
  productId: string;
  quantity: number;
}

export interface ProductInput {
  slug: string;
  nameUk: string;
  name: string;
  tagline: string;
  description: string;
  usage: string;
  specifications: SpecPair[];
  media: string[];
  categorySlug: string;
  badge?: ManualBadge;
  packaging: string;
  price: number;
  promotionalPrice?: number;
  stock: number;
  components?: ProductComponentInput[];
}

/** NOTE: (§2.3) Replaces component composition records for bundled sets. */
async function writeComponents(
  tx: Prisma.TransactionClient,
  setId: string,
  components: ProductComponentInput[] | undefined,
): Promise<void> {
  await tx.productComponent.deleteMany({ where: { setId } });
  const rows = (components ?? []).filter((c) => c.productId !== setId);
  if (rows.length === 0) return;

  await tx.productComponent.createMany({
    data: rows.map((c, index) => ({
      setId,
      componentId: c.productId,
      quantity: c.quantity,
      position: index,
    })),
  });
}

export class ProductWriteError extends Error {}

function toProductWriteError(err: unknown): ProductWriteError {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return new ProductWriteError("A product with that page address already exists. Change the address.");
  }
  console.error("Product write failed:", err);
  return new ProductWriteError("The product could not be saved. Try again.");
}

async function requireCategory(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) {
    throw new ProductWriteError(
      `Category «${slug}» was not found. Choose one from the list.`,
    );
  }
  return category;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const category = await requireCategory(input.categorySlug);

  // NOTE: (§7.1) Prepend-orders new products at the top of the catalog.
  const first = await prisma.product.findFirst({
    orderBy: { position: "asc" },
    select: { position: true },
  });

  try {
    const row = await prisma.product.create({
      data: {
        position: first ? first.position - 1 : 0,
        slug: input.slug,
        nameUk: input.nameUk,
        name: input.name,
        tagline: input.tagline,
        description: input.description,
        usage: input.usage,
        specifications: input.specifications as unknown as Prisma.InputJsonValue,
        media: input.media,
        categoryId: category.id,
        badge: input.badge ?? null,
        packaging: input.packaging,
        price: input.price,
        promotionalPrice: input.promotionalPrice ?? null,
        stock: input.stock,
        components: {
          create: (input.components ?? []).map((c, index) => ({
            componentId: c.productId,
            quantity: c.quantity,
            position: index,
          })),
        },
      },
      include: productShape.include,
    });
    return toProduct(row);
  } catch (err) {
    throw toProductWriteError(err);
  }
}

/**
 * Updates product entity and identifies dropped media URLs.
 *
 * NOTE: (§2.5, §6.5) Updates product record and returns abandoned media URLs for storage bucket cleanup.
 */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<{ product: Product; dropped: string[] }> {
  const category = await requireCategory(input.categorySlug);
  const before = await prisma.product.findUnique({ where: { id }, select: { media: true } });

  try {
    const row = await prisma.$transaction(async (tx) => {
      await writeComponents(tx, id, input.components);

      return tx.product.update({
        where: { id },
        data: {
          slug: input.slug,
          nameUk: input.nameUk,
          name: input.name,
          tagline: input.tagline,
          description: input.description,
          usage: input.usage,
          specifications: input.specifications as unknown as Prisma.InputJsonValue,
          media: input.media,
          categoryId: category.id,
          badge: input.badge ?? null,
          packaging: input.packaging,
          price: input.price,
          promotionalPrice: input.promotionalPrice ?? null,
          stock: input.stock,
        },
        include: productShape.include,
      });
    });

    const kept = new Set(input.media);
    return {
      product: toProduct(row),
      dropped: (before?.media ?? []).filter((u) => !kept.has(u)),
    };
  } catch (err) {
    throw toProductWriteError(err);
  }
}

/** NOTE: (§2.5) Soft-deletes product to preserve order history. */
export async function softDeleteProduct(id: string): Promise<boolean> {
  const { count } = await prisma.product.updateMany({
    where: { id, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

/**
 * Permanently deletes unreferenced product and returns media assets for storage deletion.
 *
 * NOTE: (§2.5) Hard delete permitted only when zero order items and zero bundle references exist.
 */
export async function deleteProductForever(
  id: string,
): Promise<
  | { outcome: "deleted"; dropped: string[] }
  | { outcome: "ordered" | "in-set" | "missing"; dropped: [] }
> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id },
      select: { id: true, media: true },
    });
    if (!product) return { outcome: "missing" as const, dropped: [] };

    const ordered = await tx.orderItem.count({ where: { productId: id } });
    if (ordered > 0) return { outcome: "ordered" as const, dropped: [] };

    const inSets = await tx.productComponent.count({ where: { componentId: id } });
    if (inSets > 0) return { outcome: "in-set" as const, dropped: [] };

    await tx.product.delete({ where: { id } });
    return { outcome: "deleted" as const, dropped: product.media };
  });
}

export async function restoreProduct(id: string): Promise<boolean> {
  const { count } = await prisma.product.updateMany({
    where: { id, isDeleted: true },
    data: { isDeleted: false },
  });
  return count > 0;
}

/**
 * Batch updates product ordering positions.
 *
 * NOTE: (§7.1) Updates explicit catalog ordering positions across a batch of product IDs.
 */
export async function reorderProducts(ids: readonly string[]): Promise<number> {
  return prisma.$transaction(async (tx) => {
    let moved = 0;
    for (const [position, id] of ids.entries()) {
      const { count } = await tx.product.updateMany({ where: { id }, data: { position } });
      moved += count;
    }
    return moved;
  });
}

