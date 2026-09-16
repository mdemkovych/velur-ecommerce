import type { ManualOrderStatus, OrderStatus } from "@/lib/types";

/**
 * Standard confirmation messages for manual order status changes.
 *
 * NOTE: (§4.1, §4.5, §8.4) Warns staff regarding stock return effects and irreversible lifecycle transitions.
 */
const STATUS_CONFIRMATIONS: Record<ManualOrderStatus, string> = {
  SHIPPED:
    "Mark the order as shipped?\n\n" +
    "After this it can no longer be cancelled — the parcel is on its way and the goods are not in the " +
    "warehouse. If it does not arrive, record a return.",
  DELIVERED:
    "Mark the order as delivered?\n\n" +
    "Only a return is left after this — the whole order or item by item.",
  CANCELLED:
    "Cancel the order?\n\n" +
    "The goods go back to the shelf, apart from the items already struck off and returned to sale.",
  RETURNED:
    "Record that the customer returned the whole order?\n\n" +
    "The sum stops counting in the turnover. The goods do not go back to the shelf — " +
    "that is recorded separately, item by item, when the parcel comes back.",
};

const CANCEL_PAID_NOTICE =
  "\n\nThe order is paid — refund the customer in the Monobank cabinet. " +
  "The shop does not do it and will not record it anywhere.";

/**
 * Resolves confirmation dialog prompt for target status and current order state.
 *
 * NOTE: (§4.1, §4.5, §8.4) Appends manual payment refund reminder when cancelling paid orders.
 */
export function confirmationFor(status: ManualOrderStatus, current: OrderStatus): string {
  const base = STATUS_CONFIRMATIONS[status];
  return status === "CANCELLED" && current === "PAID" ? base + CANCEL_PAID_NOTICE : base;
}

