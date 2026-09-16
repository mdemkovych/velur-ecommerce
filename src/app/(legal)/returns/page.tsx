import type { Metadata } from "next";
import { Clause, LegalPage } from "../LegalPage";
import { SELLER_EMAIL } from "@/lib/storeContent";

export const metadata: Metadata = {
  title: "Exchange and returns",
  description:
    "How VELUR cosmetics are exchanged and returned, under Ukraine's consumer protection law.",
  alternates: { canonical: "/returns" },
};

/**
 * Consumer returns and exchange policy pursuant to Ukrainian consumer protection law.
 *
 * NOTE: (§3.1, §4.5) Details statutory 14-day return window and cosmetics hygiene exemptions.
 */
export default function ReturnsPage() {

  return (
    <LegalPage
      title="Exchange and returns"
      intro="If something did not suit you, or arrived other than you expected, write to us. Below are the terms on which we exchange goods and refund money."
    >
      <Clause heading="The window">
        <p>
          Under Ukraine&apos;s consumer protection law you may return goods of proper quality
          within 14 days of receiving them, provided they have not been used and their
          appearance, properties, seals and original packaging are intact.
        </p>
      </Clause>

      <Clause heading="What cannot be returned">
        <p>
          Perfume and cosmetic goods of proper quality are on the list of items that cannot be
          exchanged or returned (Cabinet of Ministers Resolution no. 172 of 19.03.1994) once the
          packaging has been opened or the protective film or seal broken.
        </p>
        <p>
          This does not apply to faulty goods: if what arrived is damaged, out of date or simply
          the wrong item, we will replace it or refund you in full.
        </p>
      </Clause>

      <Clause heading="How to arrange it">
        <p>
          Write to{" "}
          <a
            href={`mailto:${SELLER_EMAIL}`}
            className="underline underline-offset-4 hover:text-black"
          >
            {SELLER_EMAIL}
          </a>
          , quoting the order number, the product and the reason for the return, and attach
          photographs if the goods are damaged. We answer within two working days and send
          instructions for sending it back.
        </p>
        <p>
          Money is refunded by the same means it was paid, once the goods have been received and
          checked. How long it takes to reach the card depends on the issuing bank. Return postage
          for goods of proper quality is paid by the buyer; for faulty goods it is paid by the
          seller.
        </p>
      </Clause>
    </LegalPage>
  );
}
