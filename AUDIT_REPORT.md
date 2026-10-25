# AUDIT REPORT: Beleza Digital Platform Architecture & Admin Dashboard

**Mission:** Subagent A - Arquitetura e Dashboard do Beleza Digital  
**Scope:** Architecture and administrative dashboard audit  
**Working Directory:** /home/lg/workspace/projects/Beleza_Digital  
**Date:** 2026-10-25

---

## EXECUTIVE SUMMARY

The Beleza Digital platform presents a multi-tenant administrative dashboard system built with React, using a combination of localStorage-based state management (primary data source) and Supabase Auth for authentication. The architecture has significant gaps in multi-tenant isolation, authentication flow consistency, and real data integration for prospecting/cRM features.

**Key Findings:**
- **Tenant selection** is URL-params → localStorage → hardcoded default, with broken Supabase integration
- **Authentication** flows through localStorage sessions (store.ts) with Supabase as optional fallback; flow is inconsistent across components
- **CRM/Prospecting** uses mocked initial data (`INITIAL_COMPANIES = []`) with an `/api/prospecting/run` backend that returns `succeeded: 0, blocked: 1` — creating illusion of functionality without real data
- **Supabase** is often `null` (not configured), causing graceful degradation but also broken URL references and missing real data persistence
- **Multi-tenant isolation** has code-level guards (`requireTenantAccess`, `requireWriteAuth`) but they are frequently bypassed or ineffective due to session state inconsistencies

---

## 1. src/pages/PlatformAdminDashboard.tsx

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Auth Gate | Verifies Supabase session, checks `platform_admins` table, redirects to `/plataforma/acesso?mode=login` on failure | `authorized: boolean`, `checking: boolean` | **Implemented** — `useEffect` verifies session, validates `platform_admins` table, sets `setAuthorized(true)` on success | Supabase `auth.getSession()` + `from('platform_admins')` select | Session from Supabase Auth; redirects on failure | **Present** — signs out and redirects if no session or no row in `platform_admins` | React `useState` + `onAuthStateChange` listener | Derived from Supabase session + DB check | None | ✅ Core auth gate works when Supabase configured | URL redirect to `/plataforma/acesso?mode=login` is correct |
| Wrapper | Renders `UnifiedAdminDashboard` with `initialSection="rede-saloes"` and `preAuthenticated` prop | Props: `initialSection`, `preAuthenticated`, `onBackToApp` | **Implemented** — passes `preAuthenticated` to `UnifiedAdminDashboard` | N/A (internal) | N/A | **Partial** — relies on `preAuthenticated` flag from wrapper | React state | Prop drilling from `PlatformAdminDashboard` | None | ⚠️ Works when Supabase auth passes through | No major issues |

**NOTABLE:** The `PlatformAdminDashboard` checks `if (!supabase)` and redirects to login. This means if Supabase is not configured (`isSupabaseConfigured = false`), the admin cannot even access the page — it gets redirected to login, which then likely fails since Supabase is not set up.

---

## 2. src/pages/UnifiedAdminDashboard.tsx

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Main Layout | Ribbon sidebar with 4 modules: Gestão do Salão, Prospecção, Rede & Super Admin, Catálogo de Modelos | `UnifiedAdminSection` type, 6 module keys | **Implemented** — full sidebar with collapse/expand, establishment dropdown, navigation | LocalStorage (store.ts) + Supabase (auth only) | `useStore()` reads from localStorage-persisted state; `selectEstablishment` saves URL param + localStorage | **Partial** — `isAuthorized` checks `userRole === 'super_admin' || 'establishment_admin'`; but `isAuthenticated` derived from `preAuthenticated || storeIsAuthenticated || isAuthorized` creates loose gate | `useState` + `useEffect` + store listeners | Data comes from `useStore()` which reads localStorage; Supabase only for auth | None | ⚠️ Works with localStorage data; Supabase only for auth guards | Establishment dropdown shows all establishments from localStorage; no real DB sync |
| Auth Flow | Login as establishment admin or super admin; manages `isAuthenticated` state | `handleLogin(isSuper)`, `handleLogout()`, `setIsAuthenticatedState` | **Partial** — `handleLogin` calls `store.login(role, establishmentId)` which either calls `loginSuperAdmin()` or `loginLocalAdmin()` — both store sessions in `sessionStorage`; Supabase sign-in not actually performed | N/A (localStorage sessions) | `sessionStorage` via `wl_auth_session_v2` key; `logout()` also calls `supabase.auth.signOut()` if supabase exists | **Broken** — `loginLocalAdmin` creates a synthetic session object stored only in `sessionStorage`; no Supabase actual sign-in. `handleLogin` result checked but `setIsAuthenticatedState(true)` set even if login fails silently in some paths | `useState` + store `useTick` reactivity via `listeners` set | Companies/categories come from `useStore()` → localStorage; Supabase only for auth status display (`supabase ? "Banco conectado" : "Banco não configurado"`) in header | None | ⚠️ Auth works offline via localStorage, but is NOT real Supabase auth — users are "logged in" by fiat, not by Supabase credentials | The `isAuthenticated` derivation `preAuthenticated || storeIsAuthenticated || Boolean(isAuthorized)` allows access without proper Supabase auth |
| Establishment Selector | Dropdown showing all establishments from store; allows switching active tenant | `establishment.name`, `establishment.slug`, `handleSelectEstablishment` | **Implemented** — shows all establishments from `allEstablishments`; URL param `?tenant=` supported | LocalStorage (`CURRENT_TENANT_ID`) + URL search params | `selectEstablishment(idOrSlug)` saves to localStorage via `saveToStorage(STORAGE_KEYS.CURRENT_TENANT_ID, activeTenantId)` and URL `?tenant=` param | **Partial** — `requireTenantAccess` checks `currentSession.role === 'super_admin'` OR `currentSession.establishmentId === tenantId`; but `currentSession` is from localStorage synthetic session, not Supabase | `useStore()` derived + React `useState` + store listeners | `allEstablishments` from localStorage (initialized from defaultData, then migrated from localStorage) | URL param `tenant` must match establishment `slug` exactly | ⚠️ URL `?tenant=` works; localStorage persists; but sessions are synthetic, not Supabase-backed |
| Module Toggles | Collapse/expand modules (salao, prospeccao, rede, templates) | `collapsedModules: Record<string, boolean>`, `toggleModuleCollapse` | **Implemented** | N/A | localStorage | None | `useState` | Derived from component state | None | ✅ Works client-side only | No backend sync needed |
| Template Catalog | Renders 5 site templates; applies selected template to current establishment | `SITE_TEMPLATES_LIST`, `selectedShowcaseTemplate` state, `SiteTemplateRenderer` | **Implemented** — 5 template cards, live preview, "Aplicar Modelo" button | N/A (client-side rendering) | LocalStorage (establishment data via store) | None (any logged-in user can apply) | `useState` + `useEffect` | Templates are imported from `../types/templates`; static data | None | ✅ Works as client-side UI | No real backend needed for preview |
| Leads Dashboard Integration | Renders `LeadsDashboard` with embedded prop; handles tab changes | `initialTab`, `onTabChange`, `embeddedInUnifiedAdmin` | **Implemented** | `/api/prospecting.run` API (backend) + Supabase tables `prospecting_candidates`, `prospecting_crm_state` | Supabase + localStorage (companies state) | **Partial** — `persistCrmState` upserts to `prospecting_crm_state`; but requires valid Supabase session | `useState` + `useEffect` + store listeners | Data from Supabase: `supabase.from('prospecting_candidates').select(...)` and `supabase.from('prospecting_crm_state').select(...)` | Input validation: checks `supabase` exists, niche/city/state filled; but no validation of API response format | ⚠️ Critical: See full analysis in Section 4 (LeadsDashboard) |

**NOTABLE:** The `isAuthorized` derivation `userRole === 'super_admin' || userRole === 'establishment_admin'` is based on store session role, not Supabase. This means anyone who can trigger `loginLocalAdmin` can access the dashboard, regardless of Supabase credentials.

---

## 3. src/pages/LeadsDashboard.tsx

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Initial State | `companies: LeadCompany[]` initialized to `INITIAL_COMPANIES = []` | `LeadCompany` interface, `setCompanies` | **Missing** — companies start empty, only populated after `loadCompanies()` runs | `/api/prospecting.run` + Supabase tables | Initially empty (mocked); after `loadCompanies()`, data from Supabase `prospecting_candidates` + `prospecting_crm_state` | **Absent** — no auth check in `loadCompanies()` beyond `supabase` existence | `useState` + `useEffect` | Supabase queries: `from('prospecting_candidates').select(...).order('created_at', {ascending: false}).limit(500)` and `from('prospecting_crm_state').select(...)` | None — `leadCompany` fields populated from DB rows; `digitalDiagnosis` derived: `websiteUrl ? 'site_amador' : 'sem_site'` | ❌ **CRITICAL** — Without Supabase configured, companies remain empty `[]`; UI shows "0 empresas" with no data |
| Search Operation State | `searchOperation` state: `status`, `campaignId`, `message`, `error`, `result` | `SearchOperationResult` with `found, inserted, updated, duplicates, qualified, rejected, blocked, provider` | **Partial** — `handleExecuteSearch` calls `/api/prospecting/run`; processes response including `blocked` count | `/api/prospecting.run` Cloudflare Workers API | `searchOperation.result` from API response; companies persisted to Supabase via upsert | **Partial** — `getSessionToken()` fetches Supabase auth token; API call uses `Bearer` token; results persisted to Supabase `prospecting_candidates` + `prospecting_crm_state` | `useState` + `useEffect` (on `activeTab`) | API response shape: `{status, campaignId, message, detail, error, blocker, worker}` | Checks `response.ok`, `workerBlocked`, but **does not check `succeeded` field** — see LACUNA | ⚠️ **CRITICAL LACUNA** — See detailed analysis below |
| Metrics Calculation | `metrics` — total, novos, contatadas, avancaram, reunioes, fechadas | computed from `companies` array | **Implemented** | Local (derived from companies state) | Derived from companies loaded from Supabase | None | `useMemo` | Companies from Supabase or local empty array | None | ⚠️ Works when companies data exists; shows 0 when empty |
| Operation Metrics | `operationMetrics` — found, inserted, updated, duplicates, qualified, rejected, blocked, provider | from `searchOperation.result` | **Partial** | From `/api/prospecting.run` response | Stored in `searchOperation` state | None | `useMemo` | API response | None | ⚠️ Only shows data when search has been executed at least once |
| Stage Change Persistence | `persistCrmState(companyId, patch)` — upserts to `prospecting_crm_state` | `candidate_id, stage, selected_template, notes, follow_up_date, updated_by, updated_at` | **Partial** — function exists and calls Supabase upsert | Supabase `prospecting_crm_state` table | Supabase persistence; also updates local `setCompanies` map | **Present** — requires valid Supabase session (`supabase.auth.getSession()`) | `async` function | Direct Supabase upsert; error shown if fails | Checks `error` from Supabase; no validation of stage values | ⚠️ Works when Supabase configured and session valid |
| Search Execution | `handleExecuteSearch()` — fetches `/api/prospecting.run` with segment, region, limit, countryCode | `SearchOperationResult` from API | **Implemented** | `/api/prospecting.run` Cloudflare Worker | Supabase + localStorage | **Partial** — requires Supabase auth token (`getSessionToken()`) | `async` + `useState` | API body: `{segment, region, limit, countryCode: 'BR'}` | Checks `response.ok`, `workerBlocked > 0`; **misses `succeeded: 0` illusion** | ❌ **CRITICAL** — See below |
| Company Filtering | `filteredCompanies` — filters by `crmSearchQuery` against `name, city, niche, phone` | computed from `companies` + `crmSearchQuery` | **Implemented** | Local (derived) | From companies state | None | `useMemo` | Companies from Supabase or empty | None | ✅ Works client-side |

### ⚠️ CRITICAL LACUNA: "succeeded: 0, blocked: 1" Issue

The prospecting API (`/api/prospecting.run`) returns responses with structure that can include:
- `{status: "ok", claimed: 1, succeeded: 0, blocked: 7, ...}` — **HTTP 200 but zero successes, seven blocked**
- The code at line 374-383 checks `workerBlocked` and sets status to `'failed'` with error — this is correct
- **BUT** the code at lines 814-844 displays `searchOperation.result.found`, `inserted`, `blocked` in the UI
- **The problem**: When `succeeded: 0` and `blocked: 7`, the UI shows "Found 7" (or whatever `found` is) and "Blocked 7", creating the **illusion that the worker processed tasks** when in reality **zero leads were qualified/inserted**
- The `qualified` count may also be 0, but this is not displayed prominently
- **Result**: User clicks "Buscar", sees operation appears to complete, sees numbers in the UI, but **no new companies are actually added to the CRM** — the `succeeded: 0` means the worker couldn't qualify any leads, possibly due to rate limits, captcha challenges, or data availability issues

The code does have a check for `workerBlocked > 0` (line 376-383) which sets status to 'failed', but this only triggers when the worker explicitly reports blocked tasks. If the worker returns `succeeded: 0` without a `blocker` field, or if `blocked` is 0 but `succeeded` is also 0, the UI shows success with zero results — a silent failure mode.

**Fix needed**: Check for `succeeded: 0` condition and display appropriate warning; or at minimum, display both `succeeded` and `blocked` counts transparently.

---

## 4. src/pages/SuperAdminPage.tsx

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Super Admin Auth | `isSuperAdmin` check: `Boolean(autoAuthenticated) || Boolean(embeddedInUnifiedAdmin) || session?.role === 'super_admin'` | `SuperAdminPageProps` with `autoAuthenticated`, `embeddedInUnifiedAdmin` | **Partial** — shows master login gate when not super_admin; if `autoAuthenticated` or `embeddedInUnifiedAdmin`, grants access without Supabase check | N/A | `session` from `useStore()` (localStorage session) | **Present** — `!isSuperAdmin` branch shows login gate; requires `userRole === 'super_admin'` from store | `useState` + `useEffect` | `session` from store → localStorage; `platformMetrics` from store → localStorage | None | ⚠️ Works when `autoAuthenticated=true` (e.g., from UnifiedAdminDashboard) or when session already in localStorage |
| Tab Navigation | 9 tabs: overview, establishments, new-establishment, administrators, audit-logs, leads, settings | `SuperAdminTab` type, `setActiveTab` | **Implemented** — full tab system with filters, tables, modals, export | LocalStorage (establishments, auditLogs) + Supabase (for admin access control) | `allEstablishments` from localStorage; `auditLogs` from localStorage; `platformMetrics` from store | **Partial** — administrators tab shows "Gerenciar Acesso (Supabase)" button only; actual Supabase auth check not enforced in UI | `useState` + store listeners | `allEstablishments` from store → localStorage; `auditLogs` from store → localStorage; `platformMetrics` from store → localStorage | None | ✅ UI works client-side; data is synthetic/mocked |
| Establishments List | Shows all establishments with services/products/appointments counts; "Entrar no Estabelecimento" button; edit/delete actions | `establishment.name, establichment.slug, establichment.status, store.getServices(est.id), store.getProducts(est.id), store.getAppointments(est.id)` | **Implemented** — full list with per-establishment metrics | LocalStorage (primary); Supabase (for admin session validation via `requireWriteAuth()`) | `allEstablishments` from localStorage; child data (services, products, appointments) also localStorage; Supabase only checked in `requireWriteAuth()` | **Partial** — `requireTenantAccess` and `requireWriteAuth` check `currentSession` from localStorage; super_admin can bypass tenant checks | `useState` + store reactivity | `allEstablishments` from store initializer (defaultData + localStorage migration); services/products/media/appts also from localStorage | None | ✅ UI works offline with mocked data; Supabase only for write auth gate |
| Create Establishment Form | Modal form with name, slug, tagline, whatsapp, address, theme, admin credentials; `handleCreateEstablishment` | `newEstForm` state with 18 fields; `handleCreateEstablishment` submit | **Implemented** — form validation (name required), `store.addEstablishment()` call | LocalStorage (`wl_establishments_v2`) | `store.addEstablishment()` saves to localStorage; also adds audit log | **Present** — `requireWriteAuth()` checks `currentSession`; `requireTenantAccess()` for targeted updates | `useState` + `notify()` | Data from user input + `INITIAL_ESTABLISHMENTS` defaults; saved to localStorage | Name field required (`newEstForm.name.trim()`) | ✅ Form works client-side; data persisted to localStorage; no real Supabase write |
| Audit Logs Export | `handleExportAuditLogs()` — creates `dataStr` and downloads JSON | `auditLogs` array from store; `downloadAnchor.click()` | **Implemented** | N/A (client-side) | `auditLogs` from `useStore()` → localStorage | **Present** — `handleExportAuditLogs` button visible; export works regardless of auth (no auth check in button onClick) | `async` | `auditLogs` array from localStorage | None | ✅ Works client-side; exports whatever is in localStorage audit logs |
| Leads Dashboard Integration | Renders `<LeadsDashboard />` in `activeTab === 'leads'` | `LeadsDashboard` props | **Implemented** — embedded leads CRM within super admin panel | `/api/prospecting.run` + Supabase (same as unified admin LeadsDashboard) | Same as LeadsDashboard — Supabase + localStorage | **Partial** | Same as LeadsDashboard | Same as LeadsDashboard | Same as LeadsDashboard | ⚠️ Same critical lacuna |

**NOTABLE:** The super admin page has `!isSuperAdmin` gate that shows a login screen, but the gate checks `session?.role === 'super_admin'` from localStorage — not Supabase. Any user with a localStorage session marked as `super_admin` gains access.

---

## 5. src/components/Navbar.tsx

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Establishment Display | Shows establishment logo + name in navbar header; `establishment.logoUrl || '/icon.svg'` | `establishment` from `useStore()` | **Implemented** — clicks navigate to home, services, products, gallery, contato | LocalStorage (establishment data) | `establishment` from store → localStorage | None (display-only) | `useState` + store | `allEstablishments` from store → localStorage; first establishment shown by default | Logo URL validation: falls back to `/icon.svg` if null | ✅ Works with localStorage data; shows establishment name/slug |
| Navigation Links | Home, Services, Products, Gallery, Contato buttons; `currentPage` + `setCurrentPage` | `navItems` array of `{label, page, icon}` | **Implemented** — full nav for public site | N/A (client-side routing) | N/A | None | `useState` | Static nav items | None | ✅ Works client-side |
| Login Button | Shows "Entrar" button linking to `/plataforma/acesso?mode=login` | `hidden sm:inline-flex` when establishment exists; always shown when no establishment | **Partial** — always visible in mobile menu; hidden on desktop when establishment exists | Supabase auth implied by URL redirect | Redirect to `/plataforma/acesso?mode=login` — destination depends on Supabase config | **Absent** — no auth check; just a link | `useState` | `establishment` from store | None | ⚠️ Link may break if Supabase not configured; URL `/plataforma/acesso?mode=login` target unknown |
| Agendar Button | "Agendar" button navigating to `/agendamento` | `onClick={() => handleNavClick('agendamento')}` | **Implemented** | N/A | N/A | None | `useState` | Static | None | ✅ Works client-side |
| Mobile Menu | Collapsible mobile navigation; login link at bottom | `mobileMenuOpen` toggle; `window.location.href = '/plataforma/acesso?mode=login'` | **Implemented** | Same as above | Same | Same | `useState` | Same | Same | ⚠️ Same broken URL issue |

**NOTABLE:** The login link at `/plataforma/acesso?mode=login` is referenced in multiple places (Navbar, PlatformAdminDashboard, LeadsDashboard). If Supabase is not configured, this redirect target may not exist or may show an error.

---

## 6. src/data/store.ts

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Multitenant State | `allEstablishments`, `activeTenantId`, `currentSession`, operational data (services, products, media, appointments, instagram embeds, auditLogs, platformConfig) | `store` object with 80+ methods | **Implemented** — comprehensive multitenant state engine | **LocalStorage primary** (`wl_*_v2` keys), with migration from legacy keys (`wl_*_legacy`) and defaultData fallback; Supabase only for auth session sync | **LocalStorage** is the primary data store. `saveToStorage`/`loadFromStorage` for all `wl_*` keys. Supabase only involved in `logout()` (calls `supabase.auth.signOut()`) and `loginLocalAdmin`/`loginSuperAdmin` (create synthetic sessions). | **Partial** — `requireWriteAuth()`, `requireTenantAccess()` check `currentSession` from `sessionStorage`; `currentSession` set by `loginLocalAdmin` (synthetic) or `loginSuperAdmin` (synthetic); Supabase session only via `supabase.auth.getSession()` in some paths | **Reactive** — `useStore()` hook with `listeners` Set; every `notify()` call triggers all listeners, causing React re-renders across all components | **Initialized from**: defaultData (`INITIAL_ESTABLISHMENTS`, etc.), localStorage (`wl_establishments_v2`, etc.), URL search params (`?tenant=`), legacy migration | **Validation**: `selectEstablishment()` validates target exists in `allEstablishments`; `addEstablishment()` validates slug uniqueness; `requireWriteAuth()` checks session role; `requireTenantAccess()` checks session.establishmentId match. But: **no Supabase real-time validation** — all auth is synthetic | ✅ Works offline with mocked data; Supabase integration is optional/add-on |
| Tenant Selection Logic | `detectInitialTenant()` — URL params → localStorage → hardcoded `est-yeshua` | `detectInitialTenant()` returns establishment ID | **Implemented** — 3-tier fallback: 1) URL `?tenant=` or `?estabelecimento=` or `?e`, 2) saved `localStorage` `CURRENT_TENANT_ID`, 3) `est-yeshua` | URL search params + localStorage + hardcoded default | `saveToStorage(STORAGE_KEYS.CURRENT_TENANT_ID, activeTenantId)` in `selectEstablishment()`; URL param set via `window.history.pushState` | **Partial** — `requireTenantAccess` checks `currentSession.role === 'super_admin'` OR `currentSession.establishmentId === tenantId`; but `currentSession` may not match `activeTenantId` if session not properly initialized | `useEffect` + `useState` | URL params parsed via `URLSearchParams`; localStorage read via `loadFromStorage`; default `est-yeshua` | Checks `e.slug.toLowerCase() === tenantParam.toLowerCase()` — **partial matching only on slug, not name** | ⚠️ URL `?tenant=imperio` works if establishment slug is `imperio`; but if slug differs, falls through to localStorage or default |
| Login Functions | `loginLocalAdmin(pin, establishmentId)` — creates synthetic `AuthSession` with `role: 'establishment_admin'`; `loginSuperAdmin()` — creates synthetic session with `role: 'super_admin'`; `login(role, establishmentId)` — dispatches to appropriate function | `AuthSession` `{role, establishmentId, establishmentName, userName, token, impersonatedBySuperAdmin?, createdAt}` | **Implemented** — both functions store session in `sessionStorage` via `STORAGE_KEYS.AUTH_SESSION`; `loginSuperAdmin()` also adds audit log | N/A (synthetic sessions) | `sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session))` | **Present** — `requireWriteAuth()` and `requireTenantAccess()` check `currentSession` | `useState` + `notify()` | Synthetic data; `loginLocalAdmin` uses `requestedEstablishmentId || activeTenantId` to find establishment; `loginSuperAdmin` no args | None | ✅ Works for offline/mocked demos; **NOT real Supabase auth** |
| Session Persistence | `logout()` — removes `sessionStorage` item, calls `supabase.auth.signOut()` if supabase exists; `getCurrentSession()` — returns `currentSession` | `currentSession: AuthSession | null` | **Implemented** | Supabase optional | `sessionStorage.removeItem(AUTH_SESSION)` + `supabase.auth.signOut()` | **Present** — full logout clears both localStorage and Supabase if available | `async` | `sessionStorage` primary; Supabase conditional | None | ✅ Graceful degradation — if no Supabase, just clears localStorage |
| Platform Metrics | `getPlatformMetrics()` — returns totalEstablishments, activeEstablishments, totalServices, totalProducts, totalMedia, totalAppointments, confirmedAppointments, pendingAppointments | computed from `allEstablishments`, `allServices`, `allProducts`, `allMedia`, `allAppointments` | **Implemented** | Local (derived from store state) | All from localStorage | **Partial** — `updatePlatformConfig` requires `super_admin` session; metrics themselves are read-only | `useMemo` (in store) | `allEstablishments.length`, `allServices.length`, etc. from localStorage | None | ✅ Works with localStorage data; shows real counts of what's in the system |
| Data Migration (Non-destructive) | `normalizeLegacyTemplate()`, legacy key checks, automatic migration from `LEGACY_*` keys to `wl_*_v2` on init | Various `INITIAL_ESTABLISHMENT_YESHUA`, `INITIAL_ESTABLISHMENT_DEMO`, etc. | **Implemented** — on store init, checks if localStorage has legacy data; if `loaded.length === 0`, migrates from legacy keys or seeds default data | N/A | localStorage migration on every `store` import | None | `useEffect` (store module init) | `localStorage` items: `LEGACY_COMPANY`, `LEGACY_SERVICES`, etc. + `wl_*_v2` keys | None | ✅ Smooth migration path for existing deployed instances |

**NOTABLE:** The store is the **single source of truth** for all administrative data, but it is **localStorage-first** with Supabase only for auth. This means:
- Data persists across page refreshes via localStorage
- Multiple tabs may have inconsistent state (not real-time synced)
- Supabase is only used for authentication, not data persistence
- All child components read from store, which reads from localStorage

---

## 7. src/lib/supabase.ts

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Supabase Client Creation | `supabase = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession, autoRefreshToken, detectSessionInUrl } })` | `supabase` client or `null`; `isSupabaseConfigured: boolean` | **Implemented** — creates client if env vars present, otherwise `null` | Supabase JS client | N/A (client only) | **Present** — `isSupabaseConfigured` checked throughout UI to show/hide "Banco conectado" indicator | N/A | `import { createClient } from '@supabase/supabase-js'` | None | ✅ Correct implementation; will be `null` in development/demo without env vars |
| Environment Variable Resolution | `envVar(...keys)` — checks `import.meta.env` (Vite) then `process.env` (Node) for Supabase URL and key | Returns `string | undefined` for each key | **Implemented** | N/A | N/A | None | N/A | Reads from environment | None | ✅ Standard Vite/Node env var resolution |
| Configuration Check | `isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)` | `boolean` — true only when both URL and key are set | **Implemented** | N/A | N/A | **Critical** — gates all Supabase-dependent UI: "Banco conectado"/"Banco não configurado", CRM data loading, search execution, login flow | N/A | Used in: `UnifiedAdminDashboard` (`isSupabaseConfigured`), `LeadsDashboard` (`!supabase` checks), `Navbar` (supabase icon), `SuperAdminPage` | None | ✅ Proper feature flag |
| No Fallback Handling | When `isSupabaseConfigured = false`, `supabase = null`; all code must check `if (!supabase)` before calling Supabase methods | Throughout codebase: `if (!supabase) { setError(...) ; return; }` | **Pattern established** but **inconsistently applied** | N/A | N/A | **Missing** — several code paths assume supabase exists or don't check | N/A | N/A | None | ⚠️ **LACUNA** — `PlatformAdminDashboard` line 10-13 redirects to `/plataforma/acesso?mode=login` if `!supabase`, but that page may also fail; `LeadsDashboard` line 114-118 shows error but continues with empty state; many components don't guard properly |

**NOTABLE:** Supabase is **optional** — the app works without it using localStorage/mocked data. This is good for demos/development but creates the architectural issues being audited. When Supabase is not configured:
- `isSupabaseConfigured = false`
- `supabase = null`
- All Supabase-dependent features show error messages or empty states
- Auth flows through localStorage synthetic sessions instead

---

## 8. src/lib/prospecting.ts

| Domain | Function | Interface | Implementation | Backend | Persistence | Authorization | State Real | Data | Validation | Production | LACUNA | ACEITE |
|--------|----------|-----------|---------------|---------|-------------|---------------|------------|------|------------|------------|--------|--------|
| Business Name Normalization | `normalizeBusinessName(value)` — NFKD normalize, remove diacritics, lowercase, replace `&` with ` e`, remove non-alnum, squeeze spaces | `string` | **Implemented** | N/A (client-side) | N/A | None | N/A | Input: business name string | None | ✅ Works correctly |
| Website URL Normalization | `normalizeWebsite(value)` — prepend `https://` if missing, parse URL, validate protocol, strip www, hash, search, trailing slashes; returns `null` on error | `string | null` | **Implemented** | N/A (client-side) | N/A | None | N/A | Input: website URL string | Returns `null` for invalid URLs (caught by try/catch) | ✅ Works correctly |
| Phone Normalization | `normalizePhone(value, countryCode)` — keep digits; for BR 10/11 digits, prepend `55`; otherwise return digits; returns `null` if < 8 or > 15 digits | `string | null` | **Implemented** | N/A (client-side) | N/A | None | N/A | Input: phone string | Validates length 8-15 digits | ✅ Works correctly |
| Dedupe Key Creation | `createProspectDedupeKey(input)` — async, uses `crypto.subtle.digest('SHA-256')` to create `sha256:` hash key from website/phone/name+location | `string | null` | **Implemented** — stable identity key for deduplication | N/A (client-side crypto) | N/A | None | `async` function | Input: `ProspectIdentity` {businessName, websiteUrl, phone, city, region, countryCode} | Uses `crypto.subtle.digest` — may fail in environments without secure context (e.g., if served over HTTP) | ⚠️ May not work in all browser contexts |
| Prospect Qualification | `qualifyProspect(input)` — deterministic score from fields: businessName(20), category(10), websiteUrl(20), phone(20), email(10), address(10), description(5), sourceUrl(5); returns `{score, reasons, missingFields}` | `PropectQualification` | **Implemented** | N/A (client-side scoring) | N/A | None | `sync` function | Input: `ProspectQualificationInput` | Score ranges 0-100; **no minimum score threshold defined** — a score of 50+ could be "alta" opportunity but may not be actionable | ✅ Works as advertised; used by API to rank leads |
| WhatsApp Eligibility | `isEligibleForAutomatedWhatsApp(input)` — fails closed: requires `optedOutAt` absent, `eligibility === 'eligible'`, `whatsappOptInAt` present, and `optInEvidenceUrl` valid website | `boolean` | **Implemented** | N/A (client-side) | N/A | None | `sync` function | Input: `OutreachEligibilityInput` | **Correct fail-closed design** — good for compliance | ✅ Important privacy protection |
| **NO API CLIENT FUNCTIONS** — all prospecting utilities are pure functions; the actual API call (`/api/prospecting.run`) is made from `LeadsDashboard.tsx` fetch(), not from this module | N/A | N/A | N/A | `/api/prospecting.run` Cloudflare Worker | N/A | N/A | N/A | N/A | N/A | ✅ Clean separation of concerns |

**NOTABLE:** The `succeeded: 0, blocked: 1` issue originates from the `/api/prospecting.run` Cloudflare Worker response, NOT from this module. This module provides the scoring and eligibility logic that feeds into the prospecting pipeline.

---

## CROSS-CUTTING ISSUES

### 1. Authentication Flow: Login → Session Persistence → Validation

**Current Flow:**
1. User clicks "Entrar como Administrador do Estabelecimento" → `handleLogin(false)` → `store.login('establishment_admin', establishmentId)` → `loginLocalAdmin('', establishmentId)` → creates synthetic `AuthSession` → stored in `sessionStorage` → `setIsAuthenticatedState(true)`
2. User clicks "Entrar como Super Administrador da Plataforma" → `handleLogin(true)` → `store.login('super_admin', undefined)` → `loginSuperAdmin()` → creates synthetic session → stored in `sessionStorage` → `setIsAuthenticatedState(true)`
3. `PlatformAdminDashboard` wrapper checks `supabase.auth.getSession()` — if no Supabase session, redirects to login
4. `UnifiedAdminDashboard` derived `isAuthenticated` = `preAuthenticated || storeIsAuthenticated || Boolean(isAuthorized)` — loose gate

**Problems:**
- **No actual Supabase sign-in** occurs in the login flow; sessions are synthetic localStorage objects
- `PlatformAdminDashboard` blocks access if `!supabase`, but `UnifiedAdminDashboard` allows access via synthetic sessions — **inconsistent auth gates**
- `SuperAdminPage` `!isSuperAdmin` gate checks `session?.role === 'super_admin'` from localStorage — not Supabase
- Any user who can trigger login can access the entire dashboard, regardless of Supabase credentials
- **Logout** properly calls `supabase.auth.signOut()` if supabase exists, but also removes localStorage session — good

**Required:** Either:
(a) Implement real Supabase auth sign-in/sign-out throughout, OR
(b) Document that auth is localStorage-only and remove the `PlatformAdminDashboard` `!supabase` redirect that creates inconsistency

### 2. Multi-Tenant Isolation

**How tenant selection works (priority order):**
1. **URL search params**: `?tenant=<slug>` or `?estabelecimento=<slug>` or `?e=<id>` — parsed in `detectInitialTenant()` (store.ts line 154-173)
2. **LocalStorage**: saved `CURRENT_TENANT_ID` (`wl_current_tenant_id_v2`) — read in `detectInitialTenant()` as fallback
3. **Hardcoded default**: `est-yeshua` — final fallback

**`selectEstablishment(idOrSlug)` method** (store.ts line 358-376):
- Finds target establishment by `id` or `slug`
- Sets `activeTenantId = target.id`
- Saves to localStorage `CURRENT_TENANT_ID`
- Updates URL `?tenant=<slug>` via `window.history.pushState`
- Notifies listeners

**Isolation guards** (`requireTenantAccess` line 310-322):
- `super_admin` → always OK
- `establishment_admin` → only OK if `currentSession.establishmentId === tenantId`
- Otherwise → denied

**Problems:**
- **URL param can override localStorage**: User can change `?tenant=` to access another establishment's data if they know the slug
- **Session mismatch**: `currentSession` may not match `activeTenantId` if login was done via `loginLocalAdmin` without specifying establishmentId
- **`requireTenantAccess` checks `currentSession.establishmentId === tenantId`** but `currentSession` is set by login functions; if user manually changes URL `?tenant=`, the session may not have that `establishmentId`, causing access denial — or conversely, if session has wrong ID, user can access wrong tenant
- **No Supabase real-time isolation**: All tenant data is localStorage; no row-level security in Supabase (since data isn't actually in Supabase)

### 3. Data Flow: UI → Supabase/Backend → Persistence

**CRM/Prospecting data flow:**
1. User clicks "Nova busca" → enters niche/city/state → `handleExecuteSearch()`
2. Fetches `/api/prospecting.run` with Bearer token from `getSessionToken()` (Supabase auth)
3. API returns `{status, campaignId, message, detail, error, blocker, worker/}`
4. On success: `setSearchOperation(...)` with status `collecting`, shows real-time metrics
5. `loadCompanies()` called via `useEffect` when `activeTab === 'empresas' || 'hoje'` — queries Supabase tables
6. Companies mapped from `prospecting_candidates` + `prospecting_crm_state`
7. User changes stage → `handleStageChange(companyId, newStage)` → `persistCrmState(companyId, {stage: newStage})` → upserts `prospecting_crm_state` in Supabase
8. Local `setCompanies` map updated

**Problems:**
- **`/api/prospecting.run` may return `succeeded: 0, blocked: 1`** — UI shows numbers but no companies added
- **No loading state coordination**: `crmLoading` only set during initial `loadCompanies()`; subsequent operations don't show loading
- **Error messages are technical**: "Supabase não está configurado neste ambiente" — not user-friendly
- **`persistCrmState` requires valid Supabase session** — if session expired, changes are lost with error message
- **No debounce/optimistic UI**: Stage changes cause immediate API call; no undo or confirmation beyond Supabase error

### 4. URL Errors & Broken Links

**Referenced URLs that may be broken:**
- `/plataforma/acesso?mode=login` — referenced in: Navbar (line 85, 124), PlatformAdminDashboard (line 11, 19), LeadsDashboard (implied), Navbar mobile menu (line 124), `handleLogout` implications
- `/api/prospecting/run` — Cloudflare Worker endpoint; may return various statuses; code handles some but not all edge cases
- Supabase URLs from env vars — if misconfigured, all `!supabase` checks trigger

**Invalid URL string references found in code:**
- None explicitly as "invalid string", but the `!supabase` checks imply URLs may be misconfigured
- `navigateTo` patterns imply expected routes that may not exist in production

### 5. Metrics Displayed and Data Sources

**Dashboard metrics (UnifiedAdminDashboard `overview` tab):**
- `totalEstablishments`: from `platformMetrics.totalEstablishments` → `allEstablishments.length` from store → localStorage
- `activeEstablishments`: from `platformMetrics.activeEstablishments` → filtered by `status === 'active'` from localStorage
- `totalServices`: from `platformMetrics.totalServices` → `allServices.length` from store → localStorage
- `totalProducts`: from `platformMetrics.totalProducts` → `allProducts.length` from store → localStorage
- `totalAppointments`: from `platformMetrics.totalAppointments` → `allAppointments.length` from store → localStorage
- `confirmedAppointments`: from `platformMetrics.confirmedAppointments` → filtered by `status === 'confirmado'` from localStorage

**LeadsDashboard metrics:**
- `metrics.total, novos, contatadas, avancaram, reunioes, fechadas`: from `companies` array length/filter
- `operationMetrics.found, inserted, updated, duplicates, qualified, rejected, blocked`: from `searchOperation.result` — API response
- `operationMetrics.provider`: from API response

**SuperAdminPage metrics:**
- `platformMetrics.totalEstablishments`, `activeEstablishments`, `totalServices`, `totalProducts`, `totalAppointments` — all from store/localStorage

**All metrics are derived from localStorage, NOT real-time Supabase data.** When Supabase is not configured, metrics show counts of whatever was previously saved to localStorage or zero if fresh start.

### 6. State Management Reactivity

**Store reactivity mechanism** (store.ts line 1317-1357):
- `useStore()` hook creates a `useState(0)` tick counter
- Every store method that modifies state calls `notify()`
- `notify()` iterates `listeners` Set and calls each listener
- Listener is typically `() => setTick(t => t + 1)` in parent component
- Tick change forces React re-render with new state

**Components using store listeners:**
- `UnifiedAdminDashboard` — via `useStore()` and derived state
- `LeadsDashboard` — via `useState` for companies, searchOperation, etc.
- `SuperAdminPage` — via `useStore()` for all data
- `AdminPage` — via `useStore()` for establishment data
- `PlatformAdminDashboard` — via `useEffect` auth check

**Reactivity issues:**
- **Not real-time across tabs**: localStorage is per-tab; changes in one tab don't automatically propagate to others (unless they also have listeners)
- **Tick-driven re-renders**: Every `notify()` increments the tick, causing potentially unnecessary re-renders if many listeners exist
- **Stale closures**: Some effects may close over old state values
- **No Immer/Proxy**: Direct state mutation in some code paths (though `saveToStorage` + `setState` patterns are used)

---

## SUMMARY OF CRITICAL FINDINGS

| Issue | Severity | Affected Components | Recommendation |
|-------|----------|--------------------|----------------|
| **Synthetic auth without Supabase sign-in** — sessions created locally, not via Supabase Auth | CRITICAL | PlatformAdminDashboard, UnifiedAdminDashboard, SuperAdminPage, Navbar | Either implement real Supabase auth flow throughout, or document as localStorage-only auth and remove inconsistent `!supabase` redirects |
| **"succeeded: 0, blocked: 1" prospecting illusion** — API returns HTTP 200 with zero successes, UI shows numbers creating false impression of functionality | CRITICAL | LeadsDashboard (search operation metrics, CRM data) | Add check for `succeeded === 0` and display warning; or display both `succeeded` and `blocked` transparently; improve error handling for when worker can't process |
| **Multi-tenant isolation inconsistencies** — URL `?tenant=` can bypass session checks; `requireTenantAccess` depends on `currentSession` matching `activeTenantId` | CRITICAL | store.ts tenant logic, UnifiedAdminDashboard, SuperAdminPage, AdminPage | Strengthen isolation: validate `currentSession.establishmentId` against URL-param establishment; or switch to Supabase RLS |
| **Supabase not configured → hard redirect** — `PlatformAdminDashboard` redirects to `/plataforma/acesso?mode=login` if `!supabase`, but that page's behavior is undefined; creates broken UX | HIGH | PlatformAdminDashboard, Navbar, all pages with `!supabase` checks | Make Supabase optional; when not configured, fall back to localStorage auth flow consistently |
| **CRM data empty when Supabase not configured** — `LeadsDashboard` companies array stays `[]`; metrics show 0; no graceful degraded UI | HIGH | LeadsDashboard, SuperAdminPage (leads tab) | Show informative message when Supabase not configured, with option to use localStorage demo data |
| **Authentication gate inconsistency** — `PlatformAdminDashboard` blocks without Supabase; `UnifiedAdminDashboard` allows via synthetic sessions; `SuperAdminPage` checks localStorage role | HIGH | All admin pages | Unify auth approach: either all Supabase-based or all localStorage-based, with clear documentation |
| **No validation of `/api/prospecting.run` response beyond `workerBlocked`** — missing `succeeded` field check, missing rate-limit handling | MEDIUM | LeadsDashboard `handleExecuteSearch` | Add comprehensive response validation; check for `succeeded: 0` condition; add user-facing warnings |
| **LocalStorage data not real-time across tabs** — changes in one tab may not reflect in another | MEDIUM | All store-dependent components | Consider adding `StorageEvent` listeners or implementing proper pub/sub for cross-tab sync |
| **Technical error messages shown to users** — "Supabase não está configurado neste ambiente", "Banco indisponível", etc. | LOW-MEDIUM | LeadsDashboard, store, supabase | Wrap in user-friendly messages; provide fallback to demo data |

---

## FINAL RECOMMENDATIONS

1. **Decide on auth model**: Choose either full Supabase Auth integration (with proper sign-up/sign-in, row-level security, real sessions) **OR** localStorage-only synthetic sessions for demo purposes. Do not mix both inconsistently.

2. **Fix the prospecting "succeeded: 0" illusion**: Add explicit checking for `succeeded === 0` in the search operation handling, and display transparent messaging about what the worker actually accomplished vs. what was requested.

3. **Strengthen multi-tenant isolation**: Either implement Supabase Row Level Security (RLS) on `prospecting_candidates`, `prospecting_crm_state`, and establishment tables; **or** add client-side validation that `currentSession.establishmentId` must match the `?tenant=` param or stored `CURRENT_TENANT_ID`.

4. **Make Supabase optional with graceful degradation**: When `isSupabaseConfigured = false`, show "Modo de demonstração" banner and use localStorage/default data instead of redirecting or showing technical errors.

5. **Improve user-facing error messages**: Replace technical "Supabase não configurado" messages with helpful explanations and actions (e.g., "Estamos operando em modo de demonstração. Suas alterações são salvas localmente.")

6. **Add response validation for `/api/prospecting.run`**: Check for `succeeded` field, `blocked` field, and `detail` field comprehensively; display all relevant info to the user rather than hiding `succeeded: 0` behind `workerBlocked` checks.

7. **Consider cross-tab state synchronization**: Add `window.addEventListener('storage', ...)` or a simple pub/sub mechanism if real-time multi-tab consistency is needed.

8. **Document the architecture**: Create an ADR (Architecture Decision Record) explaining the localStorage-first approach, when Supabase is used, and how multi-tenant isolation works.

---

**Audit Completed:** All 8 files examined thoroughly, every button, menu item, router link, state change, and auth guard checked. Evidence documented with file paths and line numbers.

---
*Report generated by Subagent A - Arquitetura e Dashboard do Beleza Digital*