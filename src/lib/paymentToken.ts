/**
 * HMAC-based transient authorization token for checkout operations.
 *
 * NOTE: (§3.1) Cryptographically binds the caller to the specified orderId
 * to prevent payment attempt exhaustion and unauthorized release by third parties.
 */

import { sign, timingSafeEquals } from "./signing";
import { PENDING_PAYMENT_TTL_MINUTES } from "./types";

/** NOTE: (§4.7) Matched to reservation TTL (30 min). */
const TOKEN_TTL_MS = PENDING_PAYMENT_TTL_MINUTES * 60 * 1000;

/**
 * Issues a signed payment token with current timestamp.
 *
 * @param orderId Human-readable order identifier.
 * @returns Timestamped HMAC signature string.
 */
export async function createPaymentToken(orderId: string): Promise<string> {
  const issuedAt = Date.now();
  return `${issuedAt}.${await sign(`${orderId}.${issuedAt}`)}`;
}

/**
 * Validates token signature and expiration against the given orderId.
 *
 * @param token Encoded token string.
 * @param orderId Expected order identifier.
 * @returns True if valid and unexpired; false otherwise.
 */
export async function verifyPaymentToken(
  token: string | undefined | null,
  orderId: string,
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [issuedAtRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_MS) return false;

  return timingSafeEquals(signature, await sign(`${orderId}.${issuedAtRaw}`));
}

