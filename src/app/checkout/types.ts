import { LAST_ORDER_STORAGE_KEY, type PlacedOrder } from "./OrderPlaced";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

/** Raw checkout form state before server payload transformation. */
export interface CheckoutValues {
  firstName: string;
  lastName: string;
  /** Subscriber digits only (+380 prefix is fixed in UI). */
  phone: string;
  email: string;
  deliveryMethod: DeliveryMethod | "";
  city: string;
  cityRef: string;
  branch: string;
  branchRef: string;
  street: string;
  house: string;
  apartment: string;
  paymentMethod: PaymentMethod | "";
  comment: string;
  consent: boolean;
}

/** Form validation error mapping. */
export type CheckoutErrors = Partial<
  Record<keyof CheckoutValues | "address" | "form", string>
>;

export const emptyCheckoutValues: CheckoutValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  deliveryMethod: "",
  city: "",
  cityRef: "",
  branch: "",
  branchRef: "",
  street: "",
  house: "",
  apartment: "",
  paymentMethod: "mono",
  comment: "",
  consent: false,
};

/**
 * Combines separate street, house, and apartment fields into single address string.
 */
export function composeAddress(values: CheckoutValues): string {
  const street = values.street.trim();
  const house = values.house.trim();
  if (street.length < 2 || house.length < 1) return "";

  const apartment = values.apartment.trim();
  return `${street} St, ${house}${apartment ? `, apt. ${apartment}` : ""}`;
}

/** Session storage key for checkout form input drafts. */
export const CHECKOUT_DRAFT_KEY = "velur_checkout_draft";

/**
 * Persists checkout form values into session storage during payment redirection.
 */
export function saveCheckoutDraft(values: CheckoutValues): void {
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(values));
  } catch {
    // Storage quota or privacy restriction fallback.
  }
}

/**
 * Retrieves cached checkout draft from session storage upon returning from bank gateway.
 */
export function readCheckoutDraft(): CheckoutValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutValues> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return { ...emptyCheckoutValues, ...parsed };
  } catch {
    return null;
  }
}

/**
 * Clears saved checkout draft from session storage.
 */
export function clearCheckoutDraft(): void {
  try {
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    // Storage quota or privacy restriction fallback.
  }
}

/**
 * Checks whether session storage holds an unsettled order requiring release or completion.
 *
 * NOTE: (§3.1, §4.5) Used during checkout initialization to detect returning unpaid sessions.
 */
export function hasReleasableOrder(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (!raw) return false;

    const stored = JSON.parse(raw) as PlacedOrder;
    return Boolean(stored.id && stored.paymentToken && !stored.settled);
  } catch {
    return false;
  }
}

