# Auditoria Beleza_Digital - Relatório Base e Plano de Ação

**Data:** 27 de outubro de 2026
**Projeto:** Beleza_Digital - Plataforma multitenant para barbearias/estéticas
**Objetivo:** Auditoria completa dos domínios do projeto e plano de ação estruturado

---

## 1. Visão Geral do Projeto

O Beleza_Digital é uma plataforma React + Vite + Supabase + Cloudflare Workers destinada a estabelecimentos de beleza (barbearias, salões, estéticas). A arquitetura utiliza:

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend/Worker:** Cloudflare Workers API (`functions/api/prospecting.run`)
- **Banco de Dados:** Supabase (PostgreSQL) - opcional, fallback para localStorage
- **State Management:** localStorage-first via `src/data/store.ts`
- **Autenticação:** Mix de Supabase Auth real + sessões sintéticas localStorage/sessionStorage

---

## 2. Domínios Auditados

### Domínio 1: Prospecção
- **Arquivos/chaves:** `functions/api/prospecting/`, `workers/prospecting-scheduler/src/`, `src/lib/prospecting.ts`
- **Funcionalidades:** Busca automatizada de leads via Google Maps/Playwright, normalização de dados, qualificação de prospects, geração de sites demo
- **Gaps Críticos:** `succeeded: 0, blocked: 1` ilusão no relatório de resultados; campos não capturados (email, instagram, logo, coordenadas)

### Domínio 2: CRM & Conversão
- **Arquivos/chaves:** `src/pages/LeadsDashboard.tsx`, `src/data/store.ts`
- **Funcionalidades:** Gestão de estágios do prospect (discovered → qualified → converted), métricas, persistência de estágios
- **Gaps Críticos:** Companies vazias quando Supabase não configurado; ilusão de "succeeded: 0"; validação de resposta API incompleta

### Domínio 3: Administração de Estabelecimentos
- **Arquivos/chaves:** `src/pages/UnifiedAdminDashboard.tsx`, `src/data/store.ts`
- **Funcionalidades:** Cadastro de estabelecimentos, seleção de tenant, módulos (Salao, Prospecção, Rede, Templates)
- **Gaps Críticos:** Isolamento multitenant inconsistente; URL `?tenant=` pode bypassar checks; sessões sintéticas sem Supabase real

### Domínio 4: Autenticação & Autorização
- **Arquivos/chaves:** `src/lib/supabase.ts`, `src/data/store.ts`, `src/pages/*`
- **Funcionalidades:** Login, persistência de sessão, gates de acesso por papel (role)
- **Gaps Críticos:** Auth sintético sem Supabase sign-in; gates inconsistentes entre PlatformAdminDashboard vs UnifiedAdminDashboard vs SuperAdminPage; redirect quebrado quando Supabase não configurado

### Domínio 5: Site Público / Demo
- **Arquivos/chaves:** `src/pages/` (HomePage, ServicesPage, GalleryPage, ProductsPage, ContactPage, AppointmentPage), `src/types/index.ts`, `CONTRACTO_CANONICO.md`
- **Funcionalidades:** Geração de sites públicos por template, preview compartilhável (ShareableSitePreview), renderizador de templates (SiteTemplateRenderer)
- **Gaps Críticos:** Campos canônicos não fluem do banco para o preview (logoUrl, coverUrl, latitude, longitude, services, products, media); InstagramSection não descomentado/usado corretamente

### Domínio 6: Catálogo de Templates
- **Arquivos/chaves:** `src/pages/Template Catalog`, `src/types/templates.ts`
- **Funcionalidades:** 5 templates de site, aplicação de template, preview em tempo real
- **Observação:** Funciona como UI client-side, sem backend necessário para preview

### Domínio 7: Cobrança & Onboarding
- **Arquivos/chaves:** `functions/api/billing/`, `functions/api/onboarding/`
- **Funcionalidades:** Planos de assinatura, checkout, webhooks, cadastro de novos estabelecimentos
- **Observação:** Integração com pagamentos e contratos contratuais

### Domínio 8: Agendamento
- **Arquivos/chaves:** `functions/api/appointments/`
- **Funcionalidades:** Criação e gestão de appointments/consultas
- **Observação:** Módulo simples com create.ts

### Domínio 9: Integrações & Webhooks
- **Arquivos/chaves:** `functions/api/webhooks/`
- **Funcionalidades:** Webhook do WhatsApp, integrações externas
- **Observação:** Integração específica para notificações WhatsApp

### Domínio 10: Store de Dados
- **Arquivos/chaves:** `src/data/store.ts`
- **Funcionalidades:** Motor de estado multitenant, seleção de tenant, login functions, session persistence, platform metrics, data migration
- **Observação:** Fonte de verdade principal (localStorage), Supabase apenas para auth

---

## 3. Plano de Ação - Fases

### Fase 1: Correções Críticas (Imediato)
| # | Tarefa | Domínio | Prioridade | Responsável |
|---|--------|---------|------------|-------------|
| 1 | Implementar validação `succeeded === 0` no LeadsDashboard | Prospecção/CRM | CRÍTICO | Backend/Frontend |
| 2 | Unificar modelo de auth: Supabase real OU localStorage-only | Auth | CRÍTICO | All |
| 3 | Corrigir redirect `/plataforma/acesso?mode=login` quando Supabase não configurado | Auth | CRÍTICO | Frontend |
| 4 | Fortalecer isolamento multitenant: validar `currentSession.establishmentId` vs `?tenant=` | Multitenant | CRÍTICO | Frontend |

### Fase 2: Correções de Alto Impacto (Curto Prazo)
| # | Tarefa | Domínio | Prioridade | Responsável |
|---|--------|---------|------------|-------------|
| 5 | Expandir ShareableSitePreview com todos campos canônicos (logoUrl, coverUrl, instagram*, coords) | Site Público | ALTO | Frontend |
| 6 | Implementar fallback graceful quando Supabase não configurado (modo demo) | Auth/CRM | ALTO | Frontend |
| 7 | Corrigir display de InstagramSection nas páginas Home, Gallery, Products | Site Público | ALTO | Frontend |
| 8 | Corrigir ilusão de metrics: exibir both `succeeded` e `blocked` transparentemente | Prospecção | ALTO | Frontend/Backend |

### Fase 3: Melhorias de Médio Impacto
| # | Tarefa | Domínio | Prioridade | Responsável |
|---|--------|---------|------------|-------------|
| 9 | Adicionar campos email, latitude, longitude ao schema canônico e persistence | Todos | MÉDIO | Backend/DB |
| 10 | Implementar cross-tab state synchronization via StorageEvent | Store | MÉDIO | Frontend |
| 11 | Melhorar mensagens de erro técnicas para amigáveis ao usuário | Todos | MÉDIO | Frontend |
| 12 | Documentar arquitetura com ADR (Architecture Decision Record) | Transversal | MÉDIO | All |

### Fase 4: Evoluções (Longo Prazo)
| # | Tarefa | Domínio | Prioridade | Responsável |
|---|--------|---------|------------|-------------|
| 13 | Implementar Row Level Security (RLS) no Supabase para isolamento multitenant | Banco de Dados | BAIXO | Backend |
| 14 | Migração de dados localStorage → Supabase real | Infraestrutura | BAIXO | Backend/DevOps |
| 15 | Implementar API de enriquecimento (scraping completo: email, instagram, coords) | Prospecção | BAIXO | Backend |

---

## 4. Agentes e Skills Disponíveis para Auditoría

### Agentes DSH Disponíveis:

1. **agent-all** - Catálogo unificado de todos os components (Agents, Subagents, Skills, Workflows, MCPs) com classificação por subsistema

2. **agent-architecture-review** - Guardião de qualidade. Revisa PRs, valida SOLID, acoplamento, performance, contratos entre agentes. Pode reprovar mudanças que violam arquitetura.

3. **agent-architecture-test** - Teste HARD do PROJETO — analisa stack, arquitetura, domínios, backend, banco, frontend, qualidade, segurança e performance do código. Gera relatório de saúde do projeto (0-100).

4. **agent-backend** - Desenvolvimento backend — rotas, serviços, autenticação, middleware, validação, contratos de API.

5. **agent-frontend** - Desenvolvimento frontend — componentes, estado, roteamento, estilos, integração com APIs.

6. **agent-testing** - Qualidade e testes — unitários, integração, E2E, performance. Define estratégia e garante cobertura.

7. **agent-security-review** - Auditoria de segurança — OWASP Top 10, secrets, SSRF, injection, crypto insegura.

8. **agent-refactor** - Remove código morto, duplicatas e dependências não usadas (knip, depcheck, ts-prune).

9. **agent-build-fix** - Resolve erros de build e TypeScript com diffs mínimos. Build verde rápido, sem mudanças arquiteturais.

10. **agent-context** - Documentação viva. Cria/atualiza ADRs, sincroniza folder-structure, registra topologia de agentes, roadmap e decision-log.

### Skills Disponíveis:

1. **qualidade** - Revisão de código, auditoria de qualidade, validação de arquitetura. Acionado por @qualidade em workflows.

2. **dsh-workflows** - Executar, listar ou auditar workflows de agent-loop, gov-loop-orchestrator, agent-creation, discovery-pipeline.

3. **project-discovery** - Inventariar projeto, detectar linguagem, framework, estrutura, CI/CD, configurações e documentação (fase 1 do discovery pipeline).

4. **agent-loop-core** - Núcleo da máquina de estados do loop de agentes — percepção→decisão→ação→verificação com gates obrigatórios.

5. **agent-generator** - Gera agentes de domínio a partir da descoberta. Define escopo, fronteiras, ferramentas e critérios de cada agente.

6. **agent-discovery** - Descobre e cataloga todos os agents disponíveis com suas especialidades.

7. **agent-supervisor** - Orquestrador. Distribui tarefas, resolve conflitos, valida shared kernel, controla roadmap, aciona discovery pipeline.

8. **agent-loop-orchestrator** - Orquestrador de Loop Engineering — gerencia ciclo completo de feature: guards de entrada, ritual de abertura, dispatch maker/checker, hash-check working tree, persistência estado, gates de fase, checkpoint humano.

9. **agent-architecture-test** - Teste hard do projeto - gera relatório de saúde (0-100).

10. **comprehensive-audit** - Metodologia universal de auditoria de plataforma — 13 domínios, checklists executáveis, critérios P0-P3 por estágio.

### Skills Externas Disponíveis (se necessário):

- **cloudflare** - Workers, Pages, KV, D1, R2, AI (Workers AI), networking, security
- **web-perf** - Análise de performance usando Chrome DevTools MCP, Core Web Vitals
- **firecrawl** - Web scraping, crawling, knowledge base building (para dados de prospecção)
- **agent-architecture-review** - Validação de contratos e arquitetura

---

## 5. Próximos Passos

1. **Validar esse documento** com o time/product owner
2. **Priorizar as fases** crítico vs não-crítico baseado no roadmap
3. **Atribuir responsáveis** para cada item do plano de ação
4. **Criar tickets** no tracker (GitHub Issues) para cada tarefa
5. **Definir métricas de sucesso** para cada domínio auditado
6. **Agendar sessões de work** com agents especializados conforme o plano

---
*Relatório gerado automaticamente pela análise inicial de código e estrutura do projeto Beleza_Digital.*