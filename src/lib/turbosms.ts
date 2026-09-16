import "server-only";
import type { Order } from "./types";

/**
 * TurboSMS dispatcher for the customer's payment confirmation.
 *
 * NOTE: (§9.2) The letter carries the detail; this carries the order number to the one
 * field the shop verifies. One part or it bills twice: 160 characters in GSM-7,
 * and only 70 if a Cyrillic character forces UCS-2.
 */

const ENDPOINT = "https://api.turbosms.ua/message/send.json";
const TIMEOUT_MS = 5_000;

/** The envelope TurboSMS answers with, including on refusal. */
type SendResponse = {
  response_status?: string;
  response_result?: { response_status?: string }[] | null;
};

/** NOTE: (§1.4) Both halves, and false is a quiet working state (§9.2). */
export function isTurboSmsConfigured(): boolean {
  return Boolean(process.env.TURBOSMS_API_TOKEN?.trim() && process.env.TURBOSMS_SENDER?.trim());
}

/** TurboSMS addresses a subscriber as 380XXXXXXXXX; an order stores E.164. */
function toRecipient(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formats the customer's payment confirmation.
 *
 * NOTE: (§9.2) A Cyrillic message is 70 characters before it splits and bills twice, so
 * the shop's name is left to the sender id and the word "order" to the no. in front of it.
 *
 * @param order Paid order entity.
 * @returns Message text, one part for any order id.
 */
export function renderOrderPaidSms(order: Order): string {
  return `Thank you! No. ${order.id} paid. Nova Poshta will write about the parcel.`;
}

/**
 * Sends the customer the payment confirmation.
 *
 * NOTE: (§9.2) Errors are logged and caught: the order is paid either way, and the
 * webhook must still answer 200.
 *
 * @param order Paid order entity.
 * @returns True when TurboSMS accepted the message for delivery.
 */
export async function sendOrderPaidSms(order: Order): Promise<boolean> {
  if (!isTurboSmsConfigured()) return false;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TURBOSMS_API_TOKEN!.trim()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        recipients: [toRecipient(order.customer.phone)],
        sms: {
          sender: process.env.TURBOSMS_SENDER!.trim(),
          text: renderOrderPaidSms(order),
        },
      }),
    });

    if (!res.ok) {
      console.error(`TurboSMS refused the paid notice for ${order.id} (HTTP ${res.status})`);
      return false;
    }

    // NOTE: (§9.2) A refusal arrives as 200, so res.ok is not the verdict. The one
    // recipient's own status is: the envelope has several success codes besides zero,
    // and a refusal it answers alone (a bad token) carries no recipient at all.
    const body = (await res.json().catch(() => null)) as SendResponse | null;
    const delivery = body?.response_result?.[0]?.response_status;
    if (delivery !== "OK") {
      // MUST NOT: log the response body; it echoes the recipient's telephone.
      console.error(
        `TurboSMS refused the paid notice for ${order.id}: ` +
          `${body?.response_status ?? "unreadable response"} / ${delivery ?? "no recipient result"}`,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Paid notice for ${order.id} could not be sent:`, err);
    return false;
  }
}
