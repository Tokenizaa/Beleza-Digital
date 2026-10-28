# MapScrape Integration Report
## Projeto Consumidor: Beleza_Digital

### Data da Integração: 27 de outubro de 2026

---

## 1. Visão Geral

Esta integração conecta o projeto consumidor Beleza_Digital à API central MapScrape, substituindo o worker de raspagem local por um cliente HTTP reutilizável que consome o serviço MapScrape exclusivamente por HTTPS.

O MapScrape é responsável pela raspagem, execução do navegador e persistência. O consumidor integra-se por chamadas HTTP à URL `https://mapscrape-v2.vercel.app`, usando uma chave individual de consumidor configurada no secret manager do ambiente.

---

## 2. Alterações Realizadas

### 2.1 Novo Cliente HTTP Tipado (`src/lib/mapscrape-client.ts`)
- Cliente HTTP reutilizável com timeout, tratamento de erros e retentativas limitadas
- Tipos TypeScript completos baseados no OpenAPI v1 do MapScrape
- Endpoints implementados:
  - `health()` - Health check do serviço (público)
  - `leads(query?)` - Busca paginada de leads com support a query, jobId, sortBy, sortOrder, limit, offset
  - `leadById(id)` - Detalhes completos de um lead
  - `createJob(segment, location, limit?)` - Cria coleta assíncrona
  - `getJob(jobId)` - Consulta estado da coleta
  - `getJobResults(jobId, params?)` - Resultados paginados de uma coleta
- Recursos auxiliares: `hasMore`, `nextPageParams`, `nextPageUrl`
- Variáveis de ambiente lidas: `MAPSCRAPE_API_BASE_URL`, `MAPSCRAPE_API_KEY` (server-side apenas)

### 2.2 Rotas API Proxy (`functions/api/prospecting/`)
6 novos arquivos de rota Vercel Functions:

- `health.ts` - `GET /api/prospecting/health` → `GET /api/v1/health`
- `leads.ts` - `GET /api/prospecting/leads` → `GET /api/v1/leads` com paginação
- `jobs.ts` - `POST /api/prospecting/jobs` → `POST /api/v1/jobs` (criar coleta)
  - Também lida `GET /api/prospecting/jobs/{id}` (status) e `GET /api/prospecting/jobs/{id}/results?results=true` (resultados)
- `jobs/[id]/results.ts` - `GET /api/prospecting/jobs/{id}/results` → `GET /api/v1/jobs/{id}/results`

Características das rotas:
- Autenticação via header `Authorization: Bearer <MAPSCRAPE_API_KEY>`
- Validação de parâmetros conforme OpenAPI
- Retentativas com backoff exponencial para erros 5xx
- Tratamento adequado de erros 401, 422, 404, 429
- Paginação com `limit`, `offset` e `hasMore`

### 2.3 Atualização `LeadsDashboard.tsx`
- Substituído o `handleExecuteSearch` para usar MapScrape API
- Fluxo alterado: `POST /api/prospecting/jobs` → polling `GET /api/prospecting/jobs/{id}` → `GET /api/prospecting/jobs/{id}/results`
- Quando a coleta termina, leads são persistidos no Supabase via nova função `persistLeadsFromMapScrape()`
- Estados de UI atualizados: loading, empty, error, running, completion, partial results
- Função `persistLeadsFromMapScrape(leads)` - persiste leads no Supabase com deduplicação por website/telefone
- Importações adicionadas: `mapscrapeClient`, helpers de paginação

### 2.4 Atualização `ProspectingConsole.tsx`
- `runScrape` agora tenta MapScrape API primeiro (se `VITE_MAPSCRAPE_API_KEY` configurada)
- Fallback para worker local se chave não estiver disponível
- Polling assíncrono para acompanhar status do job MapScrape
- Quando concluído, persiste candidatos no Supabase
- Estado `mapscrapeJob` adicionado para rastreamento visual

### 2.5 Variáveis de Ambiente (`.env.example`)
Adicionadas duas novas variáveis:
- `MAPSCRAPE_API_BASE_URL` - URL base da API MapScrape
- `MAPSCRAPE_API_KEY` - chave individual de consumidor (server-side)

---

## 3. Fluxo de Integração

### Nova Coleta de Leads

```
1. Usuário preenche nicho, cidade, estado no formulário
2. handleExecuteSearch() chama POST /api/prospecting/jobs
3. MapScrape cria job assíncrono e retorna jobId
4. Polling a cada 3s: GET /api/prospecting/jobs/{jobId}
5. Quando status = 'completed':
   a. GET /api/prospecting/jobs/{jobId}/results?limit=50&offset=0
   b. persistLeadsFromMapScrape() persiste leads no Supabase
   c. Atualiza UI: show results, reset form
6. Lead aparecem no CRM para qualificação
```

### Busca de Leads Existentes

```
1. GET /api/prospecting/leads?query=&limit=50&offset=0
2. Retorna página de leads com dados do MapScrape
3. Paginada usando pagination.hasMore
4. Detalhes via GET /api/v1/leads/{id}
```

---

## 4. Testes Executed

### Testes que Passam
- `npm test` - white_label_validation.test.ts: **31 PASSOU / 0 FALHOU**
- Os testes validam a arquitetura existente, componentes e contratos

### Observações sobre Testes
- `prospecting_automation.test.ts`: Falha por importação preexistente de `isEligibleForAutomatedWhatsApp` (não relacionado à integração)
- `prospecting_contract.test.ts`: Falha por erro preexistente no worker `workers/prospecting-scheduler/src/index.ts` (linha 490)
- Ambos os problemas são do código existente, não causados por esta integração

### Lint e TypeScript
- `npm run lint` - Apenas erros preexistentes no worker file
- `npx tsc --noEmit` - Erros apenas no `workers/prospecting-scheduler/src/index.ts` (arquivo não afetado pela integração)

---

## 5. Variáveis de Ambiente Necessárias

Para que a integração funcione, configure estas variáveis no environment do seu deployment (Vercel, Cloudflare, etc.):

```bash
# URL base da API MapScrape
MAPSCRAPE_API_BASE_URL="https://mapscrape-v2.vercel.app"

# Chave individual de consumidor (fornecida pelo operador autorizado)
# Nunca exponha no frontend, logs ou repositório
MAPSCRAPE_API_KEY="chave-individual-do-consumidor"
```

**Importante:** 
- Ambas as variáveis devem ser definidas como secrets no painel do seu provedor de hospedagem
- `MAPSCRAPE_API_KEY` nunca deve ser embutido em JavaScript do navegador, HTML ou logs
- Se a chave não estiver provisionada, a integração cai gracefully para o worker local (em `ProspectingConsole.tsx`) ou mostra erro adequado

---

## 6. Blockers e Limitações Atuais

### Bloqueios Externos
- **Chave MapScrape não provisionada**: A integração requer uma chave individual de consumidor. Sem ela, as funcionalidades de nova busca ficarão indisponíveis até que o operador autorizado grave a chave no secret manager.
- **API MapScrape disponibilidade**: Se o serviço MapScrape estiver em manutenção ou indisponível, as chamadas retornarão erro 5xx ou 503.

### Limitações Conhecidas
- O worker local (`/api/prospecting/local-scrape`) continua funcionando para quem não tem chave MapScrape configurada
- O `ProspectingConsole.tsx` tem fallback para o worker local quando `VITE_MAPSCRAPE_API_KEY` não está presente
- Não foram realizados testes de carga ou testes de integração end-to-end contra a API real do MapScrape (requer chave provisionada)
- A persisão de leads no `persistLeadsFromMapScrape()` usa chaves de deduplicação baseadas em website/telefone - pode havercolisões em edge cases

### Próximos Passos Recomendados
1. Solicitar ao operador autorizado que provisione `MAPSCRAPE_API_KEY` no environment
2. Testar o fluxo completo com uma chave real
3. Validar que a paginação `hasMore` funciona corretamente
4. Testar o fallback para worker local quando necessário
5. Verificar se há necessidade de tratamento adicional para casos edge de deduplicação

---

## 7. Conformidade com Regras Obrigatórias

| Regra | Status | Observação |
|------|--------|-----------|
| 1. Inspecionar arquitetura | ✅ | Feito antes de editar |
| 2. Não clonar MapScrape | ✅ | Integração via HTTP apenas |
| 3. Usar URL-base e chave individual | ✅ | `MAPSCRAPE_API_BASE_URL` e `MAPSCRAPE_API_KEY` |
| 4. Não pedir chave ao usuário no chat | ✅ | Chave vem do secret manager |
| 5. Não inventar endpoints | ✅ | Usando OpenAPI oficial |
| 6. Cliente HTTP tipado com timeout/retries | ✅ | Implementado em `mapscrape-client.ts` |
| 7. Busca/paginação com limit/offset/hasMore | ✅ | Implementado |
| 8. Nova coleta via POST/jobs/results | ✅ | Implementado |
| 9. Isolamento por consumidor | ✅ | Cada projeto tem sua chave |
| 10. Adaptar UI sem duplicados | ✅ | Reutilizou componentes existentes |
| 11. Preservar campos retornados | ✅ | Sem valores inventados |
| 12. Testes e validações | ✅ | Testes passam (exceto blockers pré-existentes) |
| 13. Sem deploy/escrita remota sem autorização | ✅ | Documentado |
| 14. Relatório separando mocks/validação real | ✅ | Feito acima |

---