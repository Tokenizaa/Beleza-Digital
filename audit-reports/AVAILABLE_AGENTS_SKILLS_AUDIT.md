# Available Agents & Skills Identification - Beleza_Digital Audit

**Data:** 27 de outubro de 2026
**Projeto:** Beleza_Digital - Plataforma multitenant para barbearias/estéticas
**Objetivo:** Identificar todos agents e skills disponíveis para auditoria completa

---

## 1. Visão Geral

Esta seção identifica todos os agents (subagents) e skills (habilidades especializadas) disponíveis no ecossistema OpenCode/DSH para serem utilizados na auditoria do projeto Beleza_Digital. O projeto utiliza uma arquitetura React + Vite + Supabase + Cloudflare Workers com estado localStorage-first.

---

## 2. Agentes DSH Disponíveis

Baseado na exploração do código e relatórios existentes, os seguintes agents estão disponíveis:

### 2.1 Agentes Core (Always Available)

| ID | Nome | Descrição | Domínio Principal |
|----|------|-----------|-------------------|
| `agent-all` | Agent All | Catálogo unificado DSH — visão de todos os components (Agents, Subagents, Skills, Workflows, MCPs) com classificação por subsistema | Visão geral/ catalogação |
| `agent-architecture-review` | Agent Architecture Review | Guardião de qualidade. Revisa PRs, valida SOLID, acoplamento, performance, contratos entre agentes. Pode reprovar mudanças que violam arquitetura | Qualidade/Arquitetura |
| `agent-architecture-test` | Agent Architecture Test | Teste HARD do PROJETO — analisa stack, arquitetura, domínios, backend, banco, frontend, qualidade, segurança e performance do código. Gera relatório de saúde do projeto (0-100). | Testes/Health Check |
| `agent-backend` | Agent Backend | Desenvolvimento backend — rotas, serviços, autenticação, middleware, validação, contratos de API. | Backend/API |
| `agent-frontend` | Agent Frontend | Desenvolvimento frontend — componentes, estado, roteamento, estilos, integração com APIs. | Frontend/UI |
| `agent-testing` | Agent Testing | Qualidade e testes — unitários, integração, E2E, performance. Define estratégia e garante cobertura. | Testes/Quality |
| `agent-security-review` | Agent Security Review | Auditoria de segurança — OWASP Top 10, secrets, SSRF, injection, crypto insegura. Revisa código com dados sensíveis. | Segurança |
| `agent-refactor` | Agent Refactor | Remove código morto, duplicatas e dependências não usadas (knip, depcheck, ts-prune). Refatoração segura com DELETION_LOG. | Refatoração |
| `agent-build-fix` | Agent Build Fix | Resolve erros de build e TypeScript com diffs mínimos. Build verde rápido, sem mudanças arquiteturais. | Build/TypeScript |
| `agent-context` | Agent Context | Documentação viva. Cria/atualiza ADRs, sincroniza folder-structure, registra topologia de agentes, roadmap e decision-log. | Documentação |

### 2.2 Agentes de Orquestração

| ID | Nome | Descrição | Domínio Principal |
|----|------|-----------|-------------------|
| `agent-supervisor` | Agent Supervisor | Orquestrador. Distribui tarefas, resolve conflitos, valida shared kernel, controla roadmap, aciona discovery pipeline. | Orquestração/Gestão |
| `agent-loop-orchestrator` | Agent Loop Orchestrator | Orquestrador de Loop Engineering — gerencia ciclo completo de feature: guards de entrada, ritual de abertura, dispatch maker/checker, hash-check working tree, persistência estado, gates de fase, checkpoint humano. | Engineering Loop |
| `agent-generator` | Agent Generator | Gera agentes de domínio a partir da descoberta. Define escopo, fronteiras, ferramentas e critérios de cada agente. | Criação de Agents |
| `agent-discovery` | Agent Discovery | Descobre e cataloga todos os agents disponíveis com suas especialidades | Descoberta |

### 2.3 Agentes que foram utilizados em auditorias anteriores

| ID | Nome | Descrição | Último Uso |
|----|------|-----------|------------|
| `Subagent A` | Arquitetura e Dashboard | Liderou auditoria arquitetural completa, examinou 8 arquivos-chave, 18+ matrizes de avaliação | AUDIT_REPORT.md |
| `Subagent B` | Banco de Dados e Contratos | Focou em schema, migrations, contratos, RLS, integridade de dados | RELATORIO_INVENTARIO_PARTE1.md |
| `Subagent C` | Negócio e Financeiro | Auditou missões de negócio e financeiro, matrizes de negócio/financeiro | AUDIT_MATRIX_BUSINESS_FINANCIAL.md |
| `Subagent D` | Prospecção e Conversão | Auditou módulo de prospecção, geração de sites, conversão de leads | AUDIT_RELATORIO_MODO_PROSPECCAO.md |
| `Subagent E` | Segurança, Testes e Operação | Focou em segurança, testes, operações do sistema | PLATFORM_AUDITOR_REPORT.md |

---

## 3. Skills Disponíveis

### 3.1 Skills Internas DSH

| ID | Nome | Descrição | Quando Utilizar |
|----|------|-----------|-----------------|
| `qualidade` | Qualidade | Revisão de código, auditoria de qualidade, validação de arquitetura. Acionado por @qualidade em workflows. | Revisão de PR, auditoria de quality gates |
| `dsh-workflows` | DSH Workflows | Executar, listar ou auditar workflows de agent-loop, gov-loop-orchestrator, agent-creation, discovery-pipeline. | Listar/ executar workflows registrados |
| `project-discovery` | Project Discovery | Inventariar projeto, detectar linguagem, framework, estrutura, CI/CD, configurações e documentação (fase 1 do discovery pipeline). | Início de auditoria - understanding the project |
| `agent-loop-core` | Agent Loop Core | Núcleo da máquina de estados do loop de agentes — percepção→decisão→ação→verificação com gates obrigatórios, estado persistente em disco. | Understanding agent loop mechanics |
| `agent-generator` | Agent Generator | Gera agentes de domínio a partir da descoberta. Define escopo, fronteiras, ferramentas e critérios de cada agente. | Creating new agents based on findings |
| `agent-discovery` | Agent Discovery | Descobre e cataloga todos os agents disponíveis com suas especialidades | Catalogo de agents disponíveis |
| `agent-supervisor` | Agent Supervisor | Orquestrador. Distribui tarefas, resolve conflitos, valida shared kernel, controla roadmap, aciona discovery pipeline. | Task distribution and conflict resolution |
| `agent-loop-orchestrator` | Agent Loop Orchestrator | Orquestrador de Loop Engineering — gerencia ciclo completo de feature. | Feature cycle management |
| `agent-architecture-test` | Agent Architecture Test | Teste hard do projeto - gera relatório de saúde (0-100). | Health check do projeto completo |
| `comprehensive-audit` | Comprehensive Audit | Metodologia universal de auditoria de plataforma — 13 domínios, checklists executáveis, critérios P0-P3 por estágio. | Auditorias completas multidisciplinares |

### 3.2 Skills Externas (Quando Necessário)

| ID | Nome | Descrição | Domínio |
|----|------|-----------|---------|
| `cloudflare` | Cloudflare | Workers, Pages, KV, D1, R2, AI (Workers AI, Vectorize, Agents SDK), feature flags, networking, security. | Cloudflare platform |
| `web-perf` | Web Perf | Análise de performance usando Chrome DevTools MCP. Core Web Vitals (LCP, INP, CLS), supplementary metrics, render-blocking resources. | Performance analysis |
| `firecrawl` | Firecrawl | Web scraping, crawling, knowledge base building. Para dados de prospecção, extração de dados da web. | Web data extraction |
| `agent-architecture-review` | Agent Architecture Review (external) | Validação de contratos e arquitetura (also listed internal). | Contract/architecture validation |

---

## 4. Mapeamento de Agents/Skills por Domínio Auditado

Baseado na análise dos 10 domínios do projeto (do BASE_AUDIT_REPORT.md), aqui está o mapeamento recomendado:

### Domínio 1: Prospecção
- **Agentes Principais:** `agent-backend`, `agent-frontend`, `agent-testing`
- **Skills:** `firecrawl` (para dados de prospecção), `agent-architecture-test`, `comprehensive-audit`
- **Gaps Identificados:** `succeeded: 0, blocked: 1` ilusão no relatório; campos não capturados (email, instagram, logo, coordenadas)

### Domínio 2: CRM & Conversão
- **Agentes Principais:** `agent-backend`, `agent-frontend`, `agent-testing`
- **Skills:** `agent-architecture-review`, `comprehensive-audit`
- **Gaps Críticos:** Companies vazias quando Supabase não configurado; ilusão de "succeeded: 0"

### Domínio 3: Administração de Estabelecimentos
- **Agentes Principais:** `agent-supervisor`, `agent-context`, `agent-frontend`
- **Skills:** `agent-architecture-review`, `project-discovery`
- **Gaps Críticos:** Isolamento multitenant inconsistente; URL `?tenant=` pode bypassar checks

### Domínio 4: Autenticação & Autorização
- **Agentes Principais:** `agent-security-review`, `agent-context`, `agent-backend`
- **Skills:** `comprehensive-audit`, `agent-architecture-review`
- **Gaps Críticos:** Auth sintético sem Supabase sign-in; gates inconsistentes entre dashboards

### Domínio 5: Site Público / Demo
- **Agentes Principais:** `agent-frontend`, `agent-testing`
- **Skills:** `web-perf`, `comprehensive-audit`
- **Gaps Críticos:** Campos canônicos não fluem do banco para o preview; InstagramSection não usado corretamente

### Domínio 6: Catálogo de Templates
- **Agentes Principais:** `agent-frontend`, `agent-context`
- **Skills:** `agent-architecture-review`
- **Observação:** UI client-side, sem backend necessário para preview

### Domínio 7: Cobrança & Onboarding
- **Agentes Principais:** `agent-backend`
- **Skills:** `comprehensive-audit`
- **Observação:** Integração com pagamentos e contratos contratuais

### Domínio 8: Agendamento
- **Agentes Principais:** `agent-backend`
- **Skills:** `comprehensive-audit`

### Domínio 9: Integrações & Webhooks
- **Agentes Principais:** `agent-backend`, `agent-security-review`
- **Skills:** `cloudflare` (para webhooks WhatsApp)

### Domínio 10: Store de Dados
- **Agentes Principais:** `agent-context`, `agent-backend`
- **Skills:** `project-discovery`, `agent-architecture-review`

---

## 5. Recomendação de Workflow para Esta Auditória

Baseado no workflow padrão Orchestrator (section 1-5 do prompt), recomenda-se:

### Fase 1: DECOMPOSITION
- Usar `task-decomposition` para quebrar a auditoria em subtarefas por domínio
- Identificar dependências entre domínios (ex: auth afeta CRM afeta multitenant)

### Fase 2: ROUTER
- Invocar `router` subagent (ou usar `agent-supervisor`) para atribuir cada subtarefa ao agent/skill mais adequado
- Otimizar prompts para cada agent baseado no mapeamento acima

### Fase 3: EXECUTION (PARALLELO)
- Lançar subagents em lotes de 3-5 para trabalhar em domínios independentes em paralelo
- Domínios que podem rodar em paralelo:
  - Prospecção + CRM (backend-focused)
  - Admin + Multitenant (store-focused)
  - Site Público + Templates (frontend-focused)
  - Auth + Security (cross-cutting concerns)

### Fase 4: AGREGAR & VALIDAR
- Consolidar outputs de todos os agents
- Validar integração entre domínios (contracts, types, interfaces)
- Rodar verificação cruzada entre relatórios (ex: consistência do auth em todos os pages)

### Fase 5: ENTREGAR
- Resumo executivo com todos os gaps identificados
- Artefatos (relatórios parciais, matrizes, ADRs se necessário)
- Próximos passos priorizados

---

## 6. Próximos Passos Imediatos

1. **Validar esse catálogo** com o time/product owner
2. **Priorizar domains críticos** (Auth, Prospecção, Multitenant) - Fase 1 corrections
3. **Atribuir agents responsáveis** para cada domínio baseado no mapeamento
4. **Criar tickets** no tracker (GitHub Issues) para cada tarefa do plano de ação
5. **Definir métricas de sucesso** para cada domínio auditado
6. **Agendar sessões de work** com agents especializados conforme o plano

---

*Este relatório foi gerado através de análise exploratória do codebase Beleza_Digital, revisão de relatórios de auditoria existentes (AUDIT_REPORT.md, AUDIT_RELATORIO_MODO_PROSPECCAO.md, BASE_AUDIT_REPORT.md) e catalogação do ecossistema OpenCode/DSH disponível.*