import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrder, listOrders } from "@/lib/db";
 import { requireAdmin } from "@/lib/auth";
 import { isStatPeriod } from "@/lib/orderPeriods";
 import { ORDER_STATUSES } from "@/lib/types";
 import { createOrderSchema } from "@/lib/validation";
 import { createPaymentToken } from "@/lib/paymentToken";
 import { isMonobankConfigured } from "@/lib/monobank";
 import { isNovaPoshtaConfigured, probeNovaPoshta, verifyDeliveryTarget } from "@/lib/novaposhta";
 import type { OrderCustomer } from "@/lib/types";

/**
 * Order collection endpoint for staff listing (GET) and customer order placement (POST).
 *
 * NOTE: (§3.1, §4.2, §5.2, §8.4) Provides filtered order list for managers and atomic checkout placement with Nova Poshta directory validation.
 */
const listQuerySchema = z.object({
  archived: z.enum(["0", "1"]).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  period: z.string().trim().refine(isStatPeriod, "Unknown period").optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().trim().max(64).optional(),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = listQuerySchema.safeParse({
    archived: params.get("archived") || undefined,
    status: params.get("status") || undefined,
    period: params.get("period") || undefined,
    q: params.get("q") || undefined,
    cursor: params.get("cursor") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  return NextResponse.json(
    await listOrders({
      archived: parsed.data.archived === "1",
      status: parsed.data.status,
      period: parsed.data.period,
      search: parsed.data.q,
      cursor: parsed.data.cursor,
    }),
  );
}

export async function POST(request: Request) {
  // NOTE: (§3.1) Requires active Monobank merchant integration before accepting new orders.
  if (!isMonobankConfigured()) {
    console.error("MONOBANK_API_TOKEN is not set — refusing to take orders");
    return NextResponse.json(
      { error: "Payment is temporarily unavailable. Please try again in a few minutes." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);

  // NOTE: (§5.2) Probes Nova Poshta directory availability to enforce valid cityRef/branchRef inputs.
  const cityRef = (body as { customer?: { cityRef?: unknown } } | null)?.customer?.cityRef;
  const carriesRef = typeof cityRef === "string" && cityRef.trim().length > 0;
  const requireDirectoryRefs =
    isNovaPoshtaConfigured() && (carriesRef || (await probeNovaPoshta()));

  const parsed = createOrderSchema({ requireDirectoryRefs }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed order data" },
      { status: 400 },
    );
  }

  const { customer, items } = parsed.data;

  // NOTE: (§5.2) Validates delivery target against Nova Poshta directory.
  if (requireDirectoryRefs && customer.cityRef) {
    const check = await verifyDeliveryTarget(
      customer.cityRef,
      customer.deliveryMethod === "branch" ? customer.branchRef : undefined,
    );
    if (check === "invalid") {
      console.warn(
        `Rejected an order naming a delivery target Nova Poshta does not know: ` +
          `city=${customer.cityRef} branch=${customer.branchRef ?? "-"}`,
      );
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

  const { consent: _consent, ...customerData } = customer;

  const result = await createOrder(customerData as OrderCustomer, items);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // NOTE: (§3.1, §4.7) Returns minimal order confirmation payload with secure payment HMAC token.
  const { id, status, total, createdAt, items: orderItems } = result.order;
  return NextResponse.json(
    {
      order: { id, status, total, createdAt, items: orderItems },
      paymentToken: await createPaymentToken(id),
    },
    { status: 201 },
  );
}

