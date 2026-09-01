# Tax and GST decision worksheet

> Status: **UNAPPROVED decision worksheet**. This prepares the `tax_boundary_approved` gate and must not be treated as legal/tax advice or as approved invoicing policy.

## Current verified public reference

CBIC's sectoral FAQ states that the GST rate on IT services is 18%. The exact treatment for Madrasa ERP still depends on the seller's legal/GST status, invoice structure and place-of-supply facts.

Official reference:
- CBIC sectoral FAQ: https://cbic-gst.gov.in/hindi/sectoral-faq.html

## Seller identity decision

Record before commercial invoicing:

- Seller/legal entity name:
- Entity type (individual/proprietorship/partnership/company/etc.):
- Registered business address:
- GSTIN, if registered:
- GST registration status/threshold basis:
- Invoice email/contact:
- Bank/payment beneficiary name:

## Proposed product classification for review

Madrasa ERP is intended to be sold as a hosted software/IT service subscription plus optional implementation/support. The commercial owner/accountant should confirm the applicable SAC/classification and whether implementation, support or pass-through components require separate line treatment.

Do not hard-code a legal classification in product copy until approved.

## Domestic customer decision checklist

- [ ] Confirm whether displayed prices are tax-exclusive or tax-inclusive.
- [ ] Confirm whether GST is charged and at what approved rate.
- [ ] Confirm intra-state CGST/SGST vs inter-state IGST handling.
- [ ] Confirm place-of-supply logic for target institutions.
- [ ] Confirm mandatory invoice fields and invoice numbering owner.
- [ ] Confirm payment-gateway fee/tax treatment.
- [ ] Confirm refund/credit-note procedure.
- [ ] Confirm accounting responsibility while Fees/Accounting remains deferred in the product.

## Proposed commercial wording — pending approval

Until the tax boundary is approved, customer-facing pricing should say:

> Taxes, payment-gateway charges, WhatsApp/provider usage and hardware/vendor costs are additional where applicable.

Do not publish “including GST”, “+18% GST”, tax invoice promises or GST-compliance claims until the seller/GST position is approved.

## Payment gateway boundary

Razorpay subscription webhook engineering does not determine tax treatment. Before production billing:

- verify the merchant/legal entity;
- verify the settlement account;
- verify tax-inclusive/exclusive amount conventions;
- verify refunds/credit notes operationally;
- verify the real signed webhook flow under the approved merchant account.

## Approval record

Before `tax_boundary_approved=true`, preserve evidence for:

- approved seller/legal entity;
- GST registration position;
- applicable tax treatment and price-display convention;
- place-of-supply/invoice rule;
- refund/credit-note handling;
- provider/payment pass-through treatment;
- approving accountant/legal/owner and date.

This worksheet alone is not approval evidence.
