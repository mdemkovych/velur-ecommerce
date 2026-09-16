import "server-only";
import { getAppUrl } from "./appUrl";
import { SELLER_EMAIL, SELLER_PHONE } from "./storeContent";
import type { Order } from "./types";

/**
 * The one letter the shop sends a customer, and what it says.
 *
 * NOTE: (§9.2) Sent once, when the money has arrived. Resend over plain HTTP,
 * because the SDK buys nothing a `fetch` does not.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const TIMEOUT_MS = 8_000;

/** NOTE: (§1.4) Both halves, and false is a quiet working state (§9.2). */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

function money(uah: number): string {
  // Non-breaking spaces: "1 240 ₴" must not wrap in the middle of a number.
  return `${uah.toLocaleString("uk-UA").replace(/ /g, " ")} ₴`;
}

/** Where the parcel goes, in the words the customer chose it by. */
function deliveryLine(order: Order): string {
  const { city, branch, address, deliveryMethod } = order.customer;
  if (deliveryMethod === "courier" && address) return `${city}, ${address}`;
  return branch ? `${city}, ${branch}` : city;
}

function plainBody(order: Order, appUrl: string): string {
  const items = order.items
    .map((i) => `  ${i.nameUk} — ${i.quantity} × ${money(i.price)}`)
    .join("\n");

  return [
    `Thank you for your order, ${order.customer.firstName}!`,
    "",
    `Payment received. Order no. ${order.id} is being prepared.`,
    "",
    "ORDER",
    items,
    "",
    `Total: ${money(order.total)}`,
    "",
    "DELIVERY",
    `  ${deliveryLine(order)}`,
    "  Delivery is paid by the recipient at the branch.",
    "",
    "WHAT HAPPENS NEXT",
    "  We pack the order and hand it to Nova Poshta.",
    "  Nova Poshta will tell you about the parcel separately, once",
    "  the waybill has been created.",
    "",
    "VELUR is more than cosmetics.",
    "It is a state. It is a feeling. It is about a woman who chooses herself every day.",
    "",
    "IF SOMETHING IS WRONG",
    `  Write to ${SELLER_EMAIL} or call ${SELLER_PHONE}.`,
    `  Quote the order number: ${order.id}.`,
    "",
    `Exchange and return terms: ${appUrl}/returns`,
    "",
    "VELUR",
    appUrl,
  ].join("\n");
}

/**
 * The letter's markup.
 *
 * NOTE: (§9.2) Tables and inline styles, because a mail client is not a browser:
 * a stylesheet is dropped and a web font never arrives.
 */
function htmlBody(order: Order, appUrl: string): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #ebebeb;font-size:14px;color:#131316;">
          ${escapeHtml(i.nameUk)}<br>
          <span style="font-size:12px;color:#75757e;">${i.quantity} × ${money(i.price)}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #ebebeb;font-size:14px;color:#131316;text-align:right;white-space:nowrap;">
          ${money(i.price * i.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;">
    <tr><td style="padding:32px 28px;">

      <img src="${appUrl}/email-lockup.png" width="166" height="40" alt="VELUR"
           style="display:block;margin:0 0 28px;border:0;outline:none;text-decoration:none;">

      <h1 style="margin:0 0 8px;font-size:22px;font-weight:normal;color:#131316;">
        Thank you for your order, ${escapeHtml(order.customer.firstName)}!
      </h1>
      <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#4a4b54;">
        Payment received. Order <strong style="color:#131316;">№${escapeHtml(order.id)}</strong>
        is being prepared.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
        <tr>
          <td style="padding:14px 0 0;font-size:14px;font-weight:bold;color:#131316;">Total</td>
          <td style="padding:14px 0 0;font-size:16px;font-weight:bold;color:#131316;text-align:right;white-space:nowrap;">
            ${money(order.total)}
          </td>
        </tr>
      </table>

      <p style="margin:28px 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#75757e;">Delivery</p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#131316;">${escapeHtml(deliveryLine(order))}</p>
      <p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#75757e;">
        Delivery is paid by the recipient at the branch.
      </p>

      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#75757e;">What happens next</p>
      <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#4a4b54;">
        We pack the order and hand it to Nova Poshta.
        Nova Poshta will tell you about the parcel separately, once the waybill has been created.
      </p>

      <div style="margin:32px 0 0;padding:24px 0 4px;border-top:1px solid #ebebeb;text-align:center;">
        <img src="${appUrl}/email-logo.png" width="64" height="57" alt=""
             style="display:inline-block;border:0;outline:none;text-decoration:none;">
        <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#131316;">
          VELUR is more than cosmetics.
        </p>
        <p style="margin:2px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#4a4b54;">
          It is a state. It is a feeling.<br>
          It is about a woman who chooses herself every day.
        </p>
      </div>

      <p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #ebebeb;font-size:13px;line-height:1.7;color:#75757e;">
        Something wrong with the order? Write to
        <a href="mailto:${SELLER_EMAIL}" style="color:#131316;">${SELLER_EMAIL}</a>
        or call <a href="tel:${SELLER_PHONE.replace(/\s/g, "")}" style="color:#131316;">${SELLER_PHONE}</a>,
        quoting the order number.<br>
        <a href="${appUrl}/returns" style="color:#131316;">Exchange and return terms</a>
      </p>

    </td></tr>
  </table>
</body></html>`;
}

/** Product names are manager-entered text going into markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** What the letter says, as data, separate from sending it. Exported for `mail.test.ts`. */
export function renderOrderPaidEmail(
  order: Order,
  appUrl: string,
): { subject: string; text: string; html: string } {
  return {
    subject: `Order no. ${order.id} paid — VELUR`,
    text: plainBody(order, appUrl),
    html: htmlBody(order, appUrl),
  };
}

/**
 * Sends the customer the payment confirmation.
 *
 * NOTE: (§3.1, §9.2) Errors are logged and caught: the order is paid either way,
 * and the webhook must still answer 200.
 *
 * @param order Paid order entity.
 * @returns True when Resend accepted the letter.
 */
export async function sendOrderPaidEmail(order: Order): Promise<boolean> {
  if (!isMailConfigured()) return false;

  const to = order.customer.email?.trim();
  if (!to) return false;

  try {
    const letter = renderOrderPaidEmail(order, getAppUrl());
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        from: process.env.MAIL_FROM!.trim(),
        to: [to],
        subject: letter.subject,
        text: letter.text,
        html: letter.html,
        // NOTE: (§9.2) A reply reaches the shop, not the sending domain.
        reply_to: SELLER_EMAIL,
      }),
    });

    if (!res.ok) {
      console.error(
        `Resend refused the order confirmation for ${order.id} (HTTP ${res.status}): ` +
          (await res.text().catch(() => "")),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Order confirmation for ${order.id} could not be sent:`, err);
    return false;
  }
}
