# Marco Zero — Contrato real entre scraping, persistência e templates

**Escopo:** alinhar o dado efetivamente capturado pelo Google Maps com as cinco versões públicas do site.
**Fonte de verdade:** código executável em `workers/prospecting-scheduler/src/extractor.ts`, `workers/prospecting-scheduler/src/index.ts`, migrations e `src/lib/scraped-place-normalizer.ts`. Documentos anteriores que descrevem campos não implementados não prevalecem sobre este contrato.

## 1. O que a captura atual realmente extrai

O extractor Playwright de produção retorna:

| Campo de origem | Persistência atual | Uso no gerador |
|---|---|---|
| `name` | `prospecting_candidates.business_name` | `name` / `businessName` |
| `category` | `prospecting_candidates.category` | `category` |
| `address` | coluna `address` e `captured_data.address` | `contact.address` |
| `phone` | `phone` / `normalized_phone` | `contact.phone` |
| `website` | `website_url` | `website` |
| `rating` | `raw_evidence.rating` | `rating` |
| `reviewCount` | `raw_evidence.reviewCount` | `reviewCount` |
| `sourceUrl` | `source_url` e `captured_data.source_url` | `sourceUrl` / `googleMapsUrl` |
| `placeId`, `featureId` | `provider_record_id` / `raw_evidence` | metadados de origem |
| `latitude`, `longitude` | `raw_evidence` | coordenadas |
| `images` | `raw_evidence.images` | `photos` / galeria |
| `openingHours` | `raw_evidence.openingHours` | `openingHours` |
| `priceLevel` | `raw_evidence.priceLevel` | `priceRange` |
| `editorialSummary` | `raw_evidence.editorialSummary` | `description`, quando não há descrição direta |
| `operatingStatus` | `raw_evidence.operatingStatus` | `status` |
| `fieldStatus` | `raw_evidence.fieldStatus` | proveniência/diagnóstico de captura |

O extractor **não coleta atualmente** catálogo de serviços, produtos, avaliações individuais, reels/vídeos, logo, perfil/publicações de Instagram ou URL de agendamento. O normalizador aceita esses campos caso outra fonte os passe a fornecer, mas não os fabrica.

## 2. Caminho real dos dados

1. O Worker abre o Maps via Cloudflare Browser/Playwright e chama `extractPlaceDetails()`.
2. A descoberta persiste os campos cadastrais em `prospecting_candidates` e evidências complementares em `raw_evidence`.
3. `promote_prospecting_candidate()` cria o registro em `prospects` e preserva a evidência em `captured_data.raw_evidence`.
4. A tarefa `generate_demo` lê o prospect persistido, normaliza a estrutura promovida e constrói o conteúdo usando `mapDataForTemplate()`.
5. O Worker gera uma versão persistida para cada slug ativo: `ouro-classico`, `preto-esmeralda`, `minimal-studio`, `safira-executivo` e `rubi-lounge`.
6. A tarefa `publish_demo` cria o link público com token de alta entropia; `functions/api/demos/[token].ts` lê as versões persistidas.
7. `PublicDemoSelectionPage` mapeia os dados normalizados para `SharedSitePreview` e `SiteTemplateRenderer`.

## 3. Contrato normalizado

`src/lib/scraped-place-normalizer.ts` é a fronteira entre o formato Postgres/JSON do scraper e o domínio dos templates. Aceita campos snake_case, camelCase e evidências aninhadas em `raw_evidence`. Ausências permanecem nulas ou vazias.

O mapper comum `src/lib/template-data-mapper.ts` aplica o mesmo contrato aos cinco modelos. A variação entre modelos é visual e de composição; não deve alterar a origem nem inventar valores comerciais.

Campos de proveniência preservados: `originalProvider`, `collectedAt`, `fieldStatus`, `sourceUrl`, `googleMapsUrl`.

## 4. Dados ilustrativos

Serviços, produtos e mídia de demonstração podem usar conteúdo ilustrativo apenas na camada pública de apresentação, quando a coleta não oferece esses dados. Esses exemplos:

- não são gravados em `prospects`, `site_projects` ou `site_project_versions`;
- não substituem campos reais;
- devem estar sinalizados na demonstração;
- não podem inventar telefone, endereço, nota, avaliações, horários ou perfis externos.

A ausência de um campo não significa que o estabelecimento não ofereça o serviço ou produto; significa apenas que a coleta não o confirmou.

## 5. Idempotência das cinco versões

A restrição anterior de `site_project_versions` permitia apenas uma linha por `generation_task_id`. A migration `20261031100000_five_template_demo_versions.sql` substitui essa unicidade por `(generation_task_id, template_version_id)`, permitindo uma versão por modelo e retentativas sem duplicação.

**Atenção operacional:** a migration está versionada no repositório. A aplicação no banco de produção precisa ser confirmada no projeto Supabase correto antes de publicar o Worker atualizado. Não considerar a migration aplicada apenas por existir no Git.

## 6. Validação automatizada

`tests/scraped-place-normalizer.test.ts` cobre:
- campos reais em snake_case;
- evidências aninhadas após promoção;
- JSON serializado e arrays;
- ausência de dados sem preenchimento fictício;
- propagação do mesmo contrato para os cinco templates.

A execução de GitHub Actions `41258410876` no commit `ac2866ca53377a18960b2f30ac717f20261e6917` concluiu com testes, TypeScript e build aprovados.

## 7. Pendências para fechar o marco zero

- Aplicar e verificar a migration no projeto Supabase efetivamente usado pelo Beleza Digital.
- Executar o workflow de validação/deploy do Worker e confirmar que a versão implantada contém o gerador de cinco versões.
- Rodar um ciclo real com um prospect recém-coletado e conferir os cinco registros em `site_project_versions`.
- Abrir o link público real e comparar nome, contato, endereço, reputação, horários, preço, fotos e proveniência com a ficha original.
- Confirmar que falha da API pública não recai em dados simulados de produção.

Nenhum teste sintético substitui essa validação com um registro real.
