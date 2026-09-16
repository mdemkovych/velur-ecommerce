import "server-only";
import type { Order } from "./types";

/**
 * What the shop tells its own staff once an order is paid.
 *
 * NOTE: (§9.3) On payment, never on order creation: an abandoned checkout would
 * otherwise ring for a sale that never happened.
 */

const TIMEOUT_MS = 5_000;

function endpoint(token: string): string {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

/** NOTE: (§1.4) Both halves, and false is a quiet working state (§9.3). */
export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

/** Manager-entered text goes into markup, and Telegram parses it as HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(uah: number): string {
  return `${uah.toLocaleString("uk-UA").replace(/ /g, " ")} ₴`;
}

/**
 * What the message says, as data, separate from sending it.
 *
 * @param order Paid order entity.
 * @returns The message body, as Telegram HTML.
 */
export function renderNewOrderMessage(order: Order): string {
  const lines = order.items
    .map((i) => `• ${escapeHtml(i.nameUk)} — ${i.quantity} pcs`)
    .join("\n");

  const { firstName, lastName, phone, email, city, branch, address, deliveryMethod, comment } =
    order.customer;

  const destination =
    deliveryMethod === "courier"
      ? [`${city}, courier`, address].filter(Boolean)
      : [city, branch].filter(Boolean);

  return [
    "🛒 <b>New paid order</b>",
    "",
    `<code>${escapeHtml(order.id)}</code>`,
    "",
    lines,
    "",
    `Total: <b>${money(order.total)}</b>`,
    "",
    "👤 <b>Customer</b>",
    escapeHtml(`${firstName} ${lastName}`),
    escapeHtml(phone),
    escapeHtml(email),
    "",
    "📦 <b>Delivery</b>",
    ...destination.map((part) => escapeHtml(String(part))),
    ...(comment?.trim() ? ["", "💬 <b>Comment</b>", escapeHtml(comment.trim())] : []),
  ].join("\n");
}

/**
 * Tells the staff chat that an order is paid.
 *
 * NOTE: (§9.3) Errors are logged and caught: the order is paid either way, and
 * the webhook must still answer 200.
 *
 * @param order Paid order entity.
 * @returns True when Telegram accepted the message.
 */
export async function notifyNewOrder(order: Order): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  try {
    const res = await fetch(endpoint(process.env.TELEGRAM_BOT_TOKEN!.trim()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID!.trim(),
        text: renderNewOrderMessage(order),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      // NOTE: (§9.3) The body names the reason, which is nearly always the chat
      // id or the bot's access to it.
      console.error(
        `Telegram refused the new-order notice for ${order.id} (HTTP ${res.status}): ` +
          (await res.text().catch(() => "")),
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(`New-order notice for ${order.id} could not be sent:`, err);
    return false;
  }
}
