# Free Pennsylvania quarterly filing runbook

This workflow has no filing-service subscription. Pennsylvania's myPATH portal
accepts a sales-tax return CSV for one account at no charge. ACH debit through
myPATH avoids the card convenience fee; the business must still pay the tax it
owes.

The repository and this guide deliberately contain no license number, Letter
ID, registration-confirmation number, FEIN, myPATH credentials, bank details,
or street address. Enter account identifiers only in the private browser page
when creating a return file.

## Automation boundary

The private `/admin/orders` workspace now automates the supported preparation
work:

- queries every live order for the selected Pennsylvania quarter with
  pagination instead of relying on the dashboard's recent-order limit;
- places sales by `paid_at` in `America/New_York`, not by Stripe payout date;
- includes the fixed 6% Elverson pickup path and pre-October Pennsylvania
  deliveries;
- excludes test-mode and outbound shipments from the Pennsylvania return while
  retaining outbound amounts in the audit;
- reconciles integer-cent subtotal, production, shipping, tax, and total
  amounts;
- generates a state code `00` zero return when the period has no sales;
- creates Pennsylvania's published 14-field return CSV and a separate
  order-level audit CSV; and
- keeps the Sales License ID and FEIN in browser memory only.

Pennsylvania's current bulk-filing FAQ explicitly says that **myPATH does not
support automation**. The final MFA login, file upload, validation review,
**Submit** action, confirmation capture, and payment authorization therefore
remain owner actions. Do not build a credential-sharing or browser-login bot
around that boundary.

Official references:

- [Sales-return CSV fields](https://www.pa.gov/agencies/revenue/resources/mypath/multi-import/file-upload-specifications/sales-tax-file-upload-specs)
- [One-account upload workflow](https://revenue-pa.custhelp.com/app/answers/detail/a_id/4140/)
- [Bulk-filing limitations and processing](https://revenue-pa.custhelp.com/app/answers/detail/a_id/4141/)
- [Entity ID type codes](https://www.pa.gov/agencies/revenue/resources/mypath/multi-import/code-list)

## First-period check

The supplied notice assigns quarterly filing, but it does not show the
registration's Location Start Date. In myPATH, confirm the Location Start Date
and the first open return before filing. Do not substitute the notice issue
date.

The 2026 quarterly calendar is:

| Period | Ends | Return and payment due |
| --- | --- | --- |
| Q1 | March 31, 2026 | April 20, 2026 |
| Q2 | June 30, 2026 | July 20, 2026 |
| Q3 | September 30, 2026 | October 20, 2026 |
| Q4 | December 31, 2026 | January 20, 2027 |

If Q3 is the first open period, file it by October 20, 2026 even if it is a
zero-sales return. Pennsylvania requires a return for every licensed period.

## Automatic quarterly email

The scheduled Worker prepares one frozen, aggregate reconciliation snapshot at
9:00 a.m. `America/New_York` on the first business day on or after the second
calendar day following each quarter end. This leaves a full day for final
Stripe webhooks and reservation reconciliation. For Q3 2026, that is October
2, 2026; the return and payment are due October 20,
2026. Temporary database or email failures retry through the existing five-
minute Worker trigger, while a period-keyed database lease and deterministic
Resend key suppress routine duplicates.

The email contains only the quarter, exact due date, preparation status,
unresolved-check count, and a quarter-specific link to the authenticated CSV
download workspace. It does not attach a filing CSV or include tax identifiers,
bank details, customer data, order/payment references, or transaction rows.
The link selects the correct quarter; detailed totals and the downloadable files
remain behind staff authentication in
`/admin/orders?paPeriodEnd=YYYY-MM-DD#pa-sales-tax-filing`.

Before deployment:

1. Apply `supabase/store-orders.sql`, then
   `supabase/pa-quarterly-report-email.sql`.
2. Configure the dedicated private `STORE_PA_TAX_REPORT_EMAIL`, the verified
   `EMAIL_FROM`, and `RESEND_API_KEY`.
3. Keep `STORE_PA_TAX_REPORT_START_PERIOD_END=2026-09-30` so enabling the job
   cannot backfill old quarters accidentally.
4. Set `STORE_PA_TAX_REPORT_ENABLED=true` and
   `STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED=true` only for the verified private
   delivery path.
5. Run `npm run store:check:online` and require the **Supabase PA quarterly
   report contract** check to pass.

The message is a preparation notice, not proof of filing or payment. The final
myPATH upload, validation, **Submit** action, confirmation capture, and payment
authorization remain manual.

## Quarterly procedure

1. Open `/admin/orders`, enter the private staff token, and load orders.
2. In **Pennsylvania quarterly filing**, select the quarter and choose
   **Reconcile complete period**. A current quarter can be previewed, but the
   return download remains locked until the quarter closes.
3. Review the state/local summary and download the website audit CSV. Resolve
   every red exception before filing.
4. Confirm there were no offline, exempt, or marketplace Pennsylvania sales to
   add. If there were, prepare the complete return directly in myPATH or with a
   qualified preparer; the website-only generator intentionally does not guess
   them.
5. Review taxable business purchases for Pennsylvania use tax. Enter the
   **tax amount due**, not the untaxed purchase price. Enter any supported
   return credit and identify it as TPPR and/or Other. Do not put prepayments or
   the timely-filer discount in the return credit field.
6. Compare the period with Stripe so a missed webhook cannot silently omit a
   live sale or refund, then complete all four on-screen confirmations.
7. Enter the 8- or 11-digit Sales License/Account ID and the nine-digit entity
   ID. An LLC filing under its FEIN normally uses entity ID type `001`. These
   values are not posted to the server or saved in storage.
8. Choose **Download myPATH return CSV**. Also retain the website audit CSV in
   private records.
9. Sign in to myPATH, open the Sales account, choose **Sales Tax File Upload**,
   add the return CSV, and review the validation result and displayed totals.
   Validation is not filing. Choose **Submit** and save the confirmation.
10. Pay the portal-calculated balance by ACH debit or another approved method.
    Do not store banking data in SeaPals. Pennsylvania's separate payment CSV
    exists for bulk ACH workflows, but this implementation intentionally keeps
    bank details out of generated files and source code.
11. Check myPATH after nightly processing and verify the submission shows
    **Processed** and the payment was not reversed. Archive the filed return,
    confirmation, payment proof, audit CSV, and relevant Stripe report.

## Fail-closed exceptions

The generator will not create a filing CSV when it finds:

- a live order whose stored subtotal, production fee, shipping, tax, and total
  do not reconcile;
- a Pennsylvania order whose collected tax does not uniquely match 6%, 7%, or
  8%;
- a succeeded refund or payment dispute affecting the selected period;
- any Pennsylvania delivery on or after October 1, 2026, because the historical
  ledger does not retain an authoritative destination county or penny-level
  state/local tax split;
- a pre-October Philadelphia or Allegheny destination whose historical ledger
  has only an aggregate local-tax amount, not Stripe's authoritative split;
- a missing shipping destination or unsupported currency; or
- an open filing period.

The audit may still be downloaded so the exception can be resolved from Stripe
and source records. Never remove a blocker merely to make the button active.

For deliveries on or after the Department's October 1, 2026 enforcement date,
Pennsylvania requires destination sourcing: 6% state plus 1% for Allegheny
County or 2% for Philadelphia. The current ledger cannot prove the county or
penny-level jurisdiction split from the aggregate tax field, so every
Pennsylvania shipped sale from that date fails closed. For a period containing
one, use Stripe's itemized jurisdiction report to prepare the complete return
in myPATH; do not bypass the blocker from the combined 6%, 7%, or 8% rate.

## First-file validation

Pennsylvania publishes the 14 fields and their order but does not publish a
sample or state whether a header is allowed, how multiple jurisdiction rows
must be grouped, or the exact numeric grammar. The generator conservatively:

- emits no header;
- emits one record per used code, always including state code `00`;
- omits unused zero local rows; and
- emits unformatted dollar amounts with two decimals.

The Department's current TeleFile checklist calls the state inputs **PA state
gross sales** and **PA net taxable sales**, while the shorter CSV page describes
gross simply as taxable plus non-taxable sales. The generator therefore uses
Pennsylvania-destination and pickup website sales for state gross and excludes
outbound shipments. Confirm this account-level treatment with the Department
before the first production filing because the CSV page is not explicit about
multi-state sellers.

Treat the first upload as a format validation. If myPATH rejects it, do not
experiment with live amounts. Save the validation message and ask the
Department's bulk-upload team at `ra-rv-bbtrp-inq@pa.gov` to confirm the record
shape.

## Records and privacy

Keep filed-return support in private business records. Do not commit generated
return CSVs or audit exports: return files contain the tax account and entity
IDs, and audit files are sensitive business records containing order references,
timestamps, destination city/ZIP, and amounts. Clear the staff token with
**Forget token** after filing and close the tab.

This workflow reduces a routine, ordinary 6% website-only quarter to a short
review and upload. It does not replace professional advice for exemptions,
partial refunds, bad debts, credits, non-website activity, local-tax disputes,
or other fact-specific treatment.

Additional Pennsylvania references:

- [2026 REV-819 due dates](https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforbusinesses/sut/documents/2026_rev-819.pdf)
- [Sales and use tax filing guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax)
- [Local sales-tax guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/local-sales-tax)
- [Business use-tax guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/use-tax/use-tax-for-businesses)
