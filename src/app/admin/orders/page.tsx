import { getOrderStats, listOrders } from "@/lib/db";
import { OrdersView } from "./OrdersView";

/**
 * Server page pre-rendering initial order list page and aggregation statistics.
 *
 * NOTE: (§8.1, §8.4) Loads first order page and counts by status/period for initial SSR paint.
 */
export default async function AdminOrdersPage() {
  const [page, stats] = await Promise.all([listOrders({}), getOrderStats()]);

  return <OrdersView initialPage={page} initialStats={stats} />;
}

