import type { Metadata } from "next";
import { Clause, LegalPage } from "../LegalPage";
import { SELLER, SELLER_EMAIL, SELLER_PHONE } from "@/lib/storeContent";

export const metadata: Metadata = {
  title: "Public offer",
  description:
    "The public offer of the VELUR online shop: the terms on which goods are sold.",
  alternates: { canonical: "/offer" },
};

/**
 * Public sales contract and terms of service agreement under Ukrainian civil law.
 *
 * NOTE: (§3.1) Formal legal offer required by Monobank payment gateway.
 */
export default function OfferPage() {

  return (
    <LegalPage
      title="Public offer"
      intro="This document is a formal offer to enter into a contract of sale on the terms set out below. By placing an order you accept them."
    >
      <Clause heading="1. General">
        <p>
          The seller under this contract is {SELLER.name}, tax number {SELLER.taxId}, hereafter
          the «Seller». The Seller offers any individual, hereafter the «Buyer», the goods
          presented on the site on the terms of this contract.
        </p>
        <p>
          The «VELUR» trademark belongs to the Seller under Ukrainian certificate
          no. {SELLER.trademarkNumber} of {SELLER.trademarkDate}.
        </p>
        <p>
          The contract is a public one under articles 633 and 641 of the Civil Code of Ukraine.
          Its terms are the same for every buyer.
        </p>
      </Clause>

      <Clause heading="2. Subject of the contract">
        <p>
          The Seller undertakes to transfer perfume and cosmetic goods into the Buyer&apos;s
          ownership, and the Buyer undertakes to accept and pay for them on these terms.
        </p>
        <p>
          The description, ingredients, volume and price of each product are given on its page.
          Images may differ slightly from the original because of screen settings.
        </p>
      </Clause>

      <Clause heading="3. Price and payment">
        <p>
          Prices are in hryvnia. A price is fixed at the moment the order is placed, and any
          later change on the site does not affect an order already placed.
        </p>
        <p>
          Payment is made online by bank card through the monobank service. Card details are
          entered on the bank&apos;s secure page and are never passed to the Seller. Delivery is not
          part of the order total and is paid by the Buyer to the carrier separately.
        </p>
      </Clause>

      <Clause heading="4. Placing and fulfilling an order">
        <p>
          An order counts as accepted once payment is confirmed. The Seller may cancel an order
          if the goods are out of stock, informing the Buyer and refunding the sum paid in full.
        </p>
        <p>
          Delivery terms are set out on the «Delivery and payment» page, and return terms on the
          «Exchange and returns» page. Both pages form an inseparable part of this contract.
        </p>
      </Clause>

      <Clause heading="5. Liability">
        <p>
          The Seller is not liable for harm caused by using the goods other than as intended or
          contrary to the instructions. Before first use we recommend testing the product on a
          small patch of skin.
        </p>
      </Clause>

      <Clause heading="6. Seller&apos;s details">
        <p>{SELLER.name}</p>
        <p>Tax number: {SELLER.taxId}</p>
        <p>Location: {SELLER.city}</p>
        <p>
          State register entry: {SELLER.registryNumber} of {SELLER.registryDate}
        </p>
        <p>
          Email:{" "}
          <a
            href={`mailto:${SELLER_EMAIL}`}
            className="underline underline-offset-4 hover:text-black"
          >
            {SELLER_EMAIL}
          </a>
        </p>
        <p>Telephone: {SELLER_PHONE}</p>
      </Clause>
    </LegalPage>
  );
}
