# Pennsylvania sales-tax operations

This checklist contains no license number, tax account number, street address,
banking information, or identity data. Keep the supplied license image outside
the repository and outside the public website.

## Before the first taxable order

- Confirm in [myPATH](https://mypath.pa.gov/) that the sales-tax account is
  active, note its effective date and assigned filing frequency, and clear any
  account notices. The printed certificate does not show those items.
- Prominently display a copy of the license at each Pennsylvania place of
  business as directed on the certificate. If the licensed location is not
  customer-facing, ask the Department of Revenue how it wants the display
  requirement handled; do not solve it by publishing the certificate online.
- Keep `STORE_TAX_REGISTRATION_CONFIRMED=true` only while the government
  registration is active. A Stripe Tax registration records an existing
  obligation; it does not create the Pennsylvania registration.
- Verify Stripe Tax shows the Pennsylvania registration as **Collecting**, the
  origin address is correct, every enabled product has an approved tax code,
  and seller-billed shipping is included in the taxable amount.

Physical trading cards, playing cards, games, and similar hobby products are
taxable tangible personal property in Pennsylvania. The state rate is 6%.
Seller-billed delivery and handling charges made with a taxable sale are also
taxable. See the Department's [sales-tax overview](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax),
[Retailer's Information Guide (REV-717)](https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforbusinesses/sut/documents/rev-717.pdf),
and [61 Pa. Code § 54.1](https://www.pacodeandbulletin.gov/secure/pacode/data/061/chapter54/s54.1.html).

## Local-rate launch test

Pennsylvania's [local-sales-tax guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/local-sales-tax)
says Act 21 of 2026 changes Philadelphia and Allegheny County local collection
to the purchaser's delivery destination, with Department enforcement beginning
October 1, 2026. Before accepting orders on or after that date, run Stripe
sandbox calculations for representative Pennsylvania delivery addresses and
verify these expected taxable-sale rates:

| Delivery destination | Expected rate |
| --- | ---: |
| Pennsylvania outside Philadelphia and Allegheny County | 6% |
| Allegheny County | 7% |
| Philadelphia | 8% |

On August 13, 2026, representative Stripe sandbox calculations still returned
6% for all three destinations. Keep this as a launch blocker until Stripe's
result matches the Department's rule or a qualified Pennsylvania tax adviser
approves another implemented collection method.

Scheduled Elverson pickup is a fixed-location handoff. The implemented Checkout
path disables Automatic Tax for pickup and applies one separately configured,
exclusive 6% US/PA manual Tax Rate to every product and expedited-production
charge. Keep `STORE_PICKUP_TAX_CONFIRMED=false` until the exact `txr_...` object,
Checkout total, customer workflow, and handoff location have been validated
together. Mailed orders continue using Automatic Tax.

## Filing and reconciliation

- File every assigned Pennsylvania return, including zero-sales periods. Use
  the frequency and due dates shown in myPATH rather than guessing from the
  certificate.
- Reconcile both Stripe Tax's automatic-tax report for mailed orders and
  Checkout's manual-tax export for pickups to the private order ledger for each
  filing period. Calculation and collection do not file or remit a return unless
  the business separately enrolls in an available filing service.
- Include business use tax for taxable business purchases on which the vendor
  did not collect sales tax.
- Retain auditable sales and purchase invoices, taxable and nontaxable sale
  amounts, tax collected and incurred, refunds, exemption certificates, and
  filed-return support for at least three years from the end of the applicable
  calendar year. See [61 Pa. Code § 34.2](https://www.pacodeandbulletin.gov/secure/pacode/data/061/chapter34/s34.2.html).
- Export and back up order-ledger and Stripe reports after every filing period;
  do not rely on one online dashboard as the only record copy.

## Purchasing and other states

Use Pennsylvania Form REV-1220 only for inventory bought for resale, not for
supplies or equipment the business consumes. The Department's [exemption
certificate guidance](https://hub.business.pa.gov/Home/HelpCenterDetail/completethepataxexemptioncertificate)
explains the form.

The Pennsylvania license does not authorize collection for another state.
Monitor sales and physical/economic nexus elsewhere, and obtain state-specific
advice before registering or collecting outside Pennsylvania. This operations
checklist is not a substitute for advice from a Pennsylvania CPA or tax
attorney about a fact-specific classification, filing, or nexus question.
