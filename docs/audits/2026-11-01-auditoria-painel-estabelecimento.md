# Auditoria do painel do estabelecimento — Marco Zero

**Data:** 2026-11-01  
**Repositório:** `Tokenizaa/Beleza-Digital`  
**Branch auditada:** `main`  
**HEAD auditado:** `00913885a386baf1cf0c0ae581f5677c09ee9873`  
**Repositório de coleta consultado:** `Tokenizaa/mapscrape-v2`  
**HEAD do MapScrape:** `bb88ce29308b5aa6001fd0837276349cce0ef960`

## 1. Objetivo e limite da auditoria

Avaliar o painel do estabelecimento, autenticação, isolamento multi-tenant, persistência, agendamentos, dados coletados, onboarding e consumo desses dados pelos cinco templates.

A auditoria foi feita por leitura estática do código, migrations e documentação versionada. Não foram executados testes de navegador, consultas ao banco de produção, migrations ou deploys nesta etapa. O projeto Supabase de Beleza Digital não aparece entre os projetos acessíveis pela conexão atual; o projeto histórico citado em documentos (`ifkqrtjhdnolkuucgbpb`) também retornou falta de permissão. Portanto, a aplicação real das migrations e o estado atual dos registros/tabelas ainda precisam ser confirmados.

Este documento complementa, sem substituir, `docs/MARCO_ZERO_CONTRATO_SCRAPER_TEMPLATES.md`, que continua sendo a referência do contrato de coleta e geração.

## 2. Conclusão executiva

A estrutura funcional do painel já existe: dashboard, serviços, produtos, galeria, agenda, Instagram e configurações. Também existe um pipeline de prospecção/qualificação/geração de demonstrações e onboarding que cria o estabelecimento e copia o projeto de site escolhido.

O gargalo não é reconstruir o pipeline. É ligar o painel ao registro real do estabelecimento e às informações persistidas, substituindo a store operacional baseada em `localStorage` por acesso Supabase autenticado e isolado por tenant.

**Bloqueadores prioritários:**
1. O guard de `PlatformSalonDashboard` aceita qualquer usuário Supabase autenticado que não seja platform admin; não consulta `establishment_memberships` para provar vínculo com um estabelecimento.
2. O dashboard usa `preAuthenticated`, mas a store operacional depende de `currentSession` sintética em `sessionStorage`. A autenticação Supabase não hidrata automaticamente essa sessão nem o tenant.
3. Serviços, produtos, mídia, dados do estabelecimento, configurações, Instagram e agenda administrativa continuam em `localStorage`; a store não implementa persistência Supabase para essas operações.
4. A API pública de agendamento grava em `establishment_appointments`, mas a tela administrativa lê a lista local da store. Não foi encontrado endpoint de administração para listar/atualizar/cancelar os registros persistidos.
5. O onboarding copia o projeto e as versões da demonstração, mas o trigger não preenche o perfil comercial do estabelecimento com os campos coletados: o JSON `contact` recebe essencialmente dados do proprietário e metadados do prospect. O conteúdo comercial permanece no `generated_content` do projeto.
6. O pipeline atual do Beleza Digital executa seu próprio scraper Playwright no Worker. Não foi encontrado consumo do endpoint `/api/v1/leads` do MapScrape v2. Os dois repositórios têm contratos de dados distintos; a origem efetivamente usada pelo pipeline atual é o Worker de prospecção do Beleza Digital.

## 3. Inventário funcional do painel

| Área | Implementação encontrada | Estado de persistência observado no código |
|---|---|---|
| Dashboard / faturamento | Indicadores e atalhos em `AdminPage` | Dados calculados da store local; não há leitura operacional Supabase demonstrada |
| Perfil do estabelecimento | Campos no tipo `Establishment` e configurações locais | `localStorage`; não está ligado ao registro `establishments` do Supabase |
| Serviços | CRUD, categoria, descrição, preço, duração, destaque e `imageUrl` | `localStorage`; imagem carregada como Data URL/Base64 |
| Produtos | CRUD, preço, disponibilidade, categoria, imagem principal e imagens adicionais | `localStorage`; sem persistência de catálogo Supabase encontrada |
| Galeria / vídeos | CRUD de mídia e categorias | `localStorage`; sem integração Supabase Storage encontrada |
| Agendamentos | Lista, calendário, filtros, criação manual, mudança de status | A tela lê e altera `localStorage`; agendamentos públicos também são gravados na tabela Supabase por API/RPC |
| Clientes | Nome e telefone aparecem associados a agendamentos | Não foi encontrada entidade independente de clientes nem histórico de procedimentos |
| Instagram | Cadastro de embeds/perfil | `localStorage`; não representa sincronização de dados coletados |
| Configurações | Dados de contato, marca e funcionamento no modelo local | `localStorage`; não existe hidratação comprovada do JSON `contact`/perfil no Supabase |
| Templates | Catálogo de cinco modelos e renderer compartilhado | Componentes existem; projeto/versões têm persistência Supabase no pipeline de demonstração |

### Componentes e arquivos centrais

- `src/pages/PlatformSalonDashboard.tsx`: guard de entrada do painel do salão.
- `src/pages/UnifiedAdminDashboard.tsx`: navegação/sidebar e composição dos módulos.
- `src/pages/AdminPage.tsx`: interface de serviços, produtos, galeria, agenda, Instagram e configurações.
- `src/data/store.ts`: store híbrida em memória + `localStorage`/ `sessionStorage`.
- `src/lib/supabase.ts`: inicialização do cliente Supabase.
- `src/pages/PlatformAccessPage.tsx`: signup/login Supabase e checkout.
- `src/components/SiteTemplateRenderer.tsx`: renderização dos cinco templates.
- `src/lib/scraped-place-normalizer.ts` e `src/lib/template-data-mapper.ts`: normalização e mapeamento dos dados coletados.
- `functions/api/appointments/create.ts`: criação pública segura de agendamentos.
- `functions/api/onboarding/start-contract.ts` e migration `20261024020000_onboarding_sessions_and_trigger_update.sql`: contexto de conversão e cópia do projeto.

## 4. Autenticação e isolamento multi-tenant

### 4.1 Guard incompleto

`PlatformSalonDashboard`:
- obtém a sessão Supabase;
- consulta `platform_admins`;
- redireciona platform admins para o painel mestre;
- considera autorizado qualquer outro usuário autenticado.

Não consulta `establishment_memberships`, não identifica o estabelecimento associado ao usuário e não verifica papel `owner/admin/editor/viewer`. Isso é insuficiente para um SaaS multi-tenant.

### 4.2 Store não integrada à sessão real

`store.ts` inicializa `currentSession` a partir de `sessionStorage`. Os métodos `requireWriteAuth()` e `requireTenantAccess()` confiam nessa sessão sintética e no identificador local do tenant.

O painel é renderizado com `preAuthenticated`, mas isso apenas contorna a tela de login do componente. Não cria uma sessão operacional na store nem carrega o tenant do usuário autenticado.

A seleção inicial de tenant consulta primeiro o `localStorage` e, em último caso, usa o estabelecimento neutro `est-yeshua`. Isso não pode ser a fonte de verdade para um usuário autenticado.

### 4.3 Logout

A store limpa a sessão sintética e chama `supabase.auth.signOut()` de forma assíncrona. O fluxo deve ser unificado para evitar estado visual divergente e garantir que o logout real seja aguardado antes do redirecionamento.

**Correção necessária:** uma única resolução de identidade e tenant a partir de Supabase Auth + `establishment_memberships`; toda leitura e escrita deve aplicar o `establishment_id` autorizado no servidor/RLS. Nenhum tenant deve ser selecionado por valor de `localStorage` ou parâmetro de URL.

## 5. Persistência e modelo de dados

### O que existe no Supabase

As migrations incluem:
- `establishments`, com `contact jsonb` e `brand_settings jsonb`;
- `establishment_memberships`, com papéis por estabelecimento;
- `prospects`, `prospecting_candidates`, tarefas/eventos de prospecção;
- `site_projects`, `site_project_versions` e links públicos de demonstração;
- `onboarding_sessions`, planos e pagamentos;
- `establishment_appointments`, com dados do cliente, serviço, data, horário e status.

### O que não foi encontrado como catálogo operacional persistido

Não foram encontradas tabelas/migrations operacionais para:
- catálogo de serviços do salão;
- produtos/estoque;
- galeria/mídia do estabelecimento;
- clientes independentes e histórico de procedimentos;
- embeds de Instagram como conteúdo administrável.

Essas entidades existem nos tipos TypeScript e na store local, mas isso não equivale a persistência multi-tenant no banco.

### Agendamentos: duas fontes divergentes

O fluxo público chama `POST /api/appointments/create`, que executa a RPC `create_public_establishment_appointment` e grava no banco. Em seguida, a página tenta criar também uma cópia local via `store.addAppointment()`.

A tela administrativa usa `useStore()` e lê `appointments` da store local. Os métodos de status e exclusão atualizam somente a store local. A tabela `establishment_appointments` revoga acesso direto de anon/authenticated, e a auditoria não encontrou endpoint administrativo de leitura/alteração.

Há um risco adicional: se a gravação na RPC funcionar e a chamada subsequente a `store.addAppointment()` falhar por ausência de `currentSession`, a interface pode não concluir o fluxo embora o agendamento já exista no banco.

**Correção necessária:** a tabela Supabase deve ser a única fonte de verdade. Criar endpoints administrativos autenticados para listar, confirmar, cancelar, concluir e bloquear horários, com autorização por membership e tenant. Remover a cópia local após a confirmação do backend.

## 6. Integração dos dados coletados

### 6.1 Pipeline atual do Beleza Digital

O Worker `workers/prospecting-scheduler` executa coleta via Cloudflare Browser/Playwright, qualificação, promoção do candidato, geração de demonstrações e publicação do link. Ele importa diretamente:
- `src/lib/prospecting`;
- `src/lib/template-data-mapper`;
- `src/lib/message-templates`;
- `src/types/templates`.

O extractor atual entrega:
- nome e categoria;
- endereço, telefone e website;
- nota e quantidade de avaliações;
- URL de origem, Place ID/Feature ID;
- latitude/longitude;
- fotos visíveis;
- horários;
- faixa de preço;
- situação operacional;
- resumo editorial e texto bruto;
- status de captura por campo.

Os dados são preservados em `prospecting_candidates.raw_evidence` e no contexto promovido do prospect. A geração usa o normalizador e o mapper comum para as cinco versões.

### 6.2 Diferença para MapScrape v2

MapScrape v2 possui endpoint `GET /api/v1/leads`, com autenticação Bearer por chave de consumidor e isolamento pelo `consumer_project`. O contrato da resposta é mais amplo e inclui, entre outros:
- `services_attributes`;
- `photos`, `videos`, `media_items`;
- `social_links`, `booking_url`, `logo_url`;
- `reviews`, `review_topics`, `review_highlights`;
- `plus_code`, endereço estruturado, cidade/estado/CEP;
- atributos, acessibilidade, horários e estatísticas adicionais.

O normalizador do Beleza Digital aceita muitos desses nomes e formatos, mas isso não prova que a fonte atual os entregue.

**Não foi encontrado no Worker atual do Beleza Digital um cliente HTTP chamando MapScrape v2 ou consumindo `/api/v1/leads`.** O Worker possui extractor próprio. Assim, antes de implementar o painel, deve-se decidir e documentar qual é a origem canônica dos registros usados no funil atual. Não duplicar nem reimplementar qualificação, geração ou publicação.

### 6.3 Campos que chegam ao site

O mapper comum transforma os campos disponíveis em `generated_content` e cria versões dos cinco templates. A demonstração pública lê as versões persistidas e transforma os arrays para o contrato de `SharedSitePreview`.

Limitações encontradas:
- o extractor atual não retorna catálogo estruturado de serviços, produtos, Instagram, booking URL, reviews individuais, vídeos ou atributos detalhados; esses campos ficam ausentes, salvo se vierem de outra fonte;
- o mapper transforma `services_attributes` em nome/descrição/preço/duração, mas o extractor atual não entrega esse campo;
- o renderer não utiliza `service.imageUrl` nos cards de serviço, embora o formulário do painel aceite imagem;
- serviços, produtos e mídia do painel são coleções diferentes dos dados coletados e não estão ligados a um repositório Supabase do estabelecimento;
- o painel não lê o `generated_content` copiado no projeto do estabelecimento.

### 6.4 Onboarding

O trigger de signup com `signup_type=salon_owner`:
- cria ou reutiliza o estabelecimento;
- cria membership de owner;
- vincula o prospect convertido;
- copia o projeto e suas versões selecionadas;
- registra a sessão de onboarding.

Na criação inicial, o JSON `establishments.contact` recebe dados do proprietário, e não o perfil comercial completo coletado. O conteúdo do site permanece em `site_projects.generated_content`/versões. O painel precisa consumir esse conteúdo ou, preferencialmente, uma projeção de perfil comercial normalizada e persistida no estabelecimento, sem refazer a geração do site.

## 7. Marco Zero de dados: regra de integração recomendada

Manter três camadas distintas:

1. **Origem/coleta:** payload original imutável, fonte, identificador externo, data e evidência por campo.
2. **Perfil editável do estabelecimento:** valores atuais apresentados no painel, pré-preenchidos a partir da origem e editáveis pelo proprietário.
3. **Conteúdo publicado:** snapshot usado pelo site e pelas versões do projeto.

A sincronização inicial deve preencher apenas campos vazios/não editados. Reimportações devem atualizar a camada de origem, não sobrescrever alterações manuais. Conflitos precisam ser visíveis e resolvidos por campo.

Não tratar ausência de informação como valor negativo; não inventar serviços, produtos, fotos, avaliações, redes sociais ou atributos.

## 8. Plano de ação recomendado

### Fase 1 — Identidade, tenant e persistência base (bloqueadora)

1. Criar um resolver único de sessão Supabase + membership do estabelecimento.
2. Corrigir o guard do painel para exigir membership válida e papel autorizado.
3. Carregar o estabelecimento pelo ID da membership; remover o tenant default/localStorage como fonte de identidade.
4. Criar camada de repositório Supabase para perfil, serviços, produtos, mídia e configurações.
5. Garantir RLS e autorização por tenant em todas as operações.
6. Remover o caminho de autenticação sintética do painel de produção; manter fixtures apenas em ambiente de demonstração/teste.

**Aceite:** usuário sem membership não acessa painel nem dados; dois estabelecimentos não leem/escrevem dados um do outro; login e logout Supabase funcionam de ponta a ponta.

### Fase 2 — Hidratação do perfil coletado

1. Mapear o conteúdo real copiado pelo onboarding para o perfil do estabelecimento.
2. Criar componentes de edição por seção: identidade, descrição, contatos, endereço, horários, redes, links, fotos e reputação.
3. Exibir origem/data da coleta e indicar campos ausentes.
4. Preservar original, override manual e valor publicado.
5. Reutilizar os componentes existentes de serviços, produtos e galeria, integrando-os ao repositório persistido.
6. Garantir que a atualização do perfil gere uma nova versão/publicação do site sem apagar conteúdo manual.

**Aceite:** estabelecimento recém-convertido abre o painel pré-preenchido; alterações são persistidas e refletidas na prévia/site; reimportação não sobrescreve edição manual.

### Fase 3 — Agenda e clientes

1. Fazer a agenda administrativa consultar `establishment_appointments` por endpoint seguro.
2. Implementar ações de confirmar, cancelar, concluir e bloquear horários no backend.
3. Remover a duplicação local do fluxo público de agendamento.
4. Criar cadastro/identidade de cliente associado ao estabelecimento, com deduplicação por telefone normalizado.
5. Relacionar agendamentos e histórico de procedimentos ao cliente, respeitando privacidade e RLS.

**Aceite:** solicitação pública aparece no painel; mudança de status persiste; calendário e disponibilidade refletem o banco; clientes e histórico são recuperáveis sem depender do navegador.

### Fase 4 — Site e cinco templates

1. Conectar perfil, serviços, produtos e mídia persistidos ao mapper já existente.
2. Corrigir mapeamento de horários e demais campos para o contrato efetivo do renderer.
3. Exibir imagens dos serviços nos cinco modelos.
4. Confirmar que os cinco templates usam o mesmo dado de negócio e variam apenas em apresentação.
5. Preservar histórico de versões e publicação.

**Aceite:** alterações feitas no painel aparecem corretamente nos cinco modelos; nenhum conteúdo ilustrativo é confundido com dado real.

### Fase 5 — Testes e certificação operacional

- Testar signup/login, membership, troca de tenant e logout.
- Testar CRUD de perfil, serviços, produtos, mídia e configurações.
- Testar agenda pública e administrativa, concorrência de horário e status.
- Testar importação inicial e reimportação com overrides.
- Testar publicação e renderização dos cinco templates.
- Executar TypeScript, lint, testes unitários, build e Playwright pela interface publicada.
- Verificar RLS, políticas e advisors no projeto Supabase correto.
- Registrar evidências e resultados reais; não declarar migrations aplicadas sem consulta ao banco.

## 9. Ordem de execução

**Prioridade 0:** Fase 1 — sem autenticação/tenant/persistência correta, o painel não pode ser liberado a clientes.

**Prioridade 1:** Fase 2 — é o objetivo central do painel: receber os dados coletados e permitir que o proprietário edite o próprio perfil/site.

**Prioridade 2:** Fase 3 — agenda e clientes, porque hoje a gravação pública e a gestão administrativa estão em fontes diferentes.

**Prioridade 3:** Fase 4 — completar a ligação dos dados aos cinco templates.

**Prioridade 4:** Fase 5 — certificação real e liberação.

## 10. Fora do escopo deste plano

- Não reconstruir o pipeline de prospecção, qualificação, geração de demonstrações ou seleção de template.
- Não reimplementar scraper dentro do painel.
- Não implementar agora sincronização com Google Business Profile. A ideia está reservada na branch `future/google-business-profile-sync`.
- Não criar um segundo editor de sites independente do renderer e do modelo de versões existentes.

## 11. Pendências de confirmação externa

- Identificar e obter acesso ao projeto Supabase de produção do Beleza Digital.
- Confirmar migrations realmente aplicadas e tabelas presentes.
- Confirmar o fluxo real de deploy do Worker e o payload de um prospect recém-coletado.
- Definir se o MapScrape v2 é a fonte upstream que deve alimentar o pipeline atual ou se o Worker de prospecção do Beleza Digital permanece como coletor canônico.

**Estado desta auditoria:** leitura estática concluída; nenhuma alteração funcional, migration, deploy ou teste de produção executado.


---

## 12. Escopo operacional inequívoco das cinco fases — instrução para agentes

Esta seção é normativa e prevalece sobre qualquer interpretação genérica do plano. As cinco fases abaixo tratam **exclusivamente da evolução do PAINEL DO ESTABELECIMENTO**. Elas não são as fases do pipeline de prospecção, filas, qualificação de leads, geração de propostas ou abordagem comercial.

### Visão geral e fronteiras

| Fase | Nome | Resultado obrigatório |
|---|---|---|
| 1 | Fundação: autenticação, tenant e persistência | Usuário autenticado acessa somente seu estabelecimento; perfil básico e catálogo operacional são persistidos no Supabase |
| 2 | Perfil comercial: ingestão, edição e proveniência | Dados coletados/onboarding preenchem o painel; proprietário consegue revisar e editar sem perder a origem nem sobrescrever edições manuais |
| 3 | Operação: agenda e clientes | Agendamentos públicos e administrativos usam a mesma fonte Supabase; clientes e histórico ficam associados ao tenant |
| 4 | Presença digital: site e cinco templates | Dados reais e editados no painel alimentam corretamente os cinco templates e seu fluxo de preview/publicação |
| 5 | Certificação ponta a ponta do painel | Testes comprovam o percurso real desde login/onboarding até edição, agenda, publicação e renderização, com evidências verificáveis |

### Fase 1 — Fundação: autenticação, tenant e persistência

**Objetivo:** tornar o painel seguro e funcional com dados persistidos, sem depender de sessão sintética ou estado operacional do navegador.

**Inclui:**
1. Resolver sessão por Supabase Auth e membership válida em `establishment_memberships`.
2. Identificar o estabelecimento exclusivamente pela membership autorizada; nunca confiar em tenant vindo de `localStorage`, `sessionStorage`, query string ou valor default.
3. Aplicar papéis `owner`, `admin`, `editor` e `viewer`: leitura conforme membership; escrita somente para papéis autorizados.
4. Implementar/ajustar repositório Supabase para perfil básico do estabelecimento, serviços, produtos e mídia.
5. Aplicar RLS e políticas de leitura/escrita coerentes com tenant e papel.
6. Hidratar a store/UI com dados do repositório após login e persistir operações no backend.
7. Tratar loading, erro, sessão expirada, ausência de membership e falha de persistência sem simular sucesso.
8. Manter dados demo/sessões sintéticas restritos a demonstração/testes, sem conceder acesso a dados reais.

**Não inclui:** ingestão completa e resolução de conflitos dos dados coletados (Fase 2), agenda/clientes (Fase 3), refinamento dos templates (Fase 4).

**Aceite verificável:**
- usuário sem membership não entra no painel;
- cada papel respeita as permissões previstas;
- dois tenants não conseguem ler ou alterar registros um do outro;
- CRUD de perfil básico, serviços, produtos e mídia sobrevive a reload e novo login;
- logout encerra a sessão Supabase e limpa o estado visual;
- falhas do backend são exibidas e não são mascaradas por gravação local.

**Estado conhecido:** a branch de trabalho já recebeu implementação inicial desta fase e migration `20261101155810_establishment_catalog_persistence`. Isso não dispensa revalidar os critérios acima na branch/commit efetivamente testados.

### Fase 2 — Perfil comercial: ingestão, edição e proveniência

**Objetivo:** transformar os dados coletados e preservados no onboarding/projeto em um perfil comercial útil no painel, que o proprietário possa corrigir e complementar.

**Inclui:**
1. Rastrear o percurso real dos dados: coleta/prospect → promoção/conversão → onboarding → estabelecimento/projeto/versões → painel.
2. Identificar o payload real existente no banco; mapear campos por evidência, sem presumir que o scraper forneça campos que não coleta.
3. Criar uma projeção estruturada do perfil comercial ligada ao `establishment_id`, cobrindo quando disponíveis: nome, categoria, descrição, telefone, endereço, localização, website, horários, links/redes sociais, nota/avaliações, fotos e links de reserva.
4. Exibir no painel os dados importados em seções editáveis e indicar campos ausentes; ausência não pode ser convertida em informação inventada.
5. Preservar separadamente: dado original coletado, valor editado manualmente e valor atualmente publicado.
6. Registrar proveniência por campo quando disponível: fonte, identificador externo, data da coleta e evidência.
7. Na importação inicial, preencher o que estiver vazio; em reimportações, atualizar a origem sem sobrescrever silenciosamente edição manual.
8. Permitir ao proprietário corrigir/complementar dados e salvar no repositório da Fase 1.
9. Manter serviços, produtos e mídia como entidades administráveis próprias; não inferir catálogo a partir de texto genérico sem evidência.
10. Expor estado de sincronização/conflitos de forma simples e compreensível.

**Não inclui:** reconstruir scraper, reimplementar pipeline de prospecção/qualificação, sincronização futura com Google Business Profile ou refazer os templates.

**Aceite verificável:**
- um estabelecimento convertido com payload conhecido abre o painel com os campos existentes pré-preenchidos;
- cada campo exibido pode ser rastreado à origem ou marcado como edição manual;
- editar e recarregar mantém o valor manual;
- reimportar atualiza a camada de origem e não destrói override;
- campos ausentes permanecem vazios/indisponíveis, sem conteúdo fictício;
- dados permanecem isolados por tenant.

### Fase 3 — Operação: agenda e clientes

**Objetivo:** entregar operação diária confiável para o estabelecimento, com agenda e clientes persistidos e multi-tenant.

**Inclui:**
1. Fazer o painel administrativo listar agendamentos reais de `establishment_appointments` pelo backend, filtrados pelo tenant autorizado.
2. Implementar operações autenticadas para confirmar, cancelar, concluir e, se suportado pelo produto, reagendar/bloquear horários.
3. Fazer o fluxo público de agendamento e o painel administrativo utilizarem a mesma fonte de verdade; remover cópias locais divergentes.
4. Garantir consistência de disponibilidade e impedir dupla reserva sob concorrência no backend/banco.
5. Criar ou consolidar identidade de cliente por estabelecimento, com telefone normalizado e deduplicação segura.
6. Relacionar agendamentos ao cliente e manter histórico de visitas/procedimentos quando houver dados reais.
7. Permitir busca e visualização do histórico no painel sem expor dados entre estabelecimentos.
8. Definir e aplicar RLS/validação de autorização para dados pessoais dos clientes.
9. Tratar estados vazios, cancelamentos, falhas, conflitos de horário e carregamento.

**Não inclui:** CRM de prospecção comercial, campanhas de WhatsApp, automação de marketing ou pipeline de leads.

**Aceite verificável:**
- reserva pública aparece na agenda administrativa após atualização/relogin;
- ações administrativas persistem e refletem no calendário;
- duas tentativas concorrentes para o mesmo horário não geram dupla reserva;
- cliente pode ser localizado e seus agendamentos/histórico são consistentes;
- um tenant não consulta clientes ou agendamentos de outro;
- nenhuma operação depende de `localStorage` como fonte de verdade.

### Fase 4 — Presença digital: site e cinco templates

**Objetivo:** garantir que o perfil e o catálogo administrados no painel alimentem os sites dos clientes nos cinco modelos visuais já existentes.

**Templates no escopo:** Ouro Clássico, Preto Esmeralda, Minimal Studio, Safira Executivo e Rubi Lounge. Preservar os nomes/identificadores reais encontrados no código se diferirem desses rótulos.

**Inclui:**
1. Mapear o contrato de dados entre repositório do estabelecimento, mapper, modelo compartilhado e renderer.
2. Conectar perfil, horários, serviços, produtos e mídia persistidos aos campos correspondentes do renderer.
3. Corrigir mapeamentos de nomes/endereços/contatos/horários e demais campos sem criar valores fictícios.
4. Fazer imagens e mídias válidas aparecerem nos locais previstos, inclusive imagens de serviços quando o modelo suportar.
5. Garantir que todos os cinco templates recebam os mesmos dados de negócio; diferenças entre eles devem ser de apresentação, não de conteúdo ou fonte de dados.
6. Preservar o mecanismo existente de projeto, versões, preview, publicação e URLs públicas.
7. Ao editar dados no painel, atualizar a prévia e gerar/publicar versão conforme o fluxo atual, sem apagar conteúdo manual.
8. Tratar dados opcionais ausentes com estados visuais adequados, sem endereço, horário, nota, mapa, serviço ou avaliação inventados.
9. Validar desktop e mobile nos cinco templates.

**Não inclui:** criar um sexto template, reescrever o motor de publicação, reconstruir pipeline de geração de propostas ou criar editor visual independente.

**Aceite verificável:**
- alterar perfil/serviço/mídia no painel reflete no preview/site;
- os cinco modelos exibem os mesmos dados reais de origem;
- nenhum template inventa dados ausentes;
- versões anteriores continuam acessíveis conforme o mecanismo existente;
- cinco modelos passam por validação visual e funcional em desktop/mobile.

### Fase 5 — Certificação ponta a ponta do painel

**Objetivo:** provar com testes e evidências que as Fases 1–4 funcionam integradas no produto real.

**Inclui obrigatoriamente:**
1. Autenticação: signup/login/logout, sessão expirada e usuário sem membership.
2. Autorização: owner/admin/editor/viewer e isolamento entre pelo menos dois tenants de teste.
3. Persistência: CRUD de perfil, serviços, produtos e mídia, com reload e novo login.
4. Ingestão: perfil pré-preenchido a partir de fixture/payload real conhecido; edição manual e reimportação sem perda.
5. Agenda: criação pública, exibição administrativa, mudança de status, cancelamento e concorrência de horário.
6. Clientes: deduplicação, associação a agendamentos e isolamento por tenant.
7. Templates: preview/publicação dos cinco modelos com os mesmos dados de negócio, desktop e mobile.
8. Regressão: fluxos de onboarding e publicação já existentes continuam funcionando.
9. Qualidade: TypeScript, lint, testes unitários/integrados, build e Playwright.
10. Banco: verificar migration aplicada, RLS habilitado, policies e acesso efetivo no projeto Supabase correto.
11. Evidências: registrar comandos, ambiente, commit/branch, nomes dos testes, resultados, screenshots/artefatos quando aplicável e limitações.

**Regras de certificação:**
- Testes de filas, leases, dead-letter, qualificação de leads, geração de propostas, WhatsApp, consentimento ou HMAC podem ser regressões válidas do produto, mas **não substituem** os testes específicos do painel listados acima.
- Sessão sintética/demo não comprova autenticação real; deve ser identificada como teste de demonstração.
- Teste unitário isolado não comprova integração com Supabase; identificar claramente testes mockados e testes contra backend real.
- Não afirmar cobertura de agenda/clientes/templates se esses fluxos não foram exercitados.
- Não declarar “100%”, “pronto para produção” ou “certificado” se houver critérios bloqueados, mocks relevantes ou ausência de evidência.
- Não criar nem alterar dados reais de clientes/estabelecimentos em produção sem autorização expressa. Usar ambiente de teste/tenant de teste autorizado.
- Executar a certificação em localhost, conforme a orientação operacional definida, sem deploy.
- A fase só é concluída quando todos os critérios aplicáveis passam e os bloqueios restantes estão explicitamente documentados.

### Instrução de delegação para agente local

O agente local deve:
1. Ler este documento inteiro antes de alterar código.
2. Confirmar que está no repositório `Tokenizaa/Beleza-Digital`, branch `work/painel-estabelecimento-fases-1-5`.
3. Trabalhar somente nessa branch; não alterar `main`, não fazer merge, não fazer deploy e não usar a branch futura de Google Business Profile.
4. Conferir o estado real do Git e preservar alterações locais não commitadas.
5. Executar cada fase na ordem 1 → 2 → 3 → 4 → 5, respeitando as fronteiras e critérios de aceite acima.
6. Antes de marcar uma fase como concluída, anexar evidências específicas de cada critério; não reutilizar resultados de uma suíte de outro subsistema como prova.
7. Se uma dependência, dado ou acesso estiver ausente, registrar o bloqueio e solicitar decisão; não inventar dados nem contornar segurança.
8. Manter localhost operacional para validação visual ao final, sem publicar em produção.
9. Entregar relatório com: branch e commit; fases executadas; arquivos alterados; testes por nome e resultado; testes mockados versus reais; evidências de Supabase/RLS; URL localhost; pendências.

**Regra de interpretação:** quando um relatório mencionar “Fase 1 — filas/leases”, “Fase 2 — leads”, “Fase 3 — propostas” ou “Fase 4 — WhatsApp”, ele está descrevendo outro plano/subsistema e não pode ser usado para declarar concluídas as cinco fases deste Marco Zero do painel do estabelecimento.
