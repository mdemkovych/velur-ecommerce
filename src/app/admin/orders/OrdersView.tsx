"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { OrderPage, OrderStats } from "@/lib/db";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  orderNetTotal,
  orderRefundedTotal,
  orderReturnState,
  PAYMENT_METHOD_LABELS,
  type ManualOrderStatus,
  type Order,
  type OrderStatus,
} from "@/lib/types";
import { DEFAULT_STAT_PERIOD, STAT_PERIODS, type StatPeriod } from "@/lib/orderPeriods";
import { Icon, inputCls, Notice, PageBody, PageHeader, Select } from "../ui";
import { useConfirm } from "../useConfirm";
import { confirmationFor } from "./confirmations";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-neutral-200 text-black border border-neutral-300",
  PAID: "border border-black bg-black text-white",
  SHIPPED: "bg-blue-100 text-blue-900 border border-blue-300",
  DELIVERED: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  CANCELLED: "bg-red-100 text-red-900 border border-red-300",
  RETURNED: "bg-purple-100 text-purple-900 border border-purple-300",
};

/** Formats count suffix for dropdown option labels. */
function countSuffix(stats: OrderStats | null, value: number | undefined): string {
  return stats ? ` (${value ?? 0})` : "";
}

/** Resolves Ukrainian plural form for order line item count. */
function itemsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "item";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "items";
  return "items";
}

/**
 * Administrative orders journal view with search, filter, status transition, and archiving controls.
 *
 * NOTE: (§4.1, §8.1, §8.4) Provides server-side pagination, period metrics, and optimistic updates.
 */
export function OrdersView({
  initialPage,
  initialStats,
}: {
  initialPage: OrderPage;
  initialStats: OrderStats;
}) {
  const [orders, setOrders] = useState<Order[] | null>(initialPage.orders);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor ?? null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [stats, setStats] = useState<OrderStats | null>(initialStats);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [statsPeriod, setStatsPeriod] = useState<StatPeriod>(DEFAULT_STAT_PERIOD);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (showArchived) params.set("archived", "1");
      if (orderStatusFilter !== "all") params.set("status", orderStatusFilter);
      if (statsPeriod !== DEFAULT_STAT_PERIOD) params.set("period", statsPeriod);
      if (orderSearchQuery.trim()) params.set("q", orderSearchQuery.trim());
      if (cursor) params.set("cursor", cursor);
      return `/api/orders?${params.toString()}`;
    },
    [orderSearchQuery, orderStatusFilter, showArchived, statsPeriod],
  );

  const servedByServer = useRef(true);

  useEffect(() => {
    if (servedByServer.current) {
      servedByServer.current = false;
      return;
    }

    let cancelled = false;

    const url = buildUrl();
    const timer = setTimeout(() => {
      fetch(url)
        .then((res) => res.json())
        .then((data: { orders?: Order[]; nextCursor?: string | null }) => {
          if (cancelled) return;
          setOrders(data.orders ?? []);
          setNextCursor(data.nextCursor ?? null);
          setLoadedUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load orders:", err);
          if (!cancelled) setOrders([]);
        });
    }, orderSearchQuery.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildUrl, orderSearchQuery]);

  const refreshStats = useCallback(
    () =>
      fetch("/api/orders/stats")
        .then((res) => (res.ok ? (res.json() as Promise<OrderStats>) : null))
        .then((data) => {
          if (data) setStats(data);
        })
        .catch((err) => {
          console.error("Failed to load order statistics:", err);
        }),
    [],
  );

  const canLoadMore = nextCursor !== null && loadedUrl === buildUrl();

  const loadMore = async () => {
    if (!canLoadMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      const data = (await res.json()) as { orders?: Order[]; nextCursor?: string | null };
      setOrders((prev) => [...(prev ?? []), ...(data.orders ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error("Failed to load more orders:", err);
      setNotice("The next orders could not be loaded.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const patchOrder = async (
    orderId: string,
    patch: Partial<Pick<Order, "status" | "trackingNumber" | "managerNote">> & {
      itemReturn?: { itemId: string; returnedQuantity: number };
      archived?: boolean;
    },
  ) => {
    const previous = orders;
    const { itemReturn, archived, ...orderPatch } = patch;
    setOrders((prev) => {
      if (!prev) return prev;
      if (archived !== undefined) return prev.filter((o) => o.id !== orderId);

      return prev.map((o) => {
        if (o.id !== orderId) return o;
        if (!itemReturn) return { ...o, ...orderPatch };
        return {
          ...o,
          items: o.items.map((item) =>
            item.id === itemReturn.itemId
              ? { ...item, returnedQuantity: itemReturn.returnedQuantity }
              : item,
          ),
        };
      });
    });
    setNotice(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setOrders(previous);
        setNotice(data?.error ?? "The order could not be updated.");
        return;
      }

      const saved = (await res.json()) as Order;
      if (archived === undefined) {
        setOrders((prev) => prev?.map((o) => (o.id === orderId ? saved : o)) ?? prev);
      }
      void refreshStats();
    } catch (err) {
      console.error(err);
      setOrders(previous);
      setNotice("Connection failed. Try again.");
    }
  };

  const visibleOrders = orders ?? [];

  return (
    <PageBody className="space-y-8">
      {dialog}
      <div className="space-y-6 animate-in fade-in duration-200">
        <PageHeader
          title={showArchived ? "Orders — archive" : "Orders"}
          hint={
            showArchived
              ? "Finished orders taken out of the journal. The archive is a view only: nothing is deleted and any order can be brought back."
              : "Click an order number to open it — returns, waybills and notes live there."
          }
        />
        {notice && <Notice>{notice}</Notice>}
        <div className="space-y-2">
        <div className="grid grid-cols-2 border border-neutral-200 bg-white sm:gap-4 sm:border-0 sm:bg-transparent">
          {[
            {
              id: "total",
              label: (
                <>
                  <span className="sm:hidden">Orders</span>
                  <span className="hidden sm:inline">Orders in total</span>
                </>
              ),
              value: stats ? String(stats.byPeriod[statsPeriod]) : "—",
            },
            {
              id: "to-ship",
              label: (
                <>
                  <span className="sm:hidden">To dispatch</span>
                  <span className="hidden sm:inline">Awaiting dispatch</span>
                </>
              ),
              value: stats ? String(stats.byStatus.PAID) : "—",
            },
          ].map((stat) => (
            <div
              key={stat.id}
              className="border-l border-neutral-200 p-3 first:border-l-0 sm:border sm:bg-white sm:p-4 sm:first:border-l"
            >
              <span className="block text-[10px] leading-tight font-bold tracking-wider text-ink-3 uppercase sm:text-[11px]">
                {stat.label}
              </span>
              <p className="mt-1 text-lg font-bold tabular-nums break-words text-black sm:text-xl lg:text-2xl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:gap-4">
        <div className="col-span-2 sm:col-span-1">
        <Select
          value={statsPeriod}
          onChange={(e) => setStatsPeriod(e.target.value as StatPeriod)}
          className="w-full"
          aria-label="Period"
        >
          {STAT_PERIODS.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
              {countSuffix(stats, stats?.byPeriod[period.id])}
            </option>
          ))}
        </Select>
        </div>
        </div>
        </div>

        <div className="flex flex-col gap-3 border border-neutral-200 bg-white p-4 md:flex-row md:flex-wrap md:items-stretch md:justify-between md:gap-4">
          <div className="w-full md:min-w-[220px] md:flex-1">
            <input
              type="text"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              placeholder="Search: number, name, telephone, waybill"
              className={inputCls}
            />
          </div>

          <div className="flex items-stretch gap-3 md:contents">
          <div className="min-w-0 flex-1 md:flex-none md:min-w-[13rem]">
            <Select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="w-full"
              aria-label="Filter by status"
            >
              <option value="all">All statuses{countSuffix(stats, stats?.byPeriod.all)}</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                  {countSuffix(stats, stats?.byStatus[status])}
                </option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-label={showArchived ? "To active orders" : "Order archive"}
            className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap border px-3 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all min-[375px]:px-4.5 sm:min-h-0 ${
              showArchived
                ? "border-black bg-black text-white"
                : "border-neutral-300 bg-white text-ink-2 hover:border-black hover:text-black"
            }`}
          >
            {showArchived ? (
              <>
                <span className="sm:hidden">← Active</span>
                <span className="hidden sm:inline">← To active</span>
              </>
            ) : (
              "Archive"
            )}
          </button>
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="py-20 text-center bg-white border border-neutral-200">
            <p className="font-montserrat text-sm font-bold uppercase tracking-wider text-ink-3">
              No orders found
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleOrders.map((o) => {
              const canArchive =
                o.status === "DELIVERED" || o.status === "CANCELLED" || o.status === "RETURNED";

              const toggleArchived = () => {
                void (async () => {
                  if (
                    !o.archivedAt &&
                    !(await confirm({
                      title: "Move the order to the archive?",
                      body: `${o.id} leaves the journal but goes nowhere: the order is not deleted, and it can be brought back at any time.`,
                      confirmLabel: "Archive",
                    }))
                  ) {
                    return;
                  }
                  await patchOrder(o.id, { archived: !o.archivedAt });
                })();
              };

              const badges = (
                <>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 ${STATUS_STYLES[o.status]}`}
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                  {o.status !== "RETURNED" && orderReturnState(o.items) !== "none" && (
                    <span className="border border-neutral-300 px-2.5 py-1 text-[11px] font-bold tracking-widest text-ink-2 uppercase">
                      <span className="sm:hidden">Partly</span>
                      <span className="hidden sm:inline">Partly returned</span>
                    </span>
                  )}
                </>
              );

              return (
              <div
                key={o.id}
                className="bg-white border border-neutral-200 p-4 space-y-6 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-neutral-200">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:hidden">
                      {badges}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Link
                        href={`/admin/orders/${encodeURIComponent(o.id)}`}
                        className="font-montserrat text-lg font-bold tracking-wider text-black uppercase underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-black"
                      >
                        {o.id}
                      </Link>
                      <span className="hidden flex-wrap items-center gap-x-3 gap-y-2 sm:flex">
                        {badges}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-2 font-medium">
                      Date: {new Date(o.createdAt).toLocaleString("uk-UA")}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                  {canArchive && (
                    <button
                      type="button"
                      onClick={toggleArchived}
                      aria-label={
                        o.archivedAt ? "Bring the order back from the archive" : "Move the order to the archive"
                      }
                      title={o.archivedAt ? "Bring back from the archive" : "Archive"}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border border-neutral-300 text-ink-2 transition-colors hover:border-black hover:text-black sm:h-10 sm:w-10"
                    >
                      <Icon
                        name={o.archivedAt ? "unarchive" : "archive"}
                        className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
                      />
                    </button>
                  )}

                  {ORDER_TRANSITIONS[o.status].length > 0 && (
                    <div className="hidden shrink-0 sm:block">
                      <Select
                        compact
                        className="sm:h-10"
                        value=""
                        onChange={(e) => {
                          const next = e.target.value as OrderStatus;
                          void (async () => {
                            const question = confirmationFor(
                              next as ManualOrderStatus,
                              o.status,
                            );
                            if (
                              question &&
                              !(await confirm({
                                title: `Move to «${ORDER_STATUS_LABELS[next]}»?`,
                                body: question,
                                confirmLabel: "Yes",
                              }))
                            ) {
                              return;
                            }
                            await patchOrder(o.id, { status: next });
                          })();
                        }}
                        aria-label={`Change the status of order ${o.id}`}
                      >
                        <option value="" disabled>
                          Change the status
                        </option>
                        {ORDER_TRANSITIONS[o.status].map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  </div>
                </div>

                {o.needsReview && (
                  <div className="border border-red-300 bg-red-50 p-3">
                    <p className="text-[11px] font-bold tracking-widest text-red-700 uppercase">
                      <Icon name="warning" className="h-3.5 w-3.5" />
                      Needs a payment check
                    </p>
                    {o.reviewNote && (
                      <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line text-red-900">
                        {o.reviewNote}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] leading-relaxed text-red-800">
                      Do not ship this order until you have checked the payment against the statement of
                      Monobank.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs border-b border-neutral-200 pb-4">
                  <div className="space-y-1">
                    <p className="font-bold text-ink-3 uppercase tracking-widest text-[11px]">
                      Customer
                    </p>
                    <p className="font-bold text-sm text-black">
                      {o.customer.firstName} {o.customer.lastName}
                    </p>
                    <p className="text-sm text-neutral-700 font-medium">
                      Tel: {o.customer.phone}
                    </p>
                    <p className="text-sm text-neutral-700 font-medium">
                      Email: {o.customer.email}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-ink-3 uppercase tracking-widest text-[11px]">
                      Delivery and payment
                    </p>
                    <p className="text-sm text-neutral-700 font-medium">
                      City: {o.customer.city}
                    </p>
                    {o.customer.branch && (
                      <p className="text-sm text-neutral-700 font-medium">
                        Branch: {o.customer.branch}
                      </p>
                    )}
                    {o.customer.address && (
                      <p className="text-sm text-neutral-700 font-medium">
                        Address: {o.customer.address}
                      </p>
                    )}
                    <p className="text-sm text-neutral-700 font-medium">
                      Payment:{" "}
                      {o.paidAt
                        ? o.invoiceId
                          ? PAYMENT_METHOD_LABELS[o.customer.paymentMethod]
                          : "confirmed by hand"
                        : o.invoiceId
                          ? "waiting for the bank"
                          : "get in touch with the customer about payment"}
                    </p>
                  </div>
                </div>

                {o.customer.comment && (
                  <div className="border border-line-2 bg-surface-2 p-3 text-xs">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-black uppercase">
                      <Icon name="chat" className="h-3.5 w-3.5" />
                      Customer&apos;s notes
                    </p>
                    <p className="text-neutral-800 leading-relaxed whitespace-pre-line">
                      {o.customer.comment}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-neutral-200 bg-neutral-50 p-3 text-xs">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-black uppercase">
                    <Icon name="parcel" className="h-3.5 w-3.5" />
                    Waybill
                  </span>
                  {o.trackingNumber ? (
                    <span className="font-mono text-xs break-all text-black">{o.trackingNumber}</span>
                  ) : (
                    <span className="text-[11px] font-medium text-ink-3">
                      not yet — added on the order page
                    </span>
                  )}
                </div>

                {o.managerNote && (
                  <div className="border border-neutral-200 bg-neutral-50 p-3 text-xs">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-ink-2 uppercase">
                      <Icon name="note" className="h-3.5 w-3.5" />
                      Internal note
                    </p>
                    <p className="line-clamp-2 leading-relaxed whitespace-pre-line text-neutral-800">
                      {o.managerNote}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-4 sm:flex-nowrap">
                  <div className="min-w-0 space-y-1 sm:flex-1">
                    <p className="text-[11px] font-bold tracking-widest text-ink-3 uppercase">
                      {o.items.length} {itemsWord(o.items.length)} ·{" "}
                      {o.items.reduce((sum, i) => sum + i.quantity, 0)} pcs
                    </p>
                    <p className="truncate text-xs text-ink-2">
                      {o.items
                        .map((i) => (i.quantity > 1 ? `${i.nameUk} × ${i.quantity}` : i.nameUk))
                        .join(", ")}
                    </p>
                  </div>

                  <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto sm:shrink-0">
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`font-montserrat text-xl font-bold whitespace-nowrap ${
                            orderRefundedTotal(o.items) > 0 ? "text-ink-3 line-through" : "text-black"
                          }`}
                        >
                          {o.total} ₴
                        </p>
                        {orderRefundedTotal(o.items) > 0 && (
                          <p className="font-montserrat text-sm font-bold text-black">
                            {orderNetTotal(o)} ₴{" "}
                            <span className="hidden text-[11px] font-semibold text-ink-3 sm:inline">
                              after the return
                            </span>
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/admin/orders/${encodeURIComponent(o.id)}`}
                        className="border border-black bg-black px-4 py-2.5 text-[11px] font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-neutral-800"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}

            {canLoadMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="w-full cursor-pointer border border-neutral-300 bg-white py-3 text-[11px] font-bold tracking-[0.2em] text-ink-2 uppercase transition-colors hover:border-black hover:text-black disabled:opacity-40"
              >
                {isLoadingMore ? "Loading…" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </PageBody>
  );
}

