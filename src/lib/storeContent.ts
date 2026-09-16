/**
 * Global shop content and legal seller configuration.
 *
 * NOTE: (§8.3, §9.6) Constants holding immutable legal facts and policy versions.
 */

/* NOTE: (§8.3) Packaging text is maintained per-product and must not be defaulted globally. */

/** NOTE: (§3.6) Bump in the same commit that changes privacy policy wording. */
export const PRIVACY_POLICY_VERSION = "2026-09-05";

// ─── Legal Seller Identity ───────────────────────────────────────────────────

/**
 * Sample seller identity.
 *
 * NOTE: (§9.6) A Ukrainian trader has to publish these details, and the shop
 * renders them on the legal pages. The real registration data is replaced with
 * placeholders here: this copy is published to be read, not to trade.
 */
export const SELLER = {
  name: "Sole proprietor, sample registration",
  taxId: "0000000000",
  /* NOTE: (§9.6) Locality only; private street address is withheld for privacy. */
  city: "Ternopil, Ukraine",
  registryNumber: "0000000000000000000",
  registryDate: "20.02.2025",
  trademarkNumber: "000000",
  trademarkDate: "12.08.2026",
} as const;

/** Primary customer support and legal inquiry email. */
export const SELLER_EMAIL = "hello@example.com";

/** Customer contact phone in international format. */
export const SELLER_PHONE = "+380 00 000 00 00";

/** Unformatted phone string for tel: hyperlinks. */
export const SELLER_PHONE_HREF = "+380000000000";

/** When the telephone is answered, as shown beside the call button. */
export const SELLER_HOURS = "Daily, 09:00 to 20:00";

/**
 * Public Telegram address for the contact widget.
 *
 * MUST NOT: guess this handle. A wrong one sends customers to a stranger, and
 * nothing in the shop would report it.
 */
export const SELLER_TELEGRAM = "https://t.me/example";
