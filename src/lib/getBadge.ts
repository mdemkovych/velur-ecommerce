import { MANUAL_BADGE_LABELS, regularPrice, type Product } from "./types";

export type BadgeVariant = "sale" | "social" | "novelty" | "out_of_stock";

export interface Badge {
  text: string;
  variant: BadgeVariant;
}

/**
 * Resolves the display badge for a product card by strict priority.
 *
 * NOTE: (§12.4) Stock availability and sale state take precedence over manual
 * badges to prevent misleading product claims.
 *
 * @param product Product entity.
 * @returns Resolved badge or null if no badge applies.
 */
export function getBadge(product: Product): Badge | null {
  if (product.stock === 0) {
    return { text: "Out of stock", variant: "out_of_stock" };
  }

  if (regularPrice(product) !== undefined) {
    return { text: "Sale", variant: "sale" };
  }

  if (product.badge === "NEW") {
    return { text: MANUAL_BADGE_LABELS.NEW, variant: "novelty" };
  }

  if (product.badge === "BESTSELLER") {
    return { text: MANUAL_BADGE_LABELS.BESTSELLER, variant: "social" };
  }

  return null;
}

