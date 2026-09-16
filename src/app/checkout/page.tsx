import type { Metadata } from "next";
import { isMonobankConfigured } from "@/lib/monobank";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * Server-rendered checkout entry point resolving acquiring availability.
 *
 * NOTE: (§3.1, §3.5) Passes payment gateway availability flag to the client form component.
 */
export default function CheckoutPage() {
  return <CheckoutForm isOnlinePaymentAvailable={isMonobankConfigured()} />;
}

