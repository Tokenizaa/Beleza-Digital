# Inventário de Schema e Contratos — Parte 1/4

**Contexto:** Subagente B — Banco de dados e contratos da missão de reconciliação do repositório Beleza Digital.
**Local:** /home/lg/workspace/projects/Barbearia-Estetica-Yeshua
**Arquivos inspecionados:** 23 migrations SQL em `supabase/migrations/`; `src/types/index.ts` (197 linhas); `src/types/templates.ts` (163 linhas); `src/data/defaultData.ts`; `src/lib/prospecting.ts`; `src/components/SiteTemplateRenderer.tsx`; `src/pages/SharedSitePreview.tsx`.

---

## 1. Inventário de Tabelas no Banco (SQL)

| # | Tabela | Origem (migration) | Linhas chave | Observação |
|---|--------|--------------------|--------------|------------|
| 1 | `public.platform_admins` | `20261019000000_white_label_site_builder.sql` | 8-12 | Plataforma admin |
| 2 | `public.establishments` | `20261019000000_white_label_site_builder.sql` | 14-26 | **Tabela central de estabelecimentos** (JSONB `contact`, `brand_settings`) |
| 3 | `public.establishment_memberships` | `20261019000000_white_label_site_builder.sql` | 28-35 | Papéis de usuário por estabelecimento |
| 4 | `public.prospects` | `20261019000000_white_label_site_builder.sql` | 37-58 | Candidatos capturados (prospecção) |
| 5 | `public.site_templates` | `20261019000000_white_label_site_builder.sql` | 63-73 | Catálogo de templates de site |
| 6 | `public.site_template_versions` | `20261019000000_white_label_site_builder.sql` | 75-84 | Versões publicadas de template |
| 7 | `public.site_projects` | `20261019000000_white_label_site_builder.sql` | 89-110 | Projetos de site (draft/published) |
| 8 | `public.audit_events` | `20261019000000_white_label_site_builder.sql` | 116-125 | Log de auditoria |
| 9 | `public.billing_plans` | `20261020161116_salon_onboarding_billing_venopag.sql` | 8-20 | Planos de cobrança VenoPag |
| 10 | `public.billing_payments` | `20261020161116_salon_onboarding_billing_venopag.sql` | 22-40 | Pagamentos PIX |
| 11 | `public.establishment_appointments` | `20261020174000_tenant_scoped_server_appointments.sql` | 2-20 | Agendamentos por tenant |
| 12 | `public.prospecting_campaigns` | `20261020185512_prospecting_automation_foundation.sql` | 31-50 | Campanhas de prospecção |
| 13 | `public.prospecting_tasks` | `20261020185512_prospecting_automation_foundation.sql` | 57-79 | Fila de tasks duráveis |
| 14 | `public.prospect_events` | `20261020185512_prospecting_automation_foundation.sql` | 90-107 | Eventos de funil |
| 15 | `public.prospect_outbound_messages` | `20261020185512_prospecting_automation_foundation.sql` | 120-148 | Mensagens de saída |
| 16 | `public.site_project_versions` | `20261020185512_prospecting_automation_foundation.sql` | 154-166 | Versões de projeto de site |
| 17 | `public.prospecting_candidates` | `20261020191500_prospecting_candidates.sql` | 4-34 | Candidatos de descoberta (pré-prospects) |
| 18 | `public.site_demo_public_links` | `20261020191000_public_demo_selection.sql` | 4-15 | Links públicos de demo |
| 19 | `private.platform_admin_bootstrap_codes` | `20261020182000_first_platform_admin_bootstrap_code.sql` | 3-9 | Código bootstrap (removido na `20261024000000_cleanup...`) |

**Tabelas NÃO existentes no banco (referenciadas por código TS):**
- `services` — não existe como tabela; só como `ServiceItem[]` em memória (`defaultData.ts`)
- `products` — não existe como tabela; só como `ProductItem[]` em memória
- `media` / `galleries` / `instagram_embeds` — não existem como tabelas; só `MediaItem[]` e `InstagramEmbedItem[]` em memória

**Colunas adicionadas posteriormente (migrações evolutivas):**
- `prospects.dedupe_key`, `normalized_website`, `normalized_phone`, `qualification_score`, `qualification_reasons`, `source_captured_at`, `last_seen_at`, `outreach_eligibility` (`20261020185512`)
- `prospects.whatsapp_opt_in_at`, `whatsapp_opt_in_evidence_url`, `whatsapp_opted_out_at`, `whatsapp_opt_in_source`, `whatsapp_consent_updated_at` (`20261020190500`)
- `establishments.billing_status` (`20261020161116`)
- `establishments.billing_expires_at`, `booking_horizon_days` (`20261020173000_subscription_access_policy.sql`)
- `billing_plans.max_booking_horizon_days`, `display_order` (`20261020173000`, seed `20261022175246`)
- `site_projects.prospect_id` (re-add via `20261020193000`)
- `site_project_versions.generation_task_id` (`20261020193000`)
- `site_demo_public_links.publish_task_id` (`20261020193000`)

---

## 2. Detalhe de Colunas — Tabelas Foco

### 2.1 `public.establishments` (migration `20261019000000` + aditivas)

| Coluna | Tipo | Nulo | Default | Fonte | Comentário |
|--------|------|------|---------|-------|------------|
| id | uuid | NOT NULL | gen_random_uuid() | SQL | PK |
| slug | text | NOT NULL | — | SQL | unique, regex `^[a-z0-9]+(-[a-z0-9]+)*$` |
| name | text | NOT NULL | — | SQL | |
| status | text | NOT NULL | 'draft' | SQL | check: draft/active/inactive/archived |
| logo_url | text | NULL | — | SQL | |
| primary_color | text | NOT NULL | '#2563eb' | SQL | |
| secondary_color | text | NOT NULL | '#111827' | SQL | |
| contact | jsonb | NOT NULL | '{}' | SQL | phone, whatsapp, address, city, region, instagram (seed) |
| brand_settings | jsonb | NOT NULL | '{}' | SQL | theme, source |
| created_at | timestamptz | NOT NULL | now() | SQL | |
| updated_at | timestamptz | NOT NULL | now() | SQL | |
| billing_status | text | NOT NULL | 'pending' | aditiva | check: pending/active/past_due/canceled |
| billing_expires_at | timestamptz | NULL | — | aditiva | |
| booking_horizon_days | integer | NOT NULL | 60 | aditiva | check 1-365 |

**Nota:** Não existem colunas separadas para telefone, whatsapp, email, endereço, cidade, estado, instagram, latitude/longitude. Tudo é armazenado dentro do JSONB `contact` (ver seed linha 395-402: `phone`, `whatsapp`, `address`, `city`, `region`, `instagram`).

### 2.2 `public.prospects` (migration `20261019000000` + aditivas)

| Coluna | Tipo | Nulo | Default | Fonte | Comentário |
|--------|------|------|---------|-------|------------|
| id | uuid | NOT NULL | gen_random_uuid() | SQL | PK |
| business_name | text | NOT NULL | — | SQL | |
| slug | text | NULL | — | SQL | |
| category | text | NULL | — | SQL | |
| city | text | NULL | — | SQL | |
| region | text | NULL | — | SQL | |
| country_code | text | NOT NULL | 'BR' | SQL | |
| website_url | text | NULL | — | SQL | |
| phone | text | NULL | — | SQL | |
| email | text | NULL | — | SQL | |
| social_links | jsonb | NOT NULL | '{}' | SQL | redes sociais |
| public_source_urls | text[] | NOT NULL | '{}' | SQL | |
| source_name | text | NULL | — | SQL | |
| captured_data | jsonb | NOT NULL | '{}' | SQL | dados brutos capturados |
| qualification | jsonb | NOT NULL | '{}' | SQL | qualificação |
| status | text | NOT NULL | 'captured' | SQL | check: captured/qualified/draft_ready/... |
| captured_by | uuid | NULL | references auth.users | SQL | |
| converted_establishment_id | uuid | NULL | references establishments | SQL | |
| created_at | timestamptz | NOT NULL | now() | SQL | |
| updated_at | timestamptz | NOT NULL | now() | SQL | |
| dedupe_key | text | NULL | — | aditiva | unique index onde not null |
| normalized_website | text | NULL | — | aditiva | index |
| normalized_phone | text | NULL | — | aditiva | index |
| qualification_score | integer | NULL | — | aditiva | |
| qualification_reasons | jsonb | NOT NULL | '[]' | aditiva | |
| source_captured_at | timestamptz | NULL | — | aditiva | |
| last_seen_at | timestamptz | NOT NULL | now() | aditiva | |
| outreach_eligibility | text | NOT NULL | 'unknown' | aditiva | check: unknown/eligible/ineligible/opted_out/blocked |
| whatsapp_opt_in_at | timestamptz | NULL | — | aditiva | consentimento |
| whatsapp_opt_in_evidence_url | text | NULL | — | aditiva | |
| whatsapp_opted_out_at | timestamptz | NULL | — | aditiva | |
| whatsapp_opt_in_source | text | NULL | — | aditiva | |
| whatsapp_consent_updated_at | timestamptz | NULL | — | aditiva | |

### 2.3 `public.prospecting_candidates` (migration `20261020191500`)

| Coluna | Tipo | Nulo | Default | Comentário |
|--------|------|------|---------|------------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| campaign_id | uuid | NOT NULL | references campaigns | FK |
| provider | text | NOT NULL | — | provedor |
| provider_record_id | text | NULL | — | ID externa |
| dedupe_key | text | NOT NULL | unique | chave dedupe |
| business_name | text | NOT NULL | — | |
| category | text | NULL | — | |
| website_url | text | NULL | — | |
| normalized_website | text | NULL | — | |
| phone | text | NULL | — | |
| normalized_phone | text | NULL | — | |
| email | text | NULL | — | |
| address | text | NULL | — | |
| city | text | NULL | — | |
| region | text | NULL | — | |
| country_code | text | NOT NULL | 'BR' | |
| description | text | NULL | — | |
| source_url | text | NULL | — | |
| source_captured_at | timestamptz | NOT NULL | now() | |
| qualification_score | integer | NULL | — | |
| qualification_reasons | jsonb | NOT NULL | '[]' | |
| missing_fields | jsonb | NOT NULL | '[]' | |
| status | text | NOT NULL | 'discovered' | check |
| prospect_id | uuid | NULL | references prospects | FK após promoção |
| raw_evidence | jsonb | NOT NULL | '{}' | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

### 2.4 `public.site_projects` (migration `20261019000000` + `20261020193000`)

| Coluna | Tipo | Nulo | Default | Comentário |
|--------|------|------|---------|------------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| prospect_id | uuid | NULL | references prospects | aditiva |
| establishment_id | uuid | NULL | references establishments | FK |
| template_version_id | uuid | NOT NULL | references site_template_versions | |
| name | text | NOT NULL | — | |
| status | text | NOT NULL | 'draft' | check |
| generated_content | jsonb | NOT NULL | '{}' | |
| design_overrides | jsonb | NOT NULL | '{}' | |
| public_slug | text | NULL | unique | |
| published_url | text | NULL | — | |
| created_by | uuid | NULL | references auth.users | |
| approved_by | uuid | NULL | references auth.users | |
| approved_at | timestamptz | NULL | — | |
| published_at | timestamptz | NULL | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

Constraint: `(prospect_id is not null and establishment_id is null)` OR vice-versa (XOR).

---

## 3. Contratos TypeScript (`src/types/index.ts`)

| Interface | Campos principais | Observação |
|-----------|------------------|------------|
| `Establishment` | id, slug, name, tagline?, status, isDefault?, logoUrl?, coverUrl?, primaryColor?, secondaryColor?, theme?, whatsapp, whatsappClean, phone?, address, cityState, googleMapsUrl?, instagramHandle?, instagramUrl?, instagramBio?, instagramFollowers?, instagramPostsCount?, showInstagramGallery?, adminName?, adminEmail?, openingHoursNote?, allowOnlineBooking?, slotIntervalMinutes?, createdAt, updatedAt? | **Não há latitude/longitude; não há campos separados de email no contato** |
| `CompanyInfo` | = `Establishment` | alias |
| `InstagramEmbedItem` | id, establishmentId?, url, shortcode, title, caption?, type, previewImageUrl?, likesCount?, commentsCount?, date?, featured? | Em memória apenas |
| `ServiceItem` | id, establishmentId?, name, description, price?, durationMinutes?, category, imageUrl?, featured | Em memória apenas |
| `ProductItem` | id, establishmentId?, name, description, price, mainImage, additionalImages?, available, category, featured | Em memória apenas |
| `MediaItem` | id, establishmentId?, type, title, url, thumbnailUrl?, isReelVertical?, category, dateAdded, featured | Em memória apenas |
| `Appointment` | id, establishmentId?, clientName, clientPhone, serviceId, serviceName, servicePrice?, serviceDuration?, date, time, notes?, status, createdAt | Espelho de `establishment_appointments` |

### 3.1 Contrato de exibição `SiteBusinessData` (`src/types/templates.ts` l.146)

| Campo | Tipo | Nulo |
|-------|------|------|
| name | string | NOT NULL |
| category | string | NOT NULL |
| tagline? | string | NULL |
| description | string | NOT NULL |
| phone | string | NOT NULL |
| whatsapp | string | NOT NULL |
| address | string | NOT NULL |
| city | string | NOT NULL |
| state? | string | NULL |
| logoUrl? | string | NULL |
| coverUrl? | string | NULL |
| instagramHandle? | string | NULL |
| instagramUrl? | string | NULL |
| services? | ServiceItem[] | NULL |
| products? | ProductItem[] | NULL |
| media? | MediaItem[] | NULL |

### 3.2 Contrato de preview `ShareableSitePreview` (`src/pages/SharedSitePreview.tsx` l.5-18)

| Campo | Tipo | Nulo |
|-------|------|------|
| version | literal 1 | — |
| businessName | string | NOT NULL |
| category | string | NOT NULL |
| description | string | NOT NULL |
| phone | string | NOT NULL |
| email | string | NOT NULL |
| address | string | NOT NULL |
| websiteUrl | string | NOT NULL |
| templateId | string | NOT NULL |
| templateName | string | NOT NULL |
| projectVersion | number | NOT NULL |
| generatedAt | string | NOT NULL |

### 3.3 `SiteBusinessData` duplicada em `SiteTemplateRenderer.tsx` (l.133)

Mesma forma que templates.ts (name, category, tagline?, description, phone, whatsapp, address, city, state?, logoUrl?, coverUrl?, instagramHandle?, instagramUrl?, services?, products?, media?).

---

**Fim Parte 1.** Próxima parte: matriz de rastreabilidade completa (campo × origem × captura × transformação × persistência × leitura × exibição × status).