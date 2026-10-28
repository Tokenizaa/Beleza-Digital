# Inventário de Schema e Contratos — Parte 3/4

## 9. Lista Consolidada de Divergências entre Schema SQL e Tipos TypeScript

### 9.1 Campos no TS que NÃO existem como colunas no banco (tabela `establishments`)

O banco armazena quase tudo dentro dos JSONB `contact` e `brand_settings`. O TypeScript espera colunas planas. Não há mapeamento automático entre eles.

| Campo TS | Linha TS | Espera no banco | Realidade no banco | Gap |
|----------|----------|-----------------|--------------------|-----|
| `tagline` | `index.ts` l.25 | coluna `tagline` | NÃO EXISTE (só em defaultData) | **AUSENTE** |
| `isDefault` | `index.ts` l.27 | coluna `is_default` | NÃO EXISTE | **AUSENTE** |
| `coverUrl` | `index.ts` l.31 | coluna `cover_url` | NÃO EXISTE | **AUSENTE** |
| `phone` | `index.ts` l.39 | coluna `phone` | somente `contact.jsonb->'phone'` | **DESALINHADO** (JSONB vs coluna) |
| `whatsapp` | `index.ts` l.37 | coluna `whatsapp` | somente `contact.jsonb->'whatsapp'` | **DESALINHADO** (JSONB vs coluna) |
| `whatsappClean` | `index.ts` l.38 | coluna derivada | NÃO EXISTE (derivado em memória) | **DERIVADO** |
| `address` | `index.ts` l.40 | coluna `address` | somente `contact.jsonb->'address'` | **DESALINHADO** (JSONB vs coluna) |
| `cityState` | `index.ts` l.41 | coluna `city_state` | somente `contact.jsonb->'city'` + `region` | **DESALINHADO** (JSONB + concat) |
| `googleMapsUrl` | `index.ts` l.42 | coluna `google_maps_url` | NÃO EXISTE | **AUSENTE** |
| `instagramHandle` | `index.ts` l.45 | coluna `instagram_handle` | NÃO EXISTE em establishments (só `social_links` em prospects) | **AUSENTE** |
| `instagramBio` | `index.ts` l.47 | coluna `instagram_bio` | NÃO EXISTE | **AUSENTE** |
| `instagramFollowers` | `index.ts` l.48 | coluna `instagram_followers` | NÃO EXISTE | **AUSENTE** |
| `instagramPostsCount` | `index.ts` l.49 | coluna `instagram_posts_count` | NÃO EXISTE | **AUSENTE** |
| `showInstagramGallery` | `index.ts` l.50 | coluna `show_instagram_gallery` | NÃO EXISTE | **AUSENTE** |
| `adminName` | `index.ts` l.53 | coluna `admin_name` | NÃO EXISTE (só `contact.jsonb->'owner_name'` no seed) | **AUSENTE** |
| `adminEmail` | `index.ts` l.54 | coluna `admin_email` | NÃO EXISTE (só `contact.jsonb->'owner_email'` no seed) | **AUSENTE** |
| `openingHoursNote` | `index.ts` l.55 | coluna `opening_hours_note` | NÃO EXISTE | **AUSENTE** |
| `allowOnlineBooking` | `index.ts` l.56 | coluna `allow_online_booking` | NÃO EXISTE | **AUSENTE** |
| `slotIntervalMinutes` | `index.ts` l.57 | coluna `slot_interval_minutes` | NÃO EXISTE | **AUSENTE** |
| `latitude` / `longitude` | — | colunas `latitude`/`longitude` | NÃO EXISTEM (nenhuma migration cria) | **AUSENTE (ambos)** |

### 9.2 Campos no banco que NÃO são capturados pelo código TypeScript

| Campo banco | Linha SQL | Tipo | Por que não chega ao TS |
|-------------|-----------|------|-------------------------|
| `prospects.social_links` | `white_label_site_builder.sql` l.48 | jsonb | Não há equivalente em `lib/prospecting.ts` (`ProspectIdentity` não tem social_links) |
| `prospects.public_source_urls` | `white_label_site_builder.sql` l.49 | text[] | Não mapeado em TS; apenas `sourceUrl` em `ProspectQualificationInput` |
| `prospects.captured_data` | `white_label_site_builder.sql` l.51 | jsonb | Não existe em TS |
| `prospects.qualification` | `white_label_site_builder.sql` l.52 | jsonb | `ProspectQualification` existe em TS (`lib/prospecting.ts` l.18) mas não é um campo da interface Establishment; vive só na camada de prospecção |
| `prospects.dedupe_key` / `normalized_*` / `qualification_score` / `outreach_eligibility` | migrações prospecting | — | Colunas de automação; não refletidas em nenhum tipo TS de exibição |
| `prospects.whatsapp_opt_in_*` (5 colunas) | `20261020190500` | — | `OutreachEligibilityInput` em `lib/prospecting.ts` l.24-29 cobre parte, mas não está ligado a `Establishment` |
| `establishments.billing_status` / `billing_expires_at` / `booking_horizon_days` | aditivas | — | Não existem em `Establishment` TS |
| `billing_plans.max_booking_horizon_days` / `display_order` | `20261020173000` l.8 + seed l.28 | — | Não existem em TS |
| `site_projects.prospect_id` | `20261020193000` l.5 | uuid | Não mapeado em TS de preview |
| `site_project_versions.generation_task_id` | `20261020193000` l.13 | uuid | Não mapeado em TS |

### 9.3 Diferenças de formato / serialização / nulabilidade

| Campo | Banco | TS | Diferença | Impacto |
|-------|-------|----|-----------|---------|
| `Establishment.status` | `text` check (draft, active, inactive, archived) | `EstablishmentStatus` = 'active'\|'inactive'\|'suspended' | Enum difere: banco tem 'draft'/'archived', TS não tem; TS tem 'suspended', banco não tem | **Incompatibilidade de enum** |
| `Establishment.createdAt` | `timestamptz` | `string` | Serialização ISO-8601 esperada; banco armazena timestamptz | OK se convertido, mas nunca lido pelo client |
| `Appointment.date` | `date` | `string` (YYYY-MM-DD) | OK (date → string) |
| `Appointment.time` | `time` | `string` (HH:mm) | RPC converte com `to_char(..., 'HH24:MI')` l.87 | OK via RPC |
| `Appointment.service_price` | `numeric(12,2)` | `number \| null` | numeric → number (risco de precisão para valores grandes, mas aceitável para preços) | OK |
| `ProductItem.price` | — | `number` (obrigatório) | Em `defaultData` sempre preenchido; no banco não existe tabela | N/A (memória) |
| `ServiceItem.price` | — | `number \| null` | null permitido | N/A (memória) |
| `MediaItem.dateAdded` | — | `string` | Data como string, sem coluna no banco | N/A (memória) |
| `prospects.country_code` | `text` DEFAULT 'BR' | `countryCode?: string` | Default no banco, opcional no TS | OK |
| `prospects.status` | check list longo (7 valores) | não existe em TS de prospecção | Banco tem mais estados que o TS reconhece | **Desalinhado** |

### 9.4 Objetos referenciados pelo código que NÃO existem no banco

| Referência | Onde é referenciado | Linha | Situação |
|------------|---------------------|-------|----------|
| Tabela `services` | `defaultData.ts` (ServiceItem[]) | l.163 | Não existe como tabela SQL; só memória |
| Tabela `products` | `defaultData.ts` (ProductItem[]) | l.256 | Não existe como tabela SQL; só memória |
| Tabela `media` / galeria | `defaultData.ts` (MediaItem[]) | l.310 | Não existe como tabela SQL; só memória |
| Tabela `instagram_embeds` | `defaultData.ts` (InstagramEmbedItem[]) | l.114 | Não existe como tabela SQL; array vazio em memória |
| `establishments.booking_horizon_days` | Referenciada na RPC `create_public_establishment_appointment` l.57,72 | `20261020174000` | Criada na `20261020173000` l.5 — existe, mas só via aditiva posterior |
| `establishments.billing_expires_at` | Referenciada na RPC l.57,65 | `20261020174000` | Criada na `20261020173000` l.4 — existe via aditiva |
| `billing_plans.max_booking_horizon_days` | Referenciada na seed `20261022175246` l.28,35 | `seed_production_catalog_baseline` | Criada na `20261020173000` l.8 — existe via aditiva |
| `billing_plans.display_order` | Referenciada na seed l.28,35 | `seed_production_catalog_baseline` | NÃO CRIADA por nenhuma migration (apenas referenciada na seed) | **COLUNA FALTANTE** — seed referencia `display_order` mas nenhuma migration `add column` a cria |
| `site_demo_public_links` | `functions/api/demos/[token].ts`, `demo-links.ts`, `workers/...`, auditoria | — | **EXISTE** (criada na `20261020191000` l.4). A auditoria de 2026-10-23 reportou ausência, mas a migration está no repositório. |

---

## 10. Lista de Campos Faltantes ou Desalinhados (Resumo Executivo)

### Críticos (dados de negócio não persistidos)
1. **Serviços, produtos, mídia, Instagram embeds** — não existem tabelas SQL. Vivem apenas em `src/data/defaultData.ts` (memória). Nunca são gravados nem lidos do Supabase pelo frontend.
2. **Geolocalização (latitude/longitude)** — não existe em nenhum lugar: nem no SQL, nem no TS, nem na exibição.
3. **Campos planos de contato em `establishments`** — telefone, whatsapp, endereço, cidade, Instagram estão apenas dentro do JSONB `contact`, sem colunas próprias. O TypeScript espera colunas planas.

### Altos (desalinhamento de contrato)
4. **Enum `status` divergente** — banco: draft/active/inactive/archived; TS: active/inactive/suspended. 'suspended' no TS não existe no banco; 'draft'/'archived' no banco não existem no TS.
5. **`whatsappClean` derivado** — existe só no TS (derivado em memória), não é persistido.
6. **`isDefault`, `tagline`, `coverUrl`, `googleMapsUrl`, `adminName/Email`, `openingHoursNote`, `allowOnlineBooking`, `slotIntervalMinutes`** — existem no TS, não existem no banco.

### Médios (campos de banco não capturados pelo TS)
7. `prospects.social_links`, `captured_data`, `qualification` — JSONB no banco sem espelho TS.
8. `prospects.whatsapp_opt_in_*` — existem no banco, parcialmente cobertos por `OutreachEligibilityInput` mas não ligados a `Establishment`.
9. `billing_plans.display_order` — referenciado na seed, não criado por migration.

### Baixos (metadados de automação)
10. `dedupe_key`, `normalized_website`, `normalized_phone`, `qualification_score`, `outreach_eligibility`, `whatsapp_consent_*` — úteis para pipeline autônomo, sem espelho nos tipos de exibição.

---

**Evidências de inspeção:**
- Migrations: `supabase/migrations/20261019000000_white_label_site_builder.sql` (establishments, prospects, site_templates, site_template_versions, site_projects, audit_events), `20261020185512_prospecting_automation_foundation.sql` (colunas adicionais prospects, campaigns, tasks, events, outbound_messages, site_project_versions), `20261020191500_prospecting_candidates.sql`, `20261020191000_public_demo_selection.sql` (site_demo_public_links), `20261020173000_subscription_access_policy.sql` (billing_expires_at, booking_horizon_days, max_booking_horizon_days), `20261020174000_tenant_scoped_server_appointments.sql` (establishment_appointments + RPC).
- Tipos TS: `src/types/index.ts` (l.1-197), `src/types/templates.ts` (l.146-163 SiteBusinessData), `src/pages/SharedSitePreview.tsx` (l.5-18 ShareableSitePreview), `src/lib/prospecting.ts` (l.1-124), `src/data/defaultData.ts` (memória).

**Fim Parte 3.** Próxima parte: gaps entre captura → persistência → exibição e recomendações.