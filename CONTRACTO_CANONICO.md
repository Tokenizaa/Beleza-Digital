# Contrato Canônico — Beleza Digital / Barbearia-Estetica-Yeshua

## 1. Princípio

Este contrato define a representação compartilhada de um estabelecimento entre:
- **Captura** (worker de prospecção)
- **Banco de dados** (Supabase / Postgres)
- **Tipos TypeScript** (camada de aplicação)
- **Preview compartilhado** (SharedSitePreview)
- **Site publicado** (páginas públicas: Home, Services, Gallery, Contact, Appointment, Products)

**Regra:** não criar migrations, novas tabelas ou novas abstrações antes de confirmar que as estruturas existentes não atendem à necessidade. Reutilizar componentes corretos e eliminar divergências reais.

---

## 2. Contrato Canônico do Estabelecimento

A interface `EstablishmentCanonical` abaixo é a representação única. Qualquer campo que apareça em mais de uma camada deve usar este mesmo nome e tipo.

```ts
export type EstablishmentStatus = 'active' | 'inactive' | 'suspended';

export type EstablishmentTheme =
  | 'amber' | 'emerald' | 'sapphire' | 'ruby' | 'slate';

export interface EstablishmentCanonical {
  // Identidade
  id: string;
  slug: string;
  name: string;
  status: EstablishmentStatus;
  theme?: EstablishmentTheme;
  category?: string | null;
  tagline?: string | null;
  description?: string | null;

  // Identidade visual
  logoUrl?: string | null;
  coverUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;

  // Contato e localização
  whatsapp?: string | null;
  whatsappClean?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cityState?: string | null;          // derivado: "city - state"
  googleMapsUrl?: string | null;
  latitude?: number | null;           // geolocalização — novo campo canônico
  longitude?: number | null;          // geolocalização — novo campo canônico

  // Redes sociais
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  instagramBio?: string | null;
  instagramFollowers?: string | null;
  instagramPostsCount?: string | null;
  showInstagramGallery?: boolean;

  // Configurações de acesso e agendamento
  adminName?: string | null;
  adminEmail?: string | null;
  openingHoursNote?: string | null;
  allowOnlineBooking?: boolean;
  slotIntervalMinutes?: number | null;

  // Metadados
  createdAt: string;
  updatedAt?: string | null;

  // Conteúdo dinâmico (carregado separadamente, não no registro base)
  services?: ServiceItemCanonical[];
  products?: ProductItemCanonical[];
  media?: MediaItemCanonical[];
}

export interface ServiceItemCanonical {
  id: string;
  establishmentId?: string | null;
  name: string;
  description: string;
  price?: number | null;
  durationMinutes?: number | null;
  category: string;
  imageUrl?: string | null;
  featured: boolean;
}

export interface ProductItemCanonical {
  id: string;
  establishmentId?: string | null;
  name: string;
  description: string;
  price: number;
  mainImage: string;
  additionalImages?: string[];
  available: boolean;
  category: string;
  featured: boolean;
}

export interface MediaItemCanonical {
  id: string;
  establishmentId?: string | null;
  type: 'image' | 'video';
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  isReelVertical?: boolean;
  category: string;
  dateAdded: string;
  featured: boolean;
}
```

---

## 3. Matriz de Rastreabilidade — Campo → Origem → Captura → Persistência → Leitura → Exibição

| Campo | Origem (TS) | Captura (worker/scraping) | Transformação | Persistência (SQL) | Leitura (API/store) | Exibição (preview/site) | Status |
|-------|-------------|---------------------------|---------------|---------------------|---------------------|-------------------------|--------|
| id | Establishment | — | — | prospects.id / establishments.id | supabase / store | Ambos | ✅ Preservado |
| slug | Establishment | — | — | establishments.slug | store | Ambos | ✅ Preservado |
| name | Establishment | business_name (scraping) | normalizeBusinessName | prospects.business_name, establishments.name | store | Ambos | ✅ Preservado |
| status | EstablishmentStatus | — | — | establishments.status | store | Ambos | ⚠️ Enum divergente (TS: active/inactive/suspended; SQL: draft/active/inactive/archived) |
| category | Establishment | category (scraping) | — | prospects.category, establishments.category (via contact JSONB) | store | Ambos | ✅ Preservado |
| tagline | Establishment | — | — | establishments.tagline (não existe coluna SQL) | store | Site público ✅, Preview ❌ | ⚠️ Faltante no preview |
| description | Establishment | description (scraping, não capturado) | — | prospects.description (via captured_data) | store | Site público ❌, Preview ✅ | ⚠️ Não capturado pelo scraping |
| logoUrl | Establishment | — | — | establishments.logo_url | store | Site público ✅, Preview ❌ | ⚠️ Faltante no preview |
| coverUrl | Establishment | — | — | establishments.cover_url (não existe coluna SQL) | store | Site público ✅, Preview ❌ | ⚠️ Faltante no preview |
| whatsapp | Establishment | phone (scraping) | normalizePhone | prospects.phone, establishments.whatsapp (via contact JSONB) | store | Ambos | ✅ Preservado |
| whatsappClean | Establishment | phone (scraping) | normalizePhone | prospects.normalized_phone | store | Site público ✅, Preview ❌ | ⚠️ Faltante no preview |
| phone | Establishment | phone (scraping) | normalizePhone | prospects.phone, establishments.phone (via contact JSONB) | store | Ambos | ✅ Preservado |
| email | Establishment | — | ❌ Não capturado | prospects.email | store | Ambos | ⚠️ Não capturado pelo scraping |
| address | Establishment | address (scraping) | — | prospects.address, establishments.address (via contact JSONB) | store | Ambos | ✅ Preservado |
| city | Establishment | city (scraping) | — | prospects.city, establishments.city (via contact JSONB) | store | Site público ✅, Preview ❌ (sempre '') | ⚠️ Preview não popula city |
| state | Establishment | region (scraping) | — | prospects.region, establishments.state (via contact JSONB) | store | Ambos ❌ (não exibido) | ⚠️ Não exibido em nenhuma página |
| cityState | Establishment | city + region | derivação | — (derivado) | store | Site público ✅, Preview ❌ | ✅ Preservado |
| googleMapsUrl | Establishment | sourceUrl (scraping) | — | prospects.source_url | store | Ambos | ✅ Preservado |
| latitude | **NOVO (canônico)** | — | ❌ Não capturado | ❌ Não existe coluna | — | ❌ Não exibido | ❌ Campo novo — bloqueado |
| longitude | **NOVO (canônico)** | — | ❌ Não capturado | ❌ Não existe coluna | — | ❌ Não exibido | ❌ Campo novo — bloqueado |
| instagramHandle | Establishment | — | ❌ Não capturado | establishments.instagram_handle (via contact JSONB) | store | Ambos | ✅ Preservado (mas não capturado) |
| instagramUrl | Establishment | — | ❌ Não capturado | establishments.instagram_url (via contact JSONB) | store | Ambos | ✅ Preservado (mas não capturado) |
| instagramBio | Establishment | — | ❌ Não capturado | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| instagramFollowers | Establishment | — | ❌ Não capturado | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| instagramPostsCount | Establishment | — | ❌ Não capturado | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| showInstagramGallery | Establishment | — | ❌ Não capturado | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| adminName | Establishment | — | — | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| adminEmail | Establishment | — | — | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| openingHoursNote | Establishment | — | — | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| allowOnlineBooking | Establishment | — | — | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| slotIntervalMinutes | Establishment | — | — | — (não existe coluna SQL) | store | ❌ Não exibido | ⚠️ Faltante |
| services | Establishment | — | ❌ Não capturado | ❌ Não existe tabela de serviços | store | Ambos | ⚠️ Sem persistência |
| products | Establishment | — | ❌ Não capturado | ❌ Não existe tabela de produtos | store | Ambos | ⚠️ Sem persistência |
| media | Establishment | — | ❌ Não capturado | ❌ Não existe tabela de mídia | store | Ambos | ⚠️ Sem persistência |

**Legenda de status:**
- ✅ Preservado: campo existe e flui corretamente
- ⚠️ Atenção: campo existe mas tem gap (não capturado, não exibido, ou divergente)
- ❌ Bloqueado: campo não existe em alguma camada e não deve ser criado sem justificativa

---

## 4. Contrato do Preview Compartilhado (ShareableSitePreview)

O `ShareableSitePreview` deve ser expandido para incluir todos os campos essenciais que atualmente faltam, para que o preview reflita a identidade real do negócio.

```ts
export interface ShareableSitePreview {
  version: 1;
  businessName: string;
  category: string;
  tagline?: string | null;
  description: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  websiteUrl: string;
  templateId: string;
  templateName: string;
  projectVersion: number;
  generatedAt: string;
  // Novos campos canônicos para preview:
  logoUrl?: string | null;
  coverUrl?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
```

**Mapeamento atual → canônico no preview:**
- `preview.phone` → `whatsapp` (atualmente `whatsapp` recebe o mesmo valor de `phone` — mantido)
- `preview.city` → atualmente hardcoded `''` → deve ser populado do dado real
- `preview.state` → **novo** (não existe atualmente)
- `preview.logoUrl`, `coverUrl`, `instagramHandle`, `instagramUrl`, `googleMapsUrl`, `latitude`, `longitude` → **novos**

---

## 5. Representação de Redes Sociais, Mídias, Serviços e Coordenadas

### Redes sociais
- Representação unificada: `instagramHandle`, `instagramUrl`, `instagramBio`, `instagramFollowers`, `instagramPostsCount`, `showInstagramGallery`
- InstagramSection deve ser descomentado e usado em HomePage e GalleryPage

### Mídias
- `MediaItemCanonical` com `type: 'image' | 'video'`, `url`, `thumbnailUrl?`, `category`, `isReelVertical?`, `featured`
- Galeria, produtos e serviços usam `imageUrl` / `mainImage` com fallback para Unsplash quando ausente

### Serviços
- `ServiceItemCanonical` com `name`, `description`, `price?`, `durationMinutes?`, `category`, `imageUrl?`, `featured`
- `durationMinutes` null deve renderizar "Duração sob consulta" (não "undefined minutos")

### Coordenadas
- `latitude` / `longitude` são campos canônicos novos
- **Não existem colunas SQL** e **não são capturados** pelo scraping → estão bloqueados até que haja justificativa e fonte de dados
- Mapa só aparece quando há `address` + `cityState` (ou coordenadas válidas no futuro)

---

## 6. Estados de Validação e Proveniência

| Estado | Significado | Onde é usado |
|--------|-------------|--------------|
| `discovered` | Candidato encontrado, não avaliado | prospecting_candidates.status |
| `qualified` | Candidato pontuou >= threshold | prospecting_candidates.status |
| `disqualified` | Candidato abaixo do threshold | prospecting_candidates.status |
| `promoted` | Candidato promovido para prospect | prospecting_candidates.status |
| `duplicate` | Candidato duplicado (dedupe_key) | prospecting_candidates.status |
| `blocked` | Candidato bloqueado | prospecting_candidates.status |
| `captured` | Prospect criado a partir de candidato | prospects.status |
| `qualified` | Prospect qualificado | prospects.status |
| `draft_ready` | Prospect pronto para demo | prospects.status |
| `contacted_manually` | Prospect contatado manualmente | prospects.status |
| `converted` | Prospect convertido em cliente | prospects.status |
| `rejected` | Prospect rejeitado | prospects.status |
| `archived` | Prospect arquivado | prospects.status |
| `unknown` | Elegibilidade WhatsApp não definida | prospects.outreach_eligibility |
| `eligible` | Elegível para WhatsApp automático | prospects.outreach_eligibility |
| `ineligible` | Não elegível | prospects.outreach_eligibility |
| `opted_out` | Opt-out realizado | prospects.outreach_eligibility |
| `blocked` | Bloqueado para outreach | prospects.outreach_eligibility |

---

## 7. Compatibilidade com Registros Existentes e Valores Ausentes

- `normalizeTemplateId()` retorna `'ouro-classico'` como default quando `id` é null/undefined ou não reconhecido
- `readShareablePreview()` valida versão `1`, `businessName` não vazio, sanitiza campos com `safeText()`
- Imagens ausentes: logo → ícone Scissors, cover → Unsplash padrão, serviço → Unsplash padrão, produto → sem fallback (gap)
- Preço ausente: "Consulte valor" / R$ 0.00
- Duração ausente: "Duração sob consulta" (corrigir "undefined minutos")
- Endereço ausente: "Endereço não informado", seção de localização e mapa ocultos
- Telefone ausente: fallback para whatsapp / "Contato não informado"
- Instagram URL ausente: card não renderiza (condicional)
- Payload > 16.000 chars no preview: retorna null

---

## 8. Lista Consolidada de Alterações Necessárias

### A. Arquivos a modificar (sem novas migrations)

1. **`src/types/index.ts`** — Atualizar `Establishment` para incluir `email?`, `city?`, `state?`, `latitude?`, `longitude?` como campos opcionais canônicos
2. **`src/pages/SharedSitePreview.tsx`** — Expandir `ShareableSitePreview` com `logoUrl`, `coverUrl`, `instagramHandle`, `instagramUrl`, `city`, `state`, `googleMapsUrl`, `latitude`, `longitude`; preencher `city` corretamente (não hardcoded `''`)
3. **`src/components/SiteTemplateRenderer.tsx`** — Corrigir `service.durationMinutes` null → "Duração sob consulta"; corrigir `product.price.toFixed(2)` com `?? 0`
4. **`src/pages/ContactPage.tsx`** — Descoment InstagramSection se aplicável; garantir fallback de imagem
5. **`src/pages/HomePage.tsx`** — Descoment InstagramSection; garantir fallback de imagem para produtos
6. **`src/pages/GalleryPage.tsx`** — Descoment InstagramSection; garantir fallback de imagem para mídia
7. **`src/pages/ProductsPage.tsx`** — Adicionar fallback para `product.mainImage` ausente

### B. Migrations (apenas se justificado após validação do schema remoto)

- **Nenhuma migration nova deve ser criada antes de confirmar que as estruturas existentes não atendem.**
- Se o schema remoto não tiver `latitude`/`longitude` e essas forem necessárias, preparar migration apenas após validação.

### C. Documentação e testes do contrato

- Atualizar `CONTRACTO_CANONICO.md` (este documento)
- Adicionar testes de contrato para `ShareableSitePreview` (todos os campos)
- Adicionar testes de renderização para `SiteTemplateRenderer` com dados ausentes

---

## 9. Fluxo Canônico de Dados

```
Descoberta (Google Maps via Playwright/Browser Run)
        ↓
Extração: name, category, address, phone, website, sourceUrl
        ↓
Normalização: normalizeBusinessName, normalizeWebsite, normalizePhone
        ↓
Persistência: prospecting_candidates (dedupe_key único)
        ↓
Captura/Promoção: RPC promote_prospecting_candidate → prospects
        ↓
Qualificação: qualifyProspect → qualification_score, qualification_reasons
        ↓
Geração de Demo: ensure_prospect_site_project → site_projects + site_project_versions
        ↓
Publicação: site_demo_public_links (token_hash, expires_at)
        ↓
Preview: GET /api/demos/:token → DemoData → ShareableSitePreview → SiteTemplateRenderer
        ↓
Site Público: store.ts (localStorage) → Establishment → páginas públicas
```

**Dados que atravessam todas as etapas:** name, category, address, phone, website, sourceUrl
**Dados que NÃO atravessam (gaps):** email, instagram*, logoUrl, coverUrl, latitude, longitude, services, products, media

---

## 10. Decisões de Design

1. **Não criar novas tabelas** para serviços, produtos, mídia — usar JSONB ou manter em memória (localStorage) conforme já ocorre
2. **Não criar colunas latitude/longitude** no banco até que haja fonte de captura justificada (não existe scraping de coordenadas)
3. **Usar `establishments.contact` JSONB** para campos que não têm coluna própria no SQL (instagram, admin, etc.)
4. **Manter `prospects` como registro canônico** da prospecção; `establishments` como registro do site publicado
5. **Preview e site público usam contratos diferentes** (ShareableSitePreview vs Establishment) — o preview deve ser expandido para incluir os campos essenciais
