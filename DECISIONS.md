# Product Decisions & Architecture Source of Truth (DECISIONS.md)

This document is the authoritative record of product decisions made directly by the business owner. Read this document before executing any task. **Never reverse or modify any confirmed decision without explicit user authorization.**

Each decision includes the decision date, the status (`CONFIRMED` or `UNCONFIRMED`), and the specific reason or business context.

---

## Confirmed Decisions

| Date | Topic | Decision | Reason / Business Context | Status |
|---|---|---|---|---|
| 2026-11-25 | Single-Owner Model | Each distributor has exactly one Owner account; no staff roles, order-taker roles, or packer roles. | Eliminates unnecessary hierarchy and operational complexity for small-to-mid FMCG wholesale distributors. | `CONFIRMED` |
| 2026-11-25 | Geographic Hub & Areas | Operating deployment centered in Ratlam, MP with 2 route groups spanning 4 market areas as built (Monday City Route covering Manek Chowk & Chandni Chowk, Station Road & Do Batti; Thursday Industrial & Highway Route covering Industrial Area/Namkeen Cluster & Jaora Road, Sailana Road & Alkapuri). | Reflects the real physical distribution routes and ordering days of Ratlam wholesale market. | `CONFIRMED` |
| 2026-11-25 | Distributor Authentication | Distributor sign-in requires Google OAuth on new hardware, setting a device-bound 6-digit PIN, with PIN or WebAuthn passkey on later sessions. No mobile number + PIN or password login paths exist from arbitrary devices. | Strong device binding prevents unauthorized account takeover from unverified devices. | `CONFIRMED` |
| 2026-11-25 | Retailer Authentication & Channels | Retailers access their storefront strictly through 1-tap private tokenized web links (`/r/[token]`). No retailer passwords, no mobile OTPs, no native mobile app required. Retailers order via web browser only. | Zero onboarding friction for busy shopkeepers; avoids third-party SMS OTP costs. | `CONFIRMED` |
| 2026-11-25 | Infrastructure & Storage Constraints | No SMS gateway OTP services. No image, photo, or audio file storage uploads on Supabase (Supabase database remains empty for local development). | Keeps recurring infrastructure costs zero during pilot testing. | `CONFIRMED` |
| 2026-11-25 | Payment Processing | Settlement money flows directly to the distributor's bank account via non-custodial UPI QR and deep links. No payment gateway intermediary. Payments recorded by pasting bank SMS/notification with mandatory owner confirmation. | Avoids 2% gateway transaction cuts and settlement holding delays; preserves traditional wholesale settlement workflows. | `CONFIRMED` |
| 2026-11-25 | Language & Localization | Strict "one language at a time" on every screen. English or Hindi exclusively per session. Mixed-language labels (e.g. "खाता (Ledger)") are forbidden. Automated i18n tests reject Latin characters in Hindi strings (except approved brand/product names and standard units). | Clean readability for non-technical Hindi-speaking retail merchants and wholesale staff. | `CONFIRMED` |
| 2026-11-25 | Inventory Hierarchy | Brand-first architecture. Products belong to a Brand and are entered/managed by the distributor. | Retailers reorder based on known FMCG brands (Sunrise Foods, Crunch Co, etc.) rather than flat generic SKUs. | `CONFIRMED` |
| 2026-11-25 | Retailer Performance Budget | Retailer portal (`/r/[token]`) first-load JavaScript transfer budget is fixed at $\le$ 150 kB (gzipped). Build fails automatically if exceeded. | Ensures instant loading on 3G/4G low-end mobile devices in rural and tier-2/3 market areas. | `CONFIRMED` |
| 2026-11-25 | GST & Invoice Designation | GST stays OFF for the pilot; decide the inclusive or exclusive model later with an accountant. The document is called "Bill". Bills must NOT show GST, CGST/SGST breakdowns, a GSTIN, or "Tax Invoice" unless the tenant's `enable_gst` flag is explicitly turned ON. Total equals sum of lines after schemes. | Most local Mandi food grain and FMCG distributors operate under composition/threshold limits or supply exempt/flat wholesale goods. | `CONFIRMED` |
| 2026-11-25 | Plans & Subscription Tiers | Single free Pilot Plan with configurable limits. All invented subscription tiers (`FREE`, `PRO`, `ENTERPRISE`) and recurring pricing tiers removed from code. Limits: 5,000 products, 500 shops, 10,000 orders/month, 3 devices. Post-pilot pricing: not decided, no pricing code. | Keeps the product focused on pilot deployment validation without premature monetization baggage. | `CONFIRMED` |
| 2026-11-25 | Delivery Cut-off & Schedules | Order cut-off time and countdown are determined by the shop's specific Route Group schedule in `Asia/Kolkata`, not a hardcoded static time. | Different market delivery days and truck dispatch schedules require route-specific ordering deadlines. | `CONFIRMED` |
| 2026-11-25 | Demo Identity & Fictional Data | Real personal details, real phone numbers, and real UPI IDs must never be committed to repository or seeded. Demo identity must use clearly fictional values with no resemblance to a real business or person (Business: "Demo Traders", Owner: "Demo Owner", Email: demo@example.invalid, Phone: 9000000000 style, UPI: demo@invalid). | Prevents accidental real financial transactions or leaks of personal identity in repositories. | `CONFIRMED` |
| 2026-11-25 | Hardware Identification | Hardware identification uses a cryptographically random device token stored in an httpOnly, secure, sameSite cookie, NOT local storage, and NOT browser canvas/fingerprint collection. | Strong security, preventing script-based token exfiltration and avoiding flaky, intrusive browser fingerprinting. | `CONFIRMED` |
| 2026-11-25 | Test Database Isolation | Automated tests must strictly execute against the isolated `vitarak_fmcg_test` database (or throwaway schemas) guarded by `db-guard.ts`. Tests must never touch the demo database `vitarak_fmcg`. | Guarantees test suite execution never pollutes, modifies, or cancels live demo demonstration data. | `CONFIRMED` |
| 2026-11-25 | Sequential Identifiers | Formats: `ORD-YYYYMMDD-NNNN`, `BILL-YYYYMMDD-NNNN`, `SHP-NNNN`. Date generated in `Asia/Kolkata` with atomic per-tenant daily counters. | Eliminates ambiguous timestamp strings and ensures collision-free bookkeeping. | `CONFIRMED` |
| 2026-11-25 | Quiet Shops Computation | Computed from each shop's individual median ordering interval (with an adjustable multiplier), strictly excluding cancelled orders. | Accounts for differing natural purchase frequencies between small kiranas and large supermarkets. | `CONFIRMED` |
| 2026-11-25 | Pricing Security Isolation | Cost prices (`cost_price_paise`), purchase margins, and internal distributor notes must never be sent in any retailer-facing API response or serialized page data. | Complete commercial secrecy between wholesale distributor margin and retailer. | `CONFIRMED` |
| 2026-11-25 | WebAuthn RP ID Configuration | WebAuthn Relying Party ID comes strictly and solely from the `WEBAUTHN_RP_ID` environment variable (never from `NEXT_PUBLIC_APP_URL`, no fallback URL deduction, and never editable via distributor Settings UI). | Prevents broken passkey verification caused by user tampering or host misconfiguration. | `CONFIRMED` |
| 2026-11-25 | Append-Only Ledger Integrity | Shop ledger opening balance can be set only once per retailer; all subsequent adjustments, bills, and payments are append-only ledger entries. Balance is derived from the sum of entries. | Strict financial audit trail with zero silent retroactive balance overwrites. | `CONFIRMED` |
| 2026-11-25 | WhatsApp Notification Provider | WhatsApp provider: not decided, stay on the mock Outbox. | Avoids vendor lock-in or unconfigured API expenses during pilot phase. | `CONFIRMED` |
| 2026-11-25 | Bank SMS Ingestion Automation | Bank messages: manual paste for the pilot. Parser accepts only clear credits with owner confirmation. | Practical, zero-cost, and avoids third-party permissions on distributor mobile hardware. | `CONFIRMED` |
| 2026-11-25 | Delivery Driver Workflow | Delivery: the owner updates order status centrally, no driver screen. | Single-owner operational model centralizes dispatch control without mobile app sprawl. | `CONFIRMED` |

---

## Unconfirmed / Pending Review Items

None at this time. All product decisions are confirmed.

---

*Last Updated: 2026-11-25*
