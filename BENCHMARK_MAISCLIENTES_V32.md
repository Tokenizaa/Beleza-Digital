# Benchmark Técnico — MaisClientes v3.2 × Beleza Digital

**Objetivo:** comparar o motor de scraping e o frontend de coleta do MaisClientes v3.2 (referência) com a implementação atual do Beleza Digital (alvo), sem implementar, alterar código, banco, secrets ou infraestrutura. Toda conclusão aponta a arquivos, funções e evidências.

**Escopo de leitura realizado (evidência coletada):**

MaisClientes v3.2 (`/home/lg/workspace/projects/MaisClientes-v3.2`):
- `src/shared/types.ts` — `PlaceRecord` (~65 campos com `web_intelligence_*`), `ScrapeJob` com `completion_reason`, `cancel_requested`, `heartbeat_at`, `created_at`, `completed_at`, `ScrapeCompletionReason` (6 valores), `EXPORTABLE_FIELDS` (45 campos), `WebIntelligenceRecord`, `WebScoreBreakdown`, `OpportunityRecord`, `OpportunityStage`.
- `src/server/scraper/extractor.ts` — `extractPlaceDetails(page, jobId, targetUrl)` → `PlaceRecord`; expand de horários (`data-item-id="oh"`), seletores semânticos (`data-item-id`, `aria-label`), extração de reviews com scroll (até 80 iterações), galeria de fotos, links sociais, `booking_url`, `plus_code`, `popular_times`, `rating_distribution`, `review_highlights`, `field_status` por campo.
- `src/server/scraper/normalizer.ts` — `cleanText`, `normalizeAddress/Phone/Website/Category/Rating/ReviewCount/PriceRange/BusinessStatus`, `parseAddressComponents`, `parseSearchLocationFallback`, `extractSourcePlaceId` (`!3m6!1s` / `!1s`), `extractCoordinates` (`!3d`/`!4d` ou `@lat,lng`).
- `src/server/scraper/selectors.ts` — `SELECTORS` com feed e place; seletores primários e fallbacks para Google Maps.
- `src/server/scraper/browser.ts` — `connectScraperBrowser(legacyEndpoint?)`; Browserless com retry (2 tentativas, 700ms), timeout 8s, fallback puppeteer local em dev.
- `src/shared/scrape-progress.ts` — `calculateScrapeProgressPercent` (collected/target, 100 se completed/target_reached/feed_exhausted), `isFeedExhaustedJob`.
- `src/server/web-intelligence.ts` — `crawlCompanyWebsite`, `generateWebIntelligence` (Gemini + heurística), `WebIntelligenceRecord` com scores de aderência, maturidade digital, potencial comercial, evidências com `confidence`.

Beleza Digital (`/home/lg/workspace/projects/Beleza-Digital`):
- `workers/prospecting-scheduler/src/index.ts` — Worker completo: `Env`, `ProspectingTask`, tipos `discover/capture/qualify/generate_demo/publish_demo/send_whatsapp/sync_delivery`; `discoverCampaignTask` (Playwright Browser Run, Google Maps, paginação 45 rounds, estagnação 5 rounds); `captureCandidateTask` (`rpc/promote_prospecting_candidate`); `generateDemoTask` (5 templates); `publishDemoTask` (token público); `executeTask` (dispatch); `scheduleDueCampaigns` (apenas avança `next_run_at`, NÃO enfileira `discover`); `processBatch` (`rpc/claim_prospecting_tasks`, at-least-once, max 4 tentativas); handlers `scheduled`/`fetch` (auth via `PROSPECTING_WORKER_SECRET`); funções inline `normalizeName`, `normalizeWebsite`, `normalizePhone`, `qualify`, `createDedupeKey`.
- `workers/prospecting-scheduler/src/extractor.ts` — `extractPlaceDetails(page)` → `ExtractedPlace` (11 campos com `fieldStatus` found/not_found_in_capture); sem extração de reviews, sem paginação de avaliações, sem `plus_code`, `popular_times`, `rating_distribution`, `review_highlights`.
- `workers/prospecting-scheduler/src/normalizer.ts` — `cleanText`, `cleanBusinessName`, `sanitizeRating`, `sanitizeReviewCount`, `sanitizePhotos`, `normalizeAddress/Phone/Website/Category/Rating/ReviewCount/PriceRange/BusinessStatus`, `parseAddressComponents`, `parseSearchLocationFallback`, `extractSourcePlaceId`, `extractCoordinates`.
- `src/server/db.ts` — Supabase client, schema `mapscrape`; `ScrapeJob` reduzido (apenas `created_at`, sem `completion_reason`/`cancel_requested`/`heartbeat_at`/`completed_at`); `PlaceRecord` SEM campos `web_intelligence_*`; `run_reports` (`saveRunReport`/`getRunReport` com gzip).
- `src/server/queue-consumer.ts` — consumer de fila de scrape; valida `jobId` (`^job_[a-zA-Z0-9_-]{8,100}$`); at-least-once, max 4 tentativas.
- `src/pages/ScrapingConsole.tsx` — busca (segmento/cidade/país/limite [5,10,20,30]), executa `/api/prospecting/run`, candidatos com qualificação dupla (cadastral + comercial), cards+tabela, filtro "Alta Oportunidade" (`commercial_score>=70`), `viewMode` cards/table, `runBenchmarkPOA` (5 fichas POA), `startSearch` (`createCampaign: false`).
- `src/pages/ProspectingConsole.tsx` — campanhas (`prospecting_campaigns`), candidatos (`prospecting_candidates`), eventos (`prospect_events`), métricas via `/api/prospecting/overview`, demo links via `/api/prospecting/demo-links`, `runScrape` (`/api/prospecting/run` com `createCampaign: false`), `createDemoLink` (`/api/prospecting/demo-links`).
- `src/pages/LeadsDashboard.tsx` — CRM kanban (`prospecting_candidates` + `prospecting_crm_state`), 5 estágios (`novo/contatado/respondeu/reuniao/fechado`), 5 templates de site (`ouro-classico`, `preto-esmeralda`, `minimal-studio`, `safira-executivo`, `rubi-lounge`), qualificação dupla cadastral+comercial, WhatsApp via `createValidatedWhatsAppUrl`, modal de plano comercial (A/B/C), busca via `/api/prospecting/run` com polling (`/api/prospecting/overview?executionId=...`, até 120 tentativas × 3s).
- `src/lib/prospecting.ts` — `qualifyProspect` (score cadastral 0-100), `qualifyCommercialOpportunity` (score comercial 0-100, nível alta/media/baixa), `createProspectDedupeKey` (SHA-256, prioridade website→phone→name-location), `isEligibleForAutomatedWhatsApp`.
- `src/lib/supabase.ts` — cliente Supabase (Vite/Node), `isSupabaseConfigured`.

---

## 1. Arquitetura de coleta do MaisClientes v3.2

O MaisClientes adota uma arquitetura de scraper orquestrado em três camadas: **navegador remoto (Browserless/Puppeteer)**, **extração DOM semântica** e **inteligência web pós-coleta (site institucional + Gemini)**.

- **Camada de navegador** — `src/server/scraper/browser.ts:32` (`connectScraperBrowser`): conecta ao Browserless via `BROWSERLESS_TOKEN`/`BROWSER_WS_ENDPOINT` com retry de 2 tentativas (700ms de intervalo) e timeout de 8s (`CONNECT_TIMEOUT_MS`). Em produção (`VERCEL === '1'` ou `NODE_ENV === 'production'`) o browser remoto é obrigatório; em dev há fallback para Puppeteer local headless com `--lang=pt-BR,pt`.
- **Camada de extração** — `src/server/scraper/extractor.ts:14` (`extractPlaceDetails(page, jobId, targetUrl)`): expande o painel de horários (`data-item-id="oh"`) antes de ler o DOM; usa seletores semânticos (`data-item-id`, `aria-label`) com fallbacks CSS; captura nome, categoria, avaliação, contagem de avaliações, endereço, telefone, website, faixa de preço, status, descrição, serviços, fotos, vídeos, logo, links sociais, `booking_url`, `plus_code`, `popular_times`, `rating_distribution`, `review_highlights`, `next_opening_text/day/time`, `visible_photos_count`. Reviews são coletados com scroll do painel de avaliações (até 80 iterações, estagnação após 8 rodadas sem novos registros). Coordenadas e `source_place_id` são extraídos da URL (`!3d`/`!4d`, `@lat,lng`, `!3m6!1s`).
- **Camada de normalização** — `src/server/scraper/normalizer.ts`: `cleanText`, `normalizeAddress/Phone/Website/Category/Rating/ReviewCount/PriceRange/BusinessStatus`, `parseAddressComponents` (CEP, país, cidade, estado, bairro), `parseSearchLocationFallback`, `extractSourcePlaceId`, `extractCoordinates`.
- **Seletores centralizados** — `src/server/scraper/selectors.ts`: `SELECTORS.feed` (container, placeLinks, endOfList) e `SELECTORS.place` (título, categoria, rating, reviews, priceRange, address, website, phone, businessStatus, hours, description, services, photos, videos, logo), cada um com lista de fallbacks.
- **Progresso** — `src/shared/scrape-progress.ts:19` (`calculateScrapeProgressPercent`): alvo = `total_collected` (novos registros salvos, não descobertos) sobre `limit_requested`; 100% quando `completed`, `target_reached`, `feed_exhausted` ou `collected >= target`.
- **Job** — `src/shared/types.ts:76` (`ScrapeJob`): inclui `completion_reason` (`ScrapeCompletionReason` com 6 valores: `target_reached`, `feed_exhausted`, `access_restricted`, `user_stopped`, `fatal_error`, `feed_stagnation`), `cancel_requested`, `heartbeat_at`, `created_at`, `completed_at`, `total_found`, `total_collected`, `total_duplicates`, `total_errors`.
- **Contrato de dados** — `src/shared/types.ts:1` (`PlaceRecord`): ~65 campos incluindo `web_intelligence_status`, `web_intelligence_score`, `web_intelligence` (`WebIntelligenceRecord`). `EXPORTABLE_FIELDS` (linha 141) lista 45 campos exportáveis para CSV.
- **Web Intelligence** — `src/server/web-intelligence.ts`: `crawlCompanyWebsite` (fetch do site oficial com cheerio, detecção de tech/e-commerce/booking/canais de suporte, até 2 subpáginas); `generateWebIntelligence` (Gemini `gemini-3.8-flash` com schema JSON estrito, fallback heurístico `generateHeuristicIntelligence`); `WebIntelligenceRecord` com `business_identity`, `operational_structure`, `digital_maturity`, `opportunity_signals`, `commercial_analysis`, `scores` (7 scores 0-100 + tier A+/A/B/C), `evidences` com `confidence` (`confirmado_no_site`/`dados_coleta`/`inferencia_comercial`/`nao_identificado`).
- **Deduplicação** — `src/server/scraper/normalizer.ts:167` (`extractSourcePlaceId`): normaliza URL do Maps; prioridade `!3m6!1s` > `!1s` > CID genérico.

**Resumo:** coleta baseada em navegador real (Puppeteer/Browserless), extração rica de DOM do Google Maps (incluindo reviews, galeria, popular times, plus code), normalização robusta de endereço/coordenadas, progresso baseado em novos registros salvos, job com razão de conclusão e heartbeat, e camada de inteligência web sobre o site institucional da empresa.

---

## 2. Arquitetura atual do Beleza Digital

O Beleza Digital usa um **Cloudflare Worker** como motor de coleta, com **Playwright via Browser Run binding**, extração inline, qualificação dupla cadastral+comercial e persistência em Supabase (schema `mapscrape`).

- **Orquestração** — `workers/prospecting-scheduler/src/index.ts`: `ProspectingTask` com tipos `discover`, `capture`, `qualify`, `generate_demo`, `publish_demo`, `send_whatsapp`, `sync_delivery`. `executeTask` faz dispatch por tipo. `scheduleDueCampaigns` (linha do scheduled handler) **apenas avança `next_run_at`**, não enfileira `discover` — o discover é disparado manualmente via API (`/api/prospecting/run`, `createCampaign: false`). `processBatch` consome `rpc/claim_prospecting_tasks` com at-least-once e máximo de 4 tentativas. Autenticação via `PROSPECTING_WORKER_SECRET`.
- **Navegador** — `discoverCampaignTask` usa Playwright via binding `PROSPECTING_BROWSER` (Browser Run) sobre o Google Maps; paginação por rolagem do feed (45 rounds) com critério de estagnação (5 rounds sem novos registros).
- **Extração** — `workers/prospecting-scheduler/src/extractor.ts` (`extractPlaceDetails(page)`): `ExtractedPlace` com `name`, `category`, `address`, `phone`, `website`, `rating`, `reviewCount`, `sourceUrl`, `placeId`, `featureId`, `latitude`, `longitude`, `images`, `openingHours`, `priceLevel`, `operatingStatus`, `editorialSummary`, `rawListingText` e `fieldStatus` (11 campos com `found`/`not_found_in_capture`). **Não extrai reviews individuais, não faz paginação de avaliações, não captura `plus_code`, `popular_times`, `rating_distribution`, `review_highlights`, `social_links`, `booking_url` estruturado, `media_items`, `next_opening_*`.**
- **Normalização** — `workers/prospecting-scheduler/src/normalizer.ts`: `cleanText`, `cleanBusinessName`, `sanitizeRating`, `sanitizeReviewCount`, `sanitizePhotos`, `normalizeAddress/Phone/Website/Category/Rating/ReviewCount/PriceRange/BusinessStatus`, `parseAddressComponents`, `parseSearchLocationFallback`, `extractSourcePlaceId`, `extractCoordinates`.
- **Qualificação** — `src/lib/prospecting.ts`: `qualifyProspect` (score cadastral 0-100 com critérios: nome 20, categoria 10, website 20, telefone 20, email 10, endereço 10, descrição 5, sourceUrl 5); `qualifyCommercialOpportunity` (score comercial 0-100: dor digital até 35, contatabilidade 25, tração até 20, ponto físico 10, funcionamento ativo 10; níveis alta ≥70 / média 40-69 / baixa <40; sugestão de template por categoria/nome/endereço); `createProspectDedupeKey` (SHA-256, prioridade website → phone → name-location); `isEligibleForAutomatedWhatsApp` (fail-closed, requer opt-in).
- **Persistência** — `src/server/db.ts`: Supabase client (`configureDatabaseEnv`/`getSupabase`), schema `mapscrape`; `ScrapeJob` reduzido (apenas `created_at`, sem `completion_reason`/`cancel_requested`/`heartbeat_at`/`completed_at`); `PlaceRecord` **sem campos `web_intelligence_*`**; `run_reports` (`saveRunReport`/`upsert` por `job_id`, `getRunReport` com descompressão gzip); `findUserById/Email`, `createUser`, `updateUserLogin`, `getAuthenticatedUser`, `ensureUserProfile`; `insertPlace`/`updatePlace`/`findPlaceByUrl` (normaliza Maps URL) / `placeExistsByUrl` / `getPlaces` / `getPlacesByIds` / `getAllPlaces` / `listPlaceCategories` / `countPlaces`; `resolveProject`, `resolveSearchCategory`.
- **Consumer de fila** — `src/server/queue-consumer.ts`: consome mensagens da fila de scrape; valida `jobId` com regex `^job_[a-zA-Z0-9_-]{8,100}$`; chama `runScraperJob`; at-least-once, max 4 tentativas com `retry delaySeconds`.
- **Frontend** — `src/pages/ScrapingConsole.tsx`, `src/pages/ProspectingConsole.tsx`, `src/pages/LeadsDashboard.tsx` (detalhado no item 6).
- **API** — chamadas ao `/api/prospecting/run` (POST, bearer token, corpo `{segment, region, countryCode, limit, createCampaign, executionId}`), `/api/prospecting/overview` (métricas + polling por `executionId`), `/api/prospecting/demo-links` (POST para criar link privado de demonstração).

**Resumo:** Worker Cloudflare + Playwright (Browser Run) como motor de coleta; extração enxuta (11 campos, sem reviews/galeria completa/sinais de popularidade); qualificação dupla cadastral+comercial em TypeScript no frontend/lib; deduplicação SHA-256; persistência Supabase `mapscrape` com `ScrapeJob` reduzido e `PlaceRecord` sem web intelligence; discover manual via API, não automático por schedule.

---

## 3. Matriz comparativa de funcionalidades

| Funcionalidade | MaisClientes v3.2 (referência) | Beleza Digital (alvo) | Arquivo / Função |
|---|---|---|---|
| Motor de navegação | Puppeteer-core + Browserless (WS), fallback puppeteer local dev | Playwright via Cloudflare Browser Run binding (`PROSPECTING_BROWSER`) | MC: `src/server/scraper/browser.ts:32`; BD: `workers/prospecting-scheduler/src/index.ts` `discoverCampaignTask` |
| Timeout de conexão | 8s, retry 2× (700ms) | Não especificado no worker | MC: `browser.ts:4` |
| Idioma do navegador | `pt-BR,pt` forçado | Não evidenciado | MC: `browser.ts:68-73` |
| Extração de nome/categoria/endereço/telefone/site | Sim, seletores semânticos (`data-item-id`/`aria-label`) + fallbacks | Sim, 11 campos com `fieldStatus` | MC: `extractor.ts`; BD: `extractor.ts` |
| Avaliação e contagem de avaliações | Sim (rating + review_count) | Sim (rating, reviewCount) | MC: `extractor.ts`; BD: `extractor.ts` |
| Faixa de preço, status de funcionamento | Sim | Sim (`priceLevel`, `operatingStatus`) | MC: `extractor.ts`; BD: `extractor.ts` |
| Horários de funcionamento (semana completa) | Sim, expande painel `oh`, lê tabela de rows | Sim (`openingHours`) | MC: `extractor.ts` linhas 132-168; BD: `extractor.ts` |
| Reviews individuais (autor, nota, texto, resposta, mídia, data) | **Sim**, scroll até 80 iterações, estagnação 8 | **Não** | MC: `extractor.ts` linhas 302-418; BD: ausente |
| Review topics / categorias de avaliação | **Sim** | **Não** | MC: `extractor.ts` linhas 421-437 |
| Galeria de fotos com thumbnails estruturados | **Sim** (até 80 iterações, `media_items` com thumbnail_url) | Parcial (`images`) | MC: `extractor.ts` linhas 495-564; BD: `extractor.ts` |
| Vídeos | **Sim** | Não evidenciado | MC: `extractor.ts` linhas 284-300, 528-533 |
| Logo / foto de perfil do negócio | **Sim** (`logo_url`) | Não | MC: `extractor.ts` linhas 607-629 |
| Links sociais (Instagram, Facebook, etc.) | **Sim** (`social_links`) | Não | MC: `extractor.ts` linhas 239-252 |
| URL de agendamento/booking | **Sim** (`booking_url`) | Não | MC: `extractor.ts` linhas 257-282 |
| Plus Code | **Sim** (`plus_code`) | Não | MC: `extractor.ts` linhas 565-568 |
| Popular times | **Sim** (`popular_times`) | Não | MC: `extractor.ts` linhas 571-581 |
| Rating distribution (1-5 estrelas) | **Sim** (`rating_distribution`) | Não | MC: `extractor.ts` linhas 584-595 |
| Review highlights | **Sim** (`review_highlights`) | Não | MC: `extractor.ts` linhas 598-603 |
| next_opening_text / day / time | **Sim** | Não | MC: `extractor.ts` linhas 170-179, 632-638 |
| visible_photos_count | **Sim** (contagem textual do Maps) | Não | MC: `extractor.ts` linhas 552-556 |
| Atributos adicionais (aba Sobre) | **Sim** (`additional_attributes`, `attributes`, `accessibility_attributes`) | Não | MC: `extractor.ts` linhas 440-490 |
| Descrição da ficha | **Sim** (`description`) | Sim (`editorialSummary`) | MC: `extractor.ts`; BD: `extractor.ts` |
| source_place_id / source_url | **Sim** (`!3m6!1s` > `!1s` > CID) | Sim (`placeId`, `featureId`) | MC: `normalizer.ts:167`; BD: `extractor.ts` |
| Latitude/longitude | **Sim** (`!3d`/`!4d` ou `@lat,lng`) | Sim | MC: `normalizer.ts:185`; BD: `extractor.ts` |
| field_status por campo (captured/not_observed) | **Sim** | Sim (`fieldStatus` 11 campos) | MC: `extractor.ts` linhas 671-675; BD: `extractor.ts` |
| Deduplicação | URL do Maps (`extractSourcePlaceId`) | SHA-256 (`createDedupeKey`, prioridade website→phone→name-location) | MC: `normalizer.ts:167`; BD: `src/lib/prospecting.ts:63` |
| Progresso do job | collected/target, 100% se completed/target_reached/feed_exhausted | Não evidenciado (ScrapeJob sem total_collected/limit_requested/completion_reason) | MC: `src/shared/scrape-progress.ts`; BD: `src/server/db.ts` |
| ScrapeJob com completion_reason / heartbeat / completed_at | **Sim** (6 razões + cancel_requested) | **Não** (apenas created_at) | MC: `src/shared/types.ts:76`; BD: `src/server/db.ts:254-272` |
| Web Intelligence (site institucional + scores) | **Sim** (crawl + Gemini + heurística, WebIntelligenceRecord) | **Não** (PlaceRecord sem web_intelligence_*) | MC: `src/server/web-intelligence.ts`; BD: `src/server/db.ts` |
| Qualificação cadastral (0-100) | Não (foi substituído por web intelligence) | **Sim** (`qualifyProspect`) | BD: `src/lib/prospecting.ts:83` |
| Qualificação comercial (0-100, alta/média/baixa) | Não | **Sim** (`qualifyCommercialOpportunity`) | BD: `src/lib/prospecting.ts:198` |
| 5 templates de site para demo | Não | **Sim** (ouro-classico, preto-esmeralda, minimal-studio, safira-executivo, rubi-lounge) | BD: `src/types/templates`, `LeadsDashboard.tsx` |
| Descoberta automática agendada | Não evidenciado | **Não** (`scheduleDueCampaigns` apenas avança timer, discover manual via API) | BD: `workers/prospecting-scheduler/src/index.ts` |
| Persistência | Supabase schema `mapscrape` | Supabase schema `mapscrape` | MC: (inferido); BD: `src/server/db.ts` |
| Run reports com gzip | Não evidenciado | **Sim** (`saveRunReport`/`getRunReport`) | BD: `src/server/db.ts` |
| Frontend: busca + execução de raspagem | SearchScreen + ResultsScreen | ScrapingConsole + ProspectingConsole + LeadsDashboard | MC: (referência); BD: `src/pages/*.tsx` |
| Frontend: modal inspeção pipeline / JSON bruto | LeadDetailsModal (4 abas) | modal inspeção pipeline (5 etapas) + modal JSON bruto | BD: `ScrapingConsole.tsx` |
| Frontend: filtro alta oportunidade | cobertura 18 campos | `commercial_score>=70` | BD: `ScrapingConsole.tsx` |
| Frontend: CRM kanban + estágios de lead | OpportunityStage (lead→qualificação→apresentação→proposta→fechado→perdido) | 5 estágios (novo/contatado/respondeu/reuniao/fechado) | MC: `types.ts:294`; BD: `LeadsDashboard.tsx:37` |

---

## 4. Diferenças de extração e precisão geográfica

### 4.1 Cobertura de campos extraídos

O MaisClientes extrai **substantivamente mais campos** da ficha do Google Maps:

- **Reviews individuais:** MaisClientes rola o painel de avaliações (até 80 iterações, estagnação após 8 rodadas) e captura autor, nota, texto, data, resposta do proprietário, mídia anexada e contagem de úteis (`extractor.ts` linhas 302-418). O Beleza Digital não extrai reviews (`extractor.ts` do BD não lê o painel de avaliações).
- **Sinais de popularidade e reputação:** MaisClientes captura `popular_times`, `rating_distribution` (contagem por estrela 1-5), `review_highlights`, `review_topics`, `visible_photos_count` (contagem textual explícita do Maps, não inferida). Beleza Digital não captura nenhum destes.
- **Mídia estruturada:** MaisClientes produz `media_items` (array tipado image/video com `thumbnail_url` gerado por template `=w400-h300-k-no`), `logo_url` (foto de perfil do negócio, nunca avatar de avaliador), `videos`. Beleza Digital captura apenas `images` (lista de URLs) sem thumbnails estruturados nem logo.
- **Contato e agendamento:** MaisClientes captura `booking_url` (link "Agendar on-line" detectado por label e por domínios conhecidos como Booksy/Fresha/Treatwell/Square/Mindbody), `social_links` (Instagram, Facebook, TikTok, YouTube, LinkedIn, WhatsApp, Pinterest, Threads), `plus_code`. Beleza Digital não captura esses campos.
- **Aba Sobre / atributos:** MaisClientes clica na aba "Sobre"/"About" e extrai `additional_attributes` (texto até 18.000 chars, seções com categoria+itens, atributos rotulados), separa atributos de acessibilidade, e promove serviços para `services_attributes`. Beleza Digital captura `editorialSummary` e `services` de forma mais enxuta.

### 4.2 Precisão geográfica

Ambos extraem latitude/longitude e parseiam componentes de endereço:

- MaisClientes: `extractCoordinates` (`normalizer.ts:185`) lê `!3d`/`!4d` ou `@lat,lng` da URL; `parseAddressComponents` (`normalizer.ts:114`) extrai CEP (`\d{5}-\d{3}`), país, estado (valida contra lista de UFs brasileiras), cidade e bairro com separador ` - `; `extractSourcePlaceId` (`normalizer.ts:167`) prioriza `!3m6!1s` (place selecionado) sobre `!1s` e CID genérico.
- Beleza Digital: `extractCoordinates` e `extractSourcePlaceId` em `workers/prospecting-scheduler/src/normalizer.ts` (mesmas lógicas); `parseAddressComponents` e `parseSearchLocationFallback` também presentes.

**Conclusão:** precisão geográfica equivalente entre os dois (mesmas funções de normalização de coordenadas e endereço), mas o MaisClientes é muito mais rico em campos de negócio, reputação e mídia.

---

## 5. Diferenças entre contratos de dados

### 5.1 PlaceRecord

**MaisClientes** (`src/shared/types.ts:1`): ~65 campos, incluindo:
- `web_intelligence_status?: WebIntelligenceStatus` (`idle\|analyzing\|completed\|site_unavailable\|partial`)
- `web_intelligence_score?: number`
- `web_intelligence?: WebIntelligenceRecord` (objeto completo com `business_identity`, `operational_structure`, `digital_maturity`, `opportunity_signals`, `commercial_analysis`, `scores` (7 scores 0-100 + tier), `evidences` com `confidence`)
- `field_status?: string` (JSON com estado de captura por campo)
- `popular_times`, `rating_distribution`, `review_highlights`, `review_topics`, `additional_attributes`, `media_items`, `attributes`, `accessibility_attributes`
- `plus_code`, `booking_url`, `social_links`, `logo_url`, `videos`, `visible_photos_count`
- `next_opening_text`, `next_open_day`, `next_open_time`
- `postal_code`, `country`, `city`, `state`, `neighborhood`
- `source_place_id`, `source_url`
- `reviews` (JSON array), `photos`, `videos`

**Beleza Digital** (`src/server/db.ts:351-398`, `PlaceRecord`): **sem campos `web_intelligence_*`**. Campos reduzidos ao essencial de coleta (name, category, address, phone, website, rating, review_count, price_range, opening_hours, business_status, latitude, longitude, maps_url, description, services_attributes, photos, videos, logo_url, booking_url, social_links, reviews, review_topics, additional_attributes, media_items, plus_code, attributes, accessibility_attributes, next_opening_*, visible_photos_count, postal_code, country, city, state, source_place_id, source_url, collected_at, field_status).

**Diferença chave:** o Beleza Digital **não persiste Web Intelligence** (status, score, análise de site institucional, scores comerciais, evidências com nível de confiança).

### 5.2 ScrapeJob

**MaisClientes** (`src/shared/types.ts:76`): `id`, `user_id`, `segment`, `location`, `limit_requested`, `status` (`running\|completed\|partial\|stopped\|failed`), `cancel_requested?`, `status_message`, `completion_reason?` (`ScrapeCompletionReason`: `target_reached\|feed_exhausted\|access_restricted\|user_stopped\|fatal_error\|feed_stagnation`), `total_found`, `total_collected`, `total_duplicates`, `total_errors`, `current_step?`, `heartbeat_at?`, `created_at`, `completed_at?`, campos deprecados (`search_session_id`, `phase`, `discovery_checkpoint`, `candidate_urls`, `candidate_cursor`, `retry_count`).

**Beleza Digital** (`src/server/db.ts:254-272`): **apenas `created_at`** — sem `completion_reason`, `cancel_requested`, `heartbeat_at`, `completed_at`, `total_collected`, `limit_requested`.

**Diferença chave:** o Beleza Digital não consegue reportar razão de conclusão, progresso baseado em alvo, heartbeat nem timestamp de conclusão do job.

### 5.3 Progresso

- MaisClientes: `calculateScrapeProgressPercent` (`src/shared/scrape-progress.ts:19`) — `total_collected / limit_requested`, 100% se job terminal ou `feed_exhausted`.
- Beleza Digital: não há função equivalente evidenciada; `ScrapeJob` sem `total_collected`/`limit_requested` impede esse cálculo.

### 5.4 Deduplicação

- MaisClientes: `normalizeMapsUrl` / `extractSourcePlaceId` (URL do Maps, `!3m6!1s` > `!1s`).
- Beleza Digital: `createProspectDedupeKey` (`src/lib/prospecting.ts:63`) — SHA-256, prioridade website → phone → name-location|city|region|country. Worker inline `createDedupeKey` (prioridade google-feature > google-place > website > phone > name-location).

### 5.5 WebIntelligenceRecord

Existe apenas no MaisClientes (`src/shared/types.ts:220`): `place_id`, `place_name`, `website_url`, `resolved_url`, `status`, `is_official_website`, `business_identity`, `operational_structure`, `digital_maturity` (nível Baixa/Média/Alta, tecnologias detectadas), `opportunity_signals`, `commercial_analysis`, `scores` (`WebScoreBreakdown`: 7 scores 0-100 + tier A+/A/B/C), `evidences` (com `confidence`: `confirmado_no_site`/`dados_coleta`/`inferencia_comercial`/`nao_identificado`), `analyzed_at`.

---

## 6. Diferenças de apresentação no frontend

### MaisClientes (referência)

- **SearchScreen:** busca por projeto/categoria/segmento/localização/limite; presets [10, 20, 50, 100].
- **ResultsScreen:** cards + tabela, filtro, ordenação, cobertura de 18 campos.
- **LeadDetailsModal:** 4 abas (comercial / empresa / digital / avaliações_mídia); pipeline lead→qualificação→apresentação→proposta→fechado→perdido (`OpportunityStage`); análise IA sob demanda.
- **ScrapeEvolutionHUD:** gauge circular + telemetria.
- **ScrapeResultCards:** cards ao vivo, máximo 9.

### Beleza Digital (alvo)

- **ScrapingConsole (`src/pages/ScrapingConsole.tsx`):** busca (segmento/cidade/país/limite [5,10,20,30]); executa `POST /api/prospecting/run` (`createCampaign: false`); exibe candidatos com **qualificação dupla** (cadastral 0-100 + comercial 0-100); cards + tabela; filtro "Alta Oportunidade" (`commercial_score>=70`); `viewMode` cards/table; `runBenchmarkPOA` (5 fichas POA); modal inspeção pipeline (5 etapas: dedupe SHA-256, completude cadastral, oportunidade comercial, demo 5 modelos); modal JSON bruto do runner.ts (`testScraperRunnerPoa` chama `/api/scraper/test-runner`).
- **ProspectingConsole (`src/pages/ProspectingConsole.tsx`):** campanhas (`prospecting_campaigns`), candidatos (`prospecting_candidates`), eventos (`prospect_events`); métricas via `/api/prospecting/overview`; demo links via `/api/prospecting/demo-links`; `runScrape` (`/api/prospecting/run`); `createDemoLink` (`/api/prospecting/demo-links`, expira 14 dias).
- **LeadsDashboard (`src/pages/LeadsDashboard.tsx`):** 3 abas (hoje/buscar/empresas); CRM kanban com 5 estágios (`novo/contatado/respondeu/reuniao/fechado`) e view list; persistência em `prospecting_crm_state`; busca via `/api/prospecting/run` com polling (`/api/prospecting/overview?executionId=`, até 120 tentativas × 3s = 6 min); 5 templates de site (`ouro-classico`, `preto-esmeralda`, `minimal-studio`, `safira-executivo`, `rubi-lounge`); digitalDiagnosis (`site_identificado\|nao_identificado\|perfil_sem_foto\|site_desatualizado\|site_amador\|sem_site`); WhatsApp via `createValidatedWhatsAppUrl` (requer demo publicada + telefone válido); modal plano comercial (A/B/C) e modal detalhes com seleção de template.

**Diferenças de apresentação:**
1. MaisClientes tem **ScrapeEvolutionHUD** (gauge circular de progresso em tempo real) — Beleza Digital não tem equivalente visual de progresso da coleta.
2. MaisClientes tem **LeadDetailsModal com 4 abas** incluindo avaliações_mídia — Beleza Digital tem modal de detalhes focado em proposta de site e plano comercial, sem aba dedicada a avaliações/mídia.
3. MaisClientes tem **ScrapeResultCards (cards ao vivo, máx 9)** durante a coleta — Beleza Digital exibe candidatos apenas após persistência.
4. MaisClientes cobre **18 campos** na tabela de resultados — Beleza Digital exibe menos campos na tabela de candidatos (nome, local, pontuação, estado, origem).
5. Beleza Digital tem **CRM kanban** (5 estágios) e **pipeline de proposta de site** (5 templates, planos A/B/C, WhatsApp) — ausente no MaisClientes (que tem `OpportunityRecord` no backend mas não evidenciado no frontend).
6. Beleza Digital tem **filtro "Alta Oportunidade" (commercial_score>=70)** — MaisClientes não tem equivalente evidenciado no frontend.

---

## 7. Problemas concretos encontrados no Beleza Digital

Todas as evidências abaixo apontam para arquivos e funções específicos.

### 7.1 Extração enxuta — campos ausentes da ficha do Google Maps

O `ExtractedPlace` do Beleza Digital (`workers/prospecting-scheduler/src/extractor.ts`) captura apenas 11 campos com `fieldStatus`. Estão **ausentes**: reviews individuais, review topics, popular_times, rating_distribution, review_highlights, plus_code, booking_url estruturado, social_links, logo_url, videos, visible_photos_count, next_opening_*, additional_attributes, accessibility_attributes, attributes, media_items estruturado.

**Evidência:** `workers/prospecting-scheduler/src/extractor.ts` — `ExtractedPlace` interface tem `name, category, address, phone, website, rating, reviewCount, sourceUrl, placeId, featureId, latitude, longitude, images, openingHours, priceLevel, operatingStatus, editorialSummary, rawListingText, fieldStatus`. Comparar com `MaisClientes src/server/scraper/extractor.ts` que captura todos os acima.

### 7.2 Sem Web Intelligence

O `PlaceRecord` do Beleza Digital (`src/server/db.ts:351-398`) **não tem campos `web_intelligence_*`**. Não há crawler de site institucional, não há análise de tecnologias detectadas, não há scores de aderência/maturidade/potencial comercial, não há evidências com nível de confiança.

**Evidência:** `src/server/db.ts` `PlaceRecord` sem `web_intelligence_status`, `web_intelligence_score`, `web_intelligence`. Comparar com `MaisClientes src/shared/types.ts:1` (PlaceRecord com os 3 campos web_intelligence) e `src/server/web-intelligence.ts` (`crawlCompanyWebsite`, `generateWebIntelligence`).

### 7.3 ScrapeJob reduzido — impossibilita progresso e razão de conclusão

`ScrapeJob` no Beleza Digital (`src/server/db.ts:254-272`) tem **apenas `created_at`**. Falta `completion_reason`, `cancel_requested`, `heartbeat_at`, `completed_at`, `total_collected`, `limit_requested`, `total_found`, `total_duplicates`, `total_errors`.

**Consequência:** não é possível calcular `total_collected / limit_requested` (progresso baseado em novos registros salvos, como em `MaisClientes src/shared/scrape-progress.ts:19`), não é possível saber por que um job parou (`feed_exhausted`, `target_reached`, `access_restricted`, `user_stopped`, `fatal_error`, `feed_stagnation`), e não há heartbeat para detectar jobs travados.

### 7.4 Descoberta não é automática por schedule

`scheduleDueCampaigns` (`workers/prospecting-scheduler/src/index.ts`) **apenas avança `next_run_at`** e **não enfileira** tarefas de `discover`. O discover só ocorre manualmente via `POST /api/prospecting/run` (`createCampaign: false`).

**Evidência:** `workers/prospecting-scheduler/src/index.ts` — `scheduleDueCampaigns` corpo da função; comentário no resumo de leitura: "scheduleDueCampaigns apenas avança next_run_at, NÃO enfileira discover (discover é manual via API)".

### 7.5 Frontend depende de polling longo e endpoints não vistos

O `LeadsDashboard.tsx` faz polling em `/api/prospecting/overview?executionId=` com até 120 tentativas × 3s (6 minutos). Os endpoints `/api/prospecting/run`, `/api/prospecting/overview`, `/api/prospecting/demo-links` foram chamados pelo frontend mas **não foram lidos do lado servidor** nesta sessão (arquivos `src/api/prospecting` não localizados na raiz; podem ser Pages Functions fora do escopo lido).

**Evidência:** `src/pages/LeadsDashboard.tsx:555-625` (polling, maxAttempts=120, intervalo 3000ms); `src/pages/ProspectingConsole.tsx:101-107` (chamada a `/api/prospecting/run`).

### 7.6 Qualificação dupla só no frontend/lib, não no worker

`qualifyProspect` (cadastral) e `qualifyCommercialOpportunity` (comercial) estão em `src/lib/prospecting.ts` (execução no navegador/função isolada). O worker (`workers/prospecting-scheduler/src/index.ts`) tem `qualify` inline própria, mais simples, sem a mesma estrutura de scores e níveis.

**Evidência:** `src/lib/prospecting.ts:83` (`qualifyProspect`), `src/lib/prospecting.ts:198` (`qualifyCommercialOpportunity`); `workers/prospecting-scheduler/src/index.ts` (`qualify` inline).

### 7.7 Nenhum campo de web_intelligence na tabela places

A migration/schema `mapscrape` não registra colunas para web_intelligence no `places`, o que impediria persistir a inteligência de site institucional mesmo que fosse implementada.

**Evidência:** `src/server/db.ts` `PlaceRecord` (linhas 351-398) sem os campos; não há criação de colunas `web_intelligence_*` evidenciada.

---

## 8. Especificação objetiva do padrão a ser alcançado

O padrão a ser alcançado é definido pela implementação de referência do MaisClientes v3.2. Especificação itemizada, com arquivo de referência para cada exigência.

### 8.1 Motor de coleta

- Navegador real (Puppeteer-core ou Playwright) conectado a serviço remoto (Browserless ou Cloudflare Browser Run), com retry (≥2 tentativas), timeout (≥8s) e fallback local apenas em desenvolvimento.
- Referência: `MaisClientes src/server/scraper/browser.ts:32-75`.

### 8.2 Idioma do navegador

- Forçar `pt-BR,pt` nos argumentos de lançamento para garantir rótulos em português no Google Maps.
- Referência: `MaisClientes src/server/scraper/browser.ts:72`.

### 8.3 Expansão de horários antes da extração

- Clicar no botão de horários (`data-item-id="oh"` ou aria-label contendo "Horários de funcionamento"/"Opening hours") e aguardar renderização antes de ler o DOM.
- Referência: `MaisClientes src/server/scraper/extractor.ts:17-30`.

### 8.4 Campos obrigatórios de extração (mínimo padrão MaisClientes)

Todos os campos abaixo devem ser capturados da ficha pública do Google Maps:

| Campo | Referência MaisClientes |
|---|---|
| name, category, address, phone, website, rating, review_count | `extractor.ts` linhas 66-128 |
| price_range, business_status, opening_hours (semana completa) | `extractor.ts` linhas 118-168 |
| description, services_attributes | `extractor.ts` linhas 183-209, 487-490 |
| photos (URLs), videos, logo_url, media_items (tipado com thumbnail_url) | `extractor.ts` linhas 211-236, 284-300, 607-629, 557-564 |
| social_links | `extractor.ts` linhas 239-252 |
| booking_url (detecção por label e domínios de agendamento) | `extractor.ts` linhas 257-282 |
| plus_code | `extractor.ts` linhas 565-568 |
| popular_times | `extractor.ts` linhas 571-581 |
| rating_distribution (1-5 estrelas) | `extractor.ts` linhas 584-595 |
| review_highlights | `extractor.ts` linhas 598-603 |
| review_topics | `extractor.ts` linhas 421-437 |
| additional_attributes, attributes, accessibility_attributes (aba Sobre) | `extractor.ts` linhas 440-490 |
| next_opening_text, next_open_day, next_open_time | `extractor.ts` linhas 170-179 |
| visible_photos_count (contagem textual do Maps) | `extractor.ts` linhas 552-556 |
| reviews individuais (autor, nota, texto, data, resposta, mídia, úteis) com scroll até estagnação | `extractor.ts` linhas 302-418 (até 80 iterações, estagnação 8) |

### 8.5 Seletores com fallback

- Cada campo deve ter lista de seletores primários e secundários, centrados em `data-item-id` e `aria-label` (evitar classes CSS instáveis).
- Referência: `MaisClientes src/server/scraper/selectors.ts`.

### 8.6 Normalização

- `cleanText` (remoção zero-width/private-use unicode), `normalizeAddress/Phone/Website/Category/Rating/ReviewCount/PriceRange/BusinessStatus`, `parseAddressComponents` (CEP, país, estado válido contra UFs, cidade, bairro), `parseSearchLocationFallback`, `extractSourcePlaceId` (`!3m6!1s` > `!1s` > CID), `extractCoordinates` (`!3d`/`!4d` ou `@lat,lng` com validação de intervalo).
- Referência: `MaisClientes src/server/scraper/normalizer.ts`.

### 8.7 field_status por campo

- Cada campo coletado deve ter registro de estado (`captured` / `not_observed_in_session`) com `observed_at`. Ausência de campo não equivale à ausência na fonte.
- Referência: `MaisClientes src/server/scraper/extractor.ts` linhas 671-675.

### 8.8 Contrato de dados (PlaceRecord)

- `PlaceRecord` deve incluir os campos do padrão MaisClientes, especialmente `web_intelligence_status`, `web_intelligence_score`, `web_intelligence`, `field_status`, `popular_times`, `rating_distribution`, `review_highlights`, `review_topics`, `additional_attributes`, `media_items`, `plus_code`, `booking_url`, `social_links`, `logo_url`, `videos`, `visible_photos_count`, `next_opening_*`, `postal_code`, `country`, `city`, `state`, `source_place_id`, `source_url`.
- Referência: `MaisClientes src/shared/types.ts:1-70`.

### 8.9 Contrato de dados (ScrapeJob)

- `ScrapeJob` deve incluir `completion_reason` (6 valores: `target_reached`, `feed_exhausted`, `access_restricted`, `user_stopped`, `fatal_error`, `feed_stagnation`), `cancel_requested`, `heartbeat_at`, `created_at`, `completed_at`, `total_found`, `total_collected`, `total_duplicates`, `total_errors`, `limit_requested`.
- Referência: `MaisClientes src/shared/types.ts:76-126`.

### 8.10 Progresso baseado em novos registros salvos

- Progresso = `total_collected / limit_requested`; 100% quando `completed`, `target_reached`, `feed_exhausted` ou `collected >= target`.
- Referência: `MaisClientes src/shared/scrape-progress.ts:19-28`.

### 8.11 Deduplicação

- Chave estável baseada na URL do Maps (`extractSourcePlaceId`) ou, alternativamente, SHA-256 com prioridade website → phone → name-location.
- Referência: `MaisClientes src/server/scraper/normalizer.ts:167-183`; `Beleza Digital src/lib/prospecting.ts:63-80`.

### 8.12 Web Intelligence (site institucional)

- Crawler de site institucional (fetch com timeout, detecção de tech/e-commerce/booking/canais de suporte, até 2 subpáginas: sobre/serviços/produtos/contato).
- Análise de inteligência comercial com scores: aderência ao segmento, compatibilidade de gestão, complexidade operacional, maturidade digital, potencial comercial, confiabilidade da evidência, score geral; tier A+/A/B/C; evidências com nível de confiança (`confirmado_no_site` / `dados_coleta` / `inferencia_comercial` / `nao_identificado`).
- Fallback heurístico quando não há chave de IA configurada.
- Referência: `MaisClientes src/server/web-intelligence.ts` (`crawlCompanyWebsite`, `generateWebIntelligence`, `generateHeuristicIntelligence`); `src/shared/types.ts:208-292` (`WebIntelligenceRecord`, `WebScoreBreakdown`, `WebEvidence`).

### 8.13 Qualificação

- Qualificação cadastral (0-100): nome 20, categoria 10, website 20, telefone 20, email 10, endereço 10, descrição 5, sourceUrl 5.
- Qualificação comercial (0-100): dor digital (até 35), contatabilidade via telefone/WhatsApp (25), tração por avaliações (até 20), ponto físico (10), funcionamento ativo (10); níveis alta ≥70 / média 40-69 / baixa <40.
- Sugestão de template por categoria/nome/endereço.
- Referência: `Beleza Digital src/lib/prospecting.ts:83-329` (já implementado; manter).

### 8.14 Frontend padrão

- Busca por segmento/cidade/país/limite com presets.
- Execução de coleta via API com bearer token.
- Exibição de candidatos com qualificação dupla (cadastral + comercial).
- Filtro "Alta Oportunidade" (`commercial_score>=70`).
- Cards + tabela com viewMode alternável.
- Modal de inspeção do pipeline de coleta.
- CRM kanban com estágios de lead e persistência de estado.
- Templates de site para proposta (5 modelos).
- Referência: `Beleza Digital src/pages/ScrapingConsole.tsx`, `src/pages/ProspectingConsole.tsx`, `src/pages/LeadsDashboard.tsx` (já implementado; manter e estender com campos de extração do item 8.4).

### 8.15 Descoberta

- O discover deve ser disparável via API (`/api/prospecting/run`) e, idealmente, enfileirado automaticamente pelo schedule (`scheduleDueCampaigns` deve enfileirar `discover`, não apenas avançar `next_run_at`).

---

## 9. Testes de aceitação necessários

Cada teste abaixo deve ser implementado como teste de unidade/integração, com evidência de passagem, antes de considerar o padrão alcançado.

### 9.1 Extração de campos da ficha (unitário)

**TA-01:** Dado um HTML simulado de ficha do Google Maps com todos os campos, `extractPlaceDetails` deve retornar `PlaceRecord` com name, category, address, phone, website, rating, review_count, price_range, opening_hours, business_status preenchidos.

**TA-02:** Mesmo que TA-01, deve capturar `social_links`, `booking_url`, `plus_code`, `logo_url`.

**TA-03:** Deve capturar `popular_times`, `rating_distribution`, `review_highlights`, `review_topics`, `visible_photos_count`.

**TA-04:** Deve capturar reviews individuais com scroll simulado (mínimo 2 iterações, estagnação respeitada).

**TA-05:** Deve capturar `media_items` com `thumbnail_url` gerado pelo template `=w400-h300-k-no`.

**Arquivo alvo:** `workers/prospecting-scheduler/src/extractor.ts` (estender) ou novo arquivo de extrator alinhado ao padrão MaisClientes.

### 9.2 Normalização (unitário)

**TA-06:** `extractSourcePlaceId` deve priorizar `!3m6!1s` sobre `!1s` e CID genérico.

**TA-07:** `extractCoordinates` deve extrair `!3d`/`!4d` e `@lat,lng`, rejeitando pares fora de intervalo.

**TA-08:** `parseAddressComponents` deve extrair CEP (`\d{5}-\d{3}`), estado válido (UF brasileira), cidade e bairro com separador ` - `.

**TA-09:** `normalizeBusinessStatus` deve mapear "open/aberto" → "Aberto", "closed/fechado" → "Fechado", temporário/permanente adequadamente.

**Arquivo alvo:** `workers/prospecting-scheduler/src/normalizer.ts` (estender para equalizar com `MaisClientes src/server/scraper/normalizer.ts`).

### 9.3 Contrato de dados (integração/banco)

**TA-10:** `places` (schema `mapscrape`) deve ter colunas `web_intelligence_status`, `web_intelligence_score`, `web_intelligence` (JSONB), `field_status`, `popular_times`, `rating_distribution`, `review_highlights`, `review_topics`, `additional_attributes`, `media_items`, `plus_code`, `booking_url`, `social_links`, `logo_url`, `videos`, `visible_photos_count`, `next_opening_text`, `next_open_day`, `next_open_time`, `postal_code`, `country`, `city`, `state`, `source_place_id`, `source_url`.

**TA-11:** `scrape_jobs` deve ter `completion_reason`, `cancel_requested`, `heartbeat_at`, `created_at`, `completed_at`, `total_found`, `total_collected`, `total_duplicates`, `total_errors`, `limit_requested`.

**TA-12:** `run_reports` com `saveRunReport`/`getRunReport` (upsert por `job_id`, descompressão gzip) — já implementado, manter teste.

**Arquivo alvo:** `src/server/db.ts` + migrations Supabase.

### 9.4 Progresso do job (unitário)

**TA-13:** `calculateScrapeProgressPercent(job)` deve retornar `collected/target*100`, limitado a 99 enquanto não terminal, e 100 quando `completed`, `target_reached`, `feed_exhausted` ou `collected >= target`.

**TA-14:** `isFeedExhaustedJob(job)` deve retornar true apenas quando job terminal com `completion_reason === 'feed_exhausted'` ou `current_step === 'fim da lista de resultados'`.

**Arquivo alvo:** novo módulo alinhado a `MaisClientes src/shared/scrape-progress.ts`.

### 9.5 Web Intelligence (integração)

**TA-15:** `crawlCompanyWebsite` deve fetchar homepage, detectar tech (WordPress/WooCommerce, Shopify, etc.), e-commerce, booking, canais de suporte, e até 2 subpáginas (sobre/serviços/produtos/contato).

**TA-16:** `generateWebIntelligence` deve retornar `WebIntelligenceRecord` com `business_identity`, `operational_structure`, `digital_maturity`, `opportunity_signals`, `commercial_analysis`, `scores` (7 scores + tier), `evidences` com `confidence`; fallback heurístico quando sem chave de IA.

**TA-17:** `PlaceRecord` persistido deve conter `web_intelligence_*` preenchido após execução da inteligência.

**Arquivo alvo:** novo módulo alinhado a `MaisClientes src/server/web-intelligence.ts` e `src/shared/types.ts:208-292`.

### 9.6 Deduplicação (unitário)

**TA-18:** `createProspectDedupeKey` deve gerar SHA-256 com prioridade website → phone → name-location; retornar null quando sem identidade suficiente.

**Arquivo alvo:** `src/lib/prospecting.ts:63-80` (já implementado; manter teste).

### 9.7 Qualificação (unitário)

**TA-19:** `qualifyProspect` deve retornar score 0-100 com pesos (nome 20, categoria 10, website 20, telefone 20, email 10, endereço 10, descrição 5, sourceUrl 5) e `inspectionState`.

**TA-20:** `qualifyCommercialOpportunity` deve retornar score comercial 0-100, nível alta/média/baixa (≥70/40-69/<40), `suggestedTemplate` dentre os 5 modelos.

**Arquivo alvo:** `src/lib/prospecting.ts:83-329` (já implementado; manter teste).

### 9.8 Frontend (integração)

**TA-21:** `ScrapingConsole` deve executar `POST /api/prospecting/run` com bearer token e exibir candidatos com qualificação dupla.

**TA-22:** Filtro "Alta Oportunidade" deve mostrar apenas `commercial_score>=70`.

**TA-23:** `LeadsDashboard` deve render kanban com 5 estágios e persistir estado em `prospecting_crm_state`.

**TA-24:** Polling em `/api/prospecting/overview?executionId=` deve respeitar `maxAttempts` e intervalo, e tratar status terminal (`succeeded`/`blocked`/`dead_letter`/`cancelled`).

**Arquivo alvo:** `src/pages/ScrapingConsole.tsx`, `src/pages/LeadsDashboard.tsx` (já implementado; estender testes para novos campos de extração).

### 9.9 Descoberta automática (integração)

**TA-25:** `scheduleDueCampaigns` deve enfileirar tarefas de `discover` para campanhas vencidas, não apenas avançar `next_run_at`.

**Arquivo alvo:** `workers/prospecting-scheduler/src/index.ts` (`scheduleDueCampaigns`).

### 9.10 Critérios de passagem

- Todos os testes TA-01 a TA-25 passando.
- Lint sem erros (`eslint src` e `eslint workers/prospecting-scheduler`).
- Typecheck passando (`tsc --noEmit`).
- Build verde.
- Nenhum regressão nos testes existentes de qualificação e deduplicação.

---

**Conclusão executiva:** O Beleza Digital já implementa bem a qualificação dupla cadastral+comercial, a deduplicação SHA-256, o CRM kanban, o pipeline de propostas com 5 templates e o frontend de busca/coleta. As principais lacunas frente ao padrão MaisClientes v3.2 são: (i) extração enxuta (faltam reviews, popular_times, rating_distribution, review_highlights, plus_code, booking_url, social_links, logo_url, videos, next_opening_*, additional_attributes, media_items estruturado); (ii) ausência de Web Intelligence (site institucional + scores + evidências); (iii) `ScrapeJob` reduzido (sem `completion_reason`, `heartbeat_at`, `completed_at`, `total_collected`, `limit_requested`); (iv) `PlaceRecord` sem campos `web_intelligence_*`; (v) `scheduleDueCampaigns` não enfileira `discover`. A especificação da seção 8 e os testes TA-01 a TA-25 definem o caminho para fechar essas lacunas sem alterar o que já funciona.
