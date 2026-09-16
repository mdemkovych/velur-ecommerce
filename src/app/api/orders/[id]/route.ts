import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelOrder,
  clearOrderReview,
  deleteCancelledOrder,
  getOrderById,
  markOrderReturned,
  setItemReturn,
  setOrderArchived,
  updateOrder,
  updateOrderCustomer,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { voidInvoice } from "@/lib/monobank";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { MANUAL_ORDER_STATUSES } from "@/lib/types";
import { orderCustomerPatchSchema } from "@/lib/validation";
import { isNovaPoshtaConfigured, probeNovaPoshta, verifyDeliveryTarget } from "@/lib/novaposhta";

/**
 * Single order management endpoint for staff inspection, customer updates, item returns, and cancellation.
 *
 * NOTE: (§4.1, §4.5, §4.6, §5.2, §8.4, §8.5) Handles status transitions, line-item returns, customer address edits, and cancelled order purging under advisory locks.
 */

const patchSchema = z.object({
  status: z.enum(MANUAL_ORDER_STATUSES).optional(),
  trackingNumber: z.string().trim().max(40).optional(),
  managerNote: z.string().trim().max(1000).optional(),
  archived: z.boolean().optional(),
  reviewResolved: z.literal(true).optional(),
  customer: orderCustomerPatchSchema.optional(),
  itemReturn: z
    .object({
      itemId: z.string().trim().min(1).max(64),
      returnedQuantity: z.number().int().min(0).max(999),
      restock: z.boolean().default(false),
    })
    .optional(),
});

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const order = await getOrderById((await props.params).id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed data" },
      { status: 400 },
    );
  }

  if (!(await getOrderById(id))) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const patch = parsed.data;
  const { itemReturn, archived, reviewResolved, customer, ...orderPatch } = patch;

  // NOTE: (§5.2) Validates delivery address against Nova Poshta directory if configured.
  if (customer?.cityRef && isNovaPoshtaConfigured() && (await probeNovaPoshta())) {
    const check = await verifyDeliveryTarget(
      customer.cityRef,
      customer.deliveryMethod === "branch" ? customer.branchRef : undefined,
    );
    if (check === "invalid") {
      return NextResponse.json(
        {
          error:
            "Choose a city and a branch from the suggestions — the address given " +
            "was not found in the Nova Poshta directory.",
        },
        { status: 400 },
      );
    }
  }

  // NOTE: (§4.1, §4.5, §4.6) Routes order modification to specialized handler based on patch type.
  const updated = customer
    ? await updateOrderCustomer(id, customer)
    : reviewResolved
    ? await clearOrderReview(id, admin.name)
    : archived !== undefined
    ? await setOrderArchived(id, archived)
    : itemReturn
    ? await setItemReturn(
        id,
        itemReturn.itemId,
        itemReturn.returnedQuantity,
        itemReturn.restock,
      )
    : orderPatch.status === "CANCELLED"
      ? await cancelOrder(id)
      : orderPatch.status === "RETURNED"
        ? await markOrderReturned(id)
        : await updateOrder(id, orderPatch);

  if (!updated) {
    return NextResponse.json(
      {
        error: customer
          ? "Customer details can be changed only while the order has not shipped."
          : "The order could not be updated — its status may have changed already.",
      },
      { status: 409 },
    );
  }

  // NOTE: (§3.1) Voids active Monobank invoice upon order cancellation.
  if (orderPatch.status === "CANCELLED") {
    await voidInvoice(updated.invoiceId);
  }

  await logAudit({
    actor: admin.id,
    action: reviewResolved
      ? "ORDER_REVIEW_RESOLVED"
      : orderPatch.status === "CANCELLED"
        ? "ORDER_CANCELLED"
        : "ORDER_UPDATED",
    target: id,
    ip: clientIp(request),
    details: customer
      ? { edited: Object.keys(customer).filter((k) => k !== "consent") }
      : patch,
  });

  return NextResponse.json(updated);
}

/**
 * Permanently deletes a cancelled order without financial history.
 *
 * NOTE: (§4.5, §8.4) Enforces transaction-level checks via deleteCancelledOrder() ensuring no payment records exist before purging.
 */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  const existing = await getOrderById(id);
  const { outcome } = await deleteCancelledOrder(id);

  if (outcome === "missing") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (outcome === "not-cancelled") {
    return NextResponse.json(
      { error: "Only a cancelled order can be deleted." },
      { status: 409 },
    );
  }
  if (outcome === "has-payment") {
    return NextResponse.json(
      {
        error:
          "This order carries a payment or an unresolved question about money — " +
          "it cannot be deleted. Use the archive instead.",
      },
      { status: 409 },
    );
  }

  await logAudit({
    actor: admin.id,
    action: "ORDER_DELETED",
    target: id,
    ip: clientIp(request),
    // MUST NOT: put the customer in here; the row that held them is being destroyed,
    // and the usual reason to destroy it is that it held a stranger's telephone.
    details: { total: existing?.total, itemCount: existing?.items.length },
  });

  return NextResponse.json({ success: true });
}

