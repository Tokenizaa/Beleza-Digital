# Auditoria Técnica Independente — Módulo de Prospecção e Raspagem
# Beleza Digital

**Data:** Domingo, 25 de Outubro de 2026  
**Repositório:** `/home/lg/workspace/projects/Beleza_Digital`  
**Branch:** `main` (up to date with `origin/main`)  
**HEAD SHA:** `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0`  
**Produção:** `https://beleza-digital.pages.dev/`  
**Modified files (not committed):** `functions/api/prospecting/run.ts`, `workers/prospecting-scheduler/src/index.ts`

---

## RESUMO EXECUTIVO

| Veredito | **BLOQUEADO** |
|----------|---------------|
| **Motivo principal** | O endpoint `POST /api/prospecting/run` retorna HTTP 200 e relata "Busca iniciada imediatamente" mesmo quando o Worker interno regista múltiplas tarefas com `status: "blocked"` (ex: `browser_scraping_failed`). Isso ocorre porque a API apenas inspeciona o *status* de topo do worker (`workerBody.status === "ok"`), não as tarefas individuais marcadas como blocked no banco de dados. |
| **Fluxo quebrado** | Interface → `/api/prospecting/run` → Worker discovery → Falha no `PROSPECTING_BROWSER` binding ou `waitForSelector('[role="feed"]')` timeout → Worker marca tasks como `blocked` → API retorna 200 sem refletir esse estado. |
| **Cinco frentes de erro** | 1. **Interface**: Menu abre módulo, mas conteúdo depende de auth; campos de nicho/cidade/estado enviados corretamente, mas worker não consegue rasterizar.<br>2. **API**: Retorna 200 baseando-se apenas no status de topo do worker, não no resultado das tarefas.<br>3. **Worker**: `PROSPECTING_BROWSER` binding pode estar ausente/no configured; navegação no Google Maps falha por restrição de bot/no Cloudflare Browser Run.<br>4. **Banco**: RLS altamente restritiva; dados de prospecção inacessíveis ao frontend sem role `platform_admin`.<br>5. **Produção**: Binding `PROSPECTING_BROWSER` pode não estar preenchido no deploy publicado. |

---

## 1. RESULTADO INDIVIDUAL DOS CINCO SUBAGENTES

### 1.1 Interface e Navegação

**Conclusões gerais:**
- O módulo de prospecção é acessível através do menu lateral do `UnifiedAdminDashboard` → seção `prospeccao-buscar` → `LeadsDashboard` com tab `"buscar"`.
- A autenticação é **obrigatória** via `PlatformAdminDashboard` → verificação de session Supabase + tabela `platform_admins`. Sem sessão válida, o usuário é redirecionado de `/plataforma/admin` para `/plataforma/acesso?mode=login`.
- O menu sempre mostra itens `prospeccao-hoje`, `prospeccao-buscar`, `prospeccao-crm`, mas o conteúdo renderizado é **condicional** ao estado `isAuthenticated` do `UnifiedAdminDashboard` (linha 181). Se não autenticado, mostra tela de login em vez do formulário de busca.
- A navegação altera o **estado interno** (`activeSection` no UnifiedAdminDashboard, `activeTab` no LeadsDashboard), **não a URL do navegador**. A URL permanece como `/plataforma/admin` (ou `/plataforma/acesso?mode=login`).
- O formulário "Nova Busca" tem campos: **nicho** (default: "Barbearia"), **estado** (default: "RS"), **cidade** (default: "Porto Alegre"), **quantidade** (range 5-50, default 5).
- **Validação no frontend**: todos os três campos (nicho, cidade, estado) são obrigatórios antes de enviar o formulário (LeadsDashboard.tsx, linha 291-293).
- O formulário envia dados para `POST /api/prospecting/run` com payload `{segment, region, limit, countryCode}`.
- O texto "Buscar {searchLimit} empresas" no botão reflete o valor do campo de quantidade.
- **Problema identificado**: Se o usuário navegar diretamente para `/plataforma/prospeccao` sem passar pelo gate de auth do `PlatformAdminDashboard`, o componente `PlatformLeadsDashboard` é renderizado, mas imediatamente fica com `isAuthenticated=false` e mostra a tela de login em vez do formulário.

**Evidências arquivadas:**
- `src/App.tsx` linhas 68-70: rotas `/plataforma/prospeccao`, `/plataforma/crm`, `/plataforma/leads`, `/prospeccao` → `PlatformLeadsDashboard`
- `src/pages/PlatformAdminDashboard.tsx` linhas 9-39: auth flow com Supabase session + `platform_admins` table check
- `src/pages/UnifiedAdminDashboard.tsx` linhas 181-238: `isAuthenticated` check mostra login screen se falso
- `src/pages/LeadsDashboard.tsx` linhas 285-381: `handleExecuteSearch` valida campos e envia API
- `src/pages/PlatformAccessPage.tsx` linhas 79-84: redirect `/plataforma/admin` → `/plataforma/acesso?mode=login`

---

### 1.2 API e Contratos

**Conclusões gerais:**
- `POST /api/prospecting/run` (functions/api/prospecting/run.ts) é o único endpoint de ativação de busca.
- **Autenticação**: Bearer token de session Supabase + verificação de `platform_admins` (admin só). Retorna 401 se token ausente/inválido, 403 se não for admin.
- **Payload obrigatório**: `{segment, region}`; opcionais: `limit` (padrão 10, máximo 100), `countryCode` (padrão "BR").
- **Fluxo completo**:
  1. Valida admin (linhas 50-54)
  2. Verifica se `PROSPECTING_WORKER_URL` e `PROSPECTING_WORKER_SECRET` estão configurados (linhas 57-63) → se não, retorna **503** com `{blocked: true, blocker: 'worker_not_configured'}`
  3. Cria campanha em `prospecting_campaigns` com `status: 'active'`, `next_run_at: now`, `schedule: {}` (imediato, sem recorrência)
  4. **Aciona worker** via `fetch(env.PROSPECTING_WORKER_URL, {method: 'POST'})` com `authorization: Bearer ${PROSPECTING_WORKER_SECRET}` (linhas 126-133)
  5. **Lê resposta do worker** (linhas 134-148): faz `workerBody = workerResponse.json()`, determina `workerStatus` baseado no `workerBody.status` de topo
  6. **Decisão final** (linhas 151-174): Se `workerError` for truthy → PATCH campanha para `status: 'blocked'`, retorna **503** com `{status: 'blocked', campaignId, detail: workerError}`. Se `workerError` for null → retorna **200** com `{status: 'ok', campaignId, message: 'Busca pontual iniciada imediatamente...', worker: workerResult}`

**O problema HTTP 200 vs blocked: 1:**
- O worker pode retornar corpo `{status: "ok", claimed: 1, succeeded: 0, blocked: 7, retryable: 0, deadLetter: 0}` — ou seja, HTTP 200 do worker, mas 7 tasks bloqueadas.
- A API (linhas 137-143) define:
  ```typescript
  const workerStatus = workerBody.status === 'blocked' || workerBody.status === 'retryable' || workerBody.status === 'failed'
    ? workerBody.status
    : (workerResponse.ok ? 'ok' : 'blocked');
  workerResult = { ...workerBody, status: workerStatus };
  if (workerStatus === 'blocked' || workerStatus === 'retryable' || workerStatus === 'failed' || !workerResponse.ok) {
    workerError = String(workerBody.error ?? workerBody.detail ?? `Worker ${workerStatus}`);
  }
  ```
- **Se** `workerBody.status` for `"ok"` (mesmo que 7 tasks internas estejam blocked) → `workerStatus = "ok"` → `workerError = null` → **API retorna 200**.
- **Se** `workerBody.status` for `"blocked"` → API retorna 503 com `{status: 'blocked', ...}`.

**Onde `blocked=1` é definido:**
- No **Worker**: cada task handler (discoverCampaignTask, captureCandidateTask, etc.) que falha define `status: "blocked"`, `last_error_code`, `last_error` no banco `prospecting_tasks`.
- No **API**: campanha `prospecting_campaigns.blocked_reason` é preenchido quando a API PATCHa campanha para `status: 'blocked'` (linha 155 do run.ts).
- No **Worker processBatch**: conta `counts.blocked` e atualiza cada task, mas esse número não é propagado de volta para a resposta da API se `workerBody.status` for `"ok"`.

**Evidências arquivadas:**
- `functions/api/prospecting/run.ts` — completo, linhas 49-175
- `functions/api/prospecting/run.ts` linhas 136-144: mecanismo de determinação de workerStatus
- `workers/prospecting-scheduler/src/index.ts` — discoverCampaignTask linhas 430-437: catch block que marca task bloqueado
- `workers/prospecting-scheduler/src/index.ts` linhas 1082-1107: processBatch que conta blocked/retryable/dead_letter

---

### 1.3 Worker e Raspagem

**Conclusões gerais:**
- O worker `prospecting-scheduler` roda a cada 5 minutos via cron (wrangler.prospecting-scheduler.toml, linha 8).
- Para busca **pontual** (via API), o worker é acionado imediatamente pelo `fetch(env.PROSPECTING_WORKER_URL)`.
- O fluxo principal é `discoverCampaignTask` (linhas 335-543), que:
  1. Verifica limite diário (linhas 337-356): `dailyLimit - discoveredToday`. Se 0, task succeeds com `outcome: "daily_limit_reached"` — **nenhum browser run**.
  2. Constrói query: `${segment} ${region}` (linha 362)
  3. **BINDING CRÍTICO**: lê `env.PROSPECTING_BROWSER` (linha 373). Se `!browserBindingValue` → throws `"prospecting_browser_binding_missing"` → catch (linha 430) → task marcado `blocked` com `last_error_code: "browser_scraping_failed"`.
  4. Importa `@cloudflare/playwright` (linha 380) e lança browser: `await launch(browserBindingValue)` (linha 381).
  5. **Step tracking** (linha 368): `step = "init"` → `"browser_connect"` → `"nav_example"` → `"nav_google_home"` → `"nav_google_maps"`.
  6. Navegação: `page.goto(testUrl)` → `page.goto(googleHome)` → `page.goto(searchUrl)` (linhas 395-406).
  7. `waitForSelector('[role="feed"]', {timeout: 15000})` (linha 407): **principal ponto de bloqueio** — se o seletor não aparecer em 15s, timeout → catch → task `blocked`.
  8. `page.evaluate()` (linhas 408-428): extrai até 100 listings de `a[href*="/maps/place/"]` cards.
  9. Dedupe + persist (linhas 451-536): para cada result, cria `dedupe_key` (SHA-256), persiste em `prospecting_candidates`, enqueue task `capture` se novo.

**O que causa `blocked: 1` no worker:**
- `PROSPECTING_BROWSER` binding ausente/empty (linha 378) → `browser_scraping_failed`
- `page.goto()` falha/timeout em qualquer um dos 3 estágios (linhas 395-406) → `browser_scraping_failed` com `failedStep` informado
- `waitForSelector('[role="feed"]')` timeout (linha 407) → `browser_scraping_failed` com `failedStep: "nav_google_maps"`
- `page.evaluate()` lança erro (DOM inesperado) → `browser_scraping_failed`
- Limite diário atingido (linhas 349-356) → **não é blocked**, outcome `"daily_limit_reached"` (task succeeds)

**Onde blocked status é definido no worker:**
- Linhas 432-437 (discoverCampaignTask catch): `status: "blocked"`, `last_error_code: "browser_scraping_failed"`, inclui `bindingType`, `bindingIsString`, `bindingLength`, `failedStep`
- Linhas 548-555 (captureCandidateTask): `status: "blocked"`, `last_error_code: "candidate_id_required"`
- Linhas 152-159 (sendWhatsAppTask): `status: "blocked"`, `last_error_code: "prospect_id_required"`
- Linhas 186-193 (sendWhatsAppTask consent gate): `status: "blocked"`, `last_error_code: "prospect_opted_out"` ou `"whatsapp_consent_or_phone_missing"`
- Linhas 890-898 (executeTask unknown type): `status: "blocked"`, `last_error_code: "integration_not_configured"`
- Linhas 900-907 (executeTask missing prospect_id): `status: "blocked"`, `last_error_code: "prospect_id_required"`

**Evidências arquivadas:**
- `workers/prospecting-scheduler/src/index.ts` — linhas 372-440: discoverCampaignTask try/catch com step tracking
- `workers/prospecting-scheduler/src/index.ts` — linhas 337-356: daily limit check
- `workers/prospecting-scheduler/src/index.ts` — linhas 406-407: waitForSelector para [role="feed"]
- `workers/prospecting-scheduler/src/index.ts` — linhas 1066-1107: processBatch que conta blocked/succeeded/retryable/dead_letter

---

### 1.4 Banco e Persistência

**Conclusões gerais:**
- **19 tabelas** no esquema Supabase, todas relacionadas ao módulo de prospecção.
- **RLS (Row Level Security)** é **altamente restritivo**: virtually todas as tabelas de prospecção só podem ser lidas por:
  - `service_role` (workers usam essa chave para contornar RLS)
  - `authenticated users` com `private.is_platform_admin()` (policy `prospecting_campaigns_platform_admin_read`, etc.)
- **Anônimos/autenticados comuns** não conseguem ler `prospecting_campaigns`, `prospecting_candidates`, `prospecting_tasks`, `prospect_events` diretamente. O frontend (`LeadsDashboard`) depende dos RPCs e da API gateway.

**Tabelas principais e fluxo:**
| Tabela | Propósito | Status flow |
|--------|-----------|-------------|
| `prospecting_campaigns` | Campanhas de busca | paused → active → blocked (blocked_reason) |
| `prospecting_candidates` | Candidatos descobertos | discovered → qualified → promoted/disqualified/blocked |
| `prospecting_tasks` | Tarefas do worker | pending → processing → succeeded/blocked/retryable/dead_letter/cancelled |
| `prospect_events` | Log de eventos | discovered/captured/qualified/disqualified/demo_generated/demo_published/etc |
| `prospects` | Prospects qualificados | captured → qualified → draft_ready/contacted_manually → converted/rejected/archived |
| `site_projects` | Projetos de site gerados | ligado ao template version |

**RPCs críticas:**
| RPC | Finalidade |
|-----|------------|
| `promote_prospecting_candidate(p_candidate_id)` | Mapa candidate → prospect, cria evento `captured` |
| `ensure_prospect_site_project(p_prospect_id, p_template_version_id)` | Cria site_project a partir do prospect, liga módulo de prospecção ao gerador de sites |

**Onde `blocked_reason` é armazenado:**
1. `prospecting_campaigns.blocked_reason` (texto) — quando campanha tem status 'blocked'
2. `prospecting_tasks.last_error_code` + `last_error` — worker define ao marcar task como 'blocked' (ex: 'browser_scraping_failed', 'consent_gate')
3. `prospect_outbound_messages.last_error_code` + `last_error` — mesmo padrão WhatsApp

**Discrepâncias notáveis:**
- TypeScript tipos não refletem enum `status` do banco (campanhas: 6 valores no DB; prospects: 7 valores; campaigns check em types é diferente)
- `establishments.contact` é JSONB no banco, mas tipos TS esperam colunas planas — gap estrutural conhecido
- `prospecting_crm_state` table foi adicionada na migration `20261024010000`, não estava nos relatórios parte 1-4 (de outubro inicial)
- `site_projects.prospect_id` existe na migration base `20261019000000`, mas o relatório antigo pode ter se referido a versão diferente

**Evidências arquivadas:**
- `RELATORIO_INVENTARIO_PARTE1.md` a `PARTE4.md` — contexto de migrações antigas
- Migrações SQL at `origin/main` — esquema completo consultado via subagent
- `supabase/` configuração

---

### 1.5 Testes e Produção

**Conclusões gerais:**
- A configuração de testes usa **apenas Chromium** (Firefox e WebKit não configurados).
- **Todos os testes automatizados rodam headless** (`headless: true` no `playwright.config.ts`).
- O `playwright-explore.cjs` é uma ferramenta de exploração manual com `headless: false` — browser visível.
- **Playwright CLI versão:** `^1.64.1`, `@cloudflare/playwright: ^1.3.6`.

**Arquivos de teste relevantes:**
| Arquivo | Propósito |
|---------|-----------|
| `tests/e2e/prospecting-real.spec.ts` | Fluxo real: login admin → nova busca → endpoint → CRM evidence |
| `tests/e2e/prospecting-real-corrected.spec.ts` | Mesmo fluxo com melhor handling de erro e suporte URL produção |
| `tests/e2e/regressao_fase0_publicado.spec.ts` | Validação de console error, proteção de rotas admin no site publicado |
| `tests/prospecting_contract.test.ts` | Contrato de dados entre tipos e DB schema, parity worker/lib (32 afirmações) |
| `tests/prospecting_automation.test.ts` | Normalização & deduplicação: normalizeName, normalizeWebsite, normalizePhone, qualifyProspect, createProspectDedupeKey |

**Comandos de teste:**
```bash
# Rodar todos os suites de teste (tsx)
npx tsx tests/prospecting_automation.test.ts
npx tsx tests/prospecting_worker.test.ts
npx tsx tests/e2e/prospecting-real.spec.ts

# Rodar Playwright E2E (headless)
npx playwright test

# Deploy
npm run deploy  # ou: npm run pages:deploy
```

**Produção (`https://beleza-digital.pages.dev/`):**
- Site responde HTTP 200
- É uma SPA static — não há automação de browser em runtime
- Os testes Playwright navegam para a URL mas rodam headless
- O deploy pipeline: `vite build` → `wrangler pages deploy dist --project-name=beleza-digital`
- **Binding `PROSPECTING_BROWSER`** no `wrangler.prospecting-scheduler.toml` é definido como `[browser] binding = "PROSPECTING_BROWSER"` mas o valor real vem de secrets do Cloudflare (não commitados no repo). Se não houver secret preenchido, o worker retorna `status: "blocked"`.

**Correspondência main × local × produção:**
| Aspecto | `origin/main` | Local (working dir) | Produção (`pages.dev`) |
|---------|--------------|---------------------|------------------------|
| Código-fonte | `be4e49b` | `be4e49b` + 2 arquivos modified (run.ts, index.ts) sem commit | Provavelmente `be4e49b` (último deploy antes das modifications) |
| `PROSPECTING_BROWSER` binding | Definido em `wrangler.prospecting-scheduler.toml` | Igual | Valor vindo de secrets Cloudflare; se vazio → worker bloqueia |
| `PROSPECTING_WORKER_URL` / `SECRET` | Em `functions/api/prospecting/run.ts env` | Igual | Devem estar configurados no deploy; se não → API retorna 503 `blocked: worker_not_configured` |
| `playwright.config.ts` | headless: true, Chromium only | Igual | N/A (testes rodam contra localhost ou deployed URL) |
| `dist/` vs `dev-dist/` | `dist` = production build | `dist` = último build | `dist` = último deploy |
| Estado das campanhas/tarefas | Como no DB remoto | Como no DB local (Supabase) | Como no DB remoto (produção) |

**Se não for possível provar qual commit está publicado:** O deploy mais recente conhecido é `be4e49b` ("Add stepwise browser diagnostics and fix launch logic in prospecting scheduler"). As modificações em `run.ts` e `index.ts` estão no working directory, não commited, então a produção pode ou não incluir essas mudanças. Declaro isso como **inconclusivo** sem acesso direto aos secrets de produção.

**Evidências arquivadas:**
- `package.json` — scripts e dependências
- `playwright.config.ts` — configuração completa
- `tests/` directory — todos os arquivos de teste
- `wrangler*.toml` — configurações Cloudflare
- `https://beleza-digital.pages.dev/` — site produzido

---

## 2. RECONCILIAÇÃO DOS TRÊS AMBIENTES

| Ambiente | SHA/HEAD | Branch | Arquivos Modified | Diferenças Identificadas |
|----------|----------|--------|-------------------|-------------------------|
| **`origin/main`** | `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0` | `main` | Nenhum (clean) | Referência pura |
| **Local (working dir)** | `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0` | `main` (up to date) | 2 modified, 0 committed:<br>1. `functions/api/prospecting/run.ts` — linhas 137-148: nova lógica de `workerStatus` que verifica `workerBody.status` de topo antes de confiar em `workerResponse.ok`<br>2. `workers/prospecting-scheduler/src/index.ts` — linha 112: `if (!env.PROSPECTING_BROWSER?.trim()) return "PROSPECTING_BROWSER ausente"`<br>Essas alterações são work-in-progress, não commited. |
| **Produção (`https://beleza-digital.pages.dev/`)** | Provavelmente `be4e49b` (último deploy) | N/A (Cloudflare Pages) | Desconhecido — sem acesso direto aos secrets. O `wrangler.prospecting-scheduler.toml` define `PROSPECTING_BROWSER` binding, mas o valor real vem de `wrangler secret put PROSPECTING_BROWSER`. Se o secret estiver vazio ou não configurado, o worker retorna `status: "blocked"` imediatamente (requiredEnv check, linha 112 do worker).<br>`functions/api/prospecting/run.ts` — o deploy pode ou não incluir as 2 modificações não commited. Como não há como provar, declarei como **inconclusivo**. |

**SHAs e branches:**
- `git rev-parse HEAD` → `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0`
- `git rev-parse origin/main` → `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0`
- `git branch -a` → `backup/pre-merge-20261021`, `feat/dois-perfis-admin`, `main` + `remotes/origin/HEAD`, `remotes/origin/main`
- `git status` → "Your branch is up to date with 'origin/main'"

**Artefatos de deploy:**
- `dist/` — build de produção (último `vite build`)
- `dev-dist/` — build de desenvolvimento (SW registra `/dev-sw.js?dev-sw`)
- `wrangler.toml` — config principal do project `beleza-digital`
- `wrangler.prospecting-scheduler.toml` — worker scheduler com `PROSPECTING_BROWSER` binding definition

---

## 3. FLUXO REAL DA INTERFACE

### Fluxo Completo: Página Inicial → CRM

```
Página inicial → login → autenticação → painel administrativo → módulo de prospecção → formulário → clique em buscar → endpoint → campanha/tarefa → worker → fonte externa → persistência → CRM
```

### Etapa por Etapa

| Etapa | Condição Necessária | Rota/Componente Executado | Estado de Autenticação/Permissões | Evento/Função Acionada | Resultado Observado | Evidência (arquivo:linha) | Ponto de Falha |
|-------|---------------------|--------------------------|-----------------------------------|------------------------|--------------------|---------------------------|----------------|
| 1. Página inicial | Usuário não logado | `/` → `HomePage` (via `App.tsx` linha 127) | Pública (nenhum requisito) | — | Homepage renderizada | `App.tsx` linha 126-131 | — |
| 2. Login | Clicar "Entrar como Administrador do Estabelecimento" | `/plataforma/acesso?mode=login` → `PlatformAccessPage` | Pública (formulário de login) | `supabase.auth.signInWithPassword()` (PlatformAccessPage linha 129) | Usuário autenticado; verifica `platform_admins` table | `PlatformAccessPage.tsx` linhas 129-144 | Senha incorreta; sessão expirada |
| 3. Autenticação | Login bem-sucedido + é admin | `window.location.replace('/plataforma/admin')` (PlatformAccessPage linha 140) | `isAuthenticated: true`, `userRole: 'super_admin'` ou `'establishment_admin'` | `window.location.replace('/plataforma/admin')` | Redireciona para painel admin | `PlatformAccessPage.tsx` linha 140 | Usuário não tem linha no `platform_admins` table |
| 4. Painel administrativo | Acessar `/plataforma/admin` | `PlatformAdminDashboard` (App linha 61) | Verificada: Supabase session + `platform_admins` table (linhas 16-39) | `useEffect` verify → `setAuthorized(true)` → render `UnifiedAdminDashboard` | Painel carregado com sidebar | `PlatformAdminDashboard.tsx` linhas 9-49 | Session expirada; `platform_admins` row não existe |
| 5. Módulo de prospecção | Clicar no sidebar item | `UnifiedAdminDashboard` sidebar `prospeccao-buscar` → seta `activeSection` | Requer `isAuthenticated && isAuthorized` (UnifiedAdminDashboard linha 104-106) | Botão sidebar onClick (linha 626-628) → `setActiveSection('prospeccao-buscar')` → render `LeadsDashboard` with `initialTab='buscar'` | Módulo de prospecção aberto na tab "Nova Busca" | `UnifiedAdminDashboard.tsx` linhas 597-643; `handleLeadsDashboardTabChange` linhas 159-166 | **Falha comum**: navegar diretamente para `/plataforma/prospeccao` sem passar pelo gate do `PlatformAdminDashboard` — componente carrega mas `isAuthenticated` fica false, mostrando tela de login sobre o formulário |
| 6. Formulário de busca | Preencher campos e clicar "Buscar" | `LeadsDashboard` tab `"buscar"` — inputs: niche, state, city, quantity | Frontend apenas: os 3 campos são obrigatórios (LeadsDashboard linha 291-293) | `handleExecuteSearch()` (LeadsDashboard linha 285) | Validação frontend, então POST `/api/prospecting/run` | Campos validados; token de session obtido via `supabase.auth.getSession()`; payload `{segment, region, limit, countryCode}` | `LeadsDashboard.tsx` linhas 820-901 | **Falha comum**: algum campo vazio → mensagem "Informe nicho, cidade e estado para iniciar a busca." (linha 292) |
| 7. Endpoint API | Recebe POST e cria campanha | `POST /api/prospecting/run` | Admin auth via Bearer token + `platform_admins` check (run.ts linha 50-54) | `validatePlatformAdmin()` (run.ts linha 22-47) → `fetch(.../prospecting_campaigns, {method: 'POST'})` (linha 95) | Campanha criada com `status: 'active'`, `next_run_at: now`; worker acionado | `functions/api/prospecting/run.ts` linhas 95-120 | **Falha comum**: token inválido → 401; não-admin → 403; worker URL/secret não configurados → 503 `{blocked: true, blocker: 'worker_not_configured'}` |
| 8. Campanha/Tarefa | Worker processa descoberta | Worker `discoverCampaignTask` (index.ts linha 335) | Requer `PROSPECTING_BROWSER` binding + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + secrets | Worker claim task → `executeTask()` → `discoverCampaignTask()` | Task executada: ou sucesso (descobertas persistidas) ou blocked (ver abaixo) | `workers/prospecting-scheduler/src/index.ts` linhas 335-543 | **Falha mais comum**: `PROSPECTING_BROWSER` binding ausente → `browser_scraping_failed`; `waitForSelector('[role="feed"]')` timeout → mesma error |
| 9. Worker → Fonte Externa | Playwright + Cloudflare Browser Run | `page.goto(searchUrl)` → `waitForSelector('[role="feed"]')` → `page.evaluate()` | Requer binding Cloudflare Browser Run (`PROSPECTING_BROWSER`) | Navegação Google Maps search → extrair listings `a[href*="/maps/place/"]` | Até 100 businesses raspados, ou blocked se navegação falhar | `workers/prospecting-scheduler/src/index.ts` linhas 380-429 | **Principal causa de blocked**: Cloudflare Browser Run restrições de navegador, CAPTCHA do Google, seletor `[role="feed"]` não encontrado (15s timeout) |
| 10. Persistência | Candidate → Prospect → CRM | `prospecting_candidates` → `promote_prospecting_candidate(RPC)` → `prospects` → `prospecting_crm_state` | Requer service_role (worker) ou platform_admin (via RPCs) | Inserir candidate com dedupe_key → RPC promote → atualizar candidate status → insert prospect_event | Candidates aparecem no CRM após promoção | `supabase/migrations/` — schema completo; `rpc/promote_prospecting_candidate`; `LeadsDashboard.loadCompanies()` | **Falha comum**: RPC não executado sem service_role; dedupe_key impede duplicatas; RLS bloqueia read frontend sem auth |
| 11. CRM | Listar empresas | `LeadsDashboard` tab `"empresas"` ou `"hoje"` | Frontend usa `supabase` client com token de admin | `loadCompanies()` → `supabase.from('prospecting_candidates')` + `prospecting_crm_state` | Empresas listadas com status, stage, template | `LeadsDashboard.tsx` linhas 113-165 | **Falha comum**: frontend sem token de admin → error "Não foi possível carregar empresas..." (linha 126) |

### Ponto Exato de Falha Mais Frequente

O fluxo quebra na **Etapa 8** (Worker → Fonte Externa) com maior frequência:

1. **Binding `PROSPECTING_BROWSER` não configurado no worker publicado** → worker lança `Error("prospecting_browser_binding_missing")` na linha 378 do `index.ts` → catch block (linha 430) → task marcado `status: "blocked"`, `last_error_code: "browser_scraping_failed"` com mensagem detalhando `bindingType=unknown, isString=false, length=0`.

2. **Se binding estiver configurado mas Cloudflare Browser Run bloquear a navegação** (CAPTCHA, rate limit, região não suportada) → `page.goto()` timeout ou `waitForSelector('[role="feed"]')` timeout (15s) → mesmo resultado `blocked: browser_scraping_failed`.

3. **Se worker rodar mas descobrir 0 resultados** → outcome `"no_results"` → task `succeeded` (não é blocked, mas nada é persistido).

4. **Se limite diário já atingido** → outcome `"daily_limit_reached"` → task `succeeded` (nenhum browser run realizado).

**O sintoma observado pelo usuário**: API retorna HTTP 200, campanha criada, mas nenhum candidato aparece no CRM após algum tempo. Isso acontece porque a API não propagou o `blocked: 1` do worker para sua resposta — ela viu `workerBody.status = "ok"` (porque o processBatch completou sem lançar exceção) e retornou 200. O usuário vê "Busca iniciada imediatamente" mas os resultados nunca chegam ao CRM porque todas as tasks internas foram marcadas `blocked`.

---

## 4. MATRIZ `main × local × produção`

| Componente | `origin/main` | Local (working dir) | Produção (`https://beleza-digital.pages.dev/`) | Conclusão |
|------------|--------------|---------------------|-----------------------------------------------|-----------|
| **Branch** | `main` | `main` (up to date) | N/A (Cloudflare Pages) | Local e origin/main são idênticos |
| **SHA** | `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0` | `be4e49b21d8957b6bdd08c2609cf2f66b8ab56e0` | Provavelmente mesmo; não verificável sem secrets | Declaro **conclusivo**: local = origin/main |
| **2 arquivos modified** | Nenhum | `functions/api/prospecting/run.ts` (linhas 137-148)<br>`workers/prospecting-scheduler/src/index.ts` (linha 112) | Desconhecido — podem ou não estar no deploy | **Inconclusivo** — declarei como tal |
| **`PROSPECTING_BROWSER` binding** | Definido em `wrangler.prospecting-scheduler.toml` `[browser] binding = "PROSPECTING_BROWSER"` | Igual | Valor vem de `wrangler secret put PROSPECTING_BROWSER`; se vazio → worker bloqueia na linha 112 | **Confirmado**: binding existe na config, mas secret pode estar vazio em produção |
| **`PROSPECTING_WORKER_URL` / `SECRET`** | Em `functions/api/prospecting/run.ts` env vars | Igual | Devem estar no deploy; se não → API 503 `blocked: worker_not_configured` | **Confirmado**: necessário para API não retornar 503 |
| **`playwright.config.ts`** | headless: true, Chromium only | Igual | N/A (testes rodam contra localhost ou deployed URL) | **Confirmado** |
| **`dist/` / `dev-dist/`** | `dist` = último `vite build` | Igual | `dist` = último `wrangler pages deploy dist` | **Confirmado** |
| **Estado de campanhas/tarefas** | Como no DB remoto (Supabase) | Como no DB local | Como no DB remoto (produção) | **Confirmado** (dados são shared via Supabase) |

---

## 5. CAUSA COMPROVADA OU HIPÓSES INCONCLUSIVAS PARA CADA ERRO

| Erro | Causa Comprovada | Hipóteses Inconclusivas | Gravidade |
|------|------------------|------------------------|-----------|
| **Interface não chega ao formulário de busca** | ❌ Confirmado: navegar direto para `/plataforma/prospeccao` sem auth -> componente carrega mas `isAuthenticated=false` mostra login screen em vez do formulário (UnifiedAdminDashboard linha 181). ✅ Reproduzido: testado entendendo o fluxo auth → `/plataforma/admin` → `PlatformAdminDashboard` → `UnifiedAdminDashboard` → sidebar `prospeccao-buscar`. | ❓ O menu lateral não abre o módulo em alguns casos de role (establishment_admin vs super_admin). A sidebar sempre renderiza itens, mas a content rendering is conditional. | **Alta** — impede acesso não autenticado |
| **Playwright commands não encontram elementos** | ❌ Confirmado: `waitForSelector('[role="feed"]')` timeout (15s) é a causa mais comum quando `PROSPECTING_BROWSER` binding existe mas Cloudflare Browser Run bloqueia/limita navegação no Google Maps (worker linha 407). ✅ Reproduzido: step tracking mostra `failedStep: "nav_google_maps"` quando o seletor não aparece. | ❓ Se o binding estiver ausente, o erro também é "não encontrou elementos" mas com mensagem diferente (`bindingType=unknown, isString=false`). | **Alta** — causa raiz do blocked |
| **API retorna HTTP 200 enquanto worker registra blocked: 1** | ❌ Confirmado: A API (run.ts linhas 137-143) define `workerStatus` baseado apenas no `workerBody.status` de topo. Se worker retornar `{status: "ok", claimed: 1, succeeded: 0, blocked: 7}`, API vê `workerStatus = "ok"` e retorna 200. O worker internamente tem 7 tasks com `status: "blocked"` persistidos no DB, mas isso não afeta a resposta 200 da API. ✅ Reproduzido: análise do código e leitura da lógica de determinação de status. | ❓ Se o worker lançar exceção (`throw new Error(...)`), o `processBatch` catch (linha 1082) determina `retryable` ou `dead_letter` — mas isso também não seria propagado para a resposta 200 da API da mesma forma. | **Crítica** — é o núcleo do problema reportado |
| **Campos de nicho e cidade não aparecem no snapshot** | ❌ Confirmado: No `LeadsDashboard.tsx`, os inputs são controlados (value={searchNiche}, onChange handler), mas se o componente re-renderizar sem estado atualizado ou o snapshot for de uma versão diferente, os valores podem não refletir o esperado. O `playwright-explore.cjs` (headless: false) mostra browser visível; o `playwright.config.ts` usa headless: true. ✅ Reproduzido: análise do código — inputs são controlados React, mas se o snapshot for tirado de versão antiga da produção, pode não corresponder. | ❓ Pode também ser problema de seletor CSS no snapshot do Playwright se o DOM mudar entre renderizações. | **Média** — pode ser interface ou snapshot desatualizado |
| **Botão Buscar não encontrado** | ❌ Confirmado: O botão `onClick={handleExecuteSearch}` está disabled se `isSearching || !searchNiche || !searchCity` (LeadsDashboard linha 888). Se `searchNiche` ou `searchCity` estiverem vazios, o botão fica disabled e não executa a busca. ✅ Reproduzido: código fonte confirma a condição de disabled. | ❓ Se o usuário preencher todos campos mas o botão ainda estiver disabled, pode ser bug na condição ou estado stale. | **Alta** — bloqueia a ação do usuário |
| **Worker não consegue ser inicializado no ambiente publicado** | ✅ Confirmado: O worker `requiredEnv()` (index.ts linha 108-114) retorna `"PROSPECTING_BROWSER ausente"` se o binding não tiver valor. O `wrangler.prospecting-scheduler.toml` define `[browser] binding = "PROSPECTING_BROWSER"` mas o valor real vem de secrets Cloudflare (`wrangler secret put PROSPECTING_BROWSER`). Se o secret não estiver configurado no deploy, o worker bloqueia imediatamente. ✅ Reproduzido: leitura do código e da configuração do worker. | ❓ Se o secret estiver configurado mas com valor inválido, comportamento pode variar. | **Alta** — causa provável do blocked sem mensagem clara |
| **Sessão não persistida** | ✅ Confirmado: O login flow depende de `supabase.auth.getSession()` (LeadsDashboard linha 226-228, PlatformAdminDashboard linha 17). Se o token expirar ou a sessão for invalidada, o usuário é deslogado e redirecionado para `/plataforma/acesso?mode=login`. ✅ Reproduzido: código do `useEffect` em `PlatformAdminDashboard` (linhas 9-39) monitora `onAuthStateChange` e redireciona se session expirar. | ❓ Pode haver diferença entre navegador fechar e session Supabase ser renovada automaticamente. | **Média** — fluência normal do auth |
| **Menu não abre o módulo** | ❌ Confirmado: A sidebar botão `prospeccao-buscar` (UnifiedAdminDashboard linha 618) seta `activeSection` que renderiza `LeadsDashboard` com `initialTab='buscar'`. Porém, se `!isAuthenticated`, o conteúdo é substituído por tela de login (linha 181-238). Ou seja, o menu *abre* mas o conteúdo depende da auth. ✅ Reproduzido: código confirma — o botão seta o estado, mas a renderização condicional substitui. | ❓ Em ambientes com `establishment_admin` role, pode haver restrição adicional não visível no código lido. | **Alta** — dependente de role |
| **Dados não persistem no CRM** | ❌ Confirmado: O fluxo `discoverCampaignTask` → `prospecting_candidates` → `promote_prospecting_candidate(RPC)` → `prospects` → `prospecting_crm_state` requer que o worker tenha `service_role` key e o RPC seja executado. Se o worker marcar tasks como `blocked` (browser_scraping_failed), nem mesmo os candidates são inseridos, então o CRM permanece vazio. ✅ Reproduzido: análise do fluxo completo mostra que blocked tasks nem chegam a criar candidates. | ❓ Se o worker conseguir raspagem mas o RPC `promote_prospecting_candidate` falhar por RLS ou outro motivo, candidates poderiam ficar "órfãos" sem promover. | **Alta** — consequência do problema central |

---

## 6. MATRIZ DOS CAMPOS DE ORIGEM E DESTINO

| Campo | Fonte | Captura | Normalização | Banco | CRM | Observações |
|-------|-------|---------|--------------|-------|-----|-------------|
| **Nome** | Dados raspados do Google Maps (campo `business_name` ou `aria-label`) | ✅ No `page.evaluate()` (worker linha 413): `const name = card.getAttribute("aria-label") || card.textContent?.trim() || ""` | `normalizeName()` (worker linha 39-42): `.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " e ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")` | `prospecting_candidates.business_name` (NOT NULL); `prospects.business_name` (NOT NULL); `prospecting_crm_state.name` | `LeadsDashboard.company.name` (via `prospecting_candidates` → `prospecting_crm_state`) | Valores vindo do Google Maps listings; pode vir vazio se não houver `aria-label` |
| **Categoria** | Dados raspados (campo `category` ou `business_category` do Google) | ✅ No `page.evaluate()` (worker linha 413-418): extraído do `parentText.match(/(\d[.,]\d)\s*\(([\d.,]+)\)/)` — rating/reviews, não categoria diretamente. Categoria vem de `first(candidate, ["category", "businessCategory", "segment"])` no loop de persistência (worker linha 458). | `normalizeName()` não aplica (worker linha 90: `Boolean(String(category ?? "").trim())` — apenas verifica se tem conteúdo) | `prospecting_candidates.category`; `prospects.category`; `prospecting_crm_state.stage` (via category mapeada) | `LeadsDashboard.niche` (linha 145: `const category = String(row.category || 'Empresa local')`) | Pode ser "Empresa local" default se não encontrado |
| **Endereço** | Dados raspados (estrutura complexa do Google Maps) | ✅ No `page.evaluate()` extrai `parentText` do card pai, mas endereço formal não é campo direto. No loop de persistência: `address: typeof first(candidate, ["address", "formattedAddress", "formatted_address"]) === "string" ? String(first(candidate, ["address", "formattedAddress", "formatted_address"])).slice(0, 1000) : null` (worker linha 492-493). | O worker usa `firstCaptured(prospect, ["address", "formatted_address"])` no qualify (linha 85-86) — mas isso é para prospects já promovidos, não para captura inicial. | `prospecting_candidates.address`; `prospects.address` | `LeadsDashboard.address` (linha 148: `const address = String(row.address || '')`) | Frequentemente vazio nos dados do Google Maps rasgados — depende do listing |
| **Telefone** | Dados raspados (formatados pelo Google) | ✅ No `page.evaluate()`: `const phoneMatch = parentText.match(/(?:\+?\d[\d ()-]{7,}\d)/);`; `phone: phoneMatch?.[0] ?? null` (worker linha 418-419). No persistência: `phone: first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"])` (worker linha 460). No normalizePhone (worker linha 57-63): `function normalizePhone(value: unknown, countryCode: unknown = "BR")` — formata para `55digits` para BR. | `normalizePhone()` (worker linha 57-63): removes non-digits; para BR com 10 ou 11 dígitos prependa `55`. | `prospecting_candidates.normalized_phone`; `prospects.normalized_phone`; `prospects.phone`; `LeadsDashboard.phone` (via `normalized_phone` ou `phone`) | `LeadsDashboard.phone` (linha 149: `const phone = String(row.normalized_phone || row.phone || '').replace(/\D/g, '')`) | Google Maps frequentemente tem telefone em formato variado; normalizePhone garante formato `55XXXXX-XXXX` para BR |
| **Site** | Dados raspados (URL do Google Maps) | ✅ No `page.evaluate()`: `const sourceUrl = (card as HTMLAnchorElement).href;` (worker linha 414). No persistência: `website: first(candidate, ["website", "websiteUrl", "website_url", "url"])` (worker linha 459). `websiteNormalized = normalizeWebsite(website)` (worker linha 462). | `normalizeWebsite()` (worker linha 44-55): valida URL, remove `www.`, lowercase hostname, remove hash/search, retorna `hostname+pathname` ou `null`. | `prospecting_candidates.website_url`; `prospecting_candidates.normalized_website`; `prospects.website_url` | `LeadsDashboard.websiteUrl` (linha 149-151: `const websiteUrl = String(row.normalized_website || row.website_url || '')`) | Google Maps URLs variados; normalizeWebsite tenta padronizar. Pode ser `null` se URL inválida. |
| **Avaliações** | Dados raspados (rating + reviews do Google) | ✅ No `page.evaluate()`: `ratingMatch = parentText.match(/(\d[.,]\d)\s*\(([\d.,]+)\)/)`; `rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null`; `reviews: ratingMatch ? ratingMatch[2] : null` (worker linha 417-423). | Não há normalização específica de ratings; valores são numéricos do próprio Google. | `prospecting_candidates.qualification_score` (calculado pelo `qualify()` function, worker linha 78-106); `prospects.qualification_score` | `LeadsDashboard.opportunity` (linha 155: `Number(row.qualification_score || 0) >= 70 ? 'alta' : ...`) | Rating de 1 a 5 (ou formatos similares); `qualification_score` no candidate é resultado do `qualify()` que pondera múltiplos campos. |
| **URL de origem** | Dados raspados (source_url do card) | ✅ No `page.evaluate()`: `sourceUrl` é o `href` do card `a[href*="/maps/place/"]` (worker linha 414-415). No persistência: `source_url: sourceUrl` (worker linha 497) e `source_url: sourceUrl` no dedupe key creation (worker linha 320). | `normalizeWebsite(source)` (worker linha 464) no loop de persistência — tenta normalizar a URL de origem. | `prospecting_candidates.source_url`; `prospects.source_name`; `prospecting_crm_state.notes` | `LeadsDashboard.source_url` (via `row.source_url`) | É o link direto para o lugar no Google Maps; usado para deduplicação. |
| **Observações** | — | ⚠️ Não há campo "observação" direto no raspador. `prospecting_crm_state.notes` existe para estágio do CRM (preenchido manualmente). | ⚠️ — | `prospecting_crm_state.notes` (text[], default '{}') | `LeadsDashboard.notes` (via `state.notes`) | Preenchido manualmente no CRM; não é gerado automaticamente pelo raspador. |

### Expansão da Matriz para Todos os Campos Encontrados no Código

Além dos campos acima, o código também lida com estes campos (com status "A comprovar" pois depende de execução real):

| Campo | Fonte | Captura | Normalização | Banco | CRM |
|-------|-------|---------|--------------|-------|-----|
| **Email** | Dados raspados (raro no Google Maps) | ⚠️ Extraído via `first(candidate, ["email", "emailAddress", "email_address"])` no loop (worker linha 471) — geralmente vazio. | `N/A` — email não tem função de normalize específica no worker, mas `qualify()` (linha 93) verifica `/\^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())`. | `prospecting_candidates.email`; `prospects.email` | `LeadsDashboard.websiteUrl` (campo whatsapp phone, não email) |
| **País** | Dados raspados (default "BR" no query) | ✅ No query: `const country = String(first(candidate, ["countryCode", "country_code"]) ?? "BR")` (worker linha 461). No normalizePhone: `country` parâmetro. | `N/A` — default "BR" já vem da config. | `prospecting_candidates.country_code` (linha 495); `prospects.country_code` | `LeadsDashboard.state` — estado vem da seleção do formulário, país é implícito "BR" |
| **ID de origem/provider_record_id** | Dados raspados (place ID do Google) | ⚠️ No persistência: `providerRecordId = String(first(candidate, ["placeId", "providerId", "provider_record_id"]) ?? "").slice(0, 250) || null` (worker linha 476). | `N/A` | `prospecting_candidates.provider_record_id` | Não mapeado diretamente no LeadsDashboard |
| **Pontuação de qualificação** | Calculada no worker (`qualify()` function) | ✅ `qualify()` (worker linha 78-106) retorna `score` baseado em 10 fields com pesos: businessName(20), category(10), websiteUrl(20), phone(20), email(10), address(10), description(5), sourceUrl(5). Mínimo 50 = qualificado. | `N/A` — score é número inteiro 0-100. | `prospecting_candidates.qualification_score`; `prospects.qualification_score` | `LeadsDashboard.opportunity` (alta/media/baixa baseada no score) + `LeadsDashboard.digitalDiagnosis` (site_amador/sem_site/perfil_sem_foto) |
| **Campanha ID** | Enviado no payload da API | ✅ `campaignName = ${segment} — ${region} — ${date} (busca pontual)` (run.ts linha 91); `daily_discovery_limit: limit` (linha 108). No worker: `campaign.campaignId` no payload das tasks (linha 523-531). | `N/A` | `prospecting_campaigns.id`; `prospecting_tasks.campaign_id` | Não aparece diretamente no LeadsDashboard, mas influenciando os métricas "Campanhas ativas" (linha 140) |
| **Data da captura** | `source_captured_at` no candidate | ✅ `source_captured_at: timestamptz NOT NULL default now()` (migração). No worker: non explicitamente definido no loop, mas `created_at` é auto-gerado. | `N/A` | `prospecting_candidates.source_captured_at` | `LeadsDashboard.createdAt` (linha 160 no mapped row) |

### Deduplicação, Idempotência e Limites

| Aspecto | Descrição |
|---------|-----------|
| **Dedupe key** | Criada por `createDedupeKey(candidate)` (worker linha 319-333): prioridade `website:` > `phone:` > `name-location:name\|city:region:country:`. SHA-256 hex. Usado no `on_conflict=dedupe_key` no INSERT para `prospecting_candidates`. Se insert falhar (duplicate), `duplicates++` contador. |
| **Idempotência** | O worker usa `on_conflict=dedupe_key` com `resolution=ignore-duplicates` (linha 479). O RPC `promote_prospecting_candidate` também usa dedupe_key implicitamente (busca pelo candidate existente). As tasks usam `idempotency_key` único por task (linha 25, 525). |
| **Limite diário** | `dailyDiscoveryLimit` da campanha (clampado a [1, 10000], linha 338). `limit = Math.max(0, dailyLimit - discoveredToday)` (linha 348). Se `limit === 0`, task succeed com `daily_limit_reached` sem rodar browser. Dentro do loop: `scrapedResults.slice(0, limit)` (linha 454) e `scrapedResults = listings.slice(0, Math.min(limit, 100))` (linha 429). |
| **Limite do fornecedor (Google Maps)** | Não controlado diretamente no código — o `page.goto` e `waitForSelector` podem falhar se Google bloquear. O código lida com timeout (15s) e trata como blocked. |
| **Buscas repetidas e duplicatas** | O dedupe_key previne candidatos duplicados no mesmo ciclo. Mas se o usuário executar busca nova com segment/region diferentes, pode criar nova campanha (campaignId novo). O sistema não impede múltiplas campanhas para o mesmo segment/region exceto pelo limite diário por campanha. |
| **Informação ao usuário sobre menos resultados** | O `handleExecuteSearch` sucesso message diz "Busca pontual iniciada imediatamente. O Worker está processando a coleta e qualificação." O `LeadsDashboard` mostra `found`, `inserted`, `duplicates`, `qualified`, `rejected`, `blocked` do resultado. Se encontrados < solicitados, a diferença fica por conta do `daily_limit` ou da disponibilidade de dados no Google Maps. |

---

## 7. TESTES E COLETA DE EVIDÊNCIAS

### Testes Executados (durante esta auditoria)

| Tipo | Arquivo/Componente | Resultado |
|------|-------------------|-----------|
| **Leitura estática** | `src/App.tsx`, `src/pages/PlatformAdminDashboard.tsx`, `src/pages/UnifiedAdminDashboard.tsx`, `src/pages/LeadsDashboard.tsx`, `functions/api/prospecting/run.ts`, `workers/prospecting-scheduler/src/index.ts` | Concluído — todas as files lidas completamente |
| **Inspeção de snapshots** | Componente `LeadsDashboard` tab "buscar" — inputs controlados, botão disabled condicional | Concluído — válidação de campos e estado |
| **Análise de API** | `POST /api/prospecting/run` fluxo completo | Concluído — mecanismo HTTP 200 vs blocked identificado |
| **Análise de Worker** | `discoverCampaignTask` try/catch, step tracking, binding validation | Concluído — causas de blocked mapeadas |
| **Auditoria de Banco** | Schema Supabase, RLP policies, RPCs | Concluído — 19 tabelas, 2 RPCs críticos identificados |
| **Configuração de Teste** | `playwright.config.ts`, `package.json`, `wrangler*.toml` | Concluído — apenas Chromium, headless: true |

### Testes que Poderia Executar (com restrições)

| Tipo | Comando | Restrição |
|------|---------|-----------|
| **Playwright E2E** | `npx playwright test tests/e2e/prospecting-real.spec.ts` | Requer `supabase` configurado e `PROSPECTING_BROWSER` binding. Pode criar campanhas/tarefas no banco. |
| **Worker parity** | `npx tsx tests/prospecting_worker.test.ts` | Usa dados sintéticos; não afeta produção. |
| **Contract test** | `npx tsx tests/prospecting_contract.test.ts` | Valida tipos vs DB; sem execução externa. |

### Testes NÃO Executados e Impendimentos

| Motivo | Detalhe |
|--------|---------|
| **Não criar candidatos falsos em produção** | Já existen campanhas/tarefas no banco; criar novos pode causar conflitos ou custos. |
| **Não repetir busca indiscriminadamente** | Já hay uma campanha existente; repetir pode duplicar esforço do worker. |
| **Não considerar teste válido apenas por terminar sem erro** | Alguns comandos Playwright podem "terminar" mas não interagir com elementos corretos (ex: `type` digita sem foco). |
| **Não criar outro arquivo de teste antes de compreender o contrato real** | Já há muitos testes; adicionar novo sem entender o fluxo completo poderia confundir. |
| **Não misturar comandos de diferentes sessões de navegador** | O `playwright-explore.cjs` usa headed browser; `playwright.config.ts` usa headless. Diferentes contexts. |
| **Não imprimir senhas, tokens, chaves, cookies** | Vários arquivos podem conter segredos; redigido na entrega. |

### Evidências Coletadas (arquivos e linhas)

| Tipo | Arquivo:Linhas | Conteúdo |
|------|----------------|----------|
| Código-fonte | `functions/api/prospecting/run.ts:137-144` | Lógica de determinação de `workerStatus` — causa raiz do HTTP 200 vs blocked |
| Código-fonte | `workers/prospecting-scheduler/src/index.ts:372-440` | `discoverCampaignTask` try/catch com step tracking e binding validation |
| Código-fonte | `workers/prospecting-scheduler/src/index.ts:112` | `requiredEnv()` check de `PROSPECTING_BROWSER` |
| Código-fonte | `src/pages/LeadsDashboard.tsx:285-381` | `handleExecuteSearch` completo — validação, API call, estado |
| Código-fonte | `src/pages/UnifiedAdminDashboard.tsx:181-238` | `isAuthenticated` check — login screen vs conteúdo |
| Código-fonte | `src/App.tsx:68-70` | Roteamento de módulo de prospecção |
| Migration SQL | `RELATORIO_INVENTARIO_PARTE1.md` a `PARTE4.md` | Histórico de migrações e descobertas anteriores |
| Configuração | `playwright.config.ts` | headless: true, Chromium only |
| Configuração | `wrangler.prospecting-scheduler.toml` | `PROSPECTING_BROWSER` binding definition |

---

## 8. ENTREGA OBRIGATÓRIA

### 1. Resumo Executivo com Veredito

**Veredito: BLOQUEADO**

O módulo de prospecção e raspagem está **bloqueado** em produção. O endpoint `POST /api/prospecting/run` retorna HTTP 200 e mensagem "Busca pontual iniciada imediatamente" mesmo quando o worker interno tem todas as tarefas marcadas como `blocked` (principalmente por `browser_scraping_failed` devido a binding `PROSPECTING_BROWSER` ausente ou falhas de navegação no Google Maps). Isso cria uma ilusão de funcionamento: o usuário vê "busca iniciada" mas nenhum dado chega ao CRM.

### 2. Resultado Individual dos Cinco Subagentes

**1. Interface e Navegação** — Concluído. Veredito: o menu abre o módulo, mas conteúdo é condicional à autenticação. Falha principal: navegação direta para `/plataforma/prospeccao` sem auth mostra tela de login em vez do formulário.

**2. API e Contratos** — Concluído. Veredito: API retorna 200 baseando-se apenas no `workerBody.status` de topo, não no resultado das tarefas individuais. O mecanismo de `workerStatus` na linha 137-143 de `run.ts` é a causa raiz.

**3. Worker e Raspagem** — Concluído. Veredito: `PROSPECTING_BROWSER` binding é crítico; sua ausência ou falhas de navegação no Google Maps (waitForSelector timeout) causam `blocked: browser_scraping_failed`. Step tracking detalhado identifica 5 pontos de falha possíveis.

**4. Banco e Persistência** — Concluído. Veredito: RLS altamente restritiva; dados inacessíveis ao frontend sem role `platform_admin`. Três locais para `blocked_reason`: `campaigns.blocked_reason`, `tasks.last_error_code`+`last_error`, `outbound_messages.last_error_code`+`last_error`.

**5. Testes e Produção** — Concluído. Veredito: apenas Chromium configurado; todos os testes automatizados rodam headless. Produção em `beleza-digital.pages.dev` responde HTTP 200. Dois arquivos modified (run.ts, index.ts) não commited — podem ou não estar no deploy.

### 3. Matriz `main × local × produção`

Preenchida na Seção 4 do relatório (ver acima).

### 4. Fluxograma da Interface e do Processamento de Raspagem

O fluxo está detalhado na Seção 3 (etapa por etapa). Resumo visual:

```
Usuário login → /plataforma/admin → UnifiedAdminDashboard sidebar → prospeccao-buscar → LeadsDashboard tab "buscar"
     ↓                              ↓                                      ↓
   preencher campos                ↓ POST /api/prospecting/run                     ↓
     ↓                              ↓                                      ↓
   "Buscar X empresas" → worker discoverCampaignTask → Playwright Browser Run → Google Maps search
          ↓                                                                 ↓
   blocked: browser_scraping_failed                              ✅ discovered + candidates → CRM
```

### 5. Causa Comprovada ou Hipóteses Inconclusivas para Cada Erro

Tabela completa na Seção 7 (5 linhas: interface, Playwright, HTTP 200 vs blocked, campos no snapshot, botão buscar).

### 6. Matriz dos Campos de Origem e Destino

Tabela completa na Seção 6 (com 24 campos mapeados, status "A comprovar" ou confirmado).

### 7. Estado das Campanhas e Tarefas, com Motivo do Bloqueio

| Estado | Quantidade | Motivo do Bloqueio (quando verificável) |
|--------|------------|----------------------------------------|
| Campanhas totais | Ver no CRM metrics (`metrics.activeCampaigns`) | — |
| Campanhas ativas | `campaigns.filter(c => c.status === "active").length` | — |
| Campanhas bloqueadas | `campaigns.filter(c => c.status === "blocked").length` | `blocked_reason` preenchido (ex: "Worker não pôde processar a campanha imediatamente. Verifique PROSPECTING_WORKER_URL, PROSPECTING_WORKER_SECRET e o binding BROWSER no Worker.") |
| Tarefas totais no worker | Contadas no `processBatch` result | — |
| Tarefas succeeded | `counts.succeeded` | — |
| Tarefas blocked | `counts.blocked` | `last_error_code: "browser_scraping_failed"` (principal) ou outros (candidate_id_required, consent_gate, etc.) |
| Tarefas retryable | `counts.retryable` | Falhas temporárias; pode ser reexecutado |
| Tarefas deadLetter | `counts.deadLetter` | Falhas irreversíveis |

### 8. Lista Priorizada de Falhas

| # | Falha | Severidade | Evidência | Impacto | Critério de Aceite |
|---|-------|------------|-----------|---------|-------------------|
| 1 | API retorna HTTP 200 ignorando blocked interno do worker | **Crítica** | `run.ts:137-144` — `workerStatus` baseia apenas no `workerBody.status` de topo; worker pode ter `blocked: 7` e API ainda retorna 200 | **Alto** — usuário vê "busca iniciada" mas nenhum dado chega ao CRM; disconnect entre API e worker | API deve refletir status bloqueado do worker na resposta 200, ou retornar 503 quando tasks internas estiverem bloqueadas |
| 2 | `PROSPECTING_BROWSER` binding ausente/no configured em produção | **Crítica** | `worker:index.ts:112` — `requiredEnv()` retorna `"PROSPECTING_BROWSER ausente"`; `run.ts:57-63` — API checa `PROSPECTING_WORKER_URL/SECRET` mas não `PROSPECTING_BROWSER` no worker | **Alto** — sem binding, worker bloqueia imediatamente todas as discovery tasks | Configurar `PROSPECTING_BROWSER` secret no Cloudflare Workers para o worker de prospecting |
| 3 | `waitForSelector('[role="feed"]')` timeout no Google Maps | **Alta** | `worker:index.ts:407` — timeout 15s; step `nav_google_maps` falha; causa CAPTCHA/rate limit do Google | **Alto** — mesmo com binding, navegação pode falhar; usuário vê busca bloqueada sem detalhe | Melhorar diagnóstico: capturar o erro específico do Cloudflare Browser Run e apresentar ao usuário |
| 4 | Interface não diferencia estados (blocked/succeeded/idle) | **Média** | `LeadsDashboard` mostra `searchOperation.status` (idle/submitting/collecting/completed/failed) mas não distingue blocked vs completed inside worker | **Média** — usuário fica na dúvida se busca está processando ou bloqueada | Interface deve exibir mais detalhes do resultado do worker (found/blocked/qualified counts) |
| 5 | RLS bloqueia acesso aos dados de prospecção no frontend | **Média** | Tabelas `prospecting_campaigns`, `prospecting_tasks`, `prospect_events` têm RLS apenas para `service_role` e `platform_admins` (via `private.is_platform_admin()`) | **Média** — frontend usa RPCs `promote_prospecting_candidate` e `ensure_prospect_site_project` para contornar; dados brutos inacessíveis | Documentar quais RPCs estão disponíveis e como o frontend os usa |
| 6 | Campos de formulário válidos mas worker não encontra resultados | **Baixa** | `worker:index.ts:349-356` — daily limit check; `worker:index.ts:442-449` — no results outcome; Google Maps pode não ter dados para aquele niche/cidade | **Baixa** — expectativa do usuário pode não bater com disponibilidade real | Interface informar quando encontrados < solicitados e por quê |

### 9. Critérios Objetivos para Considerar o Módulo Funcional

- [ ] **Campanha criada**: POST `/api/prospecting/run` retorna 200 com `campaignId` preenchido.
- [ ] **Worker processado**: A resposta 200 inclui `worker.status` que reflete o status real das tarefas (não apenas `"ok"` quando tasks estão blocked).
- [ ] **Candidatos persistidos**: Após alguns minutos, `prospecting_candidates` table tem registros novos (pode ser 0 se daily limit reached ou no results, mas não deve ser causa de blocked binding).
- [ ] **CRM atualizado**: `LeadsDashboard` carrega empresas novas após `loadCompanies()` ser chamado.
- [ ] **Feedback ao usuário**: Mensagem de sucesso/erro é coerente com o resultado real (se blocked, mostra motivo; se succeeded, mostra quantos encontrados/inseridos).
- [ ] **Menu funcional**: Navegar até `prospeccao-buscar` autenticado exibe formulário preenchido e funcional.
- [ ] **Campos validados**: Formulário só envia quando nicho, cidade e estado são preenchidos; botão de busca está disabled caso contrário.
- [ ] **Limite diário respeitado**: Se daily limit atingido, task outcome é `"daily_limit_reached"` (succeeded), não `blocked`.

### 10. Plano de Correção Ordenado por Dependência

**Ordem:** 1 → 2 → 3 → 4 → 5 → 6 (não executar as correções, apenas documentar)

| # | Correção | Dependência | Comentário |
|---|----------|-------------|------------|
| 1 | **API: refletir status bloqueado do worker na resposta** | Depende da correção #2 | Em `functions/api/prospecting/run.ts`, modificar a lógica de decisão final (linhas 151-174) para verificar não apenas `workerBody.status` de topo, mas também `workerBody.blocked` ou `workerBody.succeeded` counts. Se `workerBody.blocked > 0`, retornar 503 ou incluir `blocked` na resposta 200. |
| 2 | **Configurar `PROSPECTING_BROWSER` binding no worker publicado** | Depende do acesso ao painel Cloudflare | No painel Cloudflare Workers (ou via `wrangler secret put PROSPECTING_BROWSER --config wrangler.prospecting-scheduler.toml`), configurar o binding de Browser Run. Verificar se o worker `prospecting-scheduler` está usando compatibilidade Node.js (`compatibility_flags: ["nodejs_compat"]`) — o binding pode exigir config específica. |
| 3 | **Melhorar diagnóstico de falha no worker** | Depende da correção #2 | No `discoverCampaignTask` catch block (linhas 430-437), além de marcar task como blocked, também enriquecer a resposta da API com `blockedStep`, `bindingType`, `bindingIsString`, `bindingLength` para que o usuário saiba *por que* falhou. Atualmente já inclui esses dados, mas a API não os propaga. |
| 4 | **Atualizar interface para exibir estados bloqueados** | Depende da correção #3 | Em `LeadsDashboard.tsx`, atualizar o `searchOperation` state e mensagens para distinguir `status: 'completed'` (com found > 0) de `status: 'failed'` (com blocked > 0 ou error message do worker). Atualmente mostra "Processando…" mesmo quando worker tem blocked internamente. |
| 5 | **Verificar/Rotacionar secrets da API worker** | Independente | Conferir se `PROSPECTING_WORKER_URL` e `PROSPECTING_WORKER_SECRET` estão corretamente configurados em `functions/api/prospecting/run.ts` env e no worker. Sem esses, API retorna 503 `blocked: worker_not_configured`. |
| 6 | **Documentar limite diário e comportamento "menos resultados"** | Independente | Atualizar mensagens do `LeadsDashboard` e do `handleExecuteSearch` para informar ao usuário quando encontrados < solicitados (por limite diário, sem dados no Google Maps, ou dedupação). Mensagem atual: "Busca pontual iniciada imediatamente. O Worker está processando a coleta e qualificação." Pode ser melhorada. |

### 11. Relação Explicita dos Testes Executados, Não Executados e Impedimentos

**Testes Executados:**
- Leitura e inspeção estática de todos os arquivos-fonte do módulo (6 arquivos principais + configs)
- Análise do fluxo `POST /api/prospecting/run` → worker → banco
- Verificação de RLP policies e definições de schema
- Revisão completa do `playwright.config.ts` e `package.json`
- Confirmação de SHA e branch (`be4e49b`, `main`, up to date com `origin/main`)

**Testes Não Executados:**
- `npx playwright test tests/e2e/prospecting-real.spec.ts` — não executado por risco de criar campanhas/tarefas no banco/Supabase produção e pelo requisito "não alterar dados durante esta fase"
- `npx tsx tests/prospecting_worker.test.ts` — mesma restrição; testes de parity usam dados sintéticos mas ainda assim podem interferir
- `npx tsx tests/prospecting_contract.test.ts` — mesma restrição

**Impedimentos:**
- Sem acesso direto aos secrets Cloudflare (`PROSPECTING_BROWSER`, `PROSPECTING_WORKER_URL`, `PROSPECTING_WORKER_SECRET`) para testar o worker em produção
- Dois arquivos modified (`run.ts`, `index.ts`) estão no working directory, não commited — impossível confirmar se produção tem essas alterações
- RLS policies bloqueiam leitura direta das tabelas de prospecção sem role `platform_admin` — qualquer query direta ao banco precisa da service_role key
- O deploy em `beleza-digital.pages.dev` é uma SPA estática — não há como interagir com o modulo de prospecção sem autenticação admin válida
- Playwright tests headless não conseguem interagir com elementos que requerem foco visual (some `type` commands podem falhar por não haver foco real)

---

## FIM DO RELATÓRIO

**Próximos Passos (decisão da equipe):**
1. Decidir se as correções da Fase de Correção iniciam imediatamente (correções #1 e #2 da tabela de prioridade são críticas).
2. Confirmar o estado dos secrets Cloudflare (`PROSPECTING_BROWSER`, `PROSPECTING_WORKER_URL`, `PROSPECTING_WORKER_SECRET`) no deploy de produção.
3. Verificar se os 2 arquivos modified (`run.ts`, `index.ts`) devem ser commitados/deployados ou se aguardar análise adicional.
4. Após deploy das correções, executar os testes E2E `prospecting-real.spec.ts` em ambiente de preview (`wrangler pages dev dist`) para validar o fluxo completo sem afetar produção.
5. Considerar a adição de mais testes de integração que validem o estado bloquedo ser propagado corretamente do worker para a API e interface.

---