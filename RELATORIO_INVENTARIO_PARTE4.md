# Inventário de Schema e Contratos — Parte 4/4

## 11. Gaps entre Captura → Persistência → Exibição

### 11.1 Fluxo de Estabelecimentos (White Label)

```
Captura:    defaultData.ts (memória) — dados fixos, não vêm de formulário nem Supabase
Persistência: NÃO OCORRE via frontend. store.ts não chama supabase. 
               O banco só tem o seed Yeshua (migration l.388-405).
Leitura:    SiteTemplateRenderer lê businessData de props (memória), não do Supabase.
Exibição:   Renderer mostra logo, nome, telefone, whatsapp, endereço, Instagram, serviços, produtos, mídia.
GAP:        Nenhum dado de establishment é gravado/lido do Supabase pelo frontend. 
             O banco é apenas um registro de seed. O contrato Establishment (TS) 
             não tem correspondência 1:1 com colunas (tudo JSONB contact/brand_settings).
Evidência:  src/data/store.ts — sem chamadas supabase.from('establishments').
             src/lib/supabase.ts — cliente criado mas não usado para establishments.
             src/components/SiteTemplateRenderer.tsx l.133-194 — businessData vem de props.
```

### 11.2 Fluxo de Serviços / Produtos / Mídia

```
Captura:    defaultData.ts (INITIAL_SERVICES l.163, INITIAL_PRODUCTS l.256, INITIAL_MEDIA l.310)
Persistência: NÃO EXISTE. Sem tabelas services/products/media no SQL.
Leitura:    Memória (defaultData.ts) → SiteTemplateRenderer (servicesList l.184, etc.)
Exibição:   Renderer exibe cards de serviço, produto, galeria de mídia.
GAP CRÍTICO: Qualquer serviço/produto/mídia adicionado pelo admin é perdido ao recarregar. 
             Não há persistência nem leitura do banco.
Evidência:  src/data/defaultData.ts — arrays exportados, sem import de supabase.
```

### 11.3 Fluxo de Instagram

```
Captura:    defaultData.ts INSTAGRAM_EMBEDS vazio (l.114); InstagramSection/Modal são componentes UI.
Persistência: NÃO EXISTE tabela instagram_embeds no SQL.
Leitura:    Memória, array vazio.
Exibição:   InstagramSection mostra galeria (condicionada por showInstagramGallery=false).
GAP:        Instagram é UI apenas; sem dados, sem persistência, sem coluna no banco.
Evidência:  src/components/InstagramSection.tsx, src/components/InstagramEmbedCard.tsx.
```

### 11.4 Fluxo de Agendamentos

```
Captura:    AppointmentPage (formulário) → chama função RPC create_public_establishment_appointment.
Persistência: public.establishment_appointments (tabela real, migration 20261020174000).
Leitura:    Acesso à tabela negado por RLS (using false). Só via RPC server-side.
Exibição:   Não há listagem pública de agendamentos no preview/site.
GAP:        O registro funciona via RPC, mas a tabela é inacessível ao client; 
             não há exibição dos agendamentos no site publicado nem no painel.
Evidência:  migration 20261020174000 l.28-30 (revoke all + policy false), 
             20261022174513 (revoke execute para anon/authenticated).
```

### 11.5 Fluxo de Prospecção (Prospects)

```
Captura:    Worker autônomo (workers/prospecting-scheduler) descobre e captura.
Persistência: public.prospects, public.prospecting_candidates, public.prospect_events.
Leitura:    service_role apenas; tabelas com RLS restritas.
Exibição:   SuperAdminPage (leads) — precisa confirmar se lê via service_role ou função.
GAP:        O pipeline de prospecção persiste no banco, mas o frontend (cliente anônimo/auth) 
             não tem acesso de leitura a prospects. Não há exibição pública dos dados capturados.
Evidência:  migration 20261020185512 l.176-184 (revoke all de prospects daqui... na verdade 
             prospects é mantido da migration base; políticas restritas), 
             workers/prospecting-scheduler/src/index.ts (grava via service_role).
```

### 11.6 Fluxo de Demo / Site Publicado

```
Captura:    ensure_prospect_site_project (RPC) cria site_projects a partir do prospect.
Persistência: site_projects, site_project_versions, site_demo_public_links.
Leitura:    functions/api/demos/[token].ts lê site_demo_public_links via REST.
Exibição:   SharedSitePreview monta SiteBusinessData a partir do preview (base64 URL), 
             não diretamente do banco. Renderer exibe o site.
GAP:        O link demo carrega dados do preview (payload base64), não de uma leitura 
             direta e estruturada de estabelecimento no banco. Campos como city, 
             instagram, whatsappClean são preenchidos parcialmente ou vazios 
             (SharedSitePreview l.136-144: city='', whatsapp=phone).
Evidência:  src/pages/SharedSitePreview.tsx l.136-144 — businessData montado manualmente, 
             city vazio, whatsapp igual a phone.
```

### 11.7 Resumo de Gaps por Categoria

| Categoria | Gap | Severidade | Onde evidencia |
|-----------|-----|------------|----------------|
| Persistência establishments | Frontend nunca grava establishments no Supabase | Alta | store.ts sem supabase |
| Persistência services/products/media | Sem tabelas SQL; só memória | Crítico | defaultData.ts, nenhuma migration CREATE TABLE |
| Geolocalização | Sem lat/long em banco nem TS | Médio | Ausência geral |
| Campos plano vs JSONB | contato/endereço/Instagram só dentro de contact.jsonb | Alta | establishments.sql l.22, tipos TS esperam colunas planas |
| Enum status | banco (draft/active/inactive/archived) ≠ TS (active/inactive/suspended) | Médio | sql l.18 vs TS l.12 |
| Demo preview campos vazios | city='', whatsapp=phone, sem instagram/lat-long | Médio | SharedSitePreview.tsx l.136-144 |
| Agendamentos exibição | Tabela inacessível ao client; não exibida no site | Médio | RLS policy false (20261020174500) |
| billing_plans.display_order | Referenciado na seed, não criado por migration | Baixo | seed l.28 vs nenhuma migration add column |

---

## 12. Recomendações de Ação

### Imediatas (alta prioridade)
1. **Criar tabelas `services`, `products`, `media`, `instagram_embeds`** com FK para `establishments(id)`, e migrar `defaultData.ts` para leitura via Supabase (ou manter semente + CRUD admin).
2. **Adicionar colunas de geolocalização** `latitude` (numeric 9,6) e `longitude` (numeric 9,6) a `establishments`, e campos correspondentes em `Establishment` TS.
3. **Promover campos do JSONB `contact` para colunas próprias** (ou manter JSONB e criar view/função que expõe plano para o TypeScript): `phone`, `whatsapp`, `address`, `city`, `state`, `instagram`, `email`, `google_maps_url`.
4. **Alinhar enum `status`**: adicionar 'suspended' ao check do banco ou remover do TS.

### Médio prazo
5. **Criar view `establishments_public`** que faz `jsonb_extract_path_text` de `contact` e `brand_settings`, mapeando para os nomes esperados pelo TS (whatsapp, phone, address, cityState, instagramUrl, theme...).
6. **Preencher `city` e `whatsapp` corretamente em `SharedSitePreview.tsx`** l.136-144 (atualmente city='' e whatsapp=phone).
7. **Garantir leitura de establishments via Supabase** no frontend (substituir memória por `supabase.from('establishments')` com RLS adequado).

### Baixa prioridade
8. **Criar coluna `billing_plans.display_order`** (referenciada na seed mas ausente).
9. **Expor `prospects` com políticas de leitura scoped** para o SuperAdminPage (leads).
10. **Exibir agendamentos no site publicado/painel** (reavaliar restrição de RPC).

---

## 13. Evidências de Arquivos e Linhas Inspecionados

| Arquivo | Linhas | O que foi verificado |
|---------|--------|----------------------|
| `supabase/migrations/20261019000000_white_label_site_builder.sql` | 8-435 | establishments, prospects, site_templates, site_template_versions, site_projects, audit_events, seed Yeshua, RLS |
| `supabase/migrations/20261020185512_prospecting_automation_foundation.sql` | 7-223 | colunas adicionais prospects, campaigns, tasks, events, outbound_messages, site_project_versions, RLS/grants |
| `supabase/migrations/20261020191500_prospecting_candidates.sql` | 4-50 | prospecting_candidates |
| `supabase/migrations/20261020191000_public_demo_selection.sql` | 4-106 | site_demo_public_links, RPC select_public_demo_version |
| `supabase/migrations/20261020193000_prospect_demo_project_automation.sql` | 4-99 | alter site_projects (prospect_id), site_project_versions (generation_task_id), site_demo_public_links (publish_task_id), RPC ensure_prospect_site_project |
| `supabase/migrations/20261020173000_subscription_access_policy.sql` | 3-16 | billing_expires_at, booking_horizon_days, max_booking_horizon_days |
| `supabase/migrations/20261020174000_tenant_scoped_server_appointments.sql` | 2-97 | establishment_appointments + RPC create_public_establishment_appointment |
| `supabase/migrations/20261022175246_seed_production_catalog_baseline.sql` | 27-36 | seed billing_plans com display_order / max_booking_horizon_days |
| `supabase/migrations/20261020190500_prospecting_whatsapp_consent.sql` | 4-9 | 5 colunas whatsapp_opt_in_* |
| `src/types/index.ts` | 1-197 | Establishment, ServiceItem, ProductItem, MediaItem, InstagramEmbedItem, Appointment, PlatformConfig, etc. |
| `src/types/templates.ts` | 146-163 | SiteBusinessData (contrato de exibição) |
| `src/pages/SharedSitePreview.tsx` | 5-18, 136-144 | ShareableSitePreview, montagem businessData |
| `src/components/SiteTemplateRenderer.tsx` | 133-194, 255-667 | SiteBusinessData duplicado, leitura/exibição campos |
| `src/data/defaultData.ts` | 19-393 | dados em memória (Establishment, Services, Products, Media, Instagram, Appointments) |
| `src/data/store.ts` | (grep) | confirma ausência de chamadas supabase |
| `src/lib/prospecting.ts` | 1-124 | ProspectIdentity, ProspectQualificationInput, OutreachEligibilityInput, normalize* |
| `src/lib/supabase.ts` | 1-25 | cliente Supabase (não usado para establishments) |

---

**Fim do relatório (4 partes).** Inventário completo: 19 tabelas mapeadas, 3 tabelas ausentes (services/products/media/instagram_embeds), matriz de rastreabilidade, divergências SQL×TS, gaps captura/persistência/exibição, e evidências de arquivo/linha.