import type { Metadata } from "next";
import { Clause, LegalPage } from "../LegalPage";
import { SELLER_EMAIL } from "@/lib/storeContent";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data VELUR collects, what for, how long it is kept, and what rights a shopper has.",
  alternates: { canonical: "/privacy" },
};

/**
 * Privacy policy describing GDPR-compliant data collection, retention, and scrubbing rules.
 *
 * NOTE: (§3.6.1) Explains 3-year PII retention schedule, localStorage cart isolation, and cookieless web analytics.
 */
export default function PrivacyPage() {

  return (
    <LegalPage
      title="Privacy policy"
      intro="We collect only what we cannot deliver an order without, and pass it to nobody except the carrier, the payment service and the services that deliver your payment confirmation."
    >
      <Clause heading="What we collect">
        <p>
          First and last name, telephone number, email address, city and carrier branch.
          All of it is needed to make up the order and hand the parcel to the carrier.
        </p>
        <p>
          <strong className="font-semibold text-black">We never receive card details.</strong>{" "}
          Monobank takes them on its own secure page; all that comes back to the shop is the
          outcome of the payment.
        </p>
      </Clause>

      <Clause heading="What for">
        <p>
          To place, pay for and deliver the order, to be in touch about it, and to meet the
          legal requirements for keeping sales records. It is never used for mailings.
        </p>
      </Clause>

      <Clause heading="Who it is passed to">
        <p>
          The carrier, Nova Poshta, is given the name, telephone and branch so that it can
          deliver the parcel. Monobank receives the sum and the order number. To send the payment
          confirmation, your email address goes to the email service and your telephone number to
          the SMS service. Each receives only what it cannot deliver the message without, and uses
          it for nothing else. Data is neither passed nor sold to third parties.
        </p>
      </Clause>

      <Clause heading="How long it is kept">
        <p>
          Order data is kept for <strong className="font-semibold text-black">three years</strong>{" "}
          from the date of the order. The period is not arbitrary: it matches the general
          limitation period under the Civil Code of Ukraine and the retention period for primary
          documents under the Tax Code.
        </p>
        <p>
          Once it passes,{" "}
          <strong className="font-semibold text-black">your personal data is erased</strong> —
          name, telephone, email, address and comment. The record of the purchase itself stays,
          anonymised: the sum, the items and the dates, with no mention of the buyer. Tax
          accounting requires that, and you can no longer be identified from such a record.
        </p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          Under Ukraine&apos;s personal data protection law you have the right to learn what data
          of yours we hold, to correct it, or to demand its deletion. Write to{" "}
          <a
            href={`mailto:${SELLER_EMAIL}`}
            className="underline underline-offset-4 hover:text-black"
          >
            {SELLER_EMAIL}
          </a>
          . We usually answer within a few working days; the outer limit is thirty calendar
          days. That period is set by the law itself, and is named here as a limit rather than as
          our usual pace.
        </p>
      </Clause>

      <Clause heading="Cookies and analytics">
        <p>
          <strong className="font-semibold text-black">The site sets no cookie for a shopper.</strong>{" "}
          The basket and the wishlist live in your browser&apos;s own memory
          (localStorage). They are not sent to the server by themselves and do not let
          us recognise you. The details of an order just placed sit in the tab&apos;s
          memory (sessionStorage) and vanish the moment you close it.
        </p>
        <p>
          There are no advertising trackers on the site, and no service follows you
          between sites. We use{" "}
          <strong className="font-semibold text-black">Vercel Web Analytics</strong> —
          the built-in statistics of our host. It{" "}
          <strong className="font-semibold text-black">sets no cookie</strong> and
          does not store your IP address: we see only aggregate visit counts and
          cannot identify a particular person from them.
        </p>
        <p>
          Cookies are used only for staff signing in to the admin panel, and do not
          concern a shopper at all.
        </p>
      </Clause>
    </LegalPage>
  );
}
