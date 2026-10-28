# Inventário de Schema e Contratos — Parte 2/4

## 4. Matriz de Rastreabilidade — Estabelecimentos

Lenda: **Banco** = coluna em SQL; **TS** = campo em TypeScript; **Captura** = onde o dado entra no sistema; **Transformação** = como é mapeado/serializado; **Persistência** = onde é gravado; **Leitura** = onde é lido; **Exibição** = onde é mostrado ao usuário; **Status** = OK / GAP / DESALINHADO / AUSENTE.

### 4.1 Identidade

| Campo | Banco (establishments) | TS (Establishment) | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|------------------------|--------------------|---------|---------------|--------------|---------|----------|--------|
| id | uuid PK | id: string | migration seed / trigger provision_salon_owner | gen_random_uuid() | establishments.id | supabase.ts nunca lê establishments via client | SiteTemplateRenderer name/logo | **GAP** — código nunca consulta establishments via Supabase (store.ts é memória) |
| slug | slug text unique | slug: string | seed / trigger | slugify | establishments.slug | não lido via client | não exibido diretamente | **GAP** (não lido/exibido pelo frontend) |
| name | name text | name: string | seed / trigger / defaultData | — | establishments.name | memória (defaultData.ts) | Renderer h1, preview businessName | **DESALINHADO** — banco não populado pelo app; só seed |
| tagline | (não existe coluna) | tagline?: string | defaultData | — | — | memória | Renderer tagline | **AUSENTE no banco** |
| status | status text (draft/active/...) | status: EstablishmentStatus (active/inactive/suspended) | seed | — | establishments.status | não lido via client | não exibido | **GAP** + enum difere (suspended vs archived) |
| isDefault | (não existe) | isDefault?: boolean | defaultData | — | — | memória | não exibido | **AUSENTE no banco** |

### 4.2 Identidade Visual

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|--------|
| logo_url | logo_url text | logoUrl?: string | seed (não preenchido) | — | establishments.logo_url | não lido via client | Renderer logo img | **GAP** (não persistido/lido) |
| cover_url | (não existe) | coverUrl?: string | defaultData | — | — | memória | Renderer cover img | **AUSENTE no banco** |
| primary_color | primary_color text | primaryColor?: string | seed '#f59e0b' | — | establishments.primary_color | não lido via client | Renderer tema | **GAP** |
| secondary_color | secondary_color text | secondaryColor?: string | seed '#d97706' | — | establishments.secondary_color | não lido via client | Renderer tema | **GAP** |
| theme | brand_settings.jsonb->'theme' | theme?: EstablishmentTheme | seed 'amber' | JSONB extração | establishments.brand_settings | não lido via client | SiteTemplateConfig (hardcoded) | **DESALINHADO** — tema hardcoded em templates.ts, não lido do banco |

### 4.3 Contato e Localização

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|--------|
| phone | contact.jsonb->'phone' | phone?: string | seed '(92) 98618-7766' | JSONB | establishments.contact | não lido via client | Renderer telefone | **GAP** |
| whatsapp | contact.jsonb->'whatsapp' | whatsapp: string (obrigatório) | seed '5592986187766' | JSONB | establishments.contact | não lido via client | Renderer wa.me link | **GAP** |
| whatsappClean | (não existe) | whatsappClean: string (obrigatório) | defaultData '' | derivado (remove não-dígitos) | — | memória | Renderer wa.me | **DERIVADO** (não persistido) |
| address | contact.jsonb->'address' | address: string | seed 'Av. Constantino Nery, 50' | JSONB | establishments.contact | não lido via client | Renderer endereço | **GAP** |
| cityState | contact.jsonb->'city' (+ região) | cityState: string | seed 'Manaus' / 'Amazonas' | JSONB concat | establishments.contact | não lido via client | Renderer maps link | **GAP** |
| googleMapsUrl | (não existe) | googleMapsUrl?: string | defaultData '' | — | — | memória | Renderer link Google Maps | **AUSENTE no banco** |
| latitude/longitude | (não existem) | (não existem no TS) | — | — | — | — | — | **AUSENTE (ambos)** |
| instagram | contact.jsonb->'instagram' | instagramUrl?: string | seed URL Instagram | JSONB | establishments.contact | não lido via client | Renderer Instagram | **GAP** |

### 4.4 Instagram e Redes Sociais

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|--------|
| instagramHandle | social_links (prospects) / (não existe em establishments) | instagramHandle?: string | defaultData '' | — | — | memória | InstagramSection | **AUSENTE no banco establishments** |
| instagramBio | (não existe) | instagramBio?: string | defaultData | — | — | memória | InstagramSection | **AUSENTE no banco** |
| instagramFollowers | (não existe) | instagramFollowers?: string | defaultData '' | — | — | memória | InstagramSection | **AUSENTE no banco** |
| instagramPostsCount | (não existe) | instagramPostsCount?: string | defaultData '' | — | — | memória | InstagramSection | **AUSENTE no banco** |
| showInstagramGallery | (não existe) | showInstagramGallery?: boolean | defaultData false | — | — | memória | condicionalRenderer | **AUSENTE no banco** |

### 4.5 Administração / Acesso

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|----------|--------|
| adminName | contact.jsonb->'owner_name' (seed) | adminName?: string | seed | JSONB | establishments.contact | não lido | não exibido | **GAP** |
| adminEmail | contact.jsonb->'owner_email' (seed) | adminEmail?: string | seed | JSONB | establishments.contact | não lido | não exibido | **GAP** |
| openingHoursNote | (não existe) | openingHoursNote?: string | defaultData | — | — | memória | não exibido | **AUSENTE no banco** |
| allowOnlineBooking | (não existe) | allowOnlineBooking?: boolean | defaultData true | — | — | memória | não exibido | **AUSENTE no banco** |
| slotIntervalMinutes | (não existe) | slotIntervalMinutes?: number | defaultData 45 | — | — | memória | não exibido | **AUSENTE no banco** |

### 4.6 Auditoria

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|--------|
| created_at | timestamptz | createdAt: string | now() | ISO string | establishments.created_at | não lido via client | não exibido | **GAP** |
| updated_at | timestamptz | updatedAt?: string | now() | ISO string | establishments.updated_at | não lido via client | não exibido | **GAP** |

---

## 5. Matriz de Rastreabilidade — Prospects / Prospecting Candidates

### 5.1 Prospects (captura → banco)

| Campo | Banco (prospects) | TS (ProspectIdentity / lib/prospecting.ts) | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------------------|---------------------------------------------|---------|---------------|--------------|---------|----------|--------|
| business_name | business_name text | businessName?: string | captura autônoma (worker) | — | prospects.business_name | service_role / plataforma | não exibido publicamente | OK (via worker) |
| slug | slug text | (não mapeado) | — | slugify | prospects.slug | — | não exibido | OK |
| category | category text | category?: string | captura | — | prospects.category | — | não exibido | OK |
| city | city text | city?: string | captura | — | prospects.city | — | não exibido | OK |
| region | region text | region?: string | captura | — | prospects.region | — | não exibido | OK |
| country_code | country_code text | countryCode?: string ('BR') | captura | — | prospects.country_code | — | não exibido | OK |
| website_url | website_url text | websiteUrl?: string | captura | normalizeWebsite | prospects.website_url | — | não exibido | OK |
| phone | phone text | phone?: string | captura | normalizePhone | prospects.phone | — | não exibido | OK |
| email | email text | email?: string | captura | — | prospects.email | — | não exibido | OK |
| social_links | social_links jsonb | (não existe em TS prospect) | captura | — | prospects.social_links | — | não exibido | OK (banco só) |
| public_source_urls | public_source_urls text[] | sourceUrl?: string | captura | array[source_url] | prospects.public_source_urls | — | não exibido | OK |
| source_name | source_name text | (não mapeado) | captura | provider | prospects.source_name | — | não exibido | OK |
| captured_data | captured_data jsonb | (não existe em TS) | captura | JSONB agregado | prospects.captured_data | — | não exibido | OK (banco só) |
| qualification | qualification jsonb | ProspectQualification (score, reasons, missingFields) | captura | JSONB | prospects.qualification | — | não exibido | OK |
| status | status text | (não existe em TS) | captura | — | prospects.status | — | não exibido | OK |
| dedupe_key | dedupe_key text | (derivado via createProspectDedupeKey) | worker | SHA-256 | prospects.dedupe_key | unique index | não exibido | OK |
| normalized_website | normalized_website text | (derivado) | worker | normalizeWebsite | prospects.normalized_website | index | não exibido | OK |
| normalized_phone | normalized_phone text | (derivado) | worker | normalizePhone | prospects.normalized_phone | index | não exibido | OK |
| qualification_score | qualification_score integer | ProspectQualification.score | worker | — | prospects.qualification_score | — | não exibido | OK |
| whatsapp_opt_in_* | 5 colunas timestamptz/text | OutreachEligibilityInput | consentimento | — | prospects.whatsapp_opt_in_at etc. | índice | não exibido | OK (banco só) |
| outreach_eligibility | outreach_eligibility text | (não existe em TS) | worker | — | prospects.outreach_eligibility | índice | não exibido | OK |
| converted_establishment_id | uuid FK | (não existe em TS) | promoção | — | prospects.converted_establishment_id | — | não exibido | OK |

### 5.2 Prospecting Candidates (descoberta → promoção)

| Campo | Banco (prospecting_candidates) | TS correspondente | Status |
|-------|--------------------------------|-------------------|--------|
| Todos os acima + provider, provider_record_id, raw_evidence, missing_fields | — | lib/prospecting.ts (ProspectQualificationInput) | OK para pipeline autônomo; **não exibido ao usuário final** |

**Função `promote_prospecting_candidate`** (migration `20261020192000`, l.31-72): mapeia campos do candidate para prospects via `jsonb_build_object`, incluindo aliases duplicados (`name`, `company_name`, `website`, `phone_number`, `state`, `description`, `source_url`). Usa `jsonb_populate_record` contra colunas verificadas em `information_schema.columns` (l.74-85).

---

## 6. Matriz de Rastreabilidade — Site Projects / Templates / Demo Links

| Campo | Banco | TS | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|-------|----|---------|---------------|--------------|---------|----------|--------|
| site_projects.id | uuid | (não exposto) | ensure_prospect_site_project | gen_random_uuid | site_projects.id | service_role | — | OK |
| site_projects.name | text | ShareableSitePreview.businessName | worker | prospect.business_name | site_projects.name | worker RPC | preview businessName | OK |
| site_projects.slug / public_slug | text unique | ShareableSitePreview não tem | worker | slugify(name) | site_projects.public_slug | — | não exibido | OK |
| site_projects.generated_content | jsonb | (não existe em TS) | select_public_demo_version | versão.selecionada | site_projects.generated_content | worker | SiteTemplateRenderer (via conteúdo) | OK |
| site_projects.status | text | (não existe em TS) | worker | — | site_projects.status | — | não exibido | OK |
| site_projects.published_url | text | (não existe em TS) | publicação | — | site_projects.published_url | — | não exibido | OK |
| site_template_versions.config | jsonb | SiteTemplateConfig (hardcoded) | seed | JSONB | site_template_versions.config | não lido via client | SiteTemplateConfig (estático) | **DESALINHADO** |
| site_demo_public_links.token_hash | text | (não exposto) | demo-links.ts | SHA-256 do token | site_demo_public_links.token_hash | API function | — | OK |
| site_demo_public_links.expires_at | timestamptz | (não exposto) | demo-links.ts | now()+14d | site_demo_public_links.expires_at | API function | — | OK |
| site_demo_public_links.selected_version_id | uuid FK | (não exposto) | RPC select_public_demo_version | — | site_demo_public_links.selected_version_id | — | — | OK |

---

## 7. Matriz de Rastreabilidade — Agendamentos

| Campo | Banco (establishment_appointments) | TS (Appointment) | Captura | Transformação | Persistência | Leitura | Exibição | Status |
|-------|------------------------------------|------------------|---------|---------------|--------------|---------|----------|--------|
| id | uuid | id: string | RPC | gen_random_uuid | establishment_appointments.id | (acesso negado) | não exibido | OK |
| establishment_id | uuid FK | establishmentId?: string | RPC (via slug) | — | establishment_appointments.establishment_id | — | — | OK |
| client_name | text | clientName: string | RPC | trim | establishment_appointments.client_name | — | — | OK |
| client_phone | text | clientPhone: string | RPC | trim | establishment_appointments.client_phone | — | — | OK |
| service_id | text | serviceId: string | RPC | trim | establishment_appointments.service_id | — | — | OK |
| service_name | text | serviceName: string | RPC | trim | establishment_appointments.service_name | — | — | OK |
| service_price | numeric(12,2) | servicePrice?: number\|null | RPC | — | establishment_appointments.service_price | — | — | OK |
| service_duration_minutes | integer | serviceDuration?: number\|null | RPC | — | establishment_appointments.service_duration_minutes | — | — | OK |
| appointment_date | date | date: string (YYYY-MM-DD) | RPC | — | establishment_appointments.appointment_date | — | — | OK |
| appointment_time | time | time: string (HH:mm) | RPC | to_char HH24:MI | establishment_appointments.appointment_time | — | — | OK |
| notes | text | notes?: string | RPC | nullif trim | establishment_appointments.notes | — | — | OK |
| status | text | status: 'pendente'\|... | RPC | default 'pendente' | establishment_appointments.status | — | — | OK |
| created_at | timestamptz | createdAt: string | RPC | now() | establishment_appointments.created_at | — | — | OK |

**Nota:** A função `create_public_establishment_appointment` foi movida para `private` schema e as permissões para `anon`/`authenticated` foram revogadas (migration `20261022174513`). Apenas `service_role` pode chamar. O frontend não escreve diretamente nesta tabela.

---

## 8. Matriz de Rastreabilidade — Serviços, Produtos, Mídia (AUSENTES no banco)

| Campo | Banco | TS | Status |
|-------|-------|----|--------|
| services (tabela) | NÃO EXISTE | ServiceItem[] (defaultData.ts) | **AUSENTE no banco** — apenas memória |
| products (tabela) | NÃO EXISTE | ProductItem[] (defaultData.ts) | **AUSENTE no banco** — apenas memória |
| media / gallery (tabela) | NÃO EXISTE | MediaItem[] (defaultData.ts) | **AUSENTE no banco** — apenas memória |
| instagram_embeds (tabela) | NÃO EXISTE | InstagramEmbedItem[] (defaultData.ts, vazio) | **AUSENTE no banco** — apenas memória |

Esses dados são lidos de `defaultData.ts` (memória) e passados via `businessData` para `SiteTemplateRenderer`. Nunca são persistidos nem lidos do Supabase pelo frontend (`store.ts` não usa `supabase`).

---

**Fim Parte 2.** Próxima parte: lista consolidada de divergências e gaps com evidências de arquivo/linha.