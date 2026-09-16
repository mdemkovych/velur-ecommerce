import type { Metadata } from "next";
import { Clause, LegalPage } from "../LegalPage";
import { SELLER, SELLER_EMAIL, SELLER_PHONE, SELLER_PHONE_HREF } from "@/lib/storeContent";

export const metadata: Metadata = {
  title: "Contacts",
  description:
    "How to reach VELUR: email, telephone, Instagram and the seller's registration details.",
  alternates: { canonical: "/contacts" },
};

/**
 * Public legal contacts page including registered business credentials and communication channels.
 *
 * NOTE: (§3.1) Required for acquiring bank compliance and consumer protection verification.
 */
export default function ContactsPage() {
  return (
    <LegalPage
      title="Contacts"
      intro="Write to us with any question about a product, an order or delivery. If it concerns an order already placed, quote its number: that is how we find it fastest."
    >
      <Clause heading="How to reach us">
        <p>
          Email:{" "}
          <a
            href={`mailto:${SELLER_EMAIL}`}
            className="underline underline-offset-4 hover:text-black"
          >
            {SELLER_EMAIL}
          </a>
          . This is the main address for questions about orders, returns and paperwork.
        </p>
        <p>
          Telephone:{" "}
          <a
            href={`tel:${SELLER_PHONE_HREF}`}
            className="underline underline-offset-4 hover:text-black"
          >
            {SELLER_PHONE}
          </a>
        </p>
        <p>
          Instagram:{" "}
          <a
            href="https://instagram.com/velur.brand"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-black"
          >
            @velur.brand
          </a>
        </p>
        <p>
          For a faster answer, quote the order number and the product name, and if the
          matter is damage or a fault, attach a few photographs.
        </p>
      </Clause>

      <Clause heading="Seller&apos;s details">
        <p>Name: {SELLER.name}</p>
        <p>Tax number: {SELLER.taxId}</p>
        <p>Location: {SELLER.city}</p>
        <p>
          State register entry: {SELLER.registryNumber} of{" "}
          {SELLER.registryDate}
        </p>
        <p>
          The «VELUR» trademark is protected by Ukrainian certificate no. {SELLER.trademarkNumber} of{" "}
          {SELLER.trademarkDate}.
        </p>
      </Clause>
    </LegalPage>
  );
}

