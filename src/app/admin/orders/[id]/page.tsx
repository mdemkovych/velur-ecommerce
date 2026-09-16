import { notFound, redirect } from "next/navigation";
import { getOrderById } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { OrderDetail } from "./OrderDetail";

/**
 * Server page resolving detailed order model by ID.
 *
 * NOTE: (§3.4, §8.1, §8.4) Authenticates staff session and renders comprehensive order management view.
 */
export default async function AdminOrderPage(props: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect("/auth/login");

  const { id } = await props.params;
  const order = await getOrderById(decodeURIComponent(id));
  if (!order) notFound();

  return <OrderDetail initialOrder={order} />;
}

