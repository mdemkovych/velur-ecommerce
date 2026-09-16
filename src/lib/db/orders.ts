import "server-only";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { canTransition, chargedPrice, ORDER_STATUSES, PENDING_PAYMENT_TTL_MINUTES } from "../types";
import { DEFAULT_STAT_PERIOD, periodStart, type StatPeriod } from "../orderPeriods";
import { PRIVACY_POLICY_VERSION } from "../storeContent";
import type { ManualOrderStatus, Order, OrderCustomer, OrderStatus } from "../types";
import type { OrderCustomerPatch } from "../validation";

/**
 * Order persistence, stock reservations, state machine transitions, and staff journal queries.
 *
 * NOTE: (§3.1, §3.5, §4.1, §4.2, §4.3, §4.4, §4.5, §8.4, §8.5)
 */

/** NOTE: (§3.1) Maximum hosted checkout session attempts per order. */
export const MAX_PAYMENT_ATTEMPTS = 5;

export const orderShape = {
  include: {
    items: {
      orderBy: { id: "asc" },
      include: { product: { select: { media: true } } },
    },
  },
} satisfies Prisma.OrderDefaultArgs;

type OrderRow = Prisma.OrderGetPayload<typeof orderShape>;

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    status: row.status as OrderStatus,
    customer: {
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email,
      city: row.city,
      cityRef: row.cityRef,
      deliveryMethod: row.deliveryMethod === "COURIER" ? "courier" : "branch",
      branch: row.branch ?? undefined,
      branchRef: row.branchRef ?? undefined,
      address: row.address ?? undefined,
      paymentMethod: "mono",
      comment: row.comment ?? undefined,
    },
    items: row.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      nameUk: i.nameUk,
      price: i.price,
      quantity: i.quantity,
      // NOTE: (§2.5) Displays current product thumbnail dynamically rather than historical snapshot.
      image: i.product.media[0] ?? undefined,
      returnedQuantity: i.returnedQuantity,
      restockedQuantity: i.restockedQuantity,
    })),
    total: row.total,
    invoiceId: row.invoiceId ?? undefined,
    paymentAttempts: row.paymentAttempts,
    paidAt: row.paidAt?.toISOString(),
    trackingNumber: row.trackingNumber ?? undefined,
    managerNote: row.managerNote ?? undefined,
    archivedAt: row.archivedAt?.toISOString(),
    needsReview: row.needsReview,
    reviewNote: row.reviewNote ?? undefined,
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** NOTE: (§8.4) Order list pagination page size (20 items per page). */
export const ORDERS_PAGE_SIZE = 20;

export interface OrderListQuery {
  archived?: boolean;
  status?: OrderStatus;
  period?: StatPeriod;
  search?: string;
  cursor?: string;
}

export interface OrderPage {
  orders: Order[];
  nextCursor: string | null;
}

/** NOTE: (§8.4) Dotted term search over order ID, customer name, phone, email, and waybill number. */
function searchWhere(search: string): Prisma.OrderWhereInput | undefined {
  const terms = search.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return undefined;

  return {
    AND: terms.map((term) => ({
      OR: [
        { id: { contains: term, mode: "insensitive" as const } },
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { phone: { contains: term } },
        { email: { contains: term, mode: "insensitive" as const } },
        { trackingNumber: { contains: term } },
      ],
    })),
  };
}

/** NOTE: (§8.4) Queries paginated orders journal with status and date period filters. */
export async function listOrders(query: OrderListQuery): Promise<OrderPage> {
  const from = periodStart(query.period ?? DEFAULT_STAT_PERIOD, new Date());

  const rows = await prisma.order.findMany({
    where: {
      archivedAt: query.archived ? { not: null } : null,
      ...(query.status ? { status: query.status } : {}),
      ...(from ? { createdAt: { gte: from } } : {}),
      ...(query.search ? searchWhere(query.search) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ORDERS_PAGE_SIZE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    ...orderShape,
  });

  const hasMore = rows.length > ORDERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ORDERS_PAGE_SIZE) : rows;

  return {
    orders: page.map(toOrder),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export interface OrderStats {
  byPeriod: Record<StatPeriod, number>;
  byStatus: Record<OrderStatus, number>;
}

/** NOTE: (§8.4) Aggregates order metrics across time windows and statuses in a single transaction. */
export async function getOrderStats(now: Date = new Date()): Promise<OrderStats> {
  const [today, week, month, year, ...statusCounts] = await prisma.$transaction([
    prisma.order.count({ where: { createdAt: { gte: periodStart("today", now) } } }),
    prisma.order.count({ where: { createdAt: { gte: periodStart("week", now) } } }),
    prisma.order.count({ where: { createdAt: { gte: periodStart("month", now) } } }),
    prisma.order.count({ where: { createdAt: { gte: periodStart("year", now) } } }),
    ...ORDER_STATUSES.map((status) => prisma.order.count({ where: { status } })),
  ]);

  const byStatus = Object.fromEntries(
    ORDER_STATUSES.map((status, i) => [status, statusCounts[i]]),
  ) as Record<OrderStatus, number>;

  const all = statusCounts.reduce((sum, count) => sum + count, 0);

  return { byPeriod: { today, week, month, year, all }, byStatus };
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const row = await prisma.order.findUnique({ where: { id }, ...orderShape });
  return row ? toOrder(row) : undefined;
}

/** Generates unique human-readable order ID with Europe/Kyiv date component (e.g. VSL-YYYYMMDD-XXXXX). */
function generateOrderId(): string {
  const yyyymmdd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");

  return `VSL-${yyyymmdd}-${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export type CreateOrderResult = { order: Order } | { error: string };

class OutOfStockError extends Error {}

/** NOTE: (§4.3) Maximum active unpaid pending orders allowed per customer phone number. */
const MAX_ACTIVE_UNPAID_ORDERS = 3;

class CheckoutBlockedError extends Error {}

const MAX_ORDER_ID_ATTEMPTS = 3;

function isOrderIdCollision(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** NOTE: (§4.3) Duplicate order lookup predicate for identical cart contents and active payment TTL. */
function duplicateWhere(phone: string, fingerprint: string) {
  return {
    phone,
    status: "PENDING_PAYMENT" as const,
    cartFingerprint: fingerprint,
    expiresAt: { gt: new Date() },
  };
}

/** NOTE: (§4.3) Computes 60-bit transactional advisory lock key from phone and cart fingerprint. */
function cartLockKey(phone: string, fingerprint: string): bigint {
  const digest = crypto.createHash("sha256").update(`${phone}|${fingerprint}`).digest("hex");
  return BigInt(`0x${digest.slice(0, 15)}`);
}

/** NOTE: (§4.3) Computes deterministic SHA-256 fingerprint from sorted product IDs and quantities. */
function fingerprintCart(lines: CartLine[]): string {
  const canonical = lines
    .map((line) => `${line.productId}:${line.quantity}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** NOTE: (§3.5, §4.2, §4.3) Creates order, decrements stock atomically with row locks, and returns reservation. */
export async function createOrder(
  customer: OrderCustomer,
  lines: CartLine[],
): Promise<CreateOrderResult> {
  const fingerprint = fingerprintCart(lines);
  const existing = await prisma.order.findFirst({
    where: duplicateWhere(customer.phone, fingerprint),
    orderBy: { createdAt: "desc" },
    ...orderShape,
  });
  if (existing) return { order: toOrder(existing) };

  for (let attempt = 1; attempt <= MAX_ORDER_ID_ATTEMPTS; attempt += 1) {
    const result = await attemptCreateOrder(customer, lines, fingerprint);
    if ("retry" in result) {
      console.warn(`Order id collision, retrying (attempt ${attempt})`);
      continue;
    }
    return result;
  }

  console.error("Order creation failed: order id collided on every attempt");
  return { error: "The order could not be created. Try again." };
}

async function attemptCreateOrder(
  customer: OrderCustomer,
  lines: CartLine[],
  fingerprint: string,
): Promise<CreateOrderResult | { retry: true }> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${cartLockKey(customer.phone, fingerprint)})`;

      const duplicate = await tx.order.findFirst({
        where: duplicateWhere(customer.phone, fingerprint),
        orderBy: { createdAt: "desc" },
        ...orderShape,
      });
      if (duplicate) return duplicate;

      const activeUnpaid = await tx.order.count({
        where: {
          phone: customer.phone,
          status: "PENDING_PAYMENT",
          expiresAt: { gt: new Date() },
        },
      });
      if (activeUnpaid >= MAX_ACTIVE_UNPAID_ORDERS) {
        throw new CheckoutBlockedError(
          `This number already has ${activeUnpaid} orders awaiting payment. ` +
            "Pay them, or wait until they are cancelled.",
        );
      }

      const items: {
        productId: string;
        nameUk: string;
        price: number;
        quantity: number;
        image: string | null;
      }[] = [];

      for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const product = await tx.product.findFirst({
          where: { OR: [{ id: line.productId }, { slug: line.productId }], isDeleted: false },
        });
        if (!product) {
          throw new OutOfStockError("One of the products is no longer available. Refresh the basket.");
        }

        // NOTE: (§4.2) Direct atomic decrement with conditional stock threshold check.
        // MUST NOT: split this into a read and a write; that is how two shoppers bought the last unit.
        const { count } = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (count === 0) {
          const left = await tx.product.findUnique({
            where: { id: product.id },
            select: { stock: true },
          });
          throw new OutOfStockError(
            (left?.stock ?? 0) <= 0
              ? `«${product.nameUk}» has sold out. Remove it from the basket.`
              : `Only ${left?.stock} pcs of «${product.nameUk}» are left. Change the quantity in the basket.`,
          );
        }

        items.push({
          productId: product.id,
          nameUk: product.nameUk,
          price: chargedPrice(product),
          quantity: line.quantity,
          image: product.media[0] ?? null,
        });
      }

      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      return tx.order.create({
        data: {
          id: generateOrderId(),
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          email: customer.email,
          city: customer.city,
          cityRef: customer.cityRef,
          deliveryMethod: customer.deliveryMethod === "courier" ? "COURIER" : "BRANCH",
          branch: customer.branch ?? null,
          branchRef: customer.branchRef ?? null,
          address: customer.address ?? null,
          comment: customer.comment ?? null,
          consentAt: new Date(),
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          total,
          cartFingerprint: fingerprint,
          expiresAt: new Date(Date.now() + PENDING_PAYMENT_TTL_MINUTES * 60 * 1000),
          items: { create: items },
        },
        ...orderShape,
      });
    });

    return { order: toOrder(created) };
  } catch (err) {
    if (err instanceof OutOfStockError || err instanceof CheckoutBlockedError) {
      return { error: err.message };
    }
    if (isOrderIdCollision(err)) return { retry: true };
    console.error("Order creation failed:", err);
    return { error: "The order could not be created. Try again." };
  }
}

/** NOTE: (§4.1, §8.5) Updates order status and tracking waybill number with transition table validation. */
export async function updateOrder(
  id: string,
  patch: { status?: OrderStatus; trackingNumber?: string; managerNote?: string },
): Promise<Order | undefined> {
  try {
    if (!patch.status) {
      const row = await prisma.order.update({ where: { id }, data: patch, ...orderShape });
      return toOrder(row);
    }

    const current = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!current) return undefined;

    const from = current.status as OrderStatus;
    if (!canTransition(from, patch.status as ManualOrderStatus)) return undefined;

    const { count } = await prisma.order.updateMany({
      where: { id, status: from },
      data: patch,
    });
    if (count === 0) return undefined;

    return await getOrderById(id);
  } catch (err) {
    console.error("Order update failed:", err);
    return undefined;
  }
}

/** NOTE: (§8.5) Updates customer shipping details on pending or paid orders prior to dispatch. */
export async function updateOrderCustomer(
  id: string,
  customer: OrderCustomerPatch,
): Promise<Order | undefined> {
  const { count } = await prisma.order.updateMany({
    where: { id, status: { in: ["PENDING_PAYMENT", "PAID"] } },
    data: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      cityRef: customer.cityRef,
      deliveryMethod: customer.deliveryMethod === "courier" ? "COURIER" : "BRANCH",
      branch: customer.deliveryMethod === "branch" ? (customer.branch ?? null) : null,
      branchRef: customer.deliveryMethod === "branch" ? (customer.branchRef ?? null) : null,
      address: customer.deliveryMethod === "courier" ? (customer.address ?? null) : null,
      comment: customer.comment ?? null,
    },
  });
  if (count === 0) return undefined;

  return await getOrderById(id);
}

/** NOTE: (§3.1) Claims Monobank invoice ID atomically using compare-and-swap. */
export async function claimInvoice(
  id: string,
  expectedInvoiceId: string | undefined,
  invoiceId: string,
): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id, status: "PENDING_PAYMENT", invoiceId: expectedInvoiceId ?? null },
    data: { invoiceId },
  });
  return count > 0;
}

/** NOTE: (§3.1) Increments payment attempt counter up to MAX_PAYMENT_ATTEMPTS. */
export async function registerPaymentAttempt(id: string): Promise<Order | null> {
  const { count } = await prisma.order.updateMany({
    where: { id, status: "PENDING_PAYMENT", paymentAttempts: { lt: MAX_PAYMENT_ATTEMPTS } },
    data: { paymentAttempts: { increment: 1 } },
  });
  if (count === 0) return null;

  const row = await prisma.order.findUnique({ where: { id }, ...orderShape });
  return row ? toOrder(row) : null;
}

/** NOTE: (§3.1) Transitions order to PAID idempotently. */
export async function markOrderPaid(id: string, invoiceId?: string): Promise<Order | null> {
  const { count } = await prisma.order.updateMany({
    where: { id, status: "PENDING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date(), ...(invoiceId ? { invoiceId } : {}) },
  });
  if (count === 0) return null;

  const row = await prisma.order.findUnique({ where: { id }, ...orderShape });
  return row ? toOrder(row) : null;
}

/** NOTE: (§8.4) Sets or clears order archive timestamp. */
export async function setOrderArchived(
  id: string,
  archived: boolean,
): Promise<Order | undefined> {
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) return undefined;

  const isFinished =
    order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "RETURNED";
  if (archived && !isFinished) return undefined;

  const row = await prisma.order.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
    ...orderShape,
  });
  return toOrder(row);
}

/** NOTE: (§8.5) Permanently deletes unpaid cancelled orders with zero payment history. */
export async function deleteCancelledOrder(
  id: string,
): Promise<{ outcome: "deleted" | "missing" | "not-cancelled" | "has-payment" }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: { status: true, paidAt: true, needsReview: true },
    });
    if (!order) return { outcome: "missing" as const };
    if (order.status !== "CANCELLED") return { outcome: "not-cancelled" as const };
    if (order.paidAt || order.needsReview) return { outcome: "has-payment" as const };

    await tx.order.delete({ where: { id } });
    return { outcome: "deleted" as const };
  });
}

/** NOTE: (§8.5) Flags order with manager review note. */
export async function flagOrderForReview(id: string, note: string): Promise<void> {
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { reviewNote: true },
  });
  if (!existing) return;

  const stamped = `${new Date().toISOString()} — ${note}`;
  await prisma.order.update({
    where: { id },
    data: {
      needsReview: true,
      reviewNote: existing.reviewNote ? `${existing.reviewNote}\n${stamped}` : stamped,
    },
  });
}

/** NOTE: (§8.5) Resolves and clears order review flag with staff attribution. */
export async function clearOrderReview(
  id: string,
  resolvedBy: string,
): Promise<Order | undefined> {
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { needsReview: true, reviewNote: true },
  });
  if (!existing?.needsReview) return undefined;

  const stamped = `${new Date().toISOString()} — checked by hand (${resolvedBy}), mismatch closed.`;
  const row = await prisma.order.update({
    where: { id },
    data: {
      needsReview: false,
      reviewNote: existing.reviewNote ? `${existing.reviewNote}\n${stamped}` : stamped,
    },
    ...orderShape,
  });
  return toOrder(row);
}

export class StatusChangedError extends Error {}

/** NOTE: (§4.4, §4.5) Cancels order, releases stock reservation under line locks, and rolls back on concurrent status change. */
export async function cancelOrder(
  id: string,
  expectedStatus?: OrderStatus,
): Promise<Order | undefined> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      // NOTE: (§4.5) Acquires row-level exclusive lock on order line items before reading.
      await tx.$executeRaw`SELECT 1 FROM order_items WHERE "orderId" = ${id} FOR UPDATE`;

      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) return null;

      if (
        order.status === "CANCELLED" ||
        order.status === "SHIPPED" ||
        order.status === "DELIVERED" ||
        order.status === "RETURNED"
      ) {
        return null;
      }
      if (expectedStatus && order.status !== expectedStatus) return null;

      // NOTE: (§4.5) Restocks remaining unrefunded units to catalog stock.
      for (const item of order.items) {
        const owed = item.quantity - item.restockedQuantity;
        if (owed <= 0) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: owed } },
        });
      }

      const { count } = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: "CANCELLED" },
      });
      if (count === 0) throw new StatusChangedError();

      return tx.order.findUnique({ where: { id }, ...orderShape });
    });

    return row ? toOrder(row) : undefined;
  } catch (err) {
    if (err instanceof StatusChangedError) return undefined;
    console.error("Order cancellation failed:", err);
    return undefined;
  }
}

