import Link from "next/link";

import {
  LegalDocument,
  LegalNotice,
  LegalSection,
  OperatorContact,
} from "@/components/legal/LegalDocument";
import { SEAPALS_OPERATOR } from "@/lib/legalPrivacy.mjs";

export const metadata = {
  title: "Terms of Use | SeaPals TCG",
  description:
    "Terms governing use of the SeaPals TCG website, online tools, tournaments, surveys, store, and Reefbound adventure.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="SeaPals website and online game"
      title="Terms of Use"
      summary="These terms describe the rules for using the SeaPals website, family account, Reefbound adventure, online tools, surveys, tournaments, and store."
    >
      <LegalNotice title="A note for families">
        <p>
          A parent or legal guardian should review these terms with a minor.
          The Reefbound account must be created and managed by an adult using
          the adult’s email address. Game progress is cached locally and the
          account&apos;s three save slots are synchronized through Supabase for
          cross-device play and recovery. Clearing browser data removes that
          device&apos;s copy; deleting a profile or account also affects its cloud
          copies as described below.
        </p>
      </LegalNotice>

      <LegalSection id="agreement" title="1. Agreement and operator">
        <p>
          These Terms of Use (“Terms”) are an agreement between the person
          using SeaPals and {SEAPALS_OPERATOR.legalName} (“Sea Realm,” “we,”
          “us,” or “our”), the operator of SeaPals TCG. By using the site or
          creating an account, an adult agrees to these Terms and acknowledges
          the <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If the user is under 18, a parent or legal guardian must review and
          approve use of the service. A child under 13 must not create an
          account with the child’s own email address or submit personal contact
          information through the site.
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. The SeaPals service">
        <p>
          SeaPals includes a card-game website, educational marine-life
          content, game instructions and tools, surveys, tournament features,
          a store or store preview, and the Reefbound browser adventure.
          Features may be added, changed, paused, or removed as the project
          develops.
        </p>
        <p>
          Marine-science and educational content is provided for general
          learning and entertainment. It is not professional, medical,
          veterinary, legal, boating-safety, or environmental-management
          advice.
        </p>
      </LegalSection>

      <LegalSection
        id="accounts"
        title="3. Family accounts and synchronized saves"
      >
        <ul>
          <li>
            An adult must provide accurate account information and keep access
            to the email or Google account secure.
          </li>
          <li>
            One adult-managed account may be used as a family account, subject
            to reasonable technical and security limits.
          </li>
          <li>
            The adult is responsible for activity performed through the
            account and should sign out on a shared or public device.
          </li>
          <li>
            Reefbound keeps a local save cache and synchronizes the account&apos;s
            three save slots through Supabase. Synchronized saves can include
            player-entered player and best-friend names, progress, settings,
            decks, and other game state so the same account can continue on
            another device or restore an account copy.
          </li>
          <li>
            If devices independently change one slot, Reefbound preserves the
            conflicting copies and asks which version to keep. Availability of
            a particular local or cloud copy is not guaranteed.
          </li>
          <li>
            Removing a profile synchronizes its deletion. Deleting the family
            account removes its active cloud saves and save history, although
            provider backups may take a limited additional period to age out.
            An offline device may retain a local copy until it reconnects, the
            profile is removed there, or its browser data is cleared.
          </li>
        </ul>
        <p>
          Contact{" "}
          <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
            {SEAPALS_OPERATOR.privacyEmail}
          </a>{" "}
          to request access, export, correction, or deletion of account and
          cloud-save information, or to report suspected unauthorized access.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="4. Acceptable use">
        <p>You may not use SeaPals to:</p>
        <ul>
          <li>break the law or violate another person’s rights;</li>
          <li>
            probe, disrupt, overload, bypass, or interfere with security or
            access controls;
          </li>
          <li>
            automate abusive account creation, email delivery, survey
            submissions, tournament entries, or store requests;
          </li>
          <li>
            impersonate another person or submit another person’s contact
            information without permission;
          </li>
          <li>
            place harmful code, harassment, personal contact information, or
            inappropriate material in a free-text submission; or
          </li>
          <li>
            copy, scrape, resell, or commercially exploit SeaPals content
            except as permitted by law or written permission.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="submissions" title="5. Surveys, tournaments, and submissions">
        <p>
          Use a first name or display name rather than a full legal name for
          public-facing tournament and survey activity. A parent or guardian
          should make submissions for a player under 13. Do not include an
          address, phone number, school, private account credential, or other
          sensitive information in a deck name, survey answer, or other
          free-text field.
        </p>
        <p>
          You retain ownership of original material you submit. You give Sea
          Realm a non-exclusive, worldwide, royalty-free license to host, copy,
          format, review, and display that material only as reasonably needed
          to operate the submitted survey, tournament, event, or related
          SeaPals feature. Public tournament standings may show the submitted
          display name, deck information, and results.
        </p>
        <p>
          We may reject, remove, de-identify, or moderate a submission that
          violates these Terms, risks someone’s privacy or safety, or disrupts
          the service.
        </p>
      </LegalSection>

      <LegalSection id="email" title="6. Email communications">
        <p>
          Authentication and account-security messages are transactional and
          may be needed to use the account. Tournament review messages may be
          sent to the address supplied with a tournament entry. Marketing
          emails are optional, require a separate request at account setup or
          through the adult-facing post-play invitation, and can be stopped
          with the unsubscribe link. Declining updates does not restrict game
          access or progress.
        </p>
      </LegalSection>

      <LegalSection id="purchases" title="7. Store and purchases">
        <p>
          No item is available for purchase unless checkout is expressly
          enabled and the item is marked available. Prices, taxes, shipping
          charges, delivery estimates, product availability, and any applicable
          return or cancellation terms shown before purchase form part of that
          transaction. Stripe provides hosted payment processing and may apply
          its own terms.
        </p>
        <p>
          Mailed orders require a delivery address and the selected Shipping &amp;
          Handling charge. Free scheduled local pickup is available in
          Elverson, Pennsylvania, and does not include shipping. No pickup
          appointment is selected or confirmed during checkout. After the order
          is built, Sea Realm will email the purchaser to arrange a pickup time
          and privately provide the pickup address and instructions. The
          purchaser should not travel to pick up the order until that time is
          confirmed.
        </p>
        <p>
          Production timing is separate from carrier transit. Standard
          production means we hand mailed orders to the carrier, or mark pickup
          orders ready, within five business days after payment. If purchased,
          one-business-day production changes that production window to one
          business day for the whole order; it does not promise one-business-day
          delivery. Expedited production is limited to ten orders per SeaPals
          production day and remains subject to server-confirmed availability
          when checkout begins.
        </p>
        <p>
          Do not complete a purchase unless an adult authorized to use the
          payment method reviews and approves it. We may cancel or refund an
          order affected by a pricing error, unavailable inventory, suspected
          fraud, or a legal restriction.
        </p>
        <p>
          <strong>Cancellation, returns, and order problems.</strong> To request
          help, email{" "}
          <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
            {SEAPALS_OPERATOR.privacyEmail}
          </a>{" "}
          from the purchaser&apos;s email address and include the order number.
          Do not mail a return until we provide return instructions.
        </p>
        <ul>
          <li>
            You may cancel an order by emailing us within two hours after
            purchase. A request sent after that window is handled under the
            return policy below.
          </li>
          <li>
            You may request a return for an unopened item within 30 calendar
            days after carrier tracking shows delivery or, for local pickup,
            after the order is picked up. The purchaser pays return postage
            for an ordinary unopened-item return.
          </li>
          <li>
            Opened or played products are final sale except when an item is
            damaged, defective, missing, or incorrect. Report one of those
            problems within 14 calendar days after delivery or pickup so we
            can review it and provide return or remedy instructions.
          </li>
          <li>
            If tracking suggests that a mailed order may be lost, contact us
            so we can investigate with the carrier. Once carrier loss is
            confirmed, we will replace the affected order, subject to product
            availability, or refund it.
          </li>
          <li>
            Once we approve a refund, we issue it to the original payment
            method within five business days. For a physical return, that
            period begins after the accepted item is received and inspected.
            A bank or card issuer may take additional time to post the credit.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="ownership" title="8. SeaPals content and ownership">
        <p>
          SeaPals names, logos, card designs, artwork, text, game rules,
          software, music, and other original materials are owned by Sea Realm
          or used with permission and are protected by applicable intellectual
          property laws. These Terms give you a limited, personal,
          non-exclusive, non-transferable, revocable right to use the service
          for its intended family, educational, and entertainment purposes.
        </p>
      </LegalSection>

      <LegalSection id="providers" title="9. Third-party services">
        <p>
          SeaPals relies on service providers such as Supabase, Google,
          Cloudflare, Kit, Stripe, and Resend. Their services may have separate
          terms and privacy practices. Sea Realm is not responsible for a
          third-party service outside its reasonable control, but our{" "}
          <Link href="/privacy">Privacy Policy</Link> describes why information
          may be shared with these providers.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="10. Availability and account action">
        <p>
          We may suspend or limit access when reasonably necessary to protect
          users, investigate abuse, maintain the service, follow the law, or
          enforce these Terms. We may also discontinue a preview, tournament,
          or unfinished feature. Where practical, we will provide notice of a
          material service change.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="11. Disclaimers and limits">
        <p>
          To the extent permitted by law, SeaPals is provided “as is” and “as
          available.” Sea Realm does not guarantee that every feature will be
          uninterrupted, error-free, compatible with every device, or that
          every local or synchronized version of progress can be recovered.
        </p>
        <p>
          To the extent permitted by law, Sea Realm will not be liable for
          indirect, incidental, special, consequential, or punitive damages, or
          for lost saves, synchronization conflicts, lost profits, or lost data
          resulting from use of the service. Nothing in these Terms excludes a
          right or remedy that cannot legally be excluded, including applicable
          consumer protections.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Pennsylvania law">
        <p>
          These Terms are governed by the laws of the Commonwealth of
          Pennsylvania and applicable United States federal law, without
          regard to conflict-of-law rules. Before filing a formal dispute, the
          parties should first try in good faith to resolve it by contacting{" "}
          <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
            {SEAPALS_OPERATOR.privacyEmail}
          </a>
          . Any non-waivable rights under applicable consumer or children’s
          privacy law remain in effect.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes and severability">
        <p>
          We may update these Terms as the service develops. The effective date
          will be revised when changes are posted. If a provision is found
          unenforceable, the remaining provisions will continue to apply to the
          extent permitted by law.
        </p>
      </LegalSection>

      <OperatorContact />
    </LegalDocument>
  );
}
