# Auditoria de prontidão para produção — Beleza Digital

- **Data da auditoria:** 2026-10-28
- **Repositório:** [Tokenizaa/Beleza-Digital](https://github.com/Tokenizaa/Beleza-Digital)
- **Branch/commit auditado:** `main` / `8e276aa40a232ae8c87fe39ae0b2e5657f6fd405`
- **Método:** revisão remota do código e documentos no GitHub, inspeção de workflows e logs do GitHub Actions, leitura cruzada de auditorias anteriores e migrations.
- **Escopo:** avaliação de prontidão; nenhuma correção funcional foi aplicada.
- **Decisão:** **NO-GO — não liberar a versão auditada para produção.**

> Esta é uma auditoria documental/técnica do estado versionado no GitHub. Não tive acesso autenticado ao ambiente Supabase, Cloudflare, VenoPag ou WhatsApp, nem executei o projeto em um runner controlado nesta sessão. Por isso, não declaro certificação E2E de produção. Os bloqueios abaixo, contudo, são suficientes para impedir um GO.

## 1. Resumo executivo

A estrutura do projeto é substancial: há migrations Supabase, Pages Functions, Worker de prospecção, testes automatizados, documentação de go-live e fluxos para templates, demonstrações, onboarding e cobrança. Isso é uma base útil, mas não equivale a prontidão de produção.

A evidência mais objetiva e atual é a execução do GitHub Actions no commit auditado: os testes automatizados passaram, mas o type-check falhou em `src/pages/LeadsDashboard.tsx` com múltiplos erros de sintaxe JSX. A etapa de build foi ignorada por depender do sucesso anterior. Além disso, o status combinado do commit apresenta uma verificação Vercel em estado `failure`.

- [Workflow de validação no commit auditado](https://github.com/Tokenizaa/Beleza-Digital/actions/runs/40546261350)
- [Log da execução / job de validação](https://github.com/Tokenizaa/Beleza-Digital/actions/runs/40546261350/job/122337593892)
- [Arquivo com erro de compilação](https://github.com/Tokenizaa/Beleza-Digital/blob/main/src/pages/LeadsDashboard.tsx#L1691)

## 2. Resultado das verificações

| Área | Status | Evidência / limitação |
|---|---|---|
| Identificação da versão | APROVADO | Commit `8e276aa40a232ae8c87fe39ae0b2e5657f6fd405`, branch `main`. |
| Testes automatizados do workflow | APROVADO nessa execução | Etapa `Run automated tests` terminou com sucesso em 2026-10-27. Isso não prova integrações reais nem E2E de produção. |
| Type-check | REPROVADO | `bun run lint` / `tsc --noEmit` falha em `src/pages/LeadsDashboard.tsx`, linhas 1691–1801. |
| Build de produção | INCONCLUSIVO / NÃO EXECUTADO | Etapa `Build` foi `skipped` após falha no type-check. |
| Status de deploy/integração Vercel | REPROVADO no status consultado | Status combinado do commit mostra contexto `Vercel: failure`. O alvo de implantação precisa ser investigado antes de novo deploy. |
| Autenticação e autorização | REPROVADO para certificação | O store mantém sessão em `sessionStorage` e valida papéis no cliente; auditoria anterior descreve sessões sintéticas e inconsistência com Supabase Auth. O estado atual precisa ser corrigido e testado no servidor, não apenas no store. |
| Isolamento multi-tenant | INCONCLUSIVO, bloqueador | O tenant inicial pode ser selecionado por parâmetros de URL em `src/data/store.ts`; os controles no store não substituem RLS e autorização server-side. Não foi possível testar o banco real. |
| Persistência de dados operacionais | REPROVADO para SaaS multi-dispositivo | `src/data/store.ts` mantém estabelecimentos, serviços, produtos, mídia e agendamentos em `localStorage`; a implementação Supabase mostrada em `src/lib/supabase.ts` configura o cliente, mas não prova persistência server-side dessas entidades. |
| Prospecção e publicação de demonstrações | PARCIAL / BLOQUEADOR | Endpoints existem, mas dependem de secrets, Worker e tabelas remotas; auditoria anterior documentou ausência de `public.site_demo_public_links` no schema consultado e captura real não comprovada. Schema atual não foi consultável nesta sessão. |
| Cobrança / recorrência | PARCIAL / BLOQUEADOR se vender assinatura recorrente | A migration de onboarding registra explicitamente que a integração VenoPag disponível não implementa cobranças automáticas recorrentes. Não foi possível verificar credenciais, webhooks ou pagamentos reais. |
| Agendamentos | INCONCLUSIVO | Há migrations de RPCs com escopo de tenant e endurecimento, mas não houve teste contra banco de homologação com dois tenants. |
| Segurança de secrets | INCONCLUSIVO | Buscas de código por nomes de chaves não retornaram correspondências, mas isso não comprova que secrets estejam configurados corretamente nem substitui scanner de segredos e revisão integral. |
| Backup, restore e rollback | INCONCLUSIVO | O runbook descreve provisionamento e go-live, mas não foi possível comprovar execução de backup/restauração ou rollback no ambiente. |
| Observabilidade e operação | INCONCLUSIVO | Não houve acesso aos logs e métricas de produção, alertas, limites ou configurações reais dos Workers. |

## 3. Achados prioritários

### P0 — Bloqueio de segurança: autenticação e autorização não certificadas

**Evidências**
- `src/data/store.ts` carrega a sessão a partir de `sessionStorage`.
- `requireWriteAuth()` e `requireTenantAccess()` são controles executados no store frontend.
- `detectInitialTenant()` aceita `tenant`, `estabelecimento` ou `e` na query string para escolher o tenant ativo.
- A auditoria anterior `AUDIT_MATRIX_SEGURANCA_TESTES_OPERACAO.md` documenta criação de sessões locais sintéticas, tokens previsíveis e risco de acesso indevido por caminhos de tenant.

**Impacto:** controles em JavaScript executado no navegador não são fronteira de segurança suficiente para proteger dados de um SaaS multi-tenant. Um usuário pode controlar o próprio estado do navegador; toda operação sensível precisa ser autorizada no servidor e/ou pelo RLS.

**Critério de resolução:** comprovar Supabase Auth real, membership validada no servidor, RLS por tenant e testes negativos entre dois tenants; remover caminhos de autenticação local/sintética dos fluxos de produção. Reexecutar testes de acesso anônimo, tenant incorreto e chamadas diretas aos endpoints.

### P1 — Bloqueio de release: type-check falha no commit atual

**Evidência reproduzível:** workflow `40546261350`:
- instalação: sucesso;
- testes automatizados: sucesso;
- type-check: falha;
- build: ignorado.

O log registra, entre outros:
- `TS2657` em `src/pages/LeadsDashboard.tsx(1691,19)`;
- `TS1003`, `TS1382`, `TS17002` nas linhas 1698–1705;
- erros adicionais de fechamento/sintaxe JSX até a linha 1801.

Na inspeção do trecho, atributos `className` contêm expressões de template string (`${...}`) dentro de aspas JSX comuns. Isso é sintaxe inválida no JSX atual.

**Critério de resolução:** corrigir em fase separada, fazer type-check passar, executar build completo e obter execução verde no commit candidato a release.

### P1 — Build/deploy sem comprovação positiva

**Evidência:** o build do workflow não executou porque o type-check falhou. O status combinado do commit consultado mostra `Vercel: failure`.

**Impacto:** não existe evidência de que o commit auditado gera artefato de produção nem de que o deployment correspondente esteja saudável.

**Critério de resolução:** depois de corrigir o type-check, build limpo e deploy de homologação bem-sucedidos; verificar URL, rotas, APIs, logs de runtime e rollback.

### P1 — Persistência operacional em localStorage

**Evidência:** `src/data/store.ts` declara chaves `wl_establishments_v2`, `wl_services_v2`, `wl_products_v2`, `wl_media_v2`, `wl_appointments_v2` e `wl_auth_session_v2`; as funções `loadFromStorage` e `saveToStorage` usam Web Storage. `src/lib/supabase.ts` apenas instancia o cliente a partir de variáveis de ambiente; isso não comprova sincronização das entidades acima.

**Impacto:** dados podem ficar restritos a um navegador, não ser compartilhados entre dispositivos e ser perdidos ao limpar o armazenamento local. O comportamento é incompatível com uma fonte de verdade central para agendamentos e dados comerciais de um SaaS.

**Critério de resolução:** definir fonte de verdade server-side para cada entidade essencial, comprovar CRUD persistente e isolamento por tenant; testar em sessões e navegadores diferentes.

### P1 — Prospecção e demonstração pública não certificadas de ponta a ponta

**Evidências**
- `functions/api/prospecting/demo-links.ts` cria links consultando `public.site_demo_public_links`.
- `functions/api/demos/[token].ts` depende da mesma tabela para resolver tokens e buscar versões.
- A auditoria `docs/audits/2026-10-23-auditoria-prospeccao-geracao-site-conversao-saloes.md` reportou que essa tabela não estava no schema Supabase consultado naquela data e que a integração de captura real ainda não estava comprovada.
- O código atual do endpoint de prospecção pode retornar `503` se `PROSPECTING_WORKER_URL` ou `PROSPECTING_WORKER_SECRET` não estiverem configurados.

**Impacto:** a existência dos endpoints não garante que a descoberta, geração, emissão do link, seleção de versão e conversão funcionem no ambiente real.

**Critério de resolução:** comparar migrations com o schema aplicado; confirmar provider e Worker configurados; executar E2E em staging com prospect fictício, token expirado/inválido, seleção de versão e conversão; confirmar ausência de duplicação.

### P1 — Cobrança recorrente não comprovada

**Evidência:** `supabase/migrations/20261020161116_salon_onboarding_billing_venopag.sql` comenta expressamente que a integração VenoPag disponível para PIX cash-in/status/webhook não implementa cobrança automática recorrente.

**Impacto:** apresentar planos mensais/anuais como assinaturas automáticas pode criar divergência entre expectativa comercial, cobrança e controle de acesso.

**Critério de resolução:** decidir explicitamente entre cobrança PIX manual com renovação controlada ou integração recorrente efetiva. Testar webhooks assinados, idempotência, pagamentos pendentes/confirmados/estornados e atualização de acesso sem aceitar confirmação do browser.

### P1 — Migrations base duplicadas

**Evidência:** os arquivos `supabase/migrations/20261019000000_white_label_site_builder.sql` e `supabase/migrations/20261020154758_white_label_site_builder.sql` têm o mesmo blob SHA `c804680229ccb58a9dcf774ff8cc86a2ea2f32c3`, portanto o conteúdo versionado é idêntico sob timestamps distintos.

**Impacto:** pode haver redundância no histórico de migrations e risco de divergência entre o que a equipe considera canônico e o que foi efetivamente aplicado. Como o conteúdo usa `IF NOT EXISTS` em partes do schema, isso não prova por si só uma falha de execução.

**Critério de resolução:** comparar o histórico de migrations aplicado no Supabase com os arquivos versionados; definir migration canônica sem reescrever o histórico já aplicado; validar em banco descartável antes de qualquer alteração.

### P2 — Teste chamado E2E contém verificações sintéticas

**Evidência:** `tests/end_to_end_pipeline_certification.test.ts` descreve certificação de ponta a ponta, mas trechos iniciais verificam propriedades locais construídas no próprio teste, como igualdade de chaves de idempotência e cálculos de backoff. Isso pode validar lógica isolada, mas não prova, por si só, integração real entre banco, Worker, provedor, token público e contratação.

**Critério de resolução:** separar testes unitários/estruturais de testes E2E reais; exigir staging isolado e fixtures controladas para a cadeia integrada.

### P2 — Runbook não comprova ambiente provisionado

**Evidência:** `docs/PRODUCTION_PROVISIONING_AND_GO_LIVE_RUNBOOK.md` descreve a sequência de migrations, secrets Cloudflare, binding Browser Run e ativação do administrador.

**Impacto:** a documentação explicita dependências externas que não puderam ser verificadas. Não é possível afirmar que migrations, secrets, cron e bindings estejam presentes no ambiente ativo.

**Critério de resolução:** preencher checklist de go-live com evidência de cada configuração, sem revelar valores de secrets; comprovar backup/restore e rollback.

## 4. Avaliação das auditorias anteriores

Os relatórios anteriores continuam úteis como fontes de hipóteses, não como estado atual automaticamente confirmado:

- `AUDIT_REPORT.md` (25/10): aponta autenticação local, persistência local e integrações de prospecção incompletas.
- `AUDIT_MATRIX_SEGURANCA_TESTES_OPERACAO.md` (25/10): documenta riscos de sessão sintética, tenant por URL e falta de testes para alguns vetores.
- `AUDIT_DATA_PERSISTENCE_MATRIX.md` (25/10): documenta localStorage como fonte primária de várias entidades.
- `docs/audits/2026-10-23-auditoria-prospeccao-geracao-site-conversao-saloes.md`: documenta lacunas no link público, captura e conversão.
- O workflow mais recente consultado, em 27/10, confirma que há pelo menos uma falha atual independente desses documentos: o type-check não passa.

Não foi possível confirmar se o schema Supabase, as variáveis Cloudflare e o deployment foram corrigidos desde as auditorias anteriores.

## 5. Plano de ação recomendado

| Ordem | Ação | Critério de aceite | Bloqueia lançamento? |
|---|---|---|---|
| 1 | Corrigir JSX/type-check em `LeadsDashboard.tsx` | `bun run lint` passa | Sim |
| 2 | Reexecutar testes e build em CI | testes, type-check e build verdes no mesmo commit | Sim |
| 3 | Auditar e consolidar autenticação real | nenhuma sessão sintética em produção; autorização server-side | Sim |
| 4 | Provar isolamento multi-tenant | testes negativos com dois tenants e RLS verificada no schema aplicado | Sim |
| 5 | Resolver persistência local dos dados essenciais | CRUD persistente em backend, multi-dispositivo e com RLS | Sim |
| 6 | Validar migrations contra banco de staging | histórico aplicado consistente, sem alterações destrutivas | Sim |
| 7 | Certificar prospecção e demo pública | fluxo completo em staging e provider/Worker reais configurados | Sim, se prospecção for parte do lançamento |
| 8 | Fechar contrato de cobrança | comportamento mensal/anual documentado e confirmado; webhooks/idempotência testados | Sim, se cobrança fizer parte do lançamento |
| 9 | Validar agendamentos | criação, conflito, cancelamento e isolamento testados em staging | Sim, se agendamento for parte do lançamento |
| 10 | Comprovar backup, restore, monitoramento e rollback | execução documentada e evidências de sucesso | Sim para lançamento amplo |
| 11 | Revisar termos e conformidade de conteúdo de terceiros | fonte, retenção, atribuição e base de uso documentadas | Conforme dados utilizados |

## 6. Checklist mínimo antes do go-live

- [ ] CI verde: testes, type-check e build.
- [ ] Deployment de homologação saudável, com rotas e APIs validadas.
- [ ] Supabase Auth real validado para cada papel.
- [ ] RLS e permissões verificadas no schema efetivamente aplicado.
- [ ] Testes negativos confirmam que um tenant não acessa dados de outro.
- [ ] Entidades operacionais essenciais persistem no backend.
- [ ] Migrations aplicadas e seed revisados em ambiente isolado.
- [ ] Secrets necessários configurados por ambiente; nenhum secret exposto no frontend.
- [ ] Prospecção/Worker/demo testados sem envio de mensagens ou efeitos financeiros reais.
- [ ] Fluxo de pagamento testado em sandbox, incluindo webhook e repetição de evento.
- [ ] Agendamento validado com concorrência e fuso horário.
- [ ] Backup/restore, monitoramento, alertas e rollback comprovados.
- [ ] Aprovação final do escopo comercial de lançamento.

## 7. Limitações desta auditoria

Não foram executados nesta sessão:

- `bun install`, `bun run test`, `bun run lint` ou `bun run build` localmente; os resultados de CI foram consultados diretamente no GitHub.
- Testes de navegador Playwright em ambiente em execução.
- Consultas ao Supabase MCP ou ao banco real.
- Verificação das variáveis/secrets de Cloudflare.
- Testes de sandbox VenoPag/WhatsApp.
- Teste de backup/restauração, performance, carga ou rollback.
- Scanner completo de dependências/segredos.

Esses itens são **inconclusivos**, não aprovados.

## 8. Decisão final

**NO-GO para a versão auditada.**

Motivos imediatos:
1. O type-check falha no commit auditado e o build foi ignorado.
2. O status Vercel consultado é `failure`.
3. Autenticação/autorização e isolamento multi-tenant não estão certificados para produção.
4. Persistência de entidades operacionais depende de armazenamento local em partes importantes do produto.
5. Prospecção, demonstração pública, cobrança e configuração operacional externa ainda carecem de comprovação integrada no ambiente real.

Esta decisão não afirma que todas as integrações estejam quebradas. Afirma que, com a evidência disponível, **não há base suficiente para autorizar o lançamento seguro**. A próxima fase deve corrigir os bloqueadores em mudanças pequenas e verificáveis, mantendo a auditoria separada da implementação.
