"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  canRecordReturn,
  goodsHaveLeft,
  isManualOrderStatus,
  lineNetTotal,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  orderNetTotal,
  orderRefundedTotal,
  orderReturnState,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/types";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { cn } from "@/lib/cn";
import { Card, Icon, inputCls, labelCls, PageBody, textareaCls } from "../../ui";
import { CustomerEditor } from "./CustomerEditor";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "../../useConfirm";
import { confirmationFor } from "../confirmations";


const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-neutral-300 bg-white text-ink-2",
  PAID: "border-black bg-black text-white",
  SHIPPED: "border-black bg-white text-black",
  DELIVERED: "border-neutral-300 bg-neutral-100 text-ink-2",
  CANCELLED: "border-neutral-300 bg-neutral-100 text-ink-3 line-through",
  RETURNED: "border-neutral-300 bg-neutral-100 text-ink-3",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Detailed order view providing status transitions, item returns, TTN, and notes editing.
 *
 * NOTE: (§4.1, §4.5, §5.1, §8.4) Manages return item restocking, customer updates, and permanent deletion.
 */
export function OrderDetail({ initialOrder }: { initialOrder: Order }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [order, setOrder] = useState(initialOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [restockReminder, setRestockReminder] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  const returnsAllowed = canRecordReturn(order.status);
  const shipped = goodsHaveLeft(order.status);
  const customerEditable =
    order.status === "PENDING_PAYMENT" || order.status === "PAID";

  const refunded = orderRefundedTotal(order.items);
  const net = orderNetTotal(order);

  async function patch(body: Record<string, unknown>, note: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The changes could not be saved");
        return;
      }
      const next = data as Order;
      setOrder(next);
      setEditingCustomer(false);
      if (next.status === "RETURNED" && order.status !== "RETURNED") setRestockReminder(true);
      setSaved(note);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteForever() {
    const ok = await confirm({
      title: "Delete the order for good?",
      body:
        "The order will be gone from the database together with the customer's details, and it cannot be " +
        "brought back. The journal keeps a record of the deletion — without a name or a " +
        "telephone. If the order might still be wanted, move it to the archive instead.",
      confirmLabel: "Delete for good",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "The order could not be deleted");
        setBusy(false);
        return;
      }
      router.replace("/admin/orders");
    } catch {
      setError("Connection failed. Try again.");
      setBusy(false);
    }
  }

  const moves = ORDER_TRANSITIONS[order.status];

  return (
    <PageBody narrow className="space-y-6 pt-6 sm:pt-6">
      {dialog}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            href="/admin/orders"
            className="-mt-1 mb-2 inline-flex items-center gap-2 py-3 text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase transition-colors hover:text-black"
          >
            ← All orders
          </Link>
          <h1 className="font-mono text-xl font-bold break-all text-black sm:text-2xl">
            {order.id}
          </h1>
          <p className="text-xs text-ink-2">{formatDate(order.createdAt)}</p>
        </div>

      </div>

      {order.needsReview && (
        <div className="border border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-red-700 uppercase">
            <Icon name="warning" className="h-3.5 w-3.5" />
            Needs a payment check
          </p>
          {order.reviewNote && (
            <p className="mt-2 text-xs leading-relaxed whitespace-pre-line text-red-900">
              {order.reviewNote}
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-red-800">
            Do not ship this order until you have checked the payment against the Monobank statement.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch({ reviewResolved: true }, "The flag is cleared — the mismatch is closed.")
            }
            className="mt-3 cursor-pointer border border-red-300 bg-white px-3 py-2 text-[10px] font-bold tracking-wider text-red-800 uppercase transition-colors hover:bg-red-100 disabled:opacity-40"
          >
            I have checked the payment — clear the flag
          </button>
        </div>
      )}

      {(error || saved) && (
        <Toast
          tone={error ? "error" : "success"}
          role={error ? "alert" : "status"}
          offset="var(--admin-header-h)"
          onDismiss={error ? () => setError(null) : undefined}
        >
          {error ?? saved}
        </Toast>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:grid-rows-[auto_1fr]">
        <div className="contents xl:block xl:space-y-6 xl:col-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <div className="order-2 xl:order-none">
          <Card
            title="Order contents"
            hint={
              !returnsAllowed
                ? "An item can be struck off a paid order, and a return recorded on a shipped or delivered one. Nothing is sold yet here: the reservation returns on its own."
                : shipped
                  ? "Record what the customer returned. The shop moves no money — refunds are made in the Monobank cabinet."
                  : "The customer changed their mind about part of the order — strike off what they dropped. Those goods go straight back on sale; refund them in the Monobank cabinet."
            }
          >
            {restockReminder && (
              <div className="mb-4 border border-neutral-300 bg-neutral-50 p-3">
                <p className="text-xs leading-relaxed text-black">
                  The order is marked returned, and its money no longer counts in the
                  turnover. <strong className="font-semibold">The stock did not change.</strong>{" "}
                  Go through the items below and mark what can be sold again: only what
                  you tick goes back into stock.
                </p>
                <button
                  type="button"
                  onClick={() => setRestockReminder(false)}
                  className="mt-2 cursor-pointer text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase transition-colors hover:text-black"
                >
                  Understood
                </button>
              </div>
            )}

            <ul className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  disabled={busy}
                  canReturn={returnsAllowed}
                  shipped={shipped}
                  onSave={(returnedQuantity, restock) =>
                    patch(
                      { itemReturn: { itemId: item.id, returnedQuantity, restock } },
                      returnedQuantity > 0
                        ? shipped
                          ? `Return recorded: ${item.nameUk}`
                          : `Item struck off: ${item.nameUk}`
                        : shipped
                          ? `Return withdrawn: ${item.nameUk}`
                          : `Strike-off withdrawn: ${item.nameUk}`,
                    )
                  }
                />
              ))}
            </ul>

            <dl className="space-y-1.5 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-black">Order total</dt>
                <dd className="text-lg font-bold tabular-nums text-black">{order.total} ₴</dd>
              </div>
              {refunded > 0 && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-2">Refunded to the customer</dt>
                    <dd className="font-semibold tabular-nums text-[var(--color-sale)]">
                      −{refunded} ₴
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-neutral-200 pt-1.5">
                    <dt className="font-semibold text-black">Left to the shop</dt>
                    <dd className="text-base font-bold tabular-nums">{net} ₴</dd>
                  </div>
                </>
              )}
            </dl>
          </Card>
          </div>

          <div className="order-4 xl:order-none">
          <Card title="Delivery and tracking">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className={labelCls}>City</dt>
                <dd className="text-black">{order.customer.city}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className={labelCls}>
                  {order.customer.deliveryMethod === "courier" ? "Address" : "Branch"}
                </dt>
                <dd className="text-black">
                  {order.customer.branch || order.customer.address || "—"}
                </dd>
              </div>
            </dl>

            {order.customer.comment && (
              <div className="border border-line-2 bg-surface-2 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-black uppercase">
                  <Icon name="chat" className="h-3.5 w-3.5" />
                  Customer&apos;s notes
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-ink-2">
                  {order.customer.comment}
                </p>
              </div>
            )}

            <SavedField
              key={`ttn:${order.trackingNumber ?? ""}`}
              label="Waybill number"
              defaultValue={order.trackingNumber ?? ""}
              placeholder="20450000000000"
              disabled={busy}
              onSave={(value) => patch({ trackingNumber: value }, "Waybill number saved")}
            />
          </Card>
          </div>

          <div className="order-5 xl:order-none">
          <Card
            title="Internal note"
            hint="Only the team sees it. It is never shown to the customer."
          >
            <SavedField
              key={`note:${order.managerNote ?? ""}`}
              multiline
              label=""
              defaultValue={order.managerNote ?? ""}
              placeholder="What was agreed by telephone, what to check before dispatch…"
              disabled={busy}
              onSave={(value) => patch({ managerNote: value }, "Note saved")}
            />
          </Card>
          </div>
        </div>

        <div className="contents xl:block xl:col-start-3 xl:row-start-1">
          <div className="order-1 xl:order-none">
          <Card
            title="Status"
            headerRight={
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {order.status !== "RETURNED" && orderReturnState(order.items) !== "none" && (
                  <span className="border border-neutral-300 px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-ink-2 uppercase">
                    Partly
                  </span>
                )}
                <span
                  className={cn(
                    "border px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] uppercase",
                    STATUS_TONE[order.status],
                  )}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </span>
            }
          >
            {moves.length > 0 ? (
              <div className="space-y-2">
                {moves.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const question = confirmationFor(status, order.status);
                      if (
                        question &&
                        !(await confirm({
                          title: `Move to «${ORDER_STATUS_LABELS[status]}»?`,
                          body: question,
                          confirmLabel: "Yes",
                        }))
                      ) {
                        return;
                      }
                      if (isManualOrderStatus(status)) {
                        void patch({ status }, `Status: ${ORDER_STATUS_LABELS[status]}`);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center justify-between border border-neutral-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ORDER_STATUS_LABELS[status]}
                    <span aria-hidden>→</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-ink-2">
                This is a final state and cannot be changed by hand.
              </p>
            )}

            {order.status === "CANCELLED" && (
              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <p className="text-xs leading-relaxed text-ink-2">
                  A cancelled order can be moved to the archive — it stays in the database
                  and is visible on the «Archive» tab. Or deleted for good, if it is an empty
                  trace: an abandoned basket, or a form filled with invented details.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteForever()}
                  className="w-full cursor-pointer border border-red-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] text-red-700 uppercase transition-colors hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete for good
                </button>
                <p className="text-[11px] leading-relaxed text-ink-3">
                  An order that money passed through, or that carries an unresolved question
                  about payment, cannot be deleted — that trace is needed.
                </p>
              </div>
            )}

            {order.status === "PENDING_PAYMENT" && (
              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <p className="text-xs leading-relaxed text-ink-2">
                  The order is not paid yet, so «Shipped» and «Delivered» are unavailable.
                </p>

                <p className="text-[11px] leading-relaxed text-ink-3">
                  {order.invoiceId
                    ? "A Monobank invoice was issued — the bank will confirm the payment."
                    : "No invoice was issued, so there is nothing to confirm a payment with. The order releases its reservation on its own, and the customer can place it again."}
                </p>
              </div>
            )}
          </Card>
          </div>
        </div>

        <div className="contents xl:block xl:space-y-6 xl:col-start-3 xl:row-start-2">
          <div className="order-3 xl:order-none">
          <Card
            title="Customer and delivery"
            headerRight={
              customerEditable && !editingCustomer ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingCustomer(true)}
                  className="cursor-pointer text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-black hover:decoration-black"
                >
                  Edit
                </button>
              ) : undefined
            }
          >
            {editingCustomer ? (
              <CustomerEditor
                customer={order.customer}
                disabled={busy}
                onSave={(body) => patch(body, "Customer details saved")}
                onCancel={() => setEditingCustomer(false)}
                onInvalid={setError}
              />
            ) : (
              <dl className="space-y-3 text-sm">
                <Row
                  label="First name"
                  value={`${order.customer.firstName} ${order.customer.lastName}`}
                />
                <Row label="Telephone" value={order.customer.phone} href={`tel:${order.customer.phone}`} />
                <Row label="Email" value={order.customer.email} href={`mailto:${order.customer.email}`} />
                <Row label="City" value={order.customer.city} />
                {order.customer.deliveryMethod === "branch" ? (
                  <Row label="Branch" value={order.customer.branch ?? "—"} />
                ) : (
                  <Row label="Address" value={order.customer.address ?? "—"} />
                )}
                {!order.customer.cityRef && (
                  <p className="text-[11px] leading-relaxed text-ink-3">
                    The address was typed by hand — check it against the directory before writing the waybill.
                  </p>
                )}
              </dl>
            )}
          </Card>
          </div>

          <div className="order-6 xl:order-none">
          <Card title="Payment">
            <dl className="space-y-3 text-sm">
              <Row label="Method" value="mono pay" />
              <Row
                label="Paid"
                value={order.paidAt ? formatDate(order.paidAt) : "— not yet"}
              />
              {order.invoiceId && <Row label="Invoice" value={order.invoiceId} mono />}
              <Row label="Payment attempts" value={String(order.paymentAttempts ?? 0)} />
            </dl>
          </Card>
          </div>
        </div>
      </div>
    </PageBody>
  );
}

/** Definition list row displaying labeled string values. */
function Row({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-2">{label}</dt>
      <dd className={cn("text-right break-all text-black", mono && "font-mono text-xs")}>
        {href ? (
          <a href={href} className="underline decoration-neutral-300 hover:decoration-black">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * Order line row component handling individual line returns and inventory restock toggles.
 *
 * NOTE: (§4.1, §4.5) Provides inline return quantity adjusters and inventory return decisions.
 */
function ItemRow({
  item,
  disabled,
  canReturn,
  shipped,
  onSave,
}: {
  item: OrderItem;
  disabled: boolean;
  canReturn: boolean;
  shipped: boolean;
  onSave: (returnedQuantity: number, restock: boolean) => void;
}) {
  const [returned, setReturned] = useState(item.returnedQuantity);
  const [restock, setRestock] = useState(item.restockedQuantity > 0 || !shipped);
  const [open, setOpen] = useState(false);

  const effectiveRestock = returned > 0 && restock;

  const dirty =
    returned !== item.returnedQuantity || effectiveRestock !== item.restockedQuantity > 0;
  const fullyReturned = item.returnedQuantity >= item.quantity;

  return (
    <li className="flex items-start gap-3 py-4 sm:gap-4">
      <div className="relative h-20 w-16 shrink-0 overflow-hidden border border-neutral-200 bg-photo-bg">
        <Image
          src={primaryMedia(item.image)}
          alt=""
          fill
          className={cn("object-contain", fullyReturned && "grayscale")}
          sizes="64px"
          quality={IMAGE_QUALITY}
        />
        {fullyReturned && (
          <span className="pointer-events-none absolute inset-0 bg-neutral-500/15" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p
          className={cn(
            "text-sm font-medium text-black",
            fullyReturned && "text-ink-3 line-through",
          )}
        >
          {item.nameUk}
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <p className="min-w-0 text-xs text-ink-2">
            {item.quantity} pcs × {item.price} ₴
            {item.returnedQuantity > 0 && (
              <span className="text-[var(--color-sale)]">
                {" "}
                {" "}· {shipped ? "returned" : "struck off"} {item.returnedQuantity} pcs
                {item.restockedQuantity > 0
                  ? ` (back on the shelf +${item.restockedQuantity})`
                  : " (not returned to the shelf)"}
              </span>
            )}
          </p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {lineNetTotal(item)} ₴
          </p>
        </div>

        {canReturn && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-black hover:decoration-black"
          >
            {item.returnedQuantity > 0
              ? "Change"
              : shipped
                ? "Record a return"
                : "Strike the item off"}
          </button>
        )}

        {open && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <span className="whitespace-nowrap">{shipped ? "Returned" : "Cancel"}</span>
                <input
                  type="number"
                  min={0}
                  max={item.quantity}
                  value={returned}
                  disabled={disabled}
                  onChange={(e) => {
                    setReturned(Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)));
                  }}
                  className={cn(inputCls, "h-9 w-16 text-center")}
                />
                <span className="whitespace-nowrap text-ink-3">of {item.quantity} pcs</span>
              </label>
            </div>

            <label
              className={cn(
                "flex items-start gap-2.5 text-xs leading-relaxed",
                returned > 0 ? "cursor-pointer text-ink-2" : "cursor-not-allowed text-ink-3/60",
              )}
            >
              <input
                type="checkbox"
                checked={restock}
                disabled={disabled || returned === 0}
                onChange={(e) => setRestock(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-black"
              />
              <span>
                {shipped ? "The goods are intact — put them back on the shelf" : "Return the goods to sale"}
                <span className="block text-ink-3">
                  {shipped
                    ? "If the packaging is open or the goods are damaged, leave it unticked."
                    : "The goods never left the warehouse, so they can usually be sold again straight away."}
                </span>
              </span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={disabled || !dirty}
                onClick={() => {
                  onSave(returned, effectiveRestock);
                  setOpen(false);
                }}
                className="cursor-pointer border border-black bg-black px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-ink-3"
              >
                Save
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  setReturned(item.returnedQuantity);
                  setRestock(item.restockedQuantity > 0 || !shipped);
                }}
                className="cursor-pointer text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase transition-colors hover:text-black"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Text or textarea input with explicit button-triggered save state.
 *
 * NOTE: (§8.4) Avoids blur-triggered saves on page exits.
 */
function SavedField({
  label,
  defaultValue,
  placeholder,
  disabled,
  multiline,
  onSave,
}: {
  label: string;
  defaultValue: string;
  placeholder?: string;
  disabled: boolean;
  multiline?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  const dirty = value.trim() !== defaultValue.trim();

  return (
    <div className="space-y-2">
      <label className="block space-y-1.5">
        {label && (
          <span className="block text-[10px] font-bold tracking-[0.18em] text-ink-3 uppercase">
            {label}
          </span>
        )}
        {multiline ? (
          <textarea
            rows={4}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            className={textareaCls}
          />
        ) : (
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls}
          />
        )}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || !dirty}
          onClick={() => onSave(value.trim())}
          className="cursor-pointer border border-black bg-black px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-ink-3"
        >
          Save
        </button>
        {dirty && (
          <span className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            There are unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}

