export const LEGAL_EFFECTIVE_DATE_ISO = "2026-08-12";
export const LEGAL_EFFECTIVE_DATE_LABEL = "August 12, 2026";

export const SEAPALS_OPERATOR = Object.freeze({
  legalName: "Sea Realm, LLC",
  brandName: "SeaPals TCG",
  mailingAddress: Object.freeze([
    "PO Box 11",
    "Elverson, PA 19520",
    "United States",
  ]),
  publicPhone: null,
  privacyEmail: "maker@seapalstcg.com",
  jurisdiction: "Pennsylvania, United States",
});

export const PRIVACY_PROVIDER_NAMES = Object.freeze([
  "Cloudflare",
  "Google",
  "Kit",
  "Resend",
  "Stripe",
  "Supabase",
]);

export const PRIVACY_RETENTION_SCHEDULE = Object.freeze([
  Object.freeze({
    category: "Pending adventure approval",
    period: "1 hour",
    detail:
      "The signed, essential setup cookie expires automatically or is cleared when setup finishes.",
  }),
  Object.freeze({
    category: "Adult account and adventure authorization",
    period: "While active; deletion within 30 days of a verified request",
    detail:
      "Limited security records may be kept for up to 90 days when needed to investigate abuse or protect the service.",
  }),
  Object.freeze({
    category: "Optional email updates",
    period: "Until unsubscribe or a verified deletion request",
    detail:
      "A limited suppression record may be retained to make sure an unsubscribe request is honored.",
  }),
  Object.freeze({
    category: "Identifiable survey responses",
    period: "Up to 12 months",
    detail:
      "After that period, the response is deleted or stripped of identifying fields. De-identified totals may be retained.",
  }),
  Object.freeze({
    category: "Bug reports and game diagnostics",
    period: "Up to 24 months after submission",
    detail:
      "Reports are deleted or de-identified sooner when practical after resolution, unless they are needed for an unresolved safety, security, or legal matter.",
  }),
  Object.freeze({
    category: "Tournament contact and edit information",
    period: "Up to 90 days after the event",
    detail:
      "Display names, deck lists, and results may be kept for up to 24 months before deletion or de-identification.",
  }),
  Object.freeze({
    category: "Orders and transaction records",
    period: "Up to 7 years",
    detail:
      "Records may be retained for tax, accounting, fraud prevention, chargeback, and legal obligations. Sea Realm does not store full payment-card numbers.",
  }),
  Object.freeze({
    category: "Website analytics",
    period: "Up to 14 months",
    detail:
      "Analytics are not loaded on adventure or account-authentication routes. Aggregate, de-identified reports may be retained.",
  }),
  Object.freeze({
    category: "Routine server and security logs",
    period: "Up to 30 days; up to 90 days for an active security matter",
    detail:
      "Hosting providers may retain protected backup or security records for a limited additional period under their own schedules.",
  }),
  Object.freeze({
    category: "Support correspondence",
    period: "Up to 24 months after resolution",
    detail:
      "A record may be kept longer when reasonably needed to document an unresolved dispute or legal obligation.",
  }),
]);

export function operatorMailingAddress() {
  return SEAPALS_OPERATOR.mailingAddress.join(", ");
}
