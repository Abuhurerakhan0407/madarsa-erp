# Client V2 Phase 0 route inventory

## Baseline

- Canonical base SHA at Phase 0 start: `8ea33a6fa9c42f290147a26e3c8795eeb5757b0c`.
- Full-product behavior remains the default unless a Client V2 profile is selected by deployment override or configured tenant slug.
- Client-specific removals are capability gates; underlying implementation remains in the repository.

## Client-hidden UI routes

| Capability | Route family | Phase 0 handling |
|---|---|---|
| Fees & Accounting | `/{locale}/demo/fees` | hidden from navigation + server 404 boundary |
| Import / Promotion / Renewal | `/{locale}/students/lifecycle` | hidden from navigation + server 404 boundary |
| Donations / Sponsorships | `/{locale}/demo/donations` | hidden from navigation + server 404 boundary |
| Transport | `/{locale}/transport` | hidden from navigation + server 404 boundary |
| Library | `/{locale}/library` | hidden from navigation + server 404 boundary |
| WhatsApp Automation | `/{locale}/communications/whatsapp` | hidden from navigation + server 404 boundary |
| AI Assistant | `/{locale}/demo/ai` | hidden from navigation + server 404 boundary |
| Branches & Roles UI | `/{locale}/access` | hidden from navigation + server 404 boundary; RBAC remains intact |

## Reactivated commercial workspace

Hostel & Mess is no longer a Client V2-hidden route. The current commercial workspace is `/{locale}/hostel`; visibility is controlled by the Hostel/Mess capability plus existing branch permissions. Teacher navigation remains unchanged.

## Client-hidden API families

The current API tree has dedicated API families for two client-hidden operational modules:

- `/api/students/lifecycle/*`
  - `import`
  - `rollover`
  - `session`
- `/api/communications/whatsapp/*`
  - `config`
  - `consent`
  - `queue`
  - `templates`

All of those handlers retain their existing authentication/membership checks and now additionally return a non-cacheable 404 when the active tenant profile disables the capability.

The current top-level API tree does not expose dedicated `fees`, `donations`, `hostel`, `transport`, `library`, `ai`, or `access` API families. Their reusable implementation is preserved; Phase 0 blocks their client-facing route families without deleting backend/RBAC code.

## Capability interaction rule

Capability enablement never replaces RBAC. Access requires both:

1. the product capability is enabled for the tenant/client profile; and
2. existing authorization/permission checks allow the operation.

A disabled capability can only reduce access; it cannot grant permission.
