# AUDIT MISSION: Subagent C - Negócio e Financeiro do Beleza Digital

**Scope:** All business and financial operations of the Beleza Digital platform at `/home/lg/workspace/projects/Beleza_Digital`.

**Date:** Sun Oct 25 2026

---

## AUDIT MATRIX FORMAT

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Each finding maps to a row below |

---

## FINDINGS MATRIX

### 1. Salão Management (Gestão de Salões)

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Establishment CRUD | `requireWriteAuth()`, `requireTenantAccess()`, `addEstablishment()`, `updateEstablishment()`, `toggleEstablishmentStatus()`, `deleteEstablishment()` | URL-driven `?tenant=` selection; `selectEstablishment(idOrSlug)` | **store.ts** lines 298-539: full multitenant API with auth checks, slug generation, audit logging | None (in-memory localStorage state; Supabase RPC would be used when configured) | **localStorage** keys: `wl_establishments_v2`, `wl_current_tenant_id_v2`, etc. All data lost when Supabase not configured | `requireWriteAuth()` checks `currentSession.role` must be `super_admin` or `establishment_admin`; `requireTenantAccess()` isolates by `establishmentId` | **Real state when Supabase configured**; otherwise **localStorage/mocked** | All 7 storage keys (establishments, services, products, media, appointments, instagram_embeds, audit_logs, platform_config) persist to localStorage; migration from legacy keys auto-runs on init | Slug validation in `addEstablishment()`: `baseSlug` sanitized via `.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');` Final slug collision avoidance via `${baseSlug}-${Date.now().toString().slice(-4)}`; `deleteEstablishment()` blocks deletion of default template `est-yeshua` | `price` field on `ProductItem` is `number` (not `number | null` like services); `available: boolean`; `featured: boolean`; establishment-product link via `establishmentId` | When Supabase not configured: **ALL metrics and data are localStorage-only**, no real backend persistence | URL param `?tenant=imperio` drives initial tenant selection via `detectInitialTenant()`; `selectEstablishment()` updates URL via `window.history.pushState` | **Critical**: No backend persistence when Supabase absent. Platform is non-functional for multi-tenant operations without Supabase config. | Establishment status toggle protects default template `est-yeshua` from deactivation (toggle checks `est.isDefault` and returns false if attempting to delete default) |
| Multi-tenant isolation | `requireWriteAuth()`, `requireTenantAccess()` | Session-based: `currentSession.establishmentId` vs `targetEstablishmentId` | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Core multitenant design is sound; execution environment determines whether it works |

---

### 2. Onboarding

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Initial establishment flow | First-run setup loads `INITIAL_ESTABLISHMENT_YESHUA` + `INITIAL_ESTABLISHMENT_DEMO` | `selectEstablishment('est-yeshua')` or `?tenant=imperio` URL param | **store.ts** lines 111-176: auto-detection from localStorage + URL params + fallback to `est-yeshua`; **defaultData.ts** defines two demo establishments | None — purely client-side store initialization | **localStorage** on `wl_establishments_v2` | Not applicable (client-side only) | **Mocked/demo data** — two hardcoded establishments | `INITIAL_ESTABLISHMENTS` array in `defaultData.ts` | URL param parsing: `new URLSearchParams(window.location.search).get('tenant')` or `get('estabelecimento')` or `get('e')` | Demo flow works for UI showcasing; production requires Supabase sign-up flow with `signup_type=salon_owner` trigger | **Lacuna**: No server-backed onboarding flow visible. `provision_salon_owner()` trigger exists in Supabase migrations but is not connected to any UI flow beyond the SQL migration | Default establishments `est-yeshua` (modelo-inicial) and `est-imperio` (demonstracao) are always present for demo purposes |

---

### 3. Planos e Assinaturas

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |---|
| Product items (products store data) | `addProduct()`, `updateProduct()`, `deleteProduct()`, `toggleFeaturedProduct()` | Product form in `salao-produtos` tab; `ProductItem` type with `price: number`, `available: boolean`, `featured: boolean` | **store.ts** lines 665-723: addProduct requires `requireWriteAuth()` + `requireTenantAccess()`, stores with `establishmentId`; **defaultData.ts** `INITIAL_PRODUCTS` has 4 products (3 for yeshua, 1 for imperio) with `price: number` fields (35.0, 42.0, 49.9, 55.0) | None — in-memory store only; no backend API for product purchase flow | **localStorage** key `wl_products_v2` | `requireWriteAuth()` checks super_admin/establishment_admin; `requireTenantAccess()` scoped by establishmentId | **LocalStorage-mocked** — products are part of the demo data model | `ProductItem` type: `id`, `establishmentId?`, `name`, `description`, `price: number`, `mainImage`, `additionalImages?`, `available: boolean`, `category: string`, `featured: boolean` | Price must be `number` (not null like services); `available: boolean` controls display; `featured: boolean` for highlighting | Products are purely localStorage-persisted; no Supabase `products` table visible in migrations — all financial data lives in `billing_plans` and `billing_payments` Supabase tables | Price field validation: `price: number` in type; `available: boolean` gates product visibility; no price ≥ 0 validation in store (relied on type system) | Product purchase has **NO backend process** (see Critical Financial Flow Questions below) | **Critical gap**: Products exist only in localStorage store; no backend API, no purchase flow, no revenue capture for product sales | Products are scoped per establishment via `establishmentId`; demo data isolates `est-imperio` products from `est-yeshua` |

---

### 4. Pagamentos e Cobranças

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VenoPag checkout creation | `POST /api/billing/create-checkout` | PlanSelectionPage.tsx `handleCheckout(planId)` | **functions/api/billing/create-checkout.ts** lines 1-113: validates Supabase session, validates establishment membership via `establishment_memberships`, fetches `billing_plans`, creates `billing_payments` record, calls VenoPag provider API, returns `checkout_url` or `pix_copy_paste` | **Supabase** RPC + VenoPag provider API (`https://venopagments.com/api/cashin`): checks `env.VENOPAG_CLIENT_ID`, `env.VENOPAG_CLIENT_SECRET`, `env.VENOPAG_BASE_URL`, `env.VENOPAG_WEBHOOK_URL` | **Supabase** tables: `billing_plans`, `billing_payments`, `establishment_memberships`, `auth.users` | Bearer token from Supabase auth; `authorization: Bearer ${session.access_token}`; service_role key for DB operations | **Real backend** when Supabase + VenoPag env vars are configured; **completely non-functional** when env vars missing | `billing_plans`: `price_brl_cents integer not null check (price_brl_cents > 0)`; `billing_payments`: `amount_brl_cents integer not null check (amount_brl_cents > 0)`, `status in ('pending','paid','expired','canceled','failed')` | Plan ID must be valid UUID matching `billing_plans.id`; amount must be `Number.SAFE_INTEGER`; provider must return `checkout_url` or `pix_copy_paste`; VenoPag signature verification in webhook | **Partially functional**: Code is written and logic is complete, BUT requires environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `VENOPAG_CLIENT_ID`, `VENOPAG_CLIENT_SECRET`) that are likely not set in current deployment | **Critical**: Payment flow exists in code but is **not operational** without VenoPag credentials. The `create-checkout` endpoint returns `503: 'A integração de cobrança ainda não foi configurada no servidor.'` when env vars are missing |
| VenoPag webhook handler | `POST /api/billing/webhook` | VenoPag webhook POST with `X-Veno-Signature` header | **functions/api/billing/webhook.ts** lines 1-70: HMAC signature validation, processes `request_number`, updates `billing_payments.status` to `paid`/`expired`/`canceled`/`failed`, calls RPC `public.apply_venopag_paid_payment` | **Supabase** RPC `public.apply_venopag_paid_payment` (service_role only): updates payment to `paid`, sets `billing_expires_at` on establishment, sets `billing_status = 'active'` | **Supabase** tables: `billing_payments`, `establishments` (updates `billing_expires_at`, `booking_horizon_days`, `billing_status`) | Same as above + `X-Veno-Signature` HMAC validation against `env.VENOPAG_WEBHOOK_SECRET` | **Real backend** when configured; otherwise 503 error | Same as above + `provider_request_number` match, `amount` validation, `transaction_id` optional | Status must be in `['confirmed','paid','completed']` for "paid" handling; `request_number` must be present; amount must be > 0 | **Functionally complete** but **not operational** without VenoPag credentials and webhook secret | Webhook processes confirmed payments, calls RPC to grant access days and set establishment to `active` status |

---

### 5. Inadimplência e Cancelamentos

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Establishment status toggle | `toggleEstablishmentStatus(id)` | SuperAdminPage toggle button; `handleToggleStatus(id, name)` | **store.ts** lines 460-484: toggles `status` between `active`/`inactive`; protects default template `est-yeshua`; logs audit entry; requires `requireWriteAuth()` + `requireTenantAccess()` | None — localStorage only | **localStorage** key `wl_establishments_v2` | Same as above | **LocalStorage-mocked** | `Establishment` type: `status: EstablishmentStatus` with values `'active' | 'inactive' | 'suspended'` | No explicit delinquency validation; toggle is unconditional except default protection | Establishment can be set to `inactive` via UI; no automatic reinstatement or grace-period logic | **Works for basic active/inactive toggling** but no delinquency-specific logic (past_due, grace periods, etc.) | `billing_status` column exists in Supabase `establishments` table (`'pending'|'active'|'past_due'|'canceled'`) but is **never updated by the store code** — only the `status` field `active`/`inactive` is toggled | 

| Cancellation path | SuperAdminPage `handleDeleteEstablishment()` or store `deleteEstablishment()` | Delete button per establishment; requires `currentSession.role === 'super_admin'` | **store.ts** lines 486-539: only super_admin can delete; blocks deletion of `isDefault` establishments; purges child services/products/media/appointments/instagram_embeds; if `activeTenantId` matches, switches to `est-yeshua` | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Deletion is protected (super-admin only, default protection) but removes all associated data |

---

### 6. Revenue and Recurring Metrics

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Platform metrics | `getPlatformMetrics()` | SuperAdminPage overview tab; `platformMetrics` in `useStore()` hook | **store.ts** lines 1257-1269: returns `{totalEstablishments, activeEstablishments, inactiveEstablishments, totalServices, totalProducts, totalMedia, totalAppointments, confirmedAppointments, pendingAppointments}` | None — computes from in-memory state | **localStorage** — all data sources are localStorage-persisted store state | `isAuthenticated: Boolean(currentSession)` | **LocalStorage-mocked** when Supabase not configured | 9 metrics drawn from `allEstablishments`, `allServices`, `allProducts`, `allMedia`, `allAppointments` | All counts are simple `.length` or `.filter().length` operations; no server aggregation | Metrics are read-only derivations of store state | **ALL THESE ARE LOCALSTORAGE-ONLY when Supabase not configured** — zero real revenue data without backend | 

| Confirmed/pending appointments | `getConfirmedTimesForDate()`, `isTimeSlotBooked()` | Calendar/booking UI | **store.ts** lines 796-817: filter appointments by `status === 'confirmado'` or `status === 'pendente'` per tenant | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above |  |

---

### 7. Finance-specific APIs

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |---|
| Billing functions directory | `functions/api/billing/create-checkout.ts`, `plans.ts`, `webhook.ts` | POST JSON to create-checkout; GET plans; POST webhook with signature | All three files exist and are **fully coded** but **non-operational** without VenoPag env vars | **Supabase** + **VenoPag provider** (`https://venopagments.com`): create-checkout validates session, membership, plan, creates payment record, calls VenoPag API; webhook validates HMAC signature, calls RPC | **Supabase** tables: `billing_plans`, `billing_payments`, `establishments` (billing_status, billing_expires_at); `establishment_memberships` | Bearer token for session; service_role for DB; Veno client_id/secret for provider; `X-Veno-Signature` for webhook | **Real backend architecture** designed but **not deployable** without VenoPag credentials | Full schema: `billing_plans` (id, slug, name, description, price_brl_cents, billing_period, access_days, is_active, display_order, created_at, updated_at); `billing_payments` (id, establishment_id, user_id, plan_id, provider, provider_request_number, provider_transaction_id, amount_brl_cents, status, checkout_url, qr_url, pix_copy_paste, expires_at, paid_at, provider_payload, created_at, updated_at) | create-checkout: planId must match existing plan; amount must be safe integer; membership must exist; VenoPag must accept the request webhook: signature = HMAC-SHA256(timestamp + rawBody) using VENOPAG_WEBHOOK_SECRET; status must be confirmed/paid/completed | **Complete code implementation** with all validation, but **0% operational** in current state because environment variables are not set | The code represents a fully-baked payment system that is **waiting for VenoPag integration** to go live |
| Demos function | `functions/api/demos/[token].ts` | Demo selection/onboarding flow | Exists but minimal — primarily routes to onboarding logic | None visible | N/A | N/A | N/A | N/A | N/A | N/A | **Not analyzed in depth** but likely demo-mode routing |  |

---

### 8. Critical Financial Flow Questions

| DOMAIN | FUNCTION | INTERFACE | IMPLEMENTATION | BACKEND | PERSISTENCE | AUTHORIZATION | STATE REAL | DATA | VALIDATION | PRODUCTION | LACUNA | ACEITE |
|---|---|--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |---|
| Does product purchase trigger any backend process? | N/A — no product purchase flow exists | N/A | **NO**. Products are managed purely in the localStorage `store`; `addProduct`, `updateProduct`, `deleteProduct` only affect in-memory state + localStorage. No API endpoint, no RPC, no Supabase table interaction for product purchases. | None | **localStorage** only | N/A | **Mocked** | `ProductItem` has `price: number` and `available: boolean` but no purchase lifecycle | N/A | N/A | **Critical lacuna**: No backend process for product purchases. Products are catalog items only, not purchaseable assets with payment processing. | Products can be displayed and marked `available`, but buying them triggers nothing — no checkout, no payment, no inventory, no receipt generation |
| Is there a checkout flow? | YES — `PlanSelectionPage.tsx` with `handleCheckout(planId)` | Plan ID selection → `POST /api/billing/create-checkout` → VenoPag redirect or PIX display | **PlanSelectionPage.tsx** lines 85-120: `handleCheckout(planId)` fetches Supabase session, calls `/api/billing/create-checkout` with `planId`, receives `checkout_url` or `pix_copy_paste`, redirects window or shows alert | **functions/api/billing/create-checkout.ts** (see matrix above) + VenoPag provider API | **Supabase** tables `billing_plans`, `billing_payments`, `establishment_memberships` + VenoPag provider | Bearer token from Supabase session; `authorization: Bearer ${session.access_token}` | **Functional when configured** (Supabase + VenoPag env vars); **non-functional** otherwise | Full flow from plan selection to VenoPag cash-in URL or PIX copy-paste | Plan ID validation, membership validation, amount check, provider response validation, payment record creation + status updates | **Checkout flow exists and is coded** but **entirely dependent on VenoPag credentials** being present in environment | The UI flow is complete (plan selection → payment confirmation → redirect), but without VenoPag keys, the endpoint returns 503 and the flow breaks at the first step |
| Are webhooks handling payment confirmations? | YES — `functions/api/billing/webhook.ts` | VenoPag sends POST with `X-Veno-Signature` → updates `billing_payments` status + calls RPC | **functions/api/billing/webhook.ts** (see matrix above): HMAC validation, request_number extraction, status handling, RPC `public.apply_venopag_paid_payment` call | **Supabase** RPC `public.apply_venopag_paid_payment` (service_role only) + `billing_payments`, `establishments` tables | Same as above | Same as above + `X-Veno-Signature` HMAC against `VENOPAG_WEBHOOK_SECRET` | **Real backend** when configured; otherwise endpoint returns 503 | `request_number`, `status`, `transaction_id`, `amount` from webhook payload | Status must be `confirmed`, `paid`, or `completed`; `request_number` must exist; `amount` must be finite > 0; amount must match plan `price_brl_cents` (± rounding) | **Webhook logic is complete and correct** — it would process payment confirmations from VenoPag and update the database accordingly, but it will never receive real VenoPag webhooks without the service being configured |  |
| How are invoices/ receipts generated? | Not explicitly | N/A | **NO INVOICE/RECEIPT GENERATION CODE found** in codebase. Payment status is tracked in `billing_payments.status` and `billing_payments.provider_payload`, but no PDF generation, no email receipts, no invoice numbers. | None | **Supabase** `billing_payments` table stores `provider_payload` jsonb (could contain receipt info if VenoPag sent it) | N/A | **Not applicable** — no generation logic exists | `billing_payments` has: `id`, `provider_request_number`, `provider_transaction_id`, `checkout_url`, `qr_url`, `pix_copy_paste`, `expires_at`, `paid_at`, `provider_payload` | N/A | **Lacuna**: No invoice/receipt generation. Platform captures payment status but does not generate formal invoices. Any receipt would need to be built on top of the `provider_payload` or `pix_copy_paste` data. |  |
| What happens in production vs localStorage-only mode? | Critical distinction | N/A | **LocalStorage-only mode**: All store data (`establishments`, `products`, `services`, `payments` — though no product payments exist) is lost on browser close. No Supabase → no multi-tenant isolation, no payment processing, no persistent metrics. **Production mode** (Supabase + VenoPag env vars): Full payment flow, multi-tenant data persistence, webhook processing, access period grants, establishment status updates via RPC. | N/A | **localStorage** vs **Supabase** depending on `isSupabaseConfigured` flag (import.meta.env.VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY) | N/A | **Real** when configured; **mocked** when not | **Store metrics** (`getPlatformMetrics()`) report real counts from Supabase when configured, localStorage counts when not | N/A | **Critical**: The entire financial pipeline is "deployable but not configured." The code is architected for Supabase+VenoPag production but currently runs in localStorage-demo mode with no real revenue capture. |  |

---

## SUMMARY OF FINDINGS

### Overall Platform Financial Capability Assessment

| Capability | Status | Evidence |
|---|---|---|
| **Multi-tenant establishment management** | ✅ **Functional (localStorage)** | CRUD with auth isolation in store.ts; URL-driven tenant selection; status toggle with default protection |
| **Product catalog management** | ✅ **Functional (localStorage)** | Products with price, availability, featured flags; scoped per establishment |
| **Plan/subscription management** | ⚠️ **Code complete, not operational** | `billing_plans` and `billing_payments` Supabase tables exist; `PlanSelectionPage` + `/api/billing/create-checkout` flow is coded but requires VenoPag env vars |
| **Payment processing (PIX/Checkout)** | ❌ **Not operational** | VenoPag integration exists in functions but returns 503 without `VENOPAG_CLIENT_ID/SECRET` env vars |
| **Webhook payment confirmations** | ⚠️ **Logic complete, no real webhooks** | `functions/api/billing/webhook.ts` is fully coded with HMAC validation and RPC calls, but will never receive real VenoPag webhooks without configuration |
| **Revenue metrics & platform KPIs** | ⚠️ **LocalStorage-only** | `getPlatformMetrics()` returns accurate counts from whatever data source is active (Supabase or localStorage). No real revenue tracking without payment flow. |
| **Inadimplência/cancelamento** | ⚠️ **Basic status toggle only** | Establishment `status` can be toggled active/inactive; `billing_status` column exists in Supabase migrations but is never updated by store code. No delinquency logic. |
| **Invoice/receipt generation** | ❌ **Not implemented** | No code generates invoices or receipts. Payment data captured but not formatted for client delivery. |
| **Product purchase flow** | ❌ **Absent** | Products are catalog items only. No purchase backend, no checkout, no payment processing for products. |

### Critical Gaps Identified

1. **No Supabase configuration** — platform runs entirely in localStorage/demo mode; no real data persistence, no multi-tenant isolation, no payment processing.
2. **VenoPag credentials not set** — payment flow code exists but is non-functional; endpoint returns 503 "A integração de cobrança ainda não foi configurada no servidor."
3. **No product purchase backend** — products are display-only catalog items; no payment flow, no checkout, no revenue capture.
4. **No invoice/receipt generation** — payment status tracked but no formal invoice output.
5. **billing_status column not utilized** — Supabase migration adds `billing_status` to establishments but store code only toggles `active`/`inactive` status.
6. **No recurring subscription automation** — migrations mention "VenoPag currently exposes PIX cash-in/status/webhook in the SDK; this does not implement recurring automatic charges."

### Ready-to-Use Infrastructure

- ✅ Establishment CRUD with multi-tenant isolation
- ✅ Plan selection UI and checkout flow architecture
- ✅ VenoPag webhook handling logic (HMAC signature verification, RPC integration)
- ✅ Platform metrics derivation from store state
- ✅ Audit logging for all administrative actions
- ✅ Default template protection mechanisms

### What Needs to Be Built

- 🚨 Supabase project setup with required tables and RLS policies
- 🚨 VenoPag account integration (client ID, secret, webhook URL)
- 🚨 Product purchase backend (or removal of product purchase UI until built)
- 🚨 Invoice/receipt generation system
- 🚨 Delinquency/cancellation automated logic
- 🚨 Recurring subscription management (if needed beyond one-time PIX)

---
*End of Audit Mission Report - Subagent C - Negócio e Financeiro*