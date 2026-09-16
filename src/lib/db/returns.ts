import "server-only";
import { prisma } from "../prisma";
import { getOrderById, orderShape, StatusChangedError, toOrder } from "./orders";
import { canRecordReturn } from "../types";
import type { Order, OrderStatus } from "../types";

/**
 * Product returns and item restocking persistence layer.
 *
 * NOTE: (§4.6) Manages partial/full item returns, calculates net return totals, and adjusts product inventory delta under row lock.
 */

/**
 * Records return quantities on a specific order line item and adjusts inventory accordingly.
 *
 * NOTE: (§4.5, §4.6) Uses row-level lock (FOR UPDATE) in a transaction to prevent race conditions during inventory restock calculations.
 *
 * @param orderId Human-readable order identifier.
 * @param itemId Specific OrderItem UUID.
 * @param returnedQuantity Units marked as returned.
 * @param restock True to return units back to available product stock.
 * @returns Updated order entity or null if not permitted.
 */
export async function setItemReturn(
  orderId: string,
  itemId: string,
  returnedQuantity: number,
  restock: boolean,
): Promise<Order | null> {
  /*
   * `FOR UPDATE` before the read, never after it (§4.5). The transaction alone
   * is not enough: at READ COMMITTED two saves of one line both read the old
   * `restockedQuantity`, and the second blocks on the `update` only once its
   * delta is already wrong.
   */
  const applied = await prisma.$transaction(async (tx) => {
    // NOTE: (§4.5, §4.6) Row-level lock ensures atomic calculation of restocked delta under concurrent updates.
    await tx.$executeRaw`SELECT 1 FROM order_items WHERE id = ${itemId} FOR UPDATE`;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    // NOTE: (§4.5, §4.6) Validates status permits return (cannot return from CANCELLED).
    if (!order || !canRecordReturn(order.status as OrderStatus)) return false;

    const item = await tx.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { quantity: true, productId: true, restockedQuantity: true },
    });
    if (!item) return false;

    const returned = Math.max(0, Math.min(Math.trunc(returnedQuantity), item.quantity));
    const restockTarget = restock ? returned : 0;
    // NOTE: (§4.6) Restocks inventory based on the net delta difference.
    const delta = restockTarget - item.restockedQuantity;

    await tx.orderItem.update({
      where: { id: itemId },
      data: { returnedQuantity: returned, restockedQuantity: restockTarget },
    });

    if (delta > 0) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: delta } },
      });
    } else if (delta < 0) {
      // NOTE: (§4.6) Prevents inventory from going negative if stock was subsequently sold.
      await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: -delta } },
        data: { stock: { decrement: -delta } },
      });
    }

    return true;
  });


  if (!applied) return null;

  return (await getOrderById(orderId)) ?? null;
}

/**
 * Marks entire order as returned across all line items.
 *
 * NOTE: (§4.6) Allowed strictly from SHIPPED or DELIVERED status.
 *
 * @param id Order identifier.
 * @returns Updated order entity or undefined if status transition is invalid.
 */
export async function markOrderReturned(id: string): Promise<Order | undefined> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) return null;
      // Only from a state the goods could have reached the customer from.
      if (order.status !== "DELIVERED" && order.status !== "SHIPPED") return null;

      for (const item of order.items) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { returnedQuantity: item.quantity },
        });
      }

      const { count } = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: "RETURNED" },
      });
      if (count === 0) throw new StatusChangedError();

      return tx.order.findUnique({ where: { id }, ...orderShape });
    });

    return row ? toOrder(row) : undefined;
  } catch (err) {
    if (err instanceof StatusChangedError) return undefined;
    console.error("Marking an order returned failed:", err);
    return undefined;
  }
}
