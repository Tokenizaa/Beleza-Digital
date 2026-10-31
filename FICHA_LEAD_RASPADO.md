# Ficha do Lead Raspado — Documentação

Este documento explica onde fica, o que contém e como coletar a **ficha do lead raspado** (estabelecimento descoberto via Google Maps) no projeto Beleza_Digital.

---

## 1. O que é a "ficha do lead raspado"

A ficha do lead é o registro de um estabelecimento público coletado do Google Maps pelo motor de scraping. No código, esse contrato se chama **`PlaceRecord`**.

Cada ficha contém dados como: nome, categoria, endereço, telefone, site, nota, quantidade de avaliações, horário de funcionamento, status (aberto/fechado), coordenadas, link do Maps, fotos, redes sociais, URL de agendamento, logo, serviços, avaliações individuais, tópicos de avaliação, atributos de acessibilidade, entre outros.

---

## 2. Arquivos que compõem a ficha do lead

Todos esses arquivos estão em `src/server/scraper-engine/` (cópia isolada do repositório `Tokenizaa/mais-clientes-v2`, com apenas isolamento de dependências):

| Arquivo | Função |
|---------|--------|
| **`types.ts`** | Define a interface **`PlaceRecord`** (contrato de dados da ficha) e `ScrapeResult`, `ScrapeInput`, `ScrapeProgress`. É a definição oficial de cada campo da ficha. |
| **`extractor.ts`** | Contém `extractPlaceDetails()`. Extrai todos os campos públicos da ficha do Google Maps (DOM do place sheet): nome, categoria, telefone, site, endereço, nota, avaliações, fotos, vídeos, redes sociais, horário, status, etc. |
| **`runner.ts`** | Contém `scrapeGoogleMaps()`. Orquestra a coleta: conecta no navegador remoto (Puppeteer + Browserless), busca no Google Maps, coleta URLs de estabelecimentos, abre cada ficha e chama o extrator. Retorna `ScrapeResult` com o array `results[]` de `PlaceRecord`. |
| **`normalizer.ts`** | Funções de normalização de campos (endereço, telefone, site, categoria, nota, preço, status de funcionamento, parsing de endereço, extração de coordenadas e place ID). |
| **`selectors.ts`** | Seletores CSS centralizados para o feed de busca e a ficha do place (título, categoria, nota, endereço, telefone, site, fotos, vídeos, logo, etc.). |
| **`browserless-endpoint.ts`** | Resolve o endpoint WebSocket do navegador remoto (`BROWSER_WS_ENDPOINT`) usado pelo Puppeteer. |

### Arquivos de qualificação e persistência (camada acima do motor)

| Arquivo | Função |
|---------|--------|
| **`src/lib/prospecting.ts`** | `qualifyCommercialOpportunity()` e `qualifyProspect()`. Aplicam qualificação dupla: Completude Cadastral (0-100) e Oportunidade Comercial (0-100) sobre os dados brutos da ficha. |
| **`src/pages/ScrapingConsole.tsx`** | UI do **Console de Scraping**. Chama os endpoints para iniciar coleta (`/api/prospecting/run`), carregar fichas (`/api/prospecting/dashboard`) e testar o runner (`/api/scraper/test-runner`). Exibe as fichas capturadas com scores de qualidade cadastral e oportunidade comercial. |
| **`functions/api/prospecting/run.ts`** | Endpoint que enfileira uma tarefa de descoberta (`prospecting_tasks`) e aciona o Worker de prospecção para executar a coleta + qualificação automática. |
| **`functions/api/prospecting/dashboard.ts`** | Endpoint (novo) que retorna as tarefas (`tasks`) e as fichas de lead (`candidates`) persistidas, com estatísticas e paginação. Consumido pelo `ScrapingConsole.tsx`. |
| **`functions/api/scraper/test-runner.ts`** | Endpoint (novo) que delega a execução do runner de scraping ao Worker de prospecção (que possui o binding `BROWSER`). |

---

## 3. Contrato da ficha (PlaceRecord)

Definido em `src/server/scraper-engine/types.ts`. Campos principais:

- `id`, `job_id` — identificadores da ficha e da execução
- `name` — nome comercial
- `category` — categoria (ex: barbearia, salão de beleza)
- `address`, `city`, `state`, `country`, `postal_code` — endereço e componentes
- `phone` — telefone normalizado
- `website` — site próprio
- `rating`, `review_count` — nota e quantidade de avaliações
- `opening_hours` — horário de funcionamento
- `business_status` — aberto/fechado
- `latitude`, `longitude` — coordenadas
- `maps_url` — link da ficha no Google Maps
- `description` — descrição pública
- `services_attributes` — serviços listados
- `photos`, `videos`, `logo_url` — mídia
- `social_links` — redes sociais (Instagram, Facebook, WhatsApp, etc.)
- `booking_url` — URL de agendamento online
- `reviews` — avaliações individuais (JSON)
- `review_topics` — tópicos de avaliação (JSON)
- `additional_attributes` — atributos da aba "Sobre" (JSON)
- `field_status` — estado de captura por campo (JSON)
- `collected_at` — timestamp da coleta

---

## 4. Como coletar a ficha do lead (fluxo)

### Fluxo principal (via UI do Console de Scraping)

1. O usuário acessa o **Console de Scraping** (`prospeccao-scraping` no painel admin unificado).
2. Preenche segmento (ex: "barbearia"), região (ex: "Porto Alegre - RS") e limite de fichas.
3. Clica em **"Executar Coleta Maps"** → chama `POST /api/prospecting/run`.
4. O endpoint `run.ts`:
   - Valida a sessão de admin (Supabase).
   - Cria uma tarefa em `prospecting_tasks` (status `pending`).
   - Aciona o Worker de prospecção (`PROSPECTING_WORKER_URL`) que executa `scrapeGoogleMaps` (runner.ts) com um navegador remoto (Puppeteer + Browserless).
   - O worker coleta, normaliza, deduplica, qualifica e persiste as fichas em `prospecting_candidates`.
5. O `ScrapingConsole.tsx` carrega as fichas via `GET /api/prospecting/dashboard` e exibe as cards/tabela com:
   - Nome, categoria, localização, telefone, site
   - Score de Completude Cadastral (0-100)
   - Score de Oportunidade Comercial (0-100)
   - Botão "Inspecionar Pipeline" (modal com rastreabilidade: Coleta → Normalização → Deduplicação → Qualificação Dupla → Modelos)
   - Link para "Ver Demonstração" nos 5 modelos visuais

### Fluxo de teste direto do runner (sem gravar no banco)

- Botão **"Testar runner.ts (JSON Bruto POA)"** → chama `POST /api/scraper/test-runner`.
- Delegada ao Worker de prospecção, que executa `scrapeGoogleMaps` para "barbearia Porto Alegre - RS" (5 fichas) e retorna o JSON bruto (`PlaceRecord[]`).
- Útil para validar o motor de coleta isoladamente, sem persistência nem qualificação comercial.

---

## 5. Pré-requisitos para a coleta funcionar de fato

O motor de scraping roda no servidor e requer um **Chromium remoto compatível com Puppeteer**. Configure como secret do Worker de prospecção (`wrangler.prospecting-scheduler.toml`):

- `BROWSER` — binding de navegador (Cloudflare Browser Rendering / Browserless)
- `PROSPECTING_WORKER_URL` — URL pública do Worker prospecting-scheduler
- `PROSPECTING_WORKER_SECRET` — segredo compartilhado para autenticação interna
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — credenciais server-side do Supabase
- `SUPABASE_PUBLISHABLE_KEY` — chave pública do Supabase

Sem `BROWSER` configurado no Worker, o runner não consegue abrir o Google Maps e a coleta não retorna fichas.

---

## 6. Resumo do que foi corrigido nesta sessão

1. **Removida duplicação**: saiu a opção "Nova Busca & Raspagem" (`prospeccao-buscar`) do menu; ficou apenas **Console de Scraping** (`prospeccao-scraping`) no `UnifiedAdminDashboard.tsx`.
2. **Criado endpoint `/api/prospecting/dashboard`** (`functions/api/prospecting/dashboard.ts`) — faltante, consumido pelo `ScrapingConsole.tsx` para carregar tarefas e fichas.
3. **Criado endpoint `/api/scraper/test-runner`** (`functions/api/scraper/test-runner.ts`) — faltante, consumido pelo botão de teste do runner.
4. **Ajustadas cores** do `ScrapingConsole.tsx` para ficar igual à plataforma `Tokenizaa/mais-clientes-v2` (tema `zinc-950`/`zinc-100` com acentos `emerald-500/600`).
5. **TypeScript compila sem erros** (`tsc --noEmit` limpo).
