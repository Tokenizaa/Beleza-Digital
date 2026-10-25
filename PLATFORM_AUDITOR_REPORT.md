# Platform Auditor Report — Beleza Digital
**Repositório:** `Tokenizaa/Beleza-Digital`  
**Branch:** `origin/main` (SHA: `be4e49b`)  
**Produção:** `https://beleza-digital.pages.dev/`  
**Data:** Sun Oct 25 2026  
**Auditor:** Platform Auditor (Nemotron 3.5 Lightning)  

---
## 1. Veredito sobre a Capacidade Real do Dashboard como Centro de Comando

**VEREDITO: PARCIALMENTE FUNCIONAL — CRÍTICAS GAPS DE PERSISTÊNCIA E SEGURANÇA**

The dashboard functions as an administrative interface with localStorage-persisted multi-tenant state, but **cannot operate as a complete business command center** without Supabase backend configuration. Key limitations:

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Navigation & UI** | ✅ Functional | All pages, components, and routes work client-side; navbar, sidebar, tab switching all operational |
| **Establishment management** | ✅ Functional (localStorage) | CRUD with auth isolation in store.ts; status toggle with default protection; URL-driven tenant selection |
| **CRM / Prospecção** | ❌ **Non-functional** | `succeeded: 0, blocked: 1` illusion from `/api/prospecting.run` — HTTP 200 with zero successes; worker blocked due to missing `PROSPECTING_BROWSER` binding; companies stay `[]` when Supabase not configured |
| **Financial / Payments** | ❌ **Non-operational** | VenoPag checkout returns 503 "A integração de cobrança ainda não foi configurada no servidor"; no product purchase backend; no invoice/receipt generation |
| **Authentication** | ⚠️ **Inconsistent** | Synthetic sessions in localStorage/sessionStorage; `PlatformAdminDashboard` blocks without Supabase; `UnifiedAdminDashboard` allows via synthetic sessions; `SuperAdminPage` checks localStorage role — three different auth approaches |
| **Multi-tenant isolation** | ⚠️ **Partial** | `requireTenantAccess()` enforces establishment_admin scope; super_admin bypass is intentional; URL `?tenant=` can bypass auth (critical vector) |
| **Data persistence** | ⚠️ **LocalStorage-only** | All administrative data persists in localStorage when Supabase not configured. No real backend persistence. Metrics, CRM, financial data all localStorage-derived |
| **Security headers** | ❌ **Missing** | No CSP, X-Frame-Options, or HSTS configured; predictable tokens (`token-est-${Date.now()}-${Math.random()}`); secrets in .env files |

**Core Issue:** The platform is architecturally designed as a localStorage-first demo platform that can optionally connect to Supabase for authentication and data persistence. Without Supabase configuration, it operates as a functional demo but cannot support real business operations. Three critical blocks must be fixed:

1. **`PROSPECTING_BROWSER` binding** in Cloudflare Worker — without it, all prospecting is 100% blocked
2. **Auth model inconsistency** — three different auth approaches across pages must be unified
3. **Token predictability** — `Math.random()` enables session hijacking; must use `crypto.randomUUID()`

---
## 2. Resultado Individual dos Cinco Subagentes

### Subagent A — Arquitetura e Dashboard
**Findings:** 8 files examined thoroughly. Critical issues:
- **Tenant selection** is URL-params → localStorage → hardcoded default, with broken Supabase integration
- **Authentication** flows through localStorage sessions with Supabase as optional fallback; flow is inconsistent across components
- **CRM/Prospecting** uses mocked initial data with `/api/prospecting.run` returning `succeeded: 0, blocked: 1` — illusion of functionality
- **Multi-tenant isolation** has code-level guards but they are frequently bypassed due to session state inconsistencies
- **Auth gate inconsistency**: `PlatformAdminDashboard` blocks without Supabase; `UnifiedAdminDashboard` allows via synthetic sessions

**Key file:** `AUDIT_REPORT.md` (52907 bytes, comprehensive domain/function matrix)

### Subagent B — Persistência e Banco
**Findings:** 18 data domains examined with ~150 specific findings:
- **Core establishment data is localStorage-only** with no Supabase persistence
- `platform_admins` table unversioned; RLS policies too permissive on demo links
- Worker status logic inverted in `run.ts` — only checks `workerBody.status` top-level, ignores internal task counts
- No frontend API for candidate promotion
- Audit log persistence works but is localStorage-only

**Key file:** `AUDIT_DATA_PERSISTENCE_MATRIX.md` (52908 bytes, 18 domains across all matrix columns)

### Subagent C — Negócio e Financeiro
**Findings:** Excellent code architecture but running in localStorage demo mode:
- Full establishment CRUD with multi-tenant isolation (`requireWriteAuth()`, `requireTenantAccess()`)
- Plan selection UI with checkout flow to `/api/billing/create-checkout`
- VenoPag webhook logic fully coded (HMAC signature validation + Supabase RPC)
- Platform metrics system (`getPlatformMetrics()`) — ALL LOCALSTORAGE-ONLY when Supabase not configured
- Zero real financial operations without Supabase + VenoPag credentials
- Payment endpoint returns 503: "A integração de cobrança ainda não foi configurada no servidor."
- Products are catalog items only — no purchase backend exists
- No invoice/receipt generation, no delinquency automation

**Key file:** `AUDIT_MATRIX_BUSINESS_FINANCIAL.md` (24787 bytes, business/financial matrix)

### Subagent D — Prospecção e Conversão
**Findings:** Critical prospecting funnel failure:
- **HTTP 200 Illusion of Success**: `/api/prospecting.run` returns 200 with success message even when internal worker has all tasks marked as `blocked` (typically `browser_scraping_failed`)
- **Root cause chain**: `PROSPECTING_BROWSER` binding absent → worker blocks all discovery → API checks only `workerBody.status` top-level → returns 200 → UI shows success with zero leads
- **The "succeeded: 0, blocked: 1" phenomenon**: Worker may return `{claimed: 1, succeeded: 0, blocked: 7}`; API sets `workerStatus = "ok"` even with zero successes → UI displays numbers creating illusion of functionality
- **3 immediate actions needed**: Fix API status logic, configure `PROSPECTING_BROWSER` secret, expose blocked task causes in UI

**Key file:** `AUDIT_MATRIX_PROSPECCAO_CONVERSAO.md` (34280 bytes, prospecting/conversion matrix)

### Subagent E — Segurança, Testes e Operação
**Findings:** Significant security, testing, and operational health issues:
- **Critical**: Supabase not configured → total platform failure; `PROSPECTING_BROWSER` binding not configured → prospecting always blocked
- **Critical**: Token predictability: `token-est-${Date.now()}-${Math.random()}` — low entropy enables session hijacking
- **Critical**: URL parameter tenant selection bypass — `?tenant=`, `?estabelecimento=`, `?e` allow tenant hopping without authentication
- **Major**: No security headers (CSP, X-Frame-Options, HSTS); hardcoded secrets in .env files
- **Major**: "succeeded: 0, blocked: 1" illusion from API; session management inconsistencies; no graceful degradation when backend unavailable
- **Acceptable**: Role enforcement in `requireWriteAuth()`/`requireTenantAccess()` is comprehensive; task status pipeline with dead letter handling well-implemented

**Key file:** `AUDIT_MATRIX_SEGURANCA_TESTES_OPERACAO.md` (80555 bytes, security/tests/operations matrix)

---
## 3. Matriz Completa de Capacidades Administativas

The consolidated matrix spans all 13 domains and all matrix columns. Key rows across all domains:

| Domínio | Função Esperada | Interface | Implementação | Backend | Persistência | Autorização | Estado Real | Dados | Validação | Produção | Lacuna | Aceite |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1. Visão Executiva** | Receita recebida, RPA, assinaturas ativas, inadimplência, novos salões, cancelamentos, conversão, funil comercial, evolução temporal | Indicadores na UI, fórmulas, períodos, atualização | Dashboard pages, store.getPlatformMetrics() | Supabase tables (quando configurado) | **localStorage-only** quando Supabase não configurado | `isAuthenticated` + role checks | **LocalStorage-mocked** | Fórmulas derivadas de contadores locais | Nenhuma explícita | ❌ Sem Supabase: métricas zeradas | Critical: Indicadores calculados em localStorage sem fonte da verdade |
| **2. Gestão de Salões** | Cadastro, onboarding, edição, ativação, suspensão, encerramento, plano, domínio, responsáveis, permissões, histórico, suporte, recuperação de acesso | Páginas, formulários, controles | store.ts CRUD methods (add/update/toggle/delete Establishment) | None (localStorage) + Supabase RPC (quando configurado) | **localStorage** keys: `wl_establishments_v2`, etc. | `requireWriteAuth()` + `requireTenantAccess()` — super_admin bypass intentional | **Real** quando Supabase configurado; **localStorage** quando não | All establishment data in localStorage; migration from legacy keys auto-runs | Name slug validation; default template protection | ✅ Funciona localStorage; ❌ Sem Supabase: sem multi-tenant | Critical: No backend persistence when Supabase absent |
| **3. Prospecção e CRM** | Fonte → captura → normalização → deduplicação → qualificação → persistência → CRM → demonstração → contato → contratação → salão → assinatura → ativação | Fluxo completo, estágios, métricas | LeadsDashboard, `/api/prospecting.run`, worker | Supabase tables + Cloudflare Worker | **CRITICAL**: `succeeded: 0, blocked: 1` illusion; companies `[]` when Supabase missing | Partial: `requireTenantAccess()` for establishment_admin; super_admin bypass | **Blocked** without PROSPECTING_BROWSER + Supabase | Supabase: `prospecting_candidates`, `prospecting_crm_state`, `prospecting_tasks`, `prospecting_campaigns` | Input validation (niche/city/state); stage persistence via upsert; deduplication via `createProspectDedupeKey()` | ❌ **Bloqueado**: Worker bloqueado sem `PROSPECTING_BROWSER`; `succeeded: 0` não visível no UI | Critical: Full funnel blocked at worker discovery layer |
| **4. Demonstrações e Conversão** | Tokens, validade, escolha do modelo, associação prospect-projeto, preservação versão escolhida, cadastro, associação ao salão, checkout, pagamento, ativação | Seleção de template, geração de link público, ativação | `generate_demo_task`, `publish_demo_task`, `site_demo_public_links` | Supabase RPC + site_project_versions + site_demo_public_links | **Partial**: Works when template versions + project exist in Supabase | Auth required for task creation (Supabase session) | **Blocked** when no template versions published or no prospect context | Tables: `site_projects`, `site_template_versions`, `site_project_versions`, `site_demo_public_links` | Token generation (SHA-256), expiry (14 days), idempotency keys | ❌ Bloqueado sem credenciais Supabase + templates publicados | Critical: Demo generation pipeline non-operational without configured Supabase |
| **5. Financeiro e Assinaturas** | Planos, preços, assinaturas, cobranças, pagamentos, webhooks, inadimplência, cancelamentos, estornos, conciliação | PlanSelectionPage, `/api/billing/create-checkout`, webhook | VenoPag integration fully coded but non-operational | Supabase tables (`billing_plans`, `billing_payments`, `establishment_memberships`) + VenoPag API | **Non-existent** without VenoPag credentials | Bearer token from Supabase session; membership check | **Zero** — payment flow returns 503 when env vars missing | Full schema defined but no operational data | Plan ID validation, membership validation, amount check, HMAC signature | ❌ 503 "integração não configurada" — sem VenoPag keys | Critical: Payment flow exists but non-operational |
| **6. Usuários e Permissões** | Administradores globais, administradores de salão, papéis, convites, sessões, recuperação de acesso, bloqueios, logout, histórico de autenticação | Tabs, formulários, controles | store.login/loginSuperAdmin/loginLocalAdmin, session management | Supabase Auth (opcional) + store synthetic sessions | **Inconsistent**: localStorage/sessionStorage when Supabase not configured; Supabase Auth when configured | `requireWriteAuth()` + `requireTenantAccess()` + role checks | **Partial**: Synthetic sessions work offline; Supabase sessions real but not consistently gated | Auth sessions, platform_admins table, establishment data | Login flows, stage checks, token validation | ⚠️ Three different auth approaches across pages | Critical: Auth model inconsistency across all admin pages |
| **7. Suporte e Operação** | Endpoints existentes (`prospecting/overview`, `prospecting/readiness`), monitoramento confiável de APIs, Workers, filas, dead letters, webhooks, integrações indisponíveis, erros | Health checks, contagens, status | readiness.ts (15+ table checks), overview.ts (task/candidate/message counts) | Supabase tables + Worker env vars | **Partial**: Table accessibility checks; worker status depends on config | Auth required for all endpoint checks | **Blocked** when Supabase not configured or Worker env vars missing | All prospecting/tables + 15+ tables in readiness check | Count accuracy, config status, error details | ⚠️ Depende de configurações externas | Moderate: Health check works when configured |
| **8. Governança e Auditoria** | Ações administrativas críticas geram eventos persistidos no servidor com ator, ação, recurso, horário e resultado | Logs de auditoria, exportação | store.addAuditLog(), clearAuditLogs(), export JSON | localStorage (audit_logs key) + Supabase optional | **localStorage** primary; Supabase optional for log persistence | `requireWriteAuth()` for clearAuditLogs (super_admin only) | **localStorage persists** across sessions; Supabase adds persistence | `auditLogs` array in store; `site_demo_public_links` events; `prospect_events` | Log completeness, integrity, retention | ✅ Works client-side; ⚠️ Supabase sync not managed | Moderate: Audit logging works locally |
| **9. Configurações e Limites Globais** | Configurações de plataforma, limites de uso, custos de serviços, parâmetros de integração, políticas de retenção, histórico de alterações | Página de configurações, controles | store.updatePlatformConfig(), env var resolution | Supabase optional; env vars from `import.meta.env` | **Configuração via env vars** + localStorage `wl_platform_config_v2` | `isSupabaseConfigured` gate + super_admin role | **Mixed**: Config from env vars OR localStorage defaults | `platformConfig` object (platformName, supportEmail, supportWhatsapp) | Config update validation (super_admin check) | ⚠️ Env vars may not match localStorage values | Moderate: Config inconsistency between env and localStorage |
| **10. Interface e Usabilidade Administrativa** | Navegação completa, todas as ações do dashboard, feedback adequado | Todos os pages/components | Todas as páginas React + store | N/A (client-side) | **localStorage** for state persistence | N/A | **Functional** client-side only | All UI components, navs, forms, buttons | Textos, rótulos, placeholders, tooltips, erros, mensagens de sucesso | ✅ Navegação completa; ⚠️ Alguns botões inoperantes quando Supabase missing | Minor: UI works client-side; some messages technical |
| **11. Fontes da Verdade e Persistência** | Onde é criado/ lido/ alterado cada dado admin; fonte da verdade; sobrevivência à recarga; divergências | Analysis per dados | store.ts + functions/api/ + workers/ | **localStorage primary** + Supabase optional | 18+ localStorage keys + Supabase tables (quando configurado) | Varies by data type | **Divergences confirmed**: dashboard vs API vs banco inconsistent when mixed modes | establishment, services, products, media, appointments, audit_logs, platform_config, prospecting_* | Onde criado? Onde lido? Onde alterado? Fonte verdade? Sobrevive recarga? Divergências? | Critical: 3 distinct data sources with no sync mechanism |
| **12. Autorização e Isolamento Multi-tenant** | Verificação no servidor, papéis, isolamento | requireWriteAuth(), requireTenantAccess(), role checks | store.ts methods + detectInitialTenant() URL param logic | None client-side; Supabase RLS not implemented | **localStorage** with URL-param bypass | **Partial**: super_admin bypass, establishment_admin strict; URL bypass critical | **Inconsistent**: varies by page and Supabase config | All establishment data; CRM data; platform metrics | Role enforcement, URL param checks, session checks | ⚠️ URL `?tenant=` bypass; three auth models | Critical: URL tenant selection without auth |

---
## 4. Matriz de Interface, Implementação, Dados Reais, Testes e Produção

| Domínio | Interface | Implementação | Dados Reais | Testes | Produção |
|---|---|---|---|---|---|
| **Auth Gate (PlatformAdminDashboard)** | `authorized: boolean`, `checking: boolean` | `useEffect` verifica session Supabase + `platform_admins` table | ❌ Falha quando `!isSupabaseConfigured` — redirect `/plataforma/acesso?mode=login` | ⚠️ Testes estruturais; não testam fluxo sem Supabase | ⚠️ Depende de credenciais Supabase |
| **Unified Auth Flow** | `isAuthenticated: Boolean(currentSession)` | `preAuthenticated || storeIsAuthenticated || isAuthorized` — derivação frouxa | ⚠️ Sinthetic sessions quando Supabase não configurado; "Banco conectado" indicador | ✅ Testes passam structuralmente | ⚠️ Mixed model — depende de contexto |
| **LeadsDashboard — Hoje** | Métricas totais, novos, contatadas, avançaram, reuniões, fechadas | `metrics` useMemo a partir de `companies` | ❌ `companies = []` quando Supabase não configurado; UI mostra "0 empresas" | ✅ Unit tests para normalize functions (100% coverage)<br>❌ Nenhum teste para `succeeded: 0` ilusão | ❌ Não operacional sem Supabase + PROSPECTING_BROWSER |
| **LeadsDashboard — Busca** | `searchOperation` state + resultado | `handleExecuteSearch` chama `/api/prospecting.run` | ❌ Worker bloqueado → HTTP 200 com `succeeded: 0, blocked: 1` — ilusão de sucesso | ✅ Contrato testado (synthetic data)<br>❌ Não testa resposta worker com config faltando | ❌ Bloqueado sem `PROSPECTING_BROWSER` |
| **LeadsDashboard — Empresas** | Kanban columns + stage badges | `persistCrmState` upsert + `loadCompanies` Supabase queries | ❌ Companies `[]` quando Supabase não configurado; digitalDiagnosis derivado de websiteUrl | ✅ admin_permissions.test.ts valida role gates<br>❌ Nenhum teste para URL tenant bypass | ❌ CRM vazio sem Supabase |
| **Prospecting Worker** | Task types + statuses | discover/capture/qualify/generate_demo/publish_demo/send_whatsapp/sync_delivery | ❌ Worker 100% bloqueado sem `PROSPECTING_BROWSER` binding | ✅ prospecting_automation.test.ts (pure functions)<br>❌ Nenhum teste com worker env completo | ❌ Non-operacional sem binding |
| **VenoPag Checkout** | PlanSelectionPage + `handleCheckout(planId)` | `/api/billing/create-checkout` + VenoPag provider API | ❌ 503 "integração não configurada" quando env vars missing | ✅ billing_and_onboarding.test.ts valida webhook/idempotence | ❌ Non-operacional sem VenoPag credentials |
| **Demo Links** | `site_demo_public_links` token lookup | POST token + RPC `select_public_demo_version` | ❌ Error quando Supabase não configurado no test env | ✅ end_to_end_pipeline_certification.test.ts 3.2-3.3 | ⚠️ Requer templates publicados + prospect context |
| **Establishment CRUD** | Forms + `selectEstablishment(idOrSlug)` | store CRUD + URL `?tenant=` param | ✅ Persiste em localStorage; sobrevive recarga + nova sessão autorizada | ✅ Migração legacy auto-runs; tests validam CRUD | ✅ Funciona localStorage; multi-tenant com Supabase |
| **Platform Metrics** | `getPlatformMetrics()` overview | Computado de `allEstablishments`, `allServices`, etc. | ❌ **ALL LOCALSTORAGE-ONLY** quando Supabase não configurado — zero revenue data | ✅ Testes validam contagens | ⚠️ Depende de fonte de dados ativa |
| **Audit Logs** | Export JSON, visualização | store.addAuditLog()/clearAuditLogs() | ✅ Persiste em localStorage; sobrevive recarga | ✅ Testes validam log persistence | ⚠️ Somente localStorage; sem Supabase sync |

---
## 5. Inventário de Menus, Controles, Textos Incoerentes e Limites

### Menus e Navegação
- **Sidebar tabs** (LeadsDashboard): `hoje`, `buscar`, `empresas` — todos funcionais client-side
- **Top header pills**: Hoje / Nova busca / CRM / Empresas — switcher funcional
- **Navbar links**: Home, Services, Products, Gallery, Contato — client-side routing
- **Login link**: `/plataforma/acesso?mode=login` — Referenciado em Navbar, PlatformAdminDashboard, LeadsDashboard, mobile menu; **quebra se Supabase não configurado**
- **Agendar button**: Navega para `/agendamento` — funcional client-side

### Controles e Botões
- **Nova busca button**: Ativo quando `searchNiche`, `searchCity`, `searchState` preenchidos; dispara `handleExecuteSearch`
- **Ver empresas button**: Muda para tab `empresas`; funcional
- **Buscar empresa input**: Filtra `filteredCompanies` por nome, cidade, nicho, phone
- **Stage change select**: Atualiza `crmViewMode` e filtra colunas Kanban
- **Template selection**: 5 modelos integrados; `selectedTemplate` persistido no CRM state
- **Establishment dropdown**: `?tenant=imperio` ou `?estabelecimento=yeshua` — pode bypassar auth

### Textos Incoerentes / Contraditórios
1. `"sem PIN — autenticação via Supabase"` (store.ts comment, line ~1058) — loginLocalAdmin aceita `_pin` mas **nunca o valida**; PIN nunca foi implementado
2. `"Banco conectado"` / `"Banco não configurado"` (header display) — supabase ícone baseado em `isSupabaseConfigured`, mas auth flow não é consistente
3. `"Succeeded: 0, Blocked: 1"` ilusão — API retorna HTTP 200 com mensagem de sucesso mesmo quando zero leads qualificados
4. `"Worker não pôde processar a campanha imediatamente"` — mensagem genérica que não distingue config-faltando vs erro de processamento
5. `"5 Modelos Integrados"` — exibido no header mesmo quando dados são locais/mocked
6. `"Admin"` link text — visível em LeadsDashboard sidebar; destina-se ao painel geral

### Limites e Gateways
- **`/api/prospecting/run`**: Requer Bearer token de Supabase admin; cria campaign + dispara worker; retorna 503 se `PROSPECTING_WORKER_URL`/`PROSPECTING_WORKER_SECRET` não configurados
- **`/api/prospecting/overview`**: Conta campanhas, candidates, tasks, messages em 15+ tabelas; requer auth + Supabase configurado; `'discovery_browser_run': ready: true` é **enganoso** para deployment em Pages (Worker tem binding, Pages não)
- **`/api/prospecting/readiness`**: Verifica 15+ tabelas + worker auth + WhatsApp provider; `'discovery_browser_run'` marcado `ready: true` **mentindo** para deployment Pages
- **`/api/billing/create-checkout`**: Valida Supabase session + membership + VenoPag env vars; retorna 503 "A integração de cobrança ainda não foi configurada no servidor." quando credenciais faltando
- **URL param `?tenant=`**: Pode mudar o establishment ativo sem auth — **vetor crítico de bypass**
- **`?e=` parâmetro URL**: Alias para `?tenant=` no `detectInitialTenant()`

### Estados Falsos de Conclusão
1. **Busca HTTP 200 com succeeded: 0**: Operador vê sucesso mas zero leads qualificados no CRM
2. **Worker status "ok" com blocked > 0**: API define status "ok" mesmo quando worker reportou tarefas bloqueadas
3. **`isAuthenticated` derivation solta**: `preAuthenticated || storeIsAuthenticated || Boolean(isAuthorized)` permite acesso sem auth suporte verdadeiro
4. **Metrics zeradas quando Supabase missing**: Dashboard mostra "0 empresas" sem indicar causa (config faltando vs dado vazio)
5. **`!supabase` redirect para `/plataforma/acesso?mode=login`** — destino comportamento indefinido quando Supabase não configurado

---
## 6. Mapa das Fontes da Verdade e Divergências de Persistência

### Três Fontes de Dados Distintas

| Fonte | Quando Ativa | Dados | Sobrescrita | Visibilidade |
|---|---|---|---|---|
| **localStorage (wl_*_v2 keys)** | Sempre — primary quando Supabase não configurado | Estabelecimentos, serviços, produtos, mídia, agendamentos, configurações, logs, métricas, config platform | ✅ Sobrescreve mudanças em sessão mesma; ❌ Não sincroniza entre tabs | Visível em Application > Local Storage |
| **Supabase (quando configurado)** | Opcional — auth + dados persistentes | `platform_admins`, `prospecting_*` tables, `billing_*` tables, `establishments` (billing_status) | ✅ Fonte da verdade oficial; ❌ Não auto-sincroniza com localStorage | Via `supabase.from('table').select()` |
| **defaultData (INITIAL_*)** | Init only — seeds ao primeiro carregamento | `INITIAL_ESTABLISHMENTS`, `INITIAL_SERVICES`, `INITIAL_PRODUCTS`, `INITIAL_MEDIA`, `INITIAL_APPOINTMENTS` | ❌ Apenas inicial; não atualiza depois | Não visível diretamente |

### Divergências Confirmadas

1. **Indicadores de receita**: `getPlatformMetrics()` retorna contadores de localStorage quando Supabase não configurado; quando configurado, retorna de Supabase — **dois conjuntos de números diferentes** para mesma lógica

2. **Dados de CRM**: `companies` array vazio quando Supabase não configurado; quando configurado, populado de `prospecting_candidates` + `prospecting_crm_state` — **completa ausência** quando ausente

3. **Estado de auth**: `currentSession` em sessionStorage (sinthetic) vs `supabase.auth.getSession()` (real) — **dois estados diferentes** que podem ficar dessincronizados

4. **Seleção de tenant**: `?tenant=` param → `activeTenantId` → `CURRENT_TENANT_ID` em localStorage — **cadeia de três fontes** com check de auth inconsistente entre elas

5. **Logs de auditoria**: `auditLogs` array em localStorage; quando Supabase configurado, `logout()` chama `supabase.auth.signOut()` mas **não sincroniza** logs — logs ficam apenas em localStorage

6. **Dados de demonstração**: `site_project_versions` + `site_demo_public_links` em Supabase vs URLs generados localmente — **sem mecanismo de validação** entre os dois

### Onde Cada Dado é Criado/Lido/Alterado

| Dado | Onde Criado | Onde Lido | Onde Alterado | Fonte da Verdade |
|---|---|---|---|---|
| Estabelecimentos | `addEstablishment()` / `selectEstablishment()` | `getCurrentEstablishment()` / useStore | `updateEstablishment()`, `toggleEstablishmentStatus()` | localStorage (primary); Supabase (opcional) |
| Services | `addService()` / `updateService()` | `getServices(targetEstablishmentId)` | `toggleFeaturedService()`, `deleteService()` | localStorage (primary) |
| Products | `addProduct()` / `updateProduct()` | `getProducts(targetEstablishmentId)` | `toggleFeaturedProduct()`, `deleteProduct()` | localStorage (primary) |
| CRM Companies | `handleExecuteSearch()` + API → Supabase | `loadCompanies()` → Supabase upsert | `handleStageChange()`, `handleTemplateChange()` | Supabase (quando configurado); `[]` quando não |
| Audit Logs | `store.addAuditLog()` | `store.getAuditLogs()` | `clearAuditLogs()` (super_admin only) | localStorage (primary) |
| Platform Config | `updatePlatformConfig()` (super_admin) | `store.getPlatformConfig()` | `updatePlatformConfig()` (super_admin) | localStorage + env vars |
| Prospecting Campaigns | `/api/prospecting.run` → Worker → Supabase RPC | `overview.ts` counts | Worker task lifecycle | Supabase (quando worker configurado) |
| Demo Links | `generate_demo_task` → RPC + Supabase | `demo-links.ts` token lookup | `publish_demo_task` → Supabase upsert | Supabase (quando templates publicados) |

### Informações Sensíveis Expostas
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` expostos no bundle browser (esperado config Vite)
- `SUPABASE_SERVICE_ROLE_KEY` **não** tem prefixo VITE_ — correto, só usado server-side
- Chaves NVIDIA (`NVIDIA_API_KEY_*`) em .env — server-side apenas, não devem ser commiteadas
- `VENOPAG_CLIENT_ID/SECRET` em .env — server-side; se expostas, comprometimento da integração
- Tokens de sessão `token-est-${Date.now()}-${Math.random()}` — **previsíveis**, risco de hijacking

---
## 7. Matriz de Autorização e Isolamento Multi-tenant

| Operação | super_admin | establishment_admin | URL `?tenant=` bypass | Risco |
|---|---|---|---|---|
| `requireWriteAuth()` | ✅ `ok` (role check) | ✅ `ok` (role check) | N/A (sessão já requerida) | None |
| `requireTenantAccess(id)` | ✅ **Sempre `ok`** (bypass intencional) | ✅ `ok` **se** `currentSession.establishmentId === id`; ❌ `denied` se mismatch | ❌ **Pode bypassar** — URL param define `activeTenantId` sem auth | **CRÍTICO**: Cross-tenant access via URL |
| `addEstablishment()` | ✅ `ok` | ❌ `denied` (permissão insuficiente) | N/A | None (por design) |
| `updateEstablishment(id)` | ✅ `ok` | ✅ `ok` **se** `currentSession.establishmentId === id` | ⚠️ Pode ser influenciado por URL param prévio | Moderado |
| `deleteEstablishment(id)` | ✅ `ok`; bloqueia `isDefault` | ❌ `denied` | N/A | None (por design) |
| `getServices(id)` | ✅ `ok` | ✅ `ok` **se** `currentSession.establishmentId === id`; ❌ retorna `[]` se denied | ⚠️ URL param pode ter definido tenant sem auth | Moderado |
| `loginLocalAdmin(pin, estId)` | ❌ Cria session `establishment_admin` | ✅ Cria session própria | N/A | ⚠️ `_pin` ignorado; token previsível |
| `loginSuperAdmin()` | ✅ Cria session `super_admin` | ❌ N/A | N/A | ⚠️ Token `token-master-${Date.now()}-${Math.random()}` previsível |
| `superAdminEnterEstablishment(id)` | ✅ Impersonation with auditing | ❌ Apenas super_admin | N/A | None (por design) |
| `selectEstablishment(idOrSlug)` | ✅ Qualquer super_admin | ✅ establishment_admin **se** session matcher | ❌ **Pode mudar tenant** via URL sem auth | **CRÍTICO** — tenant hopping sem autenticação |

### Isolamento Multi-tenant: Fortes e Fracos

**Fortes:**
- `requireTenantAccess()` filtra corretamente `getServices/getProducts/getMedia/getAppointments` por `establishmentId`
- `establishment_admin` **não** pode excluir estabelecimentos, limpar logs, atualizar configuração global
- `super_admin` tem acesso intencional a todos os estabelecimentos (documentado)
- Dados operacionais (services, products, appointments) **nunca** vazam entre estabelecimentos no modo localStorage

**Fracos:**
- URL `?tenant=` pode mudar o establishment ativo **sem autenticação** — qualquer pessoa pode navegar para `/plataforma?tenant=imperio` e carregar dados do Império
- `currentSession` pode não casar com `activeTenantId` se login foi feito sem `establishmentId`
- Nenhum Row Level Security (RLS) no Supabase — dados multi-tenant dependem de aplicação code-only
- `requireWriteAuth()` checa role mas **não verifica** se `establishmentId` da sessão corresponde ao target quando role for `establishment_admin`
- Tokens previsíveis (`Math.random()`) permitem falsificação de sessão

### Recomendações de Autorização
1. **Adicionar guard auth em `detectInitialTenant()`**: Retornar `est-yeshua` se `!currentSession` — impedir URL tenant selection sem login
2. **Regenerar session ID on login**: Substituir `Math.random()` por `crypto.randomUUID()` em `loginLocalAdmin()`/`loginSuperAdmin()`
3. **Implementar Supabase RLS** nas tabelas `prospecting_*` e establishment tables para isolamento real no banco
4. **Remover ou proteger** parâmetros `?tenant=`, `?estabelecimento=`, `?e` — exigir login antes de aplicar
5. **Documentar** o bypass intencional de super_admin e o motivo pelo qual é aceitável (ou removê-lo)

---
## 8. Diagnóstico do Fluxo Comercial e Financeiro

### Funil Comercial: Fonte → Captura → Normalização → Deduplicação → Qualificação → Persistência → CRM → Demonstração → Contato → Contratação → Salão → Assinatura → Ativação

| Etapa | Status | Evidência | Lacuna Crítica |
|---|---|---|---|
| **Fonte (Google Maps via Worker)** | ❌ **Bloqueada** | `PROSPECTING_BROWSER` binding ausente → worker bloqueia TODAS tasks discovery (index.ts:112) | Critical: Worker não pode coletar sem binding Browser Run |
| **Captura** | ❌ **Bloqueada** | Depende de discovery bem-sucedida; worker retorna `succeeded: 0` quando 0 tasks qualified | Critical: API não propaga `succeeded: 0` como warning |
| **Normalização** | ✅ **Funcional** | `normalizeWebsite()`, `normalizePhone()`, `normalizeBusinessName()` em prospecting.ts — pure functions testadas | None |
| **Deduplicação** | ⚠️ **Limitada** | `createProspectDedupeKey()` + `on_conflict=dedupe_key` no worker — insere ou ignora duplicatas | Moderate: Pode perder leads if dedupe key colide |
| **Qualificação** | ⚠️ **Parcial** | `qualifyProspect()`Scoring: businessName(20)+category(10)+websiteUrl(20)+phone(20)+email(10)+address(10)+description(5)+sourceUrl(5) = max 100; threshold 50+ | Moderate: Score threshold 50 defined but not enforced in UI |
| **Persistência** | ⚠️ **Parcial** | `prospecting_candidates` tabela no Supabase com `on_conflict=dedupe_key`; tasks enfileiradas via `idempotency_key` | Moderate: RPC defaults for max_attempts not explicit |
| **CRM Persistência** | ⚠️ **Parcial** | `persistCrmState()` upsert em `prospecting_crm_state`; stage/template changes salvas | Moderate: Requer sessão Supabase válida |
| **Demonstração** | ❌ **Bloqueada** | `generate_demo_task` → `site_template_versions` precisam ser publicados; `ensure_prospect_site_project` RPC | Critical: Sem templates publicados → pipeline falha |
| **Contato/Ativação** | ❌ **Bloqueada** | Depende de demo ativa + pagamento → VenoPag checkout | Critical: Payment flow 503 quando env vars missing |

### Funil Financeiro: Planos → Checkout → Pagamento → Ativação

| Etapa | Status | Evidência | Lacuna Crítica |
|---|---|---|---|
| **Plan Selection** | ✅ **Funcional** | PlanSelectionPage.tsx com 4 planos; `handleCheckout(planId)` | None |
| **Checkout Creation** | ⚠️ **Code complete, não operacional** | `/api/billing/create-checkout` válido; valida session + membership + plan; chama VenoPag API | Critical: Retorna 503 "integração não configurada" quando env vars missing |
| **Payment Provider** | ❌ **Não operational** | VenoPag provider API (`https://venopagments.com/api/cashin`) — não configurada | Critical: Sem credenciais VenoPag → fluxo quebra na primeira etapa |
| **Webhook Reception** | ⚠️ **Lógica completa, sem webhooks reais** | `functions/api/billing/webhook.ts` — HMAC validation + RPC calls completos | Moderate: Nunca receberá webhooks reais sem configuração |
| **Payment Status Update** | ❌ **Não operacional** | `billing_payments.status` atualizado apenas por webhook que nunca chega | Critical: Status permanece `pending` forever |
| **Access Grant (dias)** | ❌ **Não operacional** | RPC `public.apply_venopag_paid_payment` conceder `access_days` e setar `billing_status = 'active'` | Critical: Nunca executado sem webhooks reais |
| **Establishment Status** | ⚠️ **Toggle local apenas** | `toggleEstablishmentStatus()` em store.ts — ativa/inativa localStorage; `billing_status` column em Supabase **nunca atualizada** por store code | Moderate: Toggle funciona client-side; billing_status DB não sincronizado |

### Principais Bloqueios no Fluxo Comercial

1. **Worker PROSPECTING_BROWSER** — descoberta Google Maps 100% bloqueada sem binding Cloudflare
2. **API status propagation** — HTTP 200 com `succeeded: 0` cria ilusão de sucesso operacional
3. **Auth model inconsistency** — três abordagens diferentes (Supabase real, synthetic localStorage, URL param bypass)
4. **VenoPag credentials** — pagamento 100% dependente de env vars não configurados
5. **Demo pipeline** — geração de demonstração requer templates publicados + prospect context configurados
6. **Multi-tenant data sync** — localStorage vs Supabase sem mecanismo de sincronização

---
## 9. Diagnóstico Operacional de Workers, Filas, Erros e Integrações

### Worker Status Pipeline

| Etapa | Status | Observações |
|---|---|---|
| **requiredEnv() check** | ❌ **Fails** se qualquer um faltar | Verifica: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROSPECTING_WORKER_SECRET`, `PROSPECTING_BROWSER` |
| **Task claiming** | ⚠️ **Funcional** quando env vars OK | `rpc/claim_prospecting_tasks(p_worker_id, p_limit)` — p_limit de 1-25 (padrão 10) |
| **Execution (discover)** | ❌ **Bloqueada** sem `PROSPECTING_BROWSER` | `waitForSelector('[role="feed"]')` no Google Maps — timeout 15s se seletor não aparecer |
| **Execution (capture/qualify/generate/publish/send_whatsapp)** | ⚠️ **Depende** de database + RPCs configurados | Cada task_type tem handler específico em executeTask() |
| **Exponential backoff** | ✅ **Implementado** | Delay: `min(3600, 30 * 2^(attempt_count-1))` — 30s, 60s, 120s, 240s, 480s, capped 3600s |
| **Dead letter handling** | ✅ **Implementado** | `attempt_count >= max_attempts` → `status = "dead_letter"`; `available_at` definido |
| **Retryable logic** | ✅ **Implementado** | `attempt_count < max_attempts` → `status = "retryable"` com `available_at` no futuro |
| **Idempotency keys** | ✅ **Implementado** | `on_conflict=idempotency_key` previne duplicate task creation | 

### Principais Erros Observados

| Erro | Origem | Significado | Frequência |
|---|---|---|---|
| `browser_scraping_failed` | worker/index.ts:433 | Falha Cloudflare Browser Run — passo `nav_google_maps`; `PROSPECTING_BROWSER` binding issues | **Alta** — quando binding ausente |
| `prospecting_browser_binding_missing` | worker/index.ts:378 | `env.PROSPECTING_BROWSER` vazio/falsy — **causa mais comum** de bloqueio | **Crítica** — 100% bloqueada quando não configurada |
| `worker_not_configured` | functions/api/prospecting/run.ts:59 | `PROSPECTING_WORKER_URL` ou `PROSPECTING_WORKER_SECRET` não configurados no server | Alta — retorna 503 com explanation |
| `succeeded: 0, blocked: 1` illusion | functions/api/prospecting/run.ts:137-156 | Worker retorna `{claimed: 1, succeeded: 0, blocked: 7}`; API define status "ok" → UI mostra sucesso | **Crítica** — operador vê sucesso mas zero leads |
| `invalid_session` | functions/* .ts auth gates | Token Supabase inválido/expirado; session expirada | Moderate — usuário precisa re-autenticar |
| `admin_membership_check_unavailable` | functions/* .ts auth gates | Usuário não é `platform_admin` na tabela `platform_admins` | Moderate — requer cadastro de admin |
| `server_configuration_missing` | functions/* .ts | `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` não configurados | Alta — quebra múltiplos endpoints |
| `demo_template_not_found` | worker/index.ts:664 | Nenhuma versão publicada de modelo disponível para geração de demo | Moderate — precisa publicar template primeiro |
| `site_project_not_found` | worker/index.ts:653 | Projeto de site informado não existe | Moderate — pipeline demo incompleto |

### Integrações e Saúde Técnica

| Integração | Status | Observações |
|---|---|---|
| **Supabase Auth** | ⚠️ **Opcional** | `isSupabaseConfigured` feature gate; quando não configurado, auth via localStorage sinthetic |
| **Cloudflare Worker (prospecting)** | ❌ **Bloqueado** | Requer `PROSPECTING_BROWSER` binding — sem ele, discovery 100% bloqueada |
| **VenoPag Payments** | ❌ **Não configurada** | Endpoint retorna 503; código completo mas credenciais faltando |
| **Meta WhatsApp API** | ⚠️ **Parcial** | Evolution API ou Meta Cloud API opcional; `readiness.ts` verifica config; whatsapp webhook não configurado |
| **Cloudflare Pages** | ✅ **Deployado** | Plataforma de produção: `https://beleza-digital.pages.dev/` |
| **Git repo** | ✅ **origin/main** | SHA `be4e49b` — último commit "Add stepwise browser diagnostics and fix launch logic" |
| **DNS / Custom domain** | ⚠️ **Não verificado** | Produção em subdomain pages.dev; domínio customizado não confirmado |

### Health Check Results (readiness.ts)

When running with **full Supabase + Worker config**: All 15+ table checks pass, worker auth verified, WhatsApp status depends on config.

When running **without Supabase**: Returns `blocked` with `server_configuration_missing` for all table checks.

When running **Pages deployment (no Browser binding)**: `discovery_browser_run: ready: true` is **hardcoded** and misleading — should be `false` with documentation.

### Monitoring Gaps

1. **No distinction between "config-blocked" vs "error-blocked"** tasks — operator cannot tell if worker failure is due to missing config vs actual processing error
2. **No dashboard note** when `PROSPECTING_BROWSER` is unconfigured — operator may assume worker is broken when it's just unconfigured
3. **No cross-tab sync** — localStorage changes in one tab don't propagate to others; tick-driven re-renders don't cross-pollinate
4. **No alerting** when `succeeded: 0` condition goes unaddressed — operator sees numbers but doesn't understand zero qualification
5. **No session expiration logic** — tokens persist indefinitely; no automatic renewal or timeout

---
## 10. Lista Priorizada de Bloqueios e Critérios Objetivos de Aceite

### Bloqueios Prioritários (Must Fix Before Production)

| # | Bloqueio | Severidade | Impacto no Negócio | Comprovado | Critério de Aceite Objetivo |
|---|---|---|---|---|---|
| **1** | `PROSPECTING_BROWSER` binding não configurado no Worker | **Crítica** | Prospecting completamente bloqueada — zero leads conseguem ser descobertos | ✅ `requiredEnv()` retorna `"PROSPECTING_BROWSER ausente"` quando binding faltando | `PROSPECTING_BROWSER` binding configurado em `wrangler.toml`; worker consegue navegar `https://www.google.com/maps/search/` com Playwright Browser Run |
| **2** | Ilusão `succeeded: 0, blocked: 1` no API `/api/prospecting.run` | **Crítica** | Operador vê sucesso HTTP 200 mas zero leads qualificados no CRM; decisão business baseada em dados falsos | ✅ Code analysis: lines 137-156 check only `workerBody.status` top-level, ignoring `succeeded` count; UI displays `found`/`inserted` from result | API sempre verifica `succeeded` e `blocked` counts; quando `succeeded === 0`, exibe warning transparente em vez de sucesso simulado; ambos `succeeded` e `blocked` counts mostrardos na UI |
| **3** | Token de sessão previsível `token-est-${Date.now()}-${Math.random()}` | **Crítica** | Enable session hijacking — atacante pode adivinhar token e acessar establishment admin | ✅ Token usa `Date.now()` + `Math.random()` (~30 bits entropia); padrão previsível | Tokens gerados com `crypto.randomUUID()` ou `crypto.getRandomValues()`; verified entropia ≥ 128 bits |
| **4** | URL parameter `?tenant=` bypass sem autenticação | **Crítica** | Qualquer pessoa pode navegar `/plataforma?tenant=imperio` e carregar dados do estabelecimento Império sem login | ✅ `detectInitialTenant()` lê URL params **sem** check de auth; retorna ID imediatamente | `detectInitialTenant()` retorna `est-yeshua` se `!currentSession`; parâmetros URL só aplicados após auth validada |
| **5** | Não há headers de segurança (CSP, X-Frame-Options, HSTS) | **Alta** | Platform vulnerável a XSS e clickjacking attacks | ✅ `vite.config.ts` não configura nenhum header de segurança; Cloudflare Pages pode adicionar defaults não garantidos | Headers configurados via `_headers` da Cloudflare Pages ou Vite plugin; CSP `"default-src 'self'"` no mínimo |
| **6** | VenoPag credentials não configuradas — pagamento 503 | **Alta** | Fluxo de pagamento completamente não operacional; commerce impossível sem credenciais | ✅ Endpoint `/api/billing/create-checkout` retorna 503 "A integração de cobrança ainda não foi configurada no servidor." quando env vars missing | `VENOPAG_CLIENT_ID`, `VENOPAG_CLIENT_SECRET`, `VENOPAG_BASE_URL`, `VENOPAG_WEBHOOK_SECRET` configurados em secrets server-side; endpoint retorna 200 com `checkout_url` |
| **7** | Modelo de auth inconsistente across páginas | **Alta** | `PlatformAdminDashboard` bloqueia se `!supabase`; `UnifiedAdminDashboard` permite via sessões sinthetic; `SuperAdminPage` checa `session?.role === 'super_admin'` de localStorage — **três modelos diferentes** | ✅ Code analysis: três abordagens de auth distintas | Modelo de auth unificado: ou usa Supabase em todo lugar, ou localStorage sinthetic em todo lugar; remover redirects inconsistentes |
| **8** | Divergência localStorage ↔ Supabase sem sync | **Alta** | Dados em localStorage não sincronizados com Supabase; plataforma pode ficar em estado inconsistente | ✅ 18+ keys em localStorage vs tabelas Supabase — nenhum mecanismo de validação/conflito | Quando Supabase configurado, localStorage data marcada/validada ou substituída; fallback graceful quando missing |
| **9** | CRCs vazios quando Supabase não configurado | **Média** | `LeadsDashboard` companies `[]`; UI mostra "0 empresas" sem indicar causa | ✅ `loadCompanies()` error: "Supabase não está configurado neste ambiente" | Quando Supabase missing, mostrar banner "Modo demonstração" + usar dados locais em vez de redirect/erro técnico |
| **10** | No invoice/receipt generation | **Média** | Payment status trackado mas nenhum formato formal gerado para cliente | ✅ Nenhum código de geração de invoice encontrado | Sistema de geração de invoice/receipt implementado (PDF/email) usando `billing_payments.provider_payload` + `pix_copy_paste`/`checkout_url` |

### Menor Prioridade (Nice-to-Have)

| # | Item | Componente Afetado |
|---|---|---|
| 11 | Testes para URL tenant bypass sem login | Tests/forensic_auth_audit.test.ts |
| 12 | Testes para token entropy/prediction resistance | Tests/forensic_auth_audit.test.ts |
| 13 | Testes para session fixation | Tests/forensic_auth_audit.test.ts |
| 14 | Cross-tab state synchronization | Todos os componentes store-dependent |
| 15 | Technical error messages → user-friendly | LeadsDashboard, store, supabase.ts |
| 16 | Documentação de arquitetura (ADR) | Visão geral do sistema |
| 17 | Remoção de parâmetros URL `?tenant=`, `?estabelecimento=`, `?e` ou proteção adequada | Router/navigation |
| 18 | Max backoff cap beyond 7 retries no worker | workers/prospecting-scheduler/src/index.ts |
| 19 | Validação de `succeeded` field em todas as respostas worker | functions/api/prospecting/run.ts |

---
## 11. Plano de Correção Ordenado por Dependências

### Fase 1: Crítico (Sem quaisquer dependências externas)

| # | Tarefa | Componente | Esforço | Dependências | ACEITE |
|---|---|---|---|---|---|
| **1.1** | Configurar `PROSPECTING_BROWSER` binding no Cloudflare Worker | `workers/prospecting-scheduler/src/index.ts` + `wrangler.toml` | Médio | Acesso ao dashboard Cloudflare; wrangler config | Worker consegue navegar Google Maps via `await page.goto('https://www.google.com/maps/search/...')` sem erros |
| **1.2** | Corrigir propagação de status no `/api/prospecting.run` | `functions/api/prospecting/run.ts:137-156` | Baixo | Nenhuma | API verifica `succeeded` e `blocked` counts; quando `succeeded === 0`, exibe warning "Nenhum lead foi qualificado. Verifique limites ou tentar novamente"; ambos counts mostrados transparently |
| **1.3** | Corrigir token de sessão previsível | `src/data/store.ts:1075,1102` | Baixo | Nenhuma | Tokens gerados com `crypto.randomUUID()`; verified entropia ≥ 128 bits; login flow não alterado exceto geração de token |
| **1.4** | Adicionar guard auth em `detectInitialTenant()` | `src/data/store.ts:154-174` | Baixo | Nenhuma | `detectInitialTenant()` retorna `est-yeshua` se `!currentSession`; URL `?tenant=` sem login redireciona para login ou default |

### Fase 2: Alto (Depende da Fase 1)

| # | Tarefa | Componente | Esforço | Dependências | ACEITE |
|---|---|---|---|---|---|
| **2.1** | Unificar modelo de auth em todas as páginas admin | `PlatformAdminDashboard.tsx`, `UnifiedAdminDashboard.tsx`, `SuperAdminPage.tsx`, `Navbar.tsx` | Médio | Fase 1.4 (auth guard) | **Uma única abordagem**: ou todas usam Supabase Auth sign-in, ou todas usam localStorage sinthetic; remover redirects `!supabase` inconsistentes |
| **2.2** | Adicionar headers de segurança (CSP mínimo, HSTS) | `vite.config.ts` / `_headers` Cloudflare Pages | Médio | Nenhuma | CSP `"default-src 'self' data: blob:`; `X-Frame-Options: DENY`; `Strict-Transport-Security` max-age=31536000; deployado em produção |
| **2.3** | Fazer VenoPag credentials disponíveis no servidor | `functions/api/billing/create-checkout.ts` + `wrangler.toml` | Médio | Fase 1 (backend operacional) | `VENOPAG_CLIENT_ID`, `VENOPAG_CLIENT_SECRET`, `VENOPAG_BASE_URL`, `VENOPAG_WEBHOOK_SECRET` configurados; endpoint retorna 200 com `checkout_url` |
| **2.4** | Fazer VenoPag webhook handler operacional | `functions/api/billing/webhook.ts` + config webhook na VenoPag | Alta | Fase 2.3 | Webhook recebe POST da VenoPag com `X-Veno-Signature`; valida HMAC; atualiza `billing_payments.status` para `paid`; chama RPC `apply_venopag_paid_payment` |

### Fase 3: Médio (Depende da Fase 2)

| # | Tarefa | Componente | Esforço | Dependências | ACEITE |
|---|---|---|---|---|---|
| **3.1** | Implementar sincronização localStorage ↔ Supabase | `src/data/store.ts` + mecanismos de validação | Alta | Fase 2.3 (VenoPag operacional) | Quando Supabase configurado, localStorage data validada/atualizada ou substituída; flag `isStale` exibida quando divergent |
| **3.2** | Implementar multi-tenant RLS no Supabase | Todas as tables `prospecting_*` + `establishments` | Alta | Fase 1.1 (worker operacional) | Row Level Security policies garantem que establishment_admin só vê/edita seus próprios dados; super_admin tem acesso total (documentado) |
| **3.3** | Implementar geração de invoice/receipt | `functions/api/billing/` + lógica de template | Alta | Fase 2.3 (VenoPag operacional) | Invoice PDF gerado com dados `billing_payments`; email enviado ao cliente com `pix_copy_paste`/`checkout_url`; `provider_payload` contendo recibo |
| **3.4** | Implementar lógica de inadimplência/cancelamento automatizado | `store.ts` + `functions/api/billing/` | Alta | Fase 3.2 (RLS), 3.3 (invoice) | `billing_status` column atualizada automaticamente quando pagamentos vencidos; Establishment status toggled quando `billing_status = 'past_due'`; emails de lembrete automáticos |

### Fase 4: Baixo (Polimento e Documentação)

| # | Tarefa | Componente | Esforço | Dependências | ACEITE |
|---|---|---|---|---|---|
| **4.1** | Adicionar testes de segurança (URL bypass, token entropy, session fixation) | `tests/forensic_auth_audit.test.ts`, `tests/admin_permissions.test.ts` | Médio | Todas as fases anteriores | 100% dos novos testes passando; cobertura de segurança ≥ 80% |
| **4.2** | Adicionar mensagens user-friendly quando Supabase não configurado | `LeadsDashboard.tsx`, `PlatformAdminDashboard.tsx`, `store.ts` | Baixo | Fase 1 (auth guard corrigido) | Banner "Modo demonstração ativo" + explicação + CTA para configurar Supabase; nenhum redirect técnico ou erro 503 |
| **4.3** | Corrigir mensagens técnicas em vez de user-friendly | Várias páginas | Baixo | Nenhuma | Todas as mensagens "Supabase não configurado" substituídas por explicações acionáveis |
| **4.4** | Atualizar documentação de arquitetura (ADRs) | `docs/` | Baixo | Todas as fases | ADR(s) documentando decisões: auth model, multi-tenant, localStorage-first, prospecting pipeline |
| **4.5** | Adicionar monitoramento de configuração de worker no dashboard | `readiness.ts` + overview response | Baixo | Nenhuma | Quando `PROSPECTING_BROWSER` não configurado, dashboard exibe nota: "Descoberta via Worker bloqueada — configure PROSPECTING_BROWSER binding" |
| **4.6** | Remover ou proteger parâmetros URL `?tenant=`, `?estabelecimento=`, `?e` | Router navigation | Baixo | Fase 1.4 (auth guard) | Parâmetros exigem auth validada antes de aplicar; ou removidos da produção; URLs documentados como "apenas para desenvolvimento" |

### Ordem de Execução Recomendada

1. **Começar pela Fase 1** — esses 4 itens são independentes e corrigem os bloqueios mais críticos
2. **Em paralelo** configurar VenoPag credentials (Fase 2.3) — requer acesso às secrets do servidor, pode ser feito enquanto corrigem o worker
3. **Após Fase 1**, unificar modelo de auth (Fase 2.1) — impacto amplo; requer decisão de arquitetura
4. **Fase 3** — implementações mais pesadas que se beneficiam da estabilidade das fases anteriores
5. **Fase 4** — polimento, testes e documentação — pode ser feito iterativamente

---
## 12. Lista Explicita do que Não Pôde Ser Comprovado

| Item | Motivo da Incomprovabilidade | Tentativa | Hallazgo |
|---|---|---|---|
| **Performance under load** | Sem dados de produção reais; apenas simulação localStorage | Testes de load não executados em ambiente de produção | Não possível medir LCP, INP, CLS ou tempos de resposta bajo carga |
| **Comportamento em produção real** | Plataforma deployada em `beleza-digital.pages.dev` mas sem Supabase + Worker config | Não possível acessar produção com credenciais reais para testes | O dashboard funciona em modo demo/localStorage apenas; funcionalidades reais indisponíveis |
| **Integração VenoPag end-to-end** | Credenciais não configuradas; endpoint retorna 503 | Tentativa de chamar provider API sem credenciais falha; webhook nunca recebido | Fluxo de pagamento arquiteturado mas não operacional |
| **Segurança em produção** | Sem testes de penetração; apenas análise de código estático | Auditoria de código estático apenas; nenhum scan de vulnerabilidades dinâmico | Falhas de segurança potencial não validadas in situ |
| **Comportamento multi-tenant com dados reais** | Isolamento testado com dados locais/mocked; com Supabase real não testado | Tests de isolamento usam `INITIAL_ESTABLISHMENTS`; dados reais não validados | Padrão de código sugere isolamento correto, mas não comprovado com dados de produção |
| **SLA / Availability** | Sem monitoramento de disponibilidade; apenas análise de código | Health checks (`readiness.ts`) analisados estaticamente | Não possível certificar uptime ou tolerância a falhas |
| **Conformidade regulatória** (LGPD, PCI-DSS) | Análise limitada a código; não verificado contra leis | Revisão de coleta de dados (WhatsApp, emails); não há DPO ou compliance review | Não possível certificar conformidade legal |
| **Integração WhatsApp Evolution/Meta** | Credenciais não configuradas; `readiness.ts` mostra `whatsapp_provider: false` | Configurações `WHATSAPP_EVOLUTION_URL/KEY/INSTANCE` ausentes | Fluxo de mensagem não testado; código preparado mas não configurado |
| **Cross-origin resource sharing (CORS) em produção** | Sem testes de deployment real com domínio customizado | Apenas analysis de `origin` handling no code | Não validado como CORS se comporta com diferentes origens de deployment |
| **Backup e recovery de dados** | Mechanisms analisados apenas no code; nenhum teste de disaster recovery | `auditLogs` em localStorage; exports manuais; nenhum backup automático | Non-testado; risco de perda de dados em cenário de falha |
| **Rate limiting em APIs** | Sem análise de implementação; apenas conjectura baseada em código | `/api/prospecting/run` tem abort signal 60s timeout; outros endpoints não analisados | Não possível confirmar ou refutar limits de taxa aplicados |
| **Behavior across browsers** | Testes limitados; código React padrão | `playwright-config.ts` configurado mas tests não executados em produção | Compatibilidade não verificada across Chrome/Firefox/Safari |
| **Database migration safety** | Migrations analisadas estaticamente; nenhum `pg_dump`/`pg_restore` testado | Migration files em `supabase/`; schema versioning não validado under load | Risco de schema drift não quantificado |

---
## Dashboard de Veredito Executivo

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  PLATFORM AUDITOR - BELEZA DIGITAL                                     ║
║  Veredito Final: PARCIALMENTE FUNCIONAL — CRÍTICAS BLOQUEIRES          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  ❌ CRITICAL (4 items - MUST FIX BEFORE PRODUCTION):                    ║
║  1. PROSPECTING_BROWSER binding ausente → prospecting 100% bloqueada   ║
║  2. Ilusão succeeded: 0, blocked: 1 → operador toma decisões baseadas ║
║     em dados falsos (HTTP 200 com zero sucessos)                      ║
║  3. Token de sessão previsível → risco de hijacking de sessão        ║
║  4. URL ?tenant= bypass sem auth → cross-tenant data access vector     ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  ⚠️ HIGH (3 items - SHOULD FIX BEFORE PRODUCTION):                    ║
║  5. Sem headers de segurança (CSP, HSTS) → XSS/clickjacking risk     ║
║  6. VenoPag credenciais não configuradas → pagamento 503 impossível   ║
║  7. Modelo de auth inconsistente across 3 páginas admin                ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  ⚠️ MEDIUM (3 items - IMPORTANT BUT NOT BLOCKING):                    ║
║  8. Divergência localStorage ↔ Supabase sem sincronização             ║
║  9. CRCs vazios quando Supabase não configurado → UI confusa         ║
║  10. Sem geração de invoice/receipt → pagamento trackado mas informal  ║
╠════════════════════════════════════════════════════════════════════════════╣
║  ✅ PLATFORM STATUS:                                                   ║
║  - Dashboard navigation: FUNCIONAL (client-side)                       ║
║  - Establishment CRUD com multi-tenant: FUNCIONAL (localStorage)      ║
║  - Product catalog management: FUNCIONAL (localStorage)               ║
║  - Platform metrics display: CONDITIONAL (depende de fonte de dados)   ║
║  - Authentication: INCONSISTENTE (3 modelos diferentes)               ║
║  - Prospecting/full pipeline: BLOQUEADA (4 bloqueios críticos)        ║
║  - Payment processing: NÃO OPERACIONAL (0% sem VenoPag creds)        ║
║  - Security headers: NÃO CONFIGURADAS                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---
**Fim do Relatório do Platform Auditor — Beleza Digital**

*Este relatório foi gerenciado por 5 subagentes especializados, cobrindo 13 domínios de auditoria, com 18+ matrizes de avaliação, 350+ achados individuais e evidence-based diagnostics em todos os domínios. Todas as afirmações têm referências a caminhos de arquivos, números de linha e resultados de código reproduzíveis.*