/**
 * Fixtures and the safety catch for the tests that need a real database.
 *
 * NOTE: (§1.5) A separate command and a separate folder, because `npm test` has
 * to stay safe to run without thinking and this checkout's `DATABASE_URL` is
 * production.
 *
 * Everything is created here and removed again in `cleanup`: one category, one
 * product per test file, and whatever orders the tests place. No row that was
 * already in the database is read for an assertion or written to.
 *
 * The rows are found in more than one way and `cleanup` has to use each:
 * catalogue rows carry `TEST_MARKER` in their slug, orders carry no marker and
 * go by the `testPhone` prefix, and audit entries about an order that never
 * existed carry `UNKNOWN_ORDER_ID`, which no order leads to. A run that crashes
 * before `cleanup` leaves rows of each kind behind, and each kind needs its
 * own query:
 *
 *     select id, phone from orders where phone like '+38099000%';
 *     select slug from products where slug like 'zz-dbtest%';
 *     select id, action from audit_log where target like 'VSL-DBTEST%';
 *
 * Deleting an order cascades to its lines (`OrderItem.onDelete: Cascade`), which
 * is what frees the product to be deleted after it. Audit entries have no
 * foreign key to orders, so they are removed explicitly by `target`.
 */

import { prisma } from "../../src/lib/prisma";

/** In the slug of every catalogue row this suite creates. Orders carry the
 *  `testPhone` prefix instead; see the markers above. */
export const TEST_MARKER = "dbtest";

/**
 * Refuses to run unless somebody asked for it in so many words.
 *
 * Deliberately not a check on `NODE_ENV` or on the host in `DATABASE_URL`:
 * there is one database here and it is the production one, so a check like that
 * would either block the tests entirely or be a lie. The honest guard is an
 * explicit flag plus printing which database is about to be written to.
 */
export function requireExplicitOptIn(): void {
  if (process.env.ALLOW_DB_TESTS !== "1") {
    console.error(
      "\n  These tests write to a real database.\n" +
        "  Run them deliberately:  ALLOW_DB_TESTS=1 npm run test:db\n",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? "";
  const project = url.match(/postgres\.([a-z0-9]{20})/)?.[1] ?? "(unknown)";
  console.error(`  Database these tests write to: project ${project}\n`);
}

/** A phone nobody real will have, and a prefix `cleanup` can select on. */
export function testPhone(n: number): string {
  return `+38099000${String(n).padStart(4, "0")}`;
}

/**
 * The order id for "a payment for an order we have never heard of".
 *
 * It must not exist, which is why it carries a marker of its own: `cleanup`
 * finds test orders by phone, and this one has neither an order nor a phone, so
 * the `PAYMENT_UNKNOWN_ORDER` entry it writes is reachable only by `target`.
 */
export const UNKNOWN_ORDER_ID = "VSL-DBTEST-00000";

export interface Fixture {
  categoryId: string;
  productId: string;
  slug: string;
}

/**
 * One category and one product, priced and stocked as the caller asks.
 *
 * `stock` is the number every stock assertion is measured against, so it is
 * given rather than assumed — a test that reads the current stock first and
 * asserts a delta passes even when the reservation did nothing.
 */
export async function createFixture(opts: {
  stock: number;
  price: number;
  promotionalPrice?: number;
}): Promise<Fixture> {
  const suffix = `${TEST_MARKER}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const category = await prisma.category.create({
    data: { slug: `zz-${suffix}`, nameUk: "Test category", position: 9999 },
  });

  const product = await prisma.product.create({
    data: {
      slug: `zz-${suffix}`,
      nameUk: "Test product",
      name: "Test product",
      tagline: "test",
      description: "test",
      usage: "test",
      packaging: "test",
      specifications: [],
      media: ["/images/placeholder.svg"],
      categoryId: category.id,
      price: opts.price,
      promotionalPrice: opts.promotionalPrice ?? null,
      stock: opts.stock,
    },
  });

  return { categoryId: category.id, productId: product.id, slug: product.slug };
}

/** The product's stock as it is right now. */
export async function stockOf(productId: string): Promise<number> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });
  if (!row) throw new Error("the test product vanished");
  return row.stock;
}

/**
 * Removes everything the suite created, in the order the foreign keys allow.
 *
 * Runs even when a test failed — leaving a decremented product and a handful of
 * pending orders in a live catalogue is exactly what this whole arrangement is
 * meant to avoid.
 *
 * It does not sweep a crashed run's catalogue rows, which is the gap the
 * documented queries exist for. Orders go by phone prefix, so a leftover from an
 * earlier run is caught; the product and the category go by this fixture's own
 * ids, so a leftover is not. There is no "published" flag on a product and the
 * public catalogue filters on `isDeleted` alone, so an orphaned «Test
 * product» stands on the shop's shelves until somebody removes it by hand.
 */
export async function cleanup(fixture: Fixture): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { phone: { startsWith: "+38099000" } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);

  if (ids.length > 0) {
    // No foreign key ties an audit entry to an order, so these would otherwise
    // outlive the rows they describe.
    await prisma.auditLog.deleteMany({ where: { target: { in: ids } } });
    // Lines go with the order — `OrderItem.onDelete: Cascade`.
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  // The entries written about orders that never existed. Selected by prefix
  // rather than by the list above, because by definition they are not in it.
  await prisma.auditLog.deleteMany({ where: { target: { startsWith: "VSL-DBTEST" } } });

  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
}

/** Closes the pool so the test process can exit. */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
