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
import {
  CANONICAL_SITE_HOSTNAME,
  CANONICAL_SITE_ORIGIN,
} from "@/lib/siteIdentity.mjs";

export const metadata = {
  title: "Privacy Policy | SeaPals TCG",
  description:
    "How Sea Realm, LLC collects, uses, shares, protects, retains, and deletes information for SeaPals TCG.",
  alternates: { canonical: "/privacy" },
};

const providerRows = [
  [
    "Supabase",
    "Account authentication, adult account email, authorization records, synchronized Reefbound saves, surveys, private bug reports, and order records.",
    "Account access, cross-device save synchronization and recovery, database hosting, security, and administration.",
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
    "Customer contact, order contents, totals, fulfillment method, and delivery address for paid-order alerts when those notifications are enabled.",
    "Sending private merchant purchase alerts.",
  ],
];

const retentionRows = [
  ...PRIVACY_RETENTION_SCHEDULE.map((entry) => [
    entry.category,
    entry.period,
    entry.detail,
  ]),
  [
    "Reefbound cloud saves",
    "While the profile and account are active; prior versions for up to 30 days",
    "A current deletion record remains while the account exists to stop an offline device from restoring a removed profile. Account deletion removes active saves, deletion records, and save history. Provider backups may take a limited additional period to age out.",
  ],
];

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
          should not enter their own email address. The adventure keeps a local
          copy of game progress and synchronizes its three save slots through
          Supabase so the family account can continue on another device or
          restore progress after local browser data is lost. Saves can include
          player-entered player and best-friend names, progress, settings, and
          decks. Reefbound does not offer public chat or player profiles and
          does not load Google Analytics on adventure or account sign-in pages.
          Email updates are optional and separate from game access.
        </p>
        <p>
          An adult can request access to, export, correction, or deletion of
          account and cloud-save information by emailing{" "}
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
          surveys, and the Reefbound adventure at{" "}
          <a href={CANONICAL_SITE_ORIGIN}>{CANONICAL_SITE_HOSTNAME}</a>. This policy
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

        <h3>Adventure progress, sync, and device storage</h3>
        <p>
          Reefbound keeps save files in local browser storage and synchronizes
          the account&apos;s three save slots to account-owned records hosted by
          Supabase. A save can include player-entered player and best-friend
          names, campaign and collection progress, settings, decks, inventory,
          quests, world position, and other game state. We use this information
          to let a family account continue across devices, restore an account
          copy after local data is lost, and resolve synchronization conflicts.
        </p>
        <p>
          If two devices change one slot independently, Reefbound preserves the
          conflicting copies and asks which one to keep instead of silently
          overwriting progress. Removing a profile creates a synchronized
          deletion record so an older offline device does not restore it as the
          current save. Clearing a browser&apos;s site data removes that device&apos;s
          local copy but does not by itself delete the account&apos;s cloud copy.
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

        <h3>Bug reports</h3>
        <p>
          Reefbound and the Simulator offer a private bug-report form. It may
          collect a written description, steps to repeat the problem, the
          expected result, player-selected impact, and limited technical and
          game context such as the page, browser, screen size, game phase,
          round, card identifiers, and board health values. The form does not
          intentionally attach an account email, account identifier, player
          name, or Reefbound save file. Reporters should not type personal
          information into the free-text fields, and a parent or guardian
          should help a player under 13 submit a report. We use reports to
          reproduce, prioritize, repair, and verify problems with the games.
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
        <p>
          After Stripe confirms a paid order, Resend processes an email alert to
          Sea Realm containing the customer contact information, purchased
          items and quantities, production speed, fulfillment method, totals,
          and any delivery address needed to prepare the order. These alerts are
          used only for order administration and fulfillment.
        </p>

        <h3>Website analytics, logs, and support</h3>
        <p>
          On general site pages, Google Analytics may receive page, device,
          browser, approximate location, referral, cookie, and usage
          information. Google Analytics is excluded from adventure,
          authentication, checkout-result, and administration routes.
          Cloudflare and other infrastructure providers may process IP
          addresses, request headers, timestamps, device or browser
          information, and security signals to deliver and protect the site. If
          someone contacts us, we receive the information included in that
          message.
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
            The account&apos;s three save slots are also synchronized through
            Supabase until the relevant profile or account is deleted.
          </li>
          <li>
            <strong>The shopping cart</strong> may remain in local browser
            storage until checkout, removal, or clearing site data.
          </li>
          <li>
            <strong>Google Analytics cookies</strong> may be used on general
            pages, but not on adventure, authentication, checkout-result, or
            administration routes.
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
        <p>
          Active cloud saves are kept while the corresponding family account
          and Reefbound profile remain active. After a profile is removed,
          prior save versions may be kept for up to 30 days for recovery and
          security, then deleted. The synchronized deletion record remains
          while the account exists so an older offline device cannot restore
          that profile as current. A verified account-deletion request removes
          active cloud saves, deletion records, and save history with the
          account. Supabase or other infrastructure backups may take a limited
          additional period to age out under the provider&apos;s backup schedule.
        </p>
      </LegalSection>

      <LegalSection id="family-rights" title="6. Parent and account-holder rights">
        <p>
          A parent, legal guardian, or adult account holder may ask us to:
        </p>
        <ul>
          <li>confirm whether we hold information connected to an account;</li>
          <li>review, receive an export of, or correct that information;</li>
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
          and aim to complete verified deletion requests within 30 days. An
          account export can include the account&apos;s cloud saves in a portable
          form.
        </p>
        <p>
          Marketing email can also be stopped through the unsubscribe link in
          the message. Removing a Reefbound profile synchronizes that
          profile&apos;s deletion; deleting the family account removes its active
          cloud saves and save history. Local copies on devices that remain
          offline may persist until the profile is removed there, the device
          reconnects, or the browser&apos;s site data is cleared.
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
