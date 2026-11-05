# Plano de Ação — Evolução do Beleza Digital (com base no benchmark vs MaisClientes v3.2)

**Origem:** [`BENCHMARK_MAISCLIENTES_V32.md`](BENCHMARK_MAISCLIENTES_V32.md) — seções 7 (problemas), 8 (padrão a atingir) e 9 (testes de aceitação TA-01 a TA-25).

**Restrições do CLAUDE.md:** nada de throw raw strings (usar `src/lib/errors.ts`); não copiar padrões de `src/legacy/`; novas APIs precisam OpenAPI spec; commits em Conventional Commits; imports alfabéticas por grupo; Definition of Done (17 itens) para cada entrega.

---

## Resumo das lacunas (do benchmark)

| # | Lacuna | Arquivo evidência | Testes de aceitação |
|---|---|---|---|
| 1 | Extração enxuta: faltam reviews, popular_times, rating_distribution, review_highlights, plus_code, booking_url, social_links, logo_url, videos, next_opening_\*, additional_attributes, media_items estruturado | `workers/prospecting-scheduler/src/extractor.ts` (11 campos) | TA-01 a TA-05 |
| 2 | Sem Web Intelligence (site institucional + scores + evidências) | `src/server/db.ts` PlaceRecord sem `web_intelligence_*` | TA-15 a TA-17 |
| 3 | `ScrapeJob` reduzido: apenas `created_at`, sem `completion_reason`/`heartbeat_at`/`completed_at`/`total_collected`/`limit_requested` | `src/server/db.ts:254-272` | TA-10 (parte), TA-13, TA-14 |
| 4 | `scheduleDueCampaigns` apenas avança `next_run_at`, não enfileira `discover` | `workers/prospecting-scheduler/src/index.ts` | TA-25 |
| 5 | Nenhum módulo de progresso (`calculateScrapeProgressPercent`/`isFeedExhaustedJob`) | ausente | TA-13, TA-14 |

---

## Fases do plano (em ordem de dependência)

### Fase 1 — Contrato de dados e banco (bloqueante para tudo)

Objetivo: equalizar `scrape_jobs` e `places` ao padrão MaisClientes, para que progresso, razão de conclusão e Web Intelligence possam ser persistidos.

**O que fazer:**
1. Adicionar à tabela `scrape_jobs` (schema `mapscrape`): `completion_reason`, `cancel_requested`, `heartbeat_at`, `created_at` (já existe), `completed_at`, `total_found`, `total_collected`, `total_duplicates`, `total_errors`, `limit_requested`.
2. Adicionar à tabela `places`: `web_intelligence_status`, `web_intelligence_score`, `web_intelligence` (JSONB), `field_status`, `popular_times`, `rating_distribution`, `review_highlights`, `review_topics`, `additional_attributes`, `media_items`, `plus_code`, `booking_url`, `social_links`, `logo_url`, `videos`, `visible_photos_count`, `next_opening_text`, `next_open_day`, `next_open_time`, `postal_code`, `country`, `city`, `state`, `source_place_id`, `source_url`.
3. Atualizar `src/server/db.ts`: `PlaceRecord`, `ScrapeJob`, `insertPlace`/`updatePlace`, `createJob`/`updateJobProgress`/`getJob` para lidar com os novos campos.
4. Criar migration Supabase para as novas colunas.
5. Testes: TA-10 (colunas de `places` e `scrape_jobs`), TA-12 (run_reports já existe — manter).

**Arquivos afetados:** `src/server/db.ts`, migrations Supabase (nova pasta `supabase/migrations/` se não existir), `src/lib/errors.ts` (helpers de erro para operações de banco).

**Definição de feita:** typecheck passando, migration aplicável em ambiente de staging, TA-10 e TA-12 verdes.

---

### Fase 2 — Extração completa da ficha do Google Maps

Objetivo: o `ExtractedPlace`/`PlaceRecord` do Beleza Digital capturar tudo que o MaisClientes captura, com `field_status` por campo.

**O que fazer:**
1. Estender `workers/prospecting-scheduler/src/extractor.ts` (`extractPlaceDetails`) para capturar:
   - reviews individuais com scroll (até 80 iterações, estagnação 8) — TA-04
   - `popular_times`, `rating_distribution`, `review_highlights`, `review_topics` — TA-03
   - `plus_code`, `booking_url` (detecção por label e domínios de agendamento), `social_links` — TA-02
   - `logo_url` (foto de perfil do negócio, nunca avatar de avaliador), `videos`, `visible_photos_count` — TA-02
   - `next_opening_text/day/time`, `additional_attributes`, `attributes`, `accessibility_attributes` (aba Sobre)
   - `media_items` tipado com `thumbnail_url` (template `=w400-h300-k-no`) — TA-05
   - `field_status` com `captured`/`not_observed_in_session` + `observed_at`
2. Estender `workers/prospecting-scheduler/src/normalizer.ts` para equalizar com `MaisClientes src/server/scraper/normalizer.ts` (`extractSourcePlaceId` prioridade `!3m6!1s` > `!1s`, `extractCoordinates` validação de intervalo, `normalizeBusinessStatus` mapeamento aberto/fechado).
3. Seletores com fallback (`data-item-id`/`aria-label`) centralizados, estilo `MaisClientes src/server/scraper/selectors.ts`.
4. Testes: TA-01 a TA-05 (extração), TA-06 a TA-09 (normalização).

**Arquivos afetados:** `workers/prospecting-scheduler/src/extractor.ts`, `workers/prospecting-scheduler/src/normalizer.ts`, novo `workers/prospecting-scheduler/src/selectors.ts`.

**Definição de feita:** todos os campos do item 8.4 do benchmark capturados; TA-01 a TA-09 verdes.

---

### Fase 3 — Web Intelligence (site institucional + scores)

Objetivo: adicionar a camada de inteligência comercial que falta ao Beleza Digital.

**O que fazer:**
1. Criar módulo de crawler de site institucional (`crawlCompanyWebsite`): fetch com timeout (8s), detecção de tech/e-commerce/booking/canais de suporte, até 2 subpáginas (sobre/serviços/produtos/contato), filtro de domínios não-institucionais (redes sociais, marketplaces).
2. Criar `generateWebIntelligence` com fallback heurístico (sem depender obrigatoriamente de chave de IA) e integração opcional com LLM (Gemini) quando `GEMINI_API_KEY` estiver presente.
3. Definir `WebIntelligenceRecord` com: `business_identity`, `operational_structure`, `digital_maturity` (Baixa/Média/Alta), `opportunity_signals`, `commercial_analysis`, `scores` (7 scores 0-100 + tier A+/A/B/C), `evidences` com `confidence` (`confirmado_no_site`/`dados_coleta`/`inferencia_comercial`/`nao_identificado`).
4. Persistir `web_intelligence_*` em `places` após execução.
5. Usar `src/lib/errors.ts` para helpers de erro (não throw raw strings).
6. Testes: TA-15 a TA-17.

**Arquivos afetados:** novo `src/server/web-intelligence.ts` (ou `src/lib/web-intelligence.ts`), `src/server/db.ts` (persistência), `src/lib/errors.ts`.

**Definição de feita:** Web Intelligence executável e persistida; TA-15 a TA-17 verdes.

---

### Fase 4 — Progresso do job e descoberta automática

Objetivo: permitir progresso baseado em novos registros salvos e discover automático por schedule.

**O que fazer:**
1. Criar módulo de progresso (`calculateScrapeProgressPercent`, `isFeedExhaustedJob`) igual ao `MaisClientes src/shared/scrape-progress.ts`.
2. Atualizar `workers/prospecting-scheduler/src/index.ts`:
   - `scheduleDueCampaigns` deve **enfileirar** tarefas de `discover` para campanhas vencidas, não apenas avançar `next_run_at` — TA-25.
   - `discoverCampaignTask` gravar `total_collected`, `limit_requested`, `completion_reason`, `heartbeat_at`, `completed_at` no job.
3. Expor progresso via API (`/api/prospecting/overview` ou novo endpoint com OpenAPI spec).
4. Testes: TA-13, TA-14, TA-25.

**Arquivos afetados:** `workers/prospecting-scheduler/src/index.ts`, novo `src/lib/scrape-progress.ts` (ou similar), `src/api/prospecting/*` (endpoint com OpenAPI spec).

**Definição de feita:** discover automático por schedule funcionando; progresso calculável; TA-13, TA-14, TA-25 verdes.

---

### Fase 5 — Frontend (exibir novos campos e progresso)

Objetivo: o frontend consumir os novos dados e apresentar progresso de coleta.

**O que fazer:**
1. `ScrapingConsole`/`LeadsDashboard`: exibir campos novos (reviews, social_links, booking_url, plus_code, popular_times, rating) nos cards/tabela/modal.
2. Adicionar `ScrapeEvolutionHUD` (gauge circular de progresso da coleta, igual ao MaisClientes) — ausente no Beleza Digital.
3. Manter filtro "Alta Oportunidade" (`commercial_score>=70`) e qualificação dupla (já implementados — preservar).
4. Atualizar modal de inspeção do pipeline para mostrar `field_status` e `web_intelligence_status`.
5. Testes: TA-21 a TA-24 (frontend).

**Arquivos afetados:** `src/pages/ScrapingConsole.tsx`, `src/pages/LeadsDashboard.tsx`, novo componente `ScrapeEvolutionHUD`.

**Definição de feita:** frontend exibe novos campos e gauge de progresso; TA-21 a TA-24 verdes.

---

### Fase 6 — Qualidade, docs e entrega

Objetivo: atender a Definition of Done completa antes de considerar a evolução pronta.

**O que fazer:**
1. Testes: todos TA-01 a TA-25 verdes (`npx vitest run`).
2. Lint: `eslint src` e `eslint workers/prospecting-scheduler` sem erros.
3. Typecheck: `npx tsc --noEmit` passando.
4. Build: `npm run build` verde.
5. Documentação: atualizar README/docs com novo contrato de dados e endpoints.
6. Changelog: atualizar.
7. Commits: Conventional Commits (ex: `feat:`, `fix:`), com atribuição `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
8. Revisão de código (Code Review) aprovada.
9. Novas APIs: OpenAPI spec.
10. Imports alfabéticas por grupo.

---

## Critérios de sucesso (Definition of Done)

Cada fase só é considerada concluída quando:
- [ ] Code Review passado
- [ ] Unit Tests passing (TA correspondentes)
- [ ] Linting sem erros
- [ ] Typecheck passing
- [ ] Documentação atualizada
- [ ] Changelog atualizado
- [ ] Commit segue Conventional Commits
- [ ] CI/CD pipeline green
- [ ] Security review completed (tokens/segredos não expostos)
- [ ] Deprecações documentadas (se houver)
- [ ] Performance benchmarks verificados
- [ ] Acessibilidade check (frontend)
- [ ] Merge ready
- [ ] Investigação completada: 3 causas testadas com evidências
- [ ] Test flow passado: fluxo principal testado e passando
- [ ] Change verified: todas as mudanças têm `change_verified: true`
- [ ] Report estruturado: JSON com status, evidências, score 0-100

---

## Ordem recomendada de execução

1. **Fase 1** (banco) — bloqueante para fases 2, 3 e 4.
2. **Fase 2** (extração) — depende da Fase 1 para persistir novos campos.
3. **Fase 3** (Web Intelligence) — depende da Fase 1 (colunas `web_intelligence_*`).
4. **Fase 4** (progresso + discover automático) — depende da Fase 1 (colunas de job).
5. **Fase 5** (frontend) — depende das fases 1-4 para consumir dados.
6. **Fase 6** (qualidade) — após todas as anteriores.

Se quiser, posso iniciar pela Fase 1 agora (criar migration e ajustar `src/server/db.ts`). Qual fase você quer que eu execute primeiro?
