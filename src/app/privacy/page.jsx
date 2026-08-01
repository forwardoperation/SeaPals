import Link from "next/link";

import {
  LegalDocument,
  LegalNotice,
  LegalSection,
  LegalTable,
  OperatorContact,
} from "@/components/legal/LegalDocument";
import {
  PRIVACY_RETENTION_SCHEDULE,
  SEAPALS_OPERATOR,
} from "@/lib/legalPrivacy.mjs";

export const metadata = {
  title: "Privacy Policy | SeaPals TCG",
  description:
    "How Sea Realm, LLC collects, uses, shares, protects, retains, and deletes information for SeaPals TCG.",
};

const providerRows = [
  [
    "Supabase",
    "Account authentication, adult account email, authorization records, surveys, tournament entries, and order records.",
    "Account access, database hosting, security, and administration.",
  ],
  [
    "Google",
    "Google sign-in profile information when selected; analytics and technical usage data on general site pages.",
    "Optional sign-in and understanding general website use. Analytics are excluded from adventure and authentication routes.",
  ],
  [
    "Kit",
    "Email address and, on the homepage form, optional first name and referral information.",
    "Sending optional launch news and card updates after the subscriber requests them.",
  ],
  [
    "Cloudflare",
    "IP address, request, device/browser, security, and delivery information.",
    "Hosting, delivering, protecting, and troubleshooting the website.",
  ],
  [
    "Stripe",
    "Order, payment, billing, shipping, contact, and fraud-prevention information when checkout is enabled.",
    "Hosted checkout, payment processing, receipts, tax, fraud prevention, and transaction administration.",
  ],
  [
    "Resend",
    "Tournament participant email, display name, deck name, event name, status, and review message when notifications are enabled.",
    "Sending transactional tournament review messages.",
  ],
];

const retentionRows = PRIVACY_RETENTION_SCHEDULE.map((entry) => [
  entry.category,
  entry.period,
  entry.detail,
]);

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="For families and players"
      title="Privacy Policy"
      summary="This policy explains what Sea Realm collects through SeaPals, why it is used, when it is shared, how long it is kept, and how families can ask to review or delete it."
    >
      <LegalNotice title="The short version for parents">
        <p>
          The Reefbound adventure requires an adult-managed account. Children
          should not enter their own email address. The adventure stores game
          progress locally in the browser, does not offer public chat or player
          profiles, and does not load Google Analytics on adventure or account
          sign-in pages. Email updates are optional and separate from game
          access.
        </p>
        <p>
          An adult can request access to or deletion of an account by emailing{" "}
          <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
            {SEAPALS_OPERATOR.privacyEmail}
          </a>
          . We may verify control of the relevant account before acting on the
          request.
        </p>
      </LegalNotice>

      <LegalSection id="scope" title="1. Who operates SeaPals">
        <p>
          {SEAPALS_OPERATOR.legalName} (“Sea Realm,” “we,” “us,” or “our”)
          operates the SeaPals TCG website, online tools, store preview,
          tournaments, surveys, and the Reefbound adventure at{" "}
          <a href="https://seapalstcg.com">seapalstcg.com</a>. This policy
          applies to information handled through those services.
        </p>
        <p>
          SeaPals is designed for families, including children. Parents and
          legal guardians should review this policy and supervise a child’s use
          of the site. A public privacy policy does not replace any direct
          notice or verified parental permission that applicable law may
          require.
        </p>
      </LegalSection>

      <LegalSection id="collection" title="2. Information we collect and why">
        <h3>Adult-managed adventure accounts</h3>
        <p>
          We collect the adult account email address, an authentication
          identifier, sign-in and security information, and records showing
          when an adult approved adventure access and whether that adult
          separately requested marketing email. If Google sign-in is selected,
          Google and Supabase may provide and store basic account details such
          as the account email, name, profile image, and provider identifier.
          We use this information to create and secure the account, authorize
          access, prevent abuse, and answer account requests.
        </p>

        <h3>Adventure progress and device storage</h3>
        <p>
          Reefbound save files, settings, deck progress, and profile slots are
          stored in the browser on the device and separated by signed-in
          account. The save feature does not upload those files to Sea Realm.
          We cannot retrieve or delete local saves remotely; the user can
          remove a profile in the game or clear the browser’s site data.
        </p>

        <h3>Optional email updates</h3>
        <p>
          If an adult requests updates, we send the email address to Kit. The
          homepage signup may also collect an optional first name and referral
          answer. We use this information only for requested SeaPals news,
          product announcements, card updates, and parent resources. After a
          completed game session, the adventure may separately invite the adult
          account holder to request a confirmation email. Both the adult-account
          and marketing confirmations begin unchecked, and Kit&apos;s
          confirmation must still be completed. Account creation and continued
          play do not require marketing consent, and every marketing message
          must provide an unsubscribe option.
        </p>

        <h3>Surveys</h3>
        <p>
          Surveys may collect a player’s first name or nickname, age, game
          preferences, written feedback, and reward-counting status. The raw
          response is private to authorized Sea Realm administrators. We may
          publish de-identified totals and summaries. A parent or guardian
          should submit any survey for a player under 13, and free-text answers
          should not contain contact details or other identifying information.
        </p>

        <h3>Tournaments</h3>
        <p>
          Tournament entry may collect a display name, adult-managed contact
          email, deck name, deck list, review notes, edit credential, match
          results, and event status. Display names, deck information, and match
          results may appear publicly in the applicable event. Contact emails
          and private edit credentials are not intended for public display.
        </p>

        <h3>Store and transactions</h3>
        <p>
          If checkout is enabled, Stripe may collect contact, payment, billing,
          shipping, tax, and fraud-prevention information. Sea Realm receives
          order and fulfillment details such as name, email, selected shipping
          or Elverson pickup method, shipping address when delivery is selected,
          purchased items, totals, payment state, and receipt references. Sea
          Realm does not receive or store a full payment-card number.
        </p>

        <h3>Website analytics, logs, and support</h3>
        <p>
          On general site pages, Google Analytics may receive page, device,
          browser, approximate location, referral, cookie, and usage
          information. Google Analytics is excluded from adventure and
          authentication routes. Cloudflare and other infrastructure providers
          may process IP addresses, request headers, timestamps, device or
          browser information, and security signals to deliver and protect the
          site. If someone contacts us, we receive the information included in
          that message.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="3. Cookies and local browser storage">
        <ul>
          <li>
            <strong>Essential authentication cookies</strong> keep an adult
            account signed in and refresh its secure session.
          </li>
          <li>
            <strong>A one-hour approval cookie</strong> securely carries the
            adult’s account and optional email choices through sign-in. It is
            cleared after account setup.
          </li>
          <li>
            <strong>Adventure saves and settings</strong> remain in local
            browser storage until the user removes them or clears site data.
          </li>
          <li>
            <strong>The shopping cart</strong> may remain in local browser
            storage until checkout, removal, or clearing site data.
          </li>
          <li>
            <strong>Google Analytics cookies</strong> may be used on general
            pages, but not on adventure or authentication routes.
          </li>
        </ul>
        <p>
          Browser controls can remove or block storage, but doing so may sign
          out an account, erase local game progress, empty the cart, or prevent
          parts of the site from working.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="4. Service providers and disclosures">
        <p>
          We do not sell personal information. We disclose limited information
          to providers that help operate the service, complete a user-requested
          transaction, send a requested message, or protect the site. We may
          also disclose information when reasonably necessary to comply with
          law, protect a person’s safety, investigate fraud or abuse, or defend
          legal rights.
        </p>
        <LegalTable
          caption="Service providers, information processed, and purposes"
          headers={["Provider", "Information processed", "Purpose"]}
          rows={providerRows}
        />
      </LegalSection>

      <LegalSection id="retention" title="5. Retention and deletion schedule">
        <p>
          We limit retention to the period reasonably needed for the purpose
          described below. At the end of the period, information will be
          deleted or de-identified unless a longer period is required by law,
          a payment dispute, fraud prevention, safety, or an active legal
          matter.
        </p>
        <LegalTable
          caption="Personal information retention schedule"
          headers={["Category", "Maximum period", "What happens next"]}
          rows={retentionRows}
        />
      </LegalSection>

      <LegalSection id="family-rights" title="6. Parent and account-holder rights">
        <p>
          A parent, legal guardian, or adult account holder may ask us to:
        </p>
        <ul>
          <li>confirm whether we hold information connected to an account;</li>
          <li>review or correct that information;</li>
          <li>delete the account and associated personal information;</li>
          <li>stop further collection or use; or</li>
          <li>withdraw optional email consent.</li>
        </ul>
        <p>
          Send the request from the account email, when possible, to{" "}
          <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
            {SEAPALS_OPERATOR.privacyEmail}
          </a>
          . Include enough information to identify the relevant account or
          submission, but do not send government identification unless we
          specifically request an appropriate verification method. We will
          verify authority before disclosing or deleting account information
          and aim to complete verified deletion requests within 30 days.
        </p>
        <p>
          Marketing email can also be stopped through the unsubscribe link in
          the message. Local game saves must be removed on the device because
          Sea Realm does not receive those save files.
        </p>
      </LegalSection>

      <LegalSection id="children" title="7. Children’s privacy">
        <p>
          Children should not submit their own email address, full legal name,
          home address, phone number, school information, or other contact
          details through SeaPals. The adventure instructs players under 13 to
          ask a parent or guardian to create and manage the family account.
          Adventure access is not conditioned on joining the marketing list.
        </p>
        <p>
          If you believe a child submitted personal information without
          appropriate adult involvement, contact us so we can investigate and
          delete it. The current adult-approval checkbox is an account-access
          safeguard; it should not be understood as a claim that every possible
          legal parental-consent requirement has been satisfied.
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          We use measures intended to protect personal information, including
          encrypted connections, limited administrative access, server-side
          credentials, signed setup records, and access controls. No service
          can guarantee perfect security. Please contact us promptly if you
          believe an account or edit link has been compromised.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to this policy">
        <p>
          We may update this policy as SeaPals changes. The effective date at
          the top will be revised, and material changes affecting previously
          collected information may also be communicated directly to the
          relevant adult account holder when required.
        </p>
        <p>
          The accompanying <Link href="/terms">Terms of Use</Link> describes
          the rules for using SeaPals.
        </p>
      </LegalSection>

      <OperatorContact />
    </LegalDocument>
  );
}
