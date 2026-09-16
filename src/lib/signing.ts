import "server-only";

/**
 * Cryptographic signing utilities for HMAC token generation and verification.
 *
 * NOTE: (§3.1) Employs Web Crypto API with SHA-256 for short-lived checkout and payment verification tokens.
 */

const encoder = new TextEncoder();

/** Development fallback key used only in non-production environments when secret is unset. */
let ephemeralDevSecret: string | null = null;

/**
 * The key a payment token is signed with.
 *
 * NOTE: (§3.1) Production refuses to sign without `PAYMENT_TOKEN_SECRET`.
 * Development mints an ephemeral one, so a restart invalidates every token
 * issued before it.
 */
export function getSecret(): string {
  const secret = process.env.PAYMENT_TOKEN_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYMENT_TOKEN_SECRET is not set — refusing to sign tokens in production");
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomUUID();
    console.warn("PAYMENT_TOKEN_SECRET is not set — using an ephemeral development secret");
  }
  return ephemeralDevSecret;
}

/** Signs a payload with HMAC-SHA256, hex encoded. */
export async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares two strings in constant time.
 *
 * NOTE: (§3.1) A plain `===` returns as soon as two bytes differ, so how long
 * it took says how much of a secret was already right. Guards the payment token
 * and the cron routes' `CRON_SECRET`.
 */
export function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

