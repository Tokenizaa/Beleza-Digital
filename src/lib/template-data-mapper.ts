/**
 * Mapa de dados do Mapscrape para o formato de generated_content
 * de cada um dos 5 templates com personalities diferentes.
 *
 * Este módulo converte os dados brutos coletados pelo Mapscrape
 * em um formato padronizado que pode ser consumido por qualquer um
 * dos 5 templates da plataforma (Ouro Clássico, Preto Esmeralda,
 * Minimal Studio, Safira Executivo, Rubi Lounge).
 *
 * O mapeamento é baseado no `template.focus` que determina quais
 * dados são destacados para cada layout de template.
 */

import type { SiteTemplateConfig, SiteVariationId } from '../types/templates';
import { normalizeScrapedPlace } from './scraped-place-normalizer';

// Interface com todos os campos possíveis do Mapscrape.
// Baseado na estrutura do buildCandidate() em scripts/scrape-local.cjs
// e nos campos mencionados na documentação/issue.
export interface MapScrapeData {
  businessName: string;
  category: string;
  description: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  sourceUrl: string | null;
  photos: string[];
  videos: string[];
  rating: number | null;
  review_count: number | null;
  opening_hours: string | null; // pode ser string ou array dependendo da fonte
  services_attributes: any[] | null;
  media_items: any[] | null;
  bookingUrl?: string | null;
  instagramUrl?: string | null;
  instagramHandle?: string | null;
  logoUrl?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceRange?: string | null;
  status?: string | null;
  collectedAt?: string | null;
  provider?: string | null;
  fieldStatus?: Record<string, unknown>;
}

// Interface padronizada para o conteúdo gerado por template.
// Esta estrutura é intencionalmente abrangente para cobrir as necessidades
// de todos os 5 templates, mas cada case do mapeamento populam apenas
// os campos relevantes para o foco daquele template.
export interface TemplateGeneratedContent {
  // Dados básicos de identificação do estabelecimento
  name: string;
  category: string;
  description: string;

  // Informações de contato padronizadas
  contact: {
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    region: string | null;
  };

  // Presença web
  website: string | null;
  sourceUrl: string | null;

  // Mídia e avaliações
  photos: string[];
  videos: string[];
  rating: number | null;
  reviewCount: number | null;

  // Conteúdo compartilhado entre todos os cinco modelos
  services?: Array<{
    name: string;
    description: string;
    price?: number | null;
    durationMinutes?: number | null;
  }>;
  media_items?: any[];
  bookingUrl?: string | null;
  instagramUrl?: string | null;
  instagramHandle?: string | null;
  logoUrl?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceRange?: string | null;
  status?: string | null;
  openingHours?: string | null;
  fieldStatus?: Record<string, unknown>;

  // Dados específicos por tipo de template (opcionais)
  // - services: serviços compartilhados por todos os templates
  // - portfolio: itens de portfólio / galeria (template Preto Esmeralda focus: portfolio)
  // - essential: informações essenciais (template Minimal Studio focus: essential)
  // - corporativo: dados corporativos (template Safira Executivo focus: corporativo)
  // - experience: experiência do cliente (template Rubi Lounge focus: experience)
  portfolio?: Array<{
    name: string;
    description: string;
    imageUrl: string;
  }>;
  essential?: {
    highlights: string[];
    standoutFeatures: string[];
  };
  corporativo?: {
    establishmentType: string;
    specialty: string;
    trustSignals: string[];
  };
  experience?: {
    atmosphere: string;
    sensoryDetails: string[];
    recommendedFor: string[];
  };

  // Metadados de origem da coleta
  collectedAt?: string;
  originalProvider: string;
}

// Configuração do template (já definida em src/types/templates.ts)
// Importado aqui para uso no tipo da função, mas a definição
// fica em src/types/templates.ts para evitar circular dependencies.
export type {
  SiteTemplateConfig,
  SiteVariationId,
};

// Função principal que mapeia dados do Mapscrape para o formato
// de generated_content adequado para cada template.
export function mapDataForTemplate(
  data: MapScrapeData | Record<string, unknown>,
  template: SiteTemplateConfig
): TemplateGeneratedContent {
  const normalized = normalizeScrapedPlace(data);
  const source: MapScrapeData = {
    businessName: normalized.businessName,
    category: normalized.category,
    description: normalized.description,
    website: normalized.website,
    phone: normalized.phone,
    email: normalized.email,
    address: normalized.address,
    city: normalized.city,
    region: normalized.region,
    sourceUrl: normalized.sourceUrl,
    photos: normalized.photos,
    videos: normalized.videos,
    rating: normalized.rating,
    review_count: normalized.review_count,
    opening_hours: normalized.opening_hours,
    services_attributes: normalized.services_attributes,
    media_items: normalized.media_items,
    bookingUrl: normalized.bookingUrl,
    instagramUrl: normalized.instagramUrl,
    instagramHandle: normalized.instagramHandle,
    logoUrl: normalized.logoUrl,
    googleMapsUrl: normalized.googleMapsUrl,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    priceRange: normalized.priceRange,
    status: normalized.status,
    collectedAt: normalized.collectedAt,
    provider: normalized.provider,
    fieldStatus: normalized.fieldStatus,
  };

  // Dados básicos sempre presentes em todos os templates
  const baseContent: TemplateGeneratedContent = {
    name: source.businessName,
    category: source.category,
    description: source.description,

    contact: {
      phone: source.phone,
      email: source.email,
      address: source.address,
      city: source.city,
      region: source.region,
    },

    website: source.website,
    sourceUrl: source.sourceUrl,

    photos: source.photos.length > 0 ? source.photos : [],
    videos: source.videos.length > 0 ? source.videos : [],
    services: (source.services_attributes || [])
      .filter((svc: any) => Boolean(svc?.service_name || svc?.name))
      .map((svc: any) => ({
        name: svc.service_name || svc.name,
        description: svc.description || svc.desc || '',
        price: svc.price ?? null,
        durationMinutes: svc.duration ?? svc.durationMinutes ?? null,
      })),
    media_items: source.media_items || [],
    bookingUrl: source.bookingUrl ?? null,
    instagramUrl: source.instagramUrl ?? null,
    instagramHandle: source.instagramHandle ?? null,
    logoUrl: source.logoUrl ?? null,
    googleMapsUrl: source.googleMapsUrl ?? source.sourceUrl,
    latitude: source.latitude ?? null,
    longitude: source.longitude ?? null,
    priceRange: source.priceRange ?? null,
    status: source.status ?? null,
    openingHours: source.opening_hours,
    fieldStatus: source.fieldStatus ?? {},
    collectedAt: source.collectedAt,
    rating: source.rating,
    reviewCount: source.review_count,
    collectedAt: source.collectedAt,
    originalProvider: source.provider || 'google-maps-cloudflare-playwright',
  };

  // Lógica switch por template.focus - mapeia dados relevantes para cada template
  const focusSpecificContent = getFocusSpecificContent(template.focus, source);

  return {
    ...baseContent,
    ...focusSpecificContent,
  };
}

// Função auxiliar que retorna o conteúdo específico baseado no focus do template
function getFocusSpecificContent(
  focus: string,
  data: MapScrapeData
): Record<string, any> {
  switch (focus) {
    case 'services': {
      // Ouro Clássico - foco em serviços oferecidos
      const services = (data.services_attributes || []).filter((svc: any) => Boolean(svc?.service_name || svc?.name));

      return {
        services: services.map((svc: any) => ({
          name: svc.service_name || svc.name,
          description: svc.description || svc.desc || '',
          price: svc.price ?? null,
          durationMinutes: svc.duration ?? null,
        })),
        description: data.description || '',
      };
    }

    case 'portfolio': {
      // Preto Esmeralda - foco em portfólio/galeria de trabalhos
      const portfolioItems = (data.media_items || []).filter((item: any) => Boolean(item?.image_url || item?.imageUrl || item?.url));

      return {
        portfolio: portfolioItems.map((item: any) => ({
          name: item.service_name || item.name || 'Mídia',
          description: item.description || '',
          imageUrl: item.image_url || item.imageUrl || item.url,
        })),
        // Galeria destaca as melhores fotos/works
        photos: data.photos.length > 0 ? data.photos.slice(0, 6) : [],
        description: data.description || '',
      };
    }

    case 'essential': {
      // Minimal Studio - foco em informações essenciais
      return {
        essential: {
          highlights: data.opening_hours ? [data.opening_hours] : [],
          standoutFeatures: [
            data.category || '',
            data.rating !== null ? `${data.rating}/5` : '',
          ].filter(Boolean),
        },
        // Dados mínimos mas completos
        photos: data.photos.length > 0 ? data.photos.slice(0, 3) : [],
        description: data.description || '',
      };
    }

    case 'corporativo': {
      // Safira Executivo - foco corporativo
      return {
        corporativo: {
          establishmentType: data.category || '',
          specialty: data.category || '',
          trustSignals: [
            data.rating !== null ? `Avaliação ${data.rating}/5` : null,
            data.review_count !== null && data.review_count > 50 ? `${data.review_count} avaliações` : null,
            data.website ? 'Site informado na fonte' : null,
          ].filter(Boolean) as string[],
        },
        // Manter fotos profissionais para demonstrar seriedade
        photos: data.photos.length > 0 ? data.photos.slice(0, 4) : [],
        description: data.description || '',
      };
    }

    case 'experience': {
      // Rubi Lounge - foco em experiência do cliente.
      // Apenas afirma o que é comprovado pelos dados coletados; não inventa
      // iluminação, música, aromas, acabamentos nem outras características
      // sensoriais que não estejam disponíveis na fonte.
      return {
        experience: {
          atmosphere: '',
          sensoryDetails: [],
          recommendedFor: [],
        },
        // Experience template valoriza fotos de ambiente
        photos: data.photos.length > 0 ? data.photos.slice(0, 5) : [],
        description: data.description || '',
      };
    }

    default:
      // Fallback caso o focus não seja reconhecido
      return {
        services: [],
        description: data.description || '',
      };
  }
}