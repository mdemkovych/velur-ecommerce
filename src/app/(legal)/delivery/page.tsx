import type { Metadata } from "next";
import { Clause, LegalPage } from "../LegalPage";

export const metadata: Metadata = {
  title: "Delivery and payment",
  description:
    "Nova Poshta delivery across Ukraine and online payment: timings, cost and how collection works.",
  alternates: { canonical: "/delivery" },
};

/**
 * Public terms of shipping (Nova Poshta) and online payment processing (Monobank).
 *
 * NOTE: (§3.1, §5.1) Outlines delivery timelines, recipient carrier payment, and secure acquiring terms.
 */
export default function DeliveryPage() {

  return (
    <LegalPage
      title="Delivery and payment"
      intro="We send orders by Nova Poshta across Ukraine. Payment is made online, by card, on the site itself."
    >
      <Clause heading="Delivery">
        <p>
          Delivery is by Nova Poshta to a branch or a parcel locker within Ukraine.
          There is no international delivery at present.
        </p>
        <p>
          An order is handed to the carrier on the day the payment arrives, or the day after.
          The time in transit depends on the destination and is usually one to three
          working days.
        </p>
        <p>
          <strong className="font-semibold text-black">Delivery is not part of the order total.</strong>{" "}
          The recipient pays the carrier directly, at Nova Poshta&apos;s rates, on collection.
        </p>
      </Clause>

      <Clause heading="Payment">
        <p>
          <strong className="font-semibold text-black">Payment through monobank.</strong>{" "}
          An order is paid online with a Visa or Mastercard from any bank.
        </p>
        <p>
          <strong className="font-semibold text-black">Payment is secure.</strong> Card details
          are entered on monobank&apos;s own secure page, not on our site: the connection is
          encrypted, and the shop neither receives nor stores the card number, the expiry date or
          the CVV. All that comes back to us is the bank&apos;s answer about whether the payment went
          through.
        </p>
        <p>
          An order counts as placed once the payment is confirmed. The goods are reserved for
          the duration of the payment; if it does not arrive within the window, the reservation is
          released and the goods become available to other shoppers again.
        </p>
        <p>There is no cash on delivery.</p>
      </Clause>

      <Clause heading="Collection">
        <p>
          Check that the packaging is intact when you collect the parcel. If it is damaged, draw
          up a report together with the branch staff: it is needed for any claim.
        </p>
      </Clause>
    </LegalPage>
  );
}
