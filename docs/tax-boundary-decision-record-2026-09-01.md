# Madrasa ERP tax boundary decision record — 2026-09-01

Status: **PENDING ONE OWNER CONFIRMATION**

This record supersedes the voided seller details in PR #90. Only the seller details below are valid for Madrasa ERP launch work.

## Seller profile supplied by owner

- Seller/legal name: **Abu hurera khan**
- Business/trade name: **Madrasa ERP**
- Entity type: **Sole Proprietorship**
- GST status: **Not GST registered**
- Address: **rm no 2 mahavir bldg no 2 opp p and t colony vakola Santacruz East Mumbai**
- Invoice email: **abuhurerak8@gmail.com**

## Current GST boundary

Official CBIC GST guidance states that the registration threshold for suppliers of services is ₹20 lakh aggregate turnover in Maharashtra/general-category states, and suppliers of services making inter-State supplies can remain exempt from registration up to that threshold.

Official references:
- https://cbic-gst.gov.in/pdf/01042019_GST-Concept-Status.pdf
- https://cbic-gst.gov.in/pdf/01062019-GST-An-Update.pdf

## Launch invoicing rule if owner confirms aggregate turnover is below ₹20 lakh

- Madrasa ERP may operate as a non-GST-registered sole proprietorship while otherwise legally eligible for the exemption.
- Do **not** charge or separately display GST.
- Do **not** display a GSTIN.
- Customer invoices/receipts must identify the seller and trade name above and state that the seller is **not GST registered**.
- Do not describe such a document as a GST tax invoice.
- Third-party/provider/hardware charges remain separately disclosed where applicable.
- GST status must be reviewed promptly if registration becomes mandatory or the seller registers voluntarily.

## Remaining confirmation before `tax_boundary_approved` may be marked complete

Owner must confirm:

> **Aggregate annual PAN-based business turnover is below ₹20 lakh.**

Until that confirmation is recorded, `tax_boundary_approved` remains **false**.

## Scope boundary

This record does not alter security, recovery, payment-provider, pilot-signoff, pricing, packaging, or retention gates.