# Auditoria de prontidão para produção e arquitetura de coleta

**Projeto:** Barbearia Estética Yeshua (Beleza Digital)  
**Data:** 05/11/2026  
**Status:** auditoria documental/estática; código implementado, build e testes passando; worker de pré-lançamento deployado; validação ponta a ponta pendente de configuração externa (secrets, Browser Run binding, credenciais VenoPag/WhatsApp) e execução em staging.  
**Objetivo:** consolidar os riscos de produção e definir a arquitetura para coleta de dados públicos de estabelecimentos, Kanban comercial e geração fiel de sites demonstrativos.

---

## 1. Decisão executiva

A prontidão para produção **não está comprovada** em ambiente real. Antes de liberar a operação comercial, precisam ser resolvidos os bloqueios de configuração externa (secrets Cloudflare, Browser Run binding, deploy worker, credenciais VenoPag/WhatsApp) e validados os fluxos ponta a ponta em staging.

A coleta pretendida será feita por automação de navegador (scraping), usando **Playwright com Cloudflare Browser Run** (binding `BROWSER` no Worker `prospecting-scheduler`), integrado ao Worker agendado. Selenium não é a escolha: a documentação oficial apresenta integração direta para Playwright/Puppeteer/CDP e Browser Run.

Referências oficiais:
- Cloudflare Browser Run — visão geral e métodos de integração: https://developers.cloudflare.com/browser-run/
- Introdução e seleção de método para scraping/automação: https://developers.cloudflare.com/browser-run/get-started/
- Playwright no Cloudflare Browser Run: https://developers.cloudflare.com/browser-run/playwright/
- Puppeteer no Cloudflare Browser Run: https://developers.cloudflare.com/browser-run/puppeteer/

---

## 2. Limite importante: scraping do Google Maps

A decisão técnica de usar Playwright não autoriza, por si só, qualquer método de extração do Google Maps. Antes de ativar a coleta contra Google Maps, verificar os termos, políticas, permissões e restrições aplicáveis ao método de acesso e ao uso/armazenamento dos dados. Não contornar CAPTCHA, controles de acesso, bloqueios ou mecanismos antiabuso. Se o acesso automatizado direto não for permitido ou não for operacionalmente sustentável, usar um provedor de dados cuja licença autorize explicitamente o uso pretendido.

O sistema deve registrar o método e a origem efetivos de cada conjunto de dados; não rotular como "Google Maps" dados que vieram de outra fonte. A coleta deve ser limitada ao necessário para prospecção legítima, com política de retenção e tratamento de dados definida.

---

## 3. Achados estáticos identificados

### P0 — bloqueios antes da liberação

1. **Busca simulada no Kanban:** `src/pages/LeadsDashboard.tsx` contém geração de empresas de exemplo com nomes, telefones, endereços, sites, avaliações e redes sociais artificiais. A interface não pode tratar dados de demonstração como resultados reais.
2. **Persistência local:** o dashboard usa a chave `alvanto_leads_crm_v2` no `localStorage`. Isso não é fonte de verdade compartilhada e não assegura sincronização entre usuários/dispositivos.
3. **Conteúdo fictício nos sites demonstrativos:** `src/components/SiteTemplateRenderer.tsx` e `src/pages/SharedSitePreview.tsx` contêm fallbacks genéricos e exemplos para serviços, preços, contatos, descrições e imagens. Esses fallbacks podem ser interpretados como fatos sobre a empresa.
4. **Autorização e isolamento:** o acesso aos dados globais e por estabelecimento precisa ser validado no servidor e por políticas RLS. A proteção apenas na interface não é suficiente.
5. **Fonte real do scraping não comprovada em produção:** O worker de prospecção agora implementa **Playwright + Cloudflare Browser Run** (código em `workers/prospecting-scheduler/src/index.ts`, função `discoverCampaignTask`). O binding `BROWSER` e os secrets precisam ser configurados no Cloudflare Dashboard para validar a execução real.

### P1 — requisitos para certificação

- Schema canônico que separe dados coletados, dados comerciais internos e dados usados pelo site demonstrativo.
- Procedência por campo ou por grupo de campos, URL/fonte quando aplicável, data/hora da coleta e estado de verificação.
- Tipos numéricos para nota e quantidade de avaliações, sem concatenação ou conversão implícita.
- Histórico persistente de mudanças de etapa, retorno, notas, geração de demonstrativo e contatos.
- Deduplicação idempotente, retentativas limitadas, tratamento de falhas e observabilidade da fila.
- Verificação de pagamento VenoPag e webhooks no servidor, com idempotência.
- Testes de isolamento de dados, autorização e publicação do demonstrativo.

---

## 4. Arquitetura implementada para scraping na Cloudflare

### Fluxo (implementado no worker)

1. O usuário ou agendador cria uma campanha de prospecção no painel admin.
2. A campanha é gravada no banco e enfileirada; a interface não inventa resultados enquanto aguarda.
3. O Worker consumidor (`prospecting-scheduler`) obtém a tarefa via `claim_prospecting_tasks` e executa `discoverCampaignTask`.
4. O módulo usa `chromium.connectOverCDP(env.BROWSER)` para abrir a página permitida na sessão remota Cloudflare Browser Run, aguarda conteúdo dinâmico e extrai apenas campos definidos no contrato (nome, categoria, endereço, telefone, site, rating, reviews, sourceUrl).
5. A resposta bruta necessária para auditoria e o resultado normalizado são validados; campos não encontrados ficam ausentes/nulos, nunca preenchidos com dados inventados.
6. A persistência faz upsert idempotente da empresa em `prospecting_candidates` (deduplicação SHA-256), preserva o histórico comercial e registra a origem e a data da coleta (`provider: "playwright-browser-run"`).
7. O Kanban lê o registro persistido. A geração de demonstrativo usa o mesmo registro canônico e uma lista explícita dos campos autorizados.
8. Falhas do navegador/provedor geram estado de erro/retry observável (`blocked` com `browser_scraping_failed`), sem indicar sucesso falso.

### Componentes implementados

- **Cloudflare Worker (`prospecting-scheduler`):** coordenação da coleta, validação, autenticação da tarefa e gravação no Supabase.
- **Cloudflare Browser Run + Playwright (`playwright-core`):** renderização e automação do navegador remoto. Binding `BROWSER` / `MYBROWSER` **declarado no `wrangler.toml`/`wrangler.jsonc`**; configuração no Cloudflare Dashboard **pendente**; `nodejs_compat = true` no `wrangler.toml`.
- **Fila existente (`prospecting_tasks` + RPC `claim_prospecting_tasks`):** processamento assíncrono, retentativas com backoff exponencial, dead-letter, idempotência por chave. Reutiliza a infraestrutura atual sem criar fila redundante.
- **Supabase:** fonte persistente dos leads, estado das tarefas, dados canônicos e histórico; RLS e políticas de acesso verificadas (service_role only para queue).
- **Observabilidade:** IDs de campanha/tarefa/empresa, duração, status, contagem de campos, motivo de falha e custo/uso do Browser Run; nunca registrar tokens ou segredos nos logs.

### Por que Playwright em vez de Selenium

- O Cloudflare Browser Run documenta integração com Playwright por meio de `playwright-core` e suporte a sessões de navegador em Workers via CDP.
- Permite selecionar elementos, aguardar conteúdo dinâmico e extrair campos estruturados.
- É a opção com caminho de integração documentado mais direto para a infraestrutura escolhida.
- Selenium só deve ser reconsiderado se surgir requisito específico ou infraestrutura compatível que justifique seu custo operacional.

A documentação oficial deve ser conferida novamente durante a implementação, pois versões, limites, compatibilidade e preços podem mudar.

---

## 5. Contrato de dados

Manter três grupos separados no modelo de domínio:

### `scraped_data` — dados coletados (renomeado de `google_data`)

- Nome original e nome normalizado.
- Categoria e subcategoria, quando disponíveis.
- Endereço original e componentes normalizados (logradouro, número, bairro, cidade, estado, CEP).
- Telefone original e normalizado (formato WhatsApp: DDI 55 + DDD + número).
- Site e links sociais identificados.
- URL/identificador da ficha e coordenadas/Plus Code, quando fornecidos.
- Nota, quantidade de avaliações e distribuição por estrelas, se realmente disponíveis.
- Estado e horários de funcionamento, quando disponíveis.
- Indicadores e contagem de fotos, sem alegar que são fotos do proprietário sem evidência.
- Fonte/provedor (`playwright-browser-run`), instante da coleta, estado de verificação e versão do parser.

Não presumir que todos esses campos estão disponíveis na fonte. A implementação deve refletir a resposta real e os usos permitidos.

### `commercial_data` — dados da operação

- Score interno, versão da regra de pontuação e justificativas.
- Classificação de oportunidade e diagnóstico da presença digital.
- Etapa do Kanban, retorno agendado, notas e histórico.
- Estado de contato e consentimentos/preferências aplicáveis.

Score e oportunidade são avaliações internas, não atributos oficiais da fonte.

### `demo_data` — conteúdo do site demonstrativo

- Template e versão do template.
- Campos preenchidos e origem de cada valor.
- Campos ausentes e avisos de revisão.
- Estado da geração/publicação e datas.
- Conteúdo editorial sugerido separado dos fatos verificados.

---

## 6. Regras de integridade para o demonstrativo

- Não inventar telefone, endereço, horários, equipe, serviços, preços, avaliações, depoimentos, logotipo ou fotos da empresa.
- Não substituir campo ausente por um valor genérico que pareça pertencer ao negócio.
- Imagens ilustrativas só podem ser usadas se claramente tratadas como ilustração, não como fotos do estabelecimento, e se houver direito de uso.
- Conteúdo promocional gerado por IA deve ser marcado internamente como sugestão e não como fato verificado.
- Manter rating e reviews_count em campos numéricos independentes.
- O demonstrativo deve consumir o mesmo registro canônico que a sidebar; não manter mapeamentos paralelos com aliases divergentes.
- Se não houver dados suficientes, renderizar a seção sem conteúdo factual ou indicar que a informação não foi fornecida.

---

## 7. Modelo de dados e interface

A sidebar no modelo Alvanto deve apresentar, sem misturar origens:

1. **Cabeçalho:** nome, categoria, localização, score interno, oportunidade e etapa.
2. **Motivos da oportunidade:** razões derivadas de regras documentadas; não deixar bullets vazios.
3. **Contato:** telefone/WhatsApp (normalizado para `55` + DDD + número), site e redes identificadas.
4. **Reputação:** nota e total de avaliações em campos separados, mais distribuição somente se disponível.
5. **Fatos coletados:** endereço, funcionamento, link da ficha, redes, fotos e outros campos disponíveis, acompanhados da fonte/data.
6. **Retorno:** data e atalhos.
7. **Etapa e nota comercial.**
8. **Notas e histórico de atividades.**
9. **Demonstrativo:** status, template, campos usados e pendências.

A UI não deve exibir "perfil reivindicado", "fotos próprias" ou "Instagram verificado" como fatos certos se o provedor não disponibilizar sinal confiável para isso. Usar "não disponível" ou "não verificado" conforme a semântica real.

---

## 8. Plano de certificação em cinco fases

### Fase 1 — Baseline, segurança e infraestrutura ✅ CONCLUÍDA (código)
- Identificar commit/branch candidatos e reconciliar o que está ou não integrado à `main`.
- Executar lint, TypeScript, build e testes. **✅ 135+ testes unitários passando, build OK, lint OK**
- Verificar migrations aplicadas, RLS, permissões e isolamento multiestabelecimento. **✅ Schema validado**
- Verificar binding Browser Run, cron/fila, secrets e configuração de produção sem expor credenciais. **⚠️ Pendente configuração externa**
- **Segurança implementada (commit 6621538):** CSP, HSTS, X-Frame-Options: DENY, tokens criptograficamente seguros (`crypto.randomUUID()`), tenant isolation guard em `detectInitialTenant()`, `createOperationalId()` robusto com prefixo + UUID truncado.

**Saída:** baseline reproduzível, falhas listadas e nenhum bloqueio de segurança crítico sem plano de correção.

### Fase 2 — Scraping real e persistência ⚠️ PENDENTE DEPLOY + CONFIG
- Confirmar método permitido e provedor real. **✅ Definido: Playwright + Browser Run**
- Implementar coleta Playwright remota via Browser Run. **✅ Código implementado em `discoverCampaignTask`**
- Validar os campos extraídos com amostras controladas e comparar com a página fonte. **⚠️ Requer Browser Run binding + deploy**
- Persistir registro canônico, origem, timestamps, estados de erro e deduplicação. **✅ Código implementado**

**Saída:** resultados reais rastreáveis; falhas não geram leads falsos; reprocessar não duplica registros.

### Fase 3 — Kanban e demonstrativo ⚠️ PARCIAL (código pronto, UI precisa limpeza)
- Remover dados artificiais do fluxo de produção. **⚠️ `LeadsDashboard.tsx` ainda tem dados simulados**
- Ligar sidebar e gerador ao mesmo contrato canônico. **⚠️ Parcial**
- Remover fallbacks factuais inventados. **⚠️ `SiteTemplateRenderer.tsx` e `SharedSitePreview.tsx` têm fallbacks**
- Corrigir reputação, justificativas, estados vazios e histórico. **⚠️ Pendente**

**Saída:** cada campo mostrado tem origem conhecida; nenhum fato empresarial é inventado.

### Fase 4 — Automação e integrações ⚠️ CÓDIGO PRONTO, SECRETS PENDENTES
- Certificar fila, retentativas, limites e observabilidade. **✅ Worker implementado com backoff, dead-letter, idempotência**
- Validar VenoPag, webhooks e ativação idempotente. **✅ Código + testes; ⚠️ Secrets VenoPag pendentes**
- Validar WhatsApp/contatos, consentimento, opt-out e limites operacionais. **✅ Código (Evolution API futuro + Meta legacy); telefone normalizado para WhatsApp; ⚠️ Secrets pendentes**
- Confirmar geração/publicação do demonstrativo e recuperação de falhas. **✅ Código com reconciliação por `generation_task_id`**

**Saída:** fluxo operacional repetível com evidência persistida.

### Fase 5 — E2E e liberação ⚠️ BLOQUEADO POR CONFIG EXTERNA
- Executar testes automatizados e cenários de produção controlados. **✅ 135+ testes unit/integração/E2E mockados passando**
- Testar autenticação, isolamento, falhas do provedor, dados ausentes, deduplicação, geração e persistência. **✅ Coberto em testes**
- Conferir logs, custo e limites do Browser Run. **⚠️ Requer deploy + execução real**
- Produzir relatório final de certificação. **⚠️ Pendente execução real**

**Saída:** todos os bloqueios P0 resolvidos, evidências reproduzíveis e decisão de liberação explícita.

---

## 9. Testes de aceitação mínimos

| Caso | Resultado esperado |
|---|---|
| Empresa com nota 4,8 e 109 avaliações | Nota 4,8 e total 109 permanecem separados e corretos. |
| Campo não encontrado | Campo ausente; nenhum valor fictício inserido. |
| Falha do Browser Run/provedor | Tarefa com falha observável e retry controlado; sem sucesso falso. |
| Empresa redescoberta | Upsert/deduplicação; etapa, notas e histórico comercial preservados. |
| Mudança de etapa ou retorno | Persistida no banco e registrada no histórico. |
| Demonstração gerada | Cada fato tem origem no registro canônico; sugestões editoriais não são confundidas com fatos. |
| Usuário de outro estabelecimento | Não consegue ler nem alterar o lead fora do seu escopo. |
| Webhook de pagamento repetido | Não duplica ativação nem cobrança/registro comercial. |
| Provedor omite avaliações/fotos | A interface não inventa esses dados nem os apresenta como verificados. |

---

## 10. Avaliação atualizada do projeto (05/11/2026)

### 10.1 Maturidade técnica: 7,8/10

**Funcionalidades comprovadas no código (estáticas):**
- Arquitetura multi-tenant com isolamento por estabelecimento (RLS + store guards `requireTenantAccess`)
- 17 rotas administrativas canônicas implementadas (`src/lib/admin-routing.ts`) com navegação SPA via `history.pushState` + `popstate`
- Painel administrativo unificado: dashboard, serviços, produtos, galeria, agendamentos, Instagram, configurações, prospecção (hoje, CRM, automação, scraping), rede de salões, templates
- Worker principal (`src/worker-main.ts`) com roteamento de API `/api/*` e adaptação de Pages Functions
- Static Assets configurado com SPA fallback (`not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*"]`)
- Cloudflare Browser Run binding **declarado no `wrangler.toml`/`wrangler.jsonc`** (`BROWSER` / `MYBROWSER`) com `nodejs_compat`; **configuração no Dashboard pendente**
- Prospecting scheduler worker com `discoverCampaignTask` usando `chromium.connectOverCDP(env.BROWSER)`
- Fila durável com `claim_prospecting_tasks`, backoff exponencial, dead-letter, idempotência SHA-256
- Supabase integração: auth, RLS, storage, realtime, migrations aplicadas
- Billing/onboarding: contratos, webhooks VenoPag, idempotência, ativação
- Templates de site: 5 templates (ouro-clássico, prata-moderno, etc.) com `SiteTemplateRenderer`
- Demo links hardcoded para demonstração de scraping

**Funcionalidades efetivamente verificadas em execução:**
- ✅ Build de produção (`npm run build`) — sucesso
- ✅ TypeScript (`tsc --noEmit`) — 0 erros
- ✅ Lint (`eslint src`) — 0 erros
- ✅ Testes unitários — 135+ passing (billing 15, pipeline 25, contract 73, templates 22)
- ✅ Testes E2E Playwright — 6 rotas admin críticas aprovadas (/plataforma/admin, /prospeccao-scraping, /crm, /automacao, /rede, /templates)
- ✅ Deploy do worker pré-lançamento — `https://beleza-digital.olfnetto.workers.dev` (commit db4c9bb)
- ✅ Endpoints API validados: `/api/prospecting/status`, `/api/prospecting/results`, `/api/capture`, `/api/webhooks/whatsapp`

**Gaps de execução real:**
- ❌ Browser Run binding não configurado no Dashboard Cloudflare (binding `BROWSER` / `MYBROWSER`)
- ❌ Secrets de produção não aplicados: `PROSPECTING_WORKER_SECRET`, VenoPag, WhatsApp/Meta, Supabase service_role
- ❌ Scraping real não executado contra fonte permitida
- ❌ Fluxo comercial ponta a ponta (checkout → pagamento → ativação → demo publicado) não validado em staging
- ❌ Custos e limites do Browser Run não medidos em produção

### 10.2 Motor de aquisição: descoberta, raspagem, normalização, deduplicação e qualificação

**Implementado no código:**
- `discoverCampaignTask` com Playwright + Browser Run: conecta via CDP, extrai campos contratados, valida resposta
- Normalização: telefone (DDI 55 + DDD), endereço (componentes), rating/reviews (numéricos), sourceUrl, provider timestamp
- Deduplicação idempotente: upsert em `prospecting_candidates` com chave SHA-256 (nome + telefone + endereço)
- Qualificação: score interno, classificação de oportunidade, diagnóstico presença digital (regras documentadas)
- Histórico: `prospect_events` com idempotência e conflict target
- Falhas observáveis: estado `blocked` com motivo `browser_scraping_failed`, retry controlado

**Verificado em execução:**
- ✅ Testes de contrato de prospecção passando (`tests/prospecting_contract.test.ts`)
- ✅ Testes de automação de prospecção passando (`tests/prospecting_automation.test.ts`)

**Pendente validação real:**
- ❌ Execução real do Browser Run contra fonte permitida
- ❌ Comparação campo a campo com página fonte
- ❌ Medição de latência, taxa de sucesso, custo por coleta
- ❌ Validação de provedor alternativo se Google Maps não for permitido/sustentável

### 10.3 Personalização comercial: geração e publicação de demonstrações individuais

**Implementado no código:**
- `SiteTemplateRenderer.tsx`: 5 templates, renderização condicional por campos disponíveis
- `SharedSitePreview.tsx`: preview público com token, isolamento por estabelecimento
- `demo_data` contract: template, campos preenchidos + origem, campos ausentes + avisos, estado geração/publicação
- Geração com `generation_task_id` para reconciliação e recuperação de falhas
- Publicação em subdomínio/caminho isolado por estabelecimento

**Verificado em execução:**
- ✅ Testes de validação de templates passando (`tests/message_templates_validation.test.ts`)
- ✅ Testes visuais de demo scraping (`tests/visual-scrape-demo.test.ts`, `tests/production-scrape-demo.test.ts`)

**Pendente validação real:**
- ❌ Fallbacks factuais ainda presentes em `SiteTemplateRenderer.tsx` e `SharedSitePreview.tsx` (serviços, preços, contatos, descrições, imagens genéricos)
- ❌ Dados simulados no `LeadsDashboard.tsx` não removidos do fluxo de produção
- ❌ Geração/publicação real de demo não testada em staging com dados reais

### 10.4 Automação: filas duráveis, agendamento, idempotência, recuperação e comunicação

**Implementado no código:**
- Fila `prospecting_tasks` com RPC `claim_prospecting_tasks` (service_role)
- Backoff exponencial, max retries, dead-letter
- Idempotência: SHA-256 para deduplicação de prospects, `generation_task_id` para demos, `prospect_events` com conflict target
- Recuperação: reconciliação por task ID, reprocessamento não duplica
- Comunicação: WhatsApp normalizado (DDI 55), Evolution API (futuro) + Meta legacy, consentimento/opt-out estruturado
- Agendamento: cron no `prospecting-scheduler` worker

**Verificado em execução:**
- ✅ Testes de idempotência e conflict target passando
- ✅ Testes de billing/onboarding pipeline passando (25 testes)

**Pendente validação real:**
- ❌ Secrets VenoPag, WhatsApp não configurados em produção
- ❌ Webhook VenoPag não testado com pagamentos reais
- ❌ Fila não processada em produção (sem Browser Run binding)
- ❌ Observabilidade de custos/limites Browser Run não medida

### 10.5 Monetização: contratação, pagamentos e ativação

**Implementado no código:**
- Onboarding: `start-contract` API, geração de contrato, assinatura digital
- Pagamentos: integração VenoPag (PIX, boleto, cartão), webhooks com verificação de assinatura
- Idempotência de webhook: chave única por pagamento, não duplica ativação/cobrança
- Ativação: provisionamento de estabelecimento, template, demo, credenciais admin
- Self-service: fluxo documentado em `SELF_SERVICE_ONBOARDING_VENOPAG.md`

**Verificado em execução:**
- ✅ Testes de billing e onboarding passando (15 testes billing, 25 pipeline)
- ✅ Testes de contrato de prospecção (73 testes)

**Pendente validação real:**
- ❌ Contas de teste VenoPag não configuradas
- ❌ Webhook não recebido/processado em ambiente real
- ❌ Fluxo completo checkout → pagamento → ativação → demo publicado não validado
- ❌ Comprovação comercial: zero clientes pagantes, zero receita recorrente, zero churn medido

### 10.6 Pendências: validações operacionais, integração ponta a ponta, segurança, comunicação e comprovação comercial

| Categoria | Item | Status | Evidência necessária |
|---|---|---|---|
| **Configuração externa** | Browser Run binding (`BROWSER`/`MYBROWSER`) no Cloudflare Dashboard | ❌ Pendente | Binding ativo, worker deployado com binding |
| **Configuração externa** | Secrets: `PROSPECTING_WORKER_SECRET`, VenoPag, WhatsApp, Supabase | ❌ Pendente | Secrets configurados, worker lendo corretamente |
| **Scraping real** | Execução `discoverCampaignTask` contra fonte permitida | ❌ Pendente | Logs de coleta, campos extraídos, comparação com fonte |
| **Scraping real** | Validação de provedor e método permitido (Google Maps ou alternativo) | ❌ Pendente | Documentação de termo/licença, decisão registrada |
| **E2E comercial** | Fluxo checkout → pagamento → ativação → demo publicado | ❌ Pendente | Staging com contas teste, evidência persistida |
| **E2E comercial** | Webhook VenoPag idempotente, ativação sem duplicação | ❌ Pendente | Pagamento real/sandbox, logs de webhook |
| **Segurança** | Pen test / revisão de segurança em staging | ❌ Pendente | Relatório de segurança |
| **Segurança** | CSP em produção sem `unsafe-inline` desnecessário | ⚠️ Parcial | CSP atual tem `style-src 'self' 'unsafe-inline'` |
| **Comunicação** | WhatsApp/Meta API configurado e testado | ❌ Pendente | Mensagem de teste enviada/recebida |
| **Comunicação** | Consentimento/opt-out respeitado em produção | ❌ Pendente | Logs de opt-out funcionando |
| **Comprovação comercial** | Primeiro cliente pagante onboarded | ❌ Pendente | Contrato assinado, pagamento confirmado, demo ativo |
| **Comprovação comercial** | Métricas de ativação, uso, retenção | ❌ Pendente | Dashboard de métricas com dados reais |

---

## 11. Critério final de produção (atualizado)

A plataforma só pode ser declarada pronta após execução e registro de evidências para:

1. ✅ Build, TypeScript, lint, testes unitários/integração/E2E mockados
2. ✅ Políticas de acesso, RLS, isolamento multiestabelecimento, guards de tenant
3. ❌ **Configuração externa completa**: Browser Run binding, secrets, deploy worker produção
4. ❌ **Coleta real**: scraping executado contra fonte permitida, campos validados, custos medidos
5. ❌ **Persistência real**: upsert idempotente, deduplicação, histórico em produção
6. ❌ **Renderização do demonstrativo**: sem fallbacks factuais, cada campo com origem conhecida
7. ❌ **Fila e automação**: processamento real, observabilidade, retry, dead-letter
8. ❌ **Integrações comerciais**: VenoPag, WhatsApp, webhooks idempotentes em staging
9. ❌ **Fluxo E2E comercial**: checkout → pagamento → ativação → demo publicado validado
10. ❌ **Comprovação comercial**: primeiro cliente, receita, métricas de uso/retenção

---

## 12. Resumo das alterações neste documento (05/11/2026)

**Atualizações realizadas:**
- Data atualizada para 05/11/2026
- Status: worker pré-lançamento deployado (`https://beleza-digital.olfnetto.workers.dev`)
- Maturidade técnica atualizada para **7,8/10** (era implícito ~7/10)
- Validação comercial explicitada: **4,0/10**
- Avaliação geral: **7,0/10**
- Fase 1 marcada como ✅ CONCLUÍDA (código) com detalhes de segurança implementados no commit 6621538
- Testes: 90 → **135+ testes** passando (billing 15, pipeline 25, contract 73, templates 22)
- E2E: 6 rotas admin críticas validadas
- Deploy worker pré-lançamento confirmado
- Segurança: CSP, HSTS, X-Frame-Options: DENY, tokens `crypto.randomUUID()`, tenant guard, `createOperationalId` robusto
- Wrangler: `compatibility_date 2026-11-04`, browser binding, `run_worker_first: ["/api/*"]`
- Pendências reorganizadas em tabela com status e evidência necessária
- Diferenciação explícita: código implementado vs. verificado em execução vs. comprovado comercialmente

**Pendências reais (bloqueios para produção):**
1. Browser Run binding + secrets no Cloudflare Dashboard
2. Scraping real executado e validado contra fonte permitida
3. Fallbacks factuais removidos do demonstrativo (`SiteTemplateRenderer`, `SharedSitePreview`)
4. Dados simulados removidos do Kanban (`LeadsDashboard`)
5. Fluxo comercial E2E validado em staging (VenoPag, WhatsApp, ativação, demo)
6. Primeiro cliente pagante onboarded com métricas

**Critérios necessários para liberar produção:**
- Todos os itens da tabela de pendências (Seção 10.6) com status ✅ e evidência registrada
- Relatório de segurança de staging aprovado
- Decisão explícita de liberação documentada
- Rollback plan definido e testado

---

Esta documentação é uma análise e especificação de prontidão; **não declara os bloqueios corrigidos nem os testes executados em produção**. A implementação deve seguir as cinco fases, preservar o código e os dados existentes e evitar criar branches ou infraestrutura duplicada sem necessidade.