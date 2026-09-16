import "server-only";
import crypto from "crypto";
import { PAYMENT_WINDOW_MINUTES } from "./types";
import type { Order } from "./types";
import { createPaymentToken } from "./paymentToken";

/**
 * Monobank Acquiring API client and cryptographic webhook verification.
 *
 * NOTE: (§3.1) Direct acquiring integration: payment cards never touch application servers.
 * Verifies webhooks via public key cryptography, creates hosted checkout invoices, checks status, and voids invoices.
 */

const API_BASE = "https://api.monobank.ua/api/merchant";
const PUBKEY_TTL_MS = 60 * 60 * 1000;

// NOTE: (§3.3) Granular timeout definitions: interactive checkout vs background tasks.
const TIMEOUT_MS = {
  status: 4_000,
  invoice: 10_000,
  void: 5_000,
} as const;

export class MonobankUnavailableError extends Error {
  constructor(message = "Online payment is temporarily unavailable") {
    super(message);
    this.name = "MonobankUnavailableError";
  }
}

/** NOTE: (§1.4) False switches online payment off; it never simulates one. */
export function isMonobankConfigured(): boolean {
  return Boolean(process.env.MONOBANK_API_TOKEN?.trim());
}

function requireToken(): string {
  const token = process.env.MONOBANK_API_TOKEN?.trim();
  if (!token) throw new MonobankUnavailableError();
  return token;
}

// ─── Webhook Signature Verification ───────────────────────────────────────────

let cachedPubKey: { pem: string; fetchedAt: number } | null = null;

let lastForcedRefetchAt = 0;
const FORCED_REFETCH_INTERVAL_MS = 60_000;

async function fetchMerchantPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/pubkey`, {
      headers: { "X-Token": requireToken() },
      signal: AbortSignal.timeout(TIMEOUT_MS.status),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const { key } = (await res.json()) as { key?: string };
    if (!key) return null;

    const pem = Buffer.from(key, "base64").toString("utf-8");
    cachedPubKey = { pem, fetchedAt: Date.now() };
    return pem;
  } catch (err) {
    console.error("Failed to fetch Monobank public key:", err);
    return null;
  }
}

async function getMerchantPublicKey(): Promise<{ pem: string; fromCache: boolean } | null> {
  if (cachedPubKey && Date.now() - cachedPubKey.fetchedAt < PUBKEY_TTL_MS) {
    return { pem: cachedPubKey.pem, fromCache: true };
  }
  const pem = await fetchMerchantPublicKey();
  return pem === null ? null : { pem, fromCache: false };
}

function verifyWith(pem: string, rawBody: string, xSign: string): boolean {
  try {
    return crypto
      .createVerify("SHA256")
      .update(rawBody)
      .verify(pem, Buffer.from(xSign, "base64"));
  } catch (err) {
    console.error("Monobank signature verification error:", err);
    return false;
  }
}

/**
 * Verifies Monobank webhook payload signature using merchant public key.
 *
 * NOTE: (§3.1) Fails closed on signature mismatch or missing keys; triggers at most one forced key refetch per minute.
 *
 * @param rawBody Raw UTF-8 request payload string.
 * @param xSign Base64 signature from 'x-sign' header.
 * @returns True if signature is cryptographically valid; false otherwise.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  xSign: string | null,
): Promise<boolean> {
  if (!xSign || !isMonobankConfigured()) return false;

  const key = await getMerchantPublicKey();
  if (!key) return false;

  if (verifyWith(key.pem, rawBody, xSign)) return true;
  if (!key.fromCache) return false;

  const now = Date.now();
  if (now - lastForcedRefetchAt < FORCED_REFETCH_INTERVAL_MS) return false;
  lastForcedRefetchAt = now;

  cachedPubKey = null;
  const fresh = await fetchMerchantPublicKey();
  if (fresh === null || fresh === key.pem) return false;

  console.warn("Monobank public key changed; re-verifying the callback against the new one.");
  return verifyWith(fresh, rawBody, xSign);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface MonobankInvoice {
  invoiceId: string;
  pageUrl: string;
}

/** NOTE: (§2.6) Converts whole UAH amounts to integer kopecks for bank transfer. */
export function toKopecks(uah: number): number {
  return Math.round(uah * 100);
}

/** NOTE: (§4.7) ISO 4217 numeric code for Ukrainian Hryvnia (UAH). */
export const UAH_CCY = 980;

/**
 * Creates hosted Monobank checkout session for an order.
 *
 * NOTE: (§3.1, §3.5) Passes itemized basket, signed success redirect token, and webhook callback URL.
 *
 * @param order Order entity.
 * @param origin Canonical origin URL.
 * @returns Generated invoice ID and redirect payment URL.
 */
export async function createInvoice(order: Order, origin: string): Promise<MonobankInvoice> {
  const token = requireToken();

  const res = await fetch(`${API_BASE}/invoice/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Token": token },
    signal: AbortSignal.timeout(TIMEOUT_MS.invoice),
    body: JSON.stringify({
      amount: toKopecks(order.total),
      ccy: UAH_CCY,
      merchantPaymInfo: {
        reference: order.id,
        destination: `Payment for VELUR order no. ${order.id}`,
        basketOrder: order.items.map((item) => ({
          name: item.nameUk,
          qty: item.quantity,
          sum: toKopecks(item.price * item.quantity),
          unit: "pcs",
          code: item.productId,
          ...(item.image ? { icon: new URL(item.image, origin).toString() } : {}),
        })),
      },
      redirectUrl: `${origin}/checkout/success?orderId=${encodeURIComponent(
        order.id,
      )}&t=${encodeURIComponent(await createPaymentToken(order.id))}`,
      webHookUrl: `${origin}/api/monobank/webhook`,
      validity: PAYMENT_WINDOW_MINUTES * 60,
      paymentType: "debit",
    }),
  });

  if (!res.ok) {
    console.error("Monobank invoice creation failed:", res.status, await res.text());
    throw new MonobankUnavailableError();
  }

  const data = (await res.json()) as Partial<MonobankInvoice>;
  if (!data.invoiceId || !data.pageUrl) throw new MonobankUnavailableError();

  return { invoiceId: data.invoiceId, pageUrl: data.pageUrl };
}

/** Monobank API transaction lifecycle status enum. */
export type MonobankInvoiceStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired";

/**
 * Fetches raw invoice state payload directly from Monobank API.
 *
 * @param invoiceId Monobank invoice identifier.
 * @returns Status payload or null if unreachable or error.
 */
export async function getInvoiceState(
  invoiceId: string,
): Promise<MonobankStatusPayload | null> {
  if (!isMonobankConfigured()) return null;

  try {
    const res = await fetch(
      `${API_BASE}/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      {
        headers: { "X-Token": requireToken() },
        signal: AbortSignal.timeout(TIMEOUT_MS.status),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("Monobank invoice status failed:", res.status, await res.text());
      return null;
    }

    return (await res.json()) as MonobankStatusPayload;
  } catch (err) {
    console.error("Monobank invoice status error:", err);
    return null;
  }
}

/**
 * Fetches high-level invoice status word.
 *
 * @param invoiceId Monobank invoice identifier.
 * @returns Status keyword or null.
 */
export async function getInvoiceStatus(
  invoiceId: string,
): Promise<MonobankInvoiceStatus | null> {
  const state = await getInvoiceState(invoiceId);
  return (state?.status as MonobankInvoiceStatus | undefined) ?? null;
}

/**
 * Voids an active Monobank invoice to prevent late payments on cancelled orders.
 *
 * NOTE: (§3.1) Fail-safe: returns boolean status without throwing to allow order cancellation flows to continue.
 *
 * @param invoiceId Monobank invoice identifier.
 * @returns True if successfully voided or not found (404); false on API error.
 */
export async function voidInvoice(invoiceId: string | undefined): Promise<boolean> {
  if (!invoiceId || !isMonobankConfigured()) return true;

  try {
    const res = await fetch(`${API_BASE}/invoice/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Token": requireToken() },
      signal: AbortSignal.timeout(TIMEOUT_MS.void),
      body: JSON.stringify({ invoiceId }),
    });
    if (res.ok || res.status === 404) return true;

    console.error("Monobank invoice removal failed:", res.status, await res.text());
    return false;
  } catch (err) {
    console.error("Monobank invoice removal error:", err);
    return false;
  }
}

// ─── Paid Callback Verification ───────────────────────────────────────────────

export interface MonobankStatusPayload {
  reference?: string;
  invoiceId?: string;
  status?: string;
  amount?: number;
  ccy?: number;
}

export type PaidCallbackCheck = { ok: true } | { ok: false; reason: string };

/**
 * Cross-checks webhook payment payload parameters against internal order state.
 *
 * NOTE: (§3.1) Verifies expected kopecks, UAH currency code (980), and matching invoiceId.
 *
 * @param order Local order entity.
 * @param payload Bank callback payload.
 * @returns Verification result object.
 */
export function verifyPaidCallback(
  order: Order,
  payload: MonobankStatusPayload,
): PaidCallbackCheck {
  const expected = toKopecks(order.total);
  if (payload.amount !== expected) {
    return { ok: false, reason: `amount ${payload.amount} != expected ${expected}` };
  }
  if (payload.ccy !== UAH_CCY) {
    return { ok: false, reason: `currency ${payload.ccy} != expected ${UAH_CCY}` };
  }
  if (order.invoiceId && payload.invoiceId !== order.invoiceId) {
    return { ok: false, reason: `invoiceId ${payload.invoiceId} != expected ${order.invoiceId}` };
  }
  return { ok: true };
}

