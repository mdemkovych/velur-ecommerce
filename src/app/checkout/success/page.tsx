import { resolvePaymentOutcome } from "@/lib/paymentOutcome";
import { SuccessContent } from "./SuccessContent";

/**
 * Server-rendered post-payment return gateway verification page.
 *
 * NOTE: (§3.1, §4.1) Resolves order payment status directly with Monobank gateway and database.
 */

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; t?: string }>;
}) {
  const { orderId = "", t } = await searchParams;
  const outcome = await resolvePaymentOutcome(orderId, t);

  return <SuccessContent orderId={orderId} outcome={outcome} />;
}

