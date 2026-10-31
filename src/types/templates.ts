import { ServiceItem, ProductItem, MediaItem } from './index';

export type SiteVariationId =
  | 'ouro-classico'
  | 'preto-esmeralda'
  | 'minimal-studio'
  | 'safira-executivo'
  | 'rubi-lounge';

export interface SiteTemplateConfig {
  id: SiteVariationId;
  slug: SiteVariationId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentBg: string;
  heroGlow: string;
  fontClass: string;
  badgeStyle: string;
  cardStyle: string;
  buttonPrimary: string;
  buttonSecondary: string;
  borderColor: string;
  previewThumbnail: string;
  recommendedFor: string;
  sections: string[];        // As 5 sections ORDENADAS diferentemente por template
  focus: string;             // Foco principal de cada template (para ajudar usuário escolher)
}

export const SITE_TEMPLATES: Record<SiteVariationId, SiteTemplateConfig> = {
  'ouro-classico': {
    id: 'ouro-classico',
    slug: 'ouro-classico',
    name: 'Ouro & Âmbar Clássico',
    shortName: 'Ouro Clássico',
    tagline: 'Imperial & Tradicional • Estilo Yeshua',
    description: 'Estética luxuosa e nobre com tons dourados e âmbar, perfeita para barbearias tradicionais e de alto padrão.',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    accentBg: 'bg-amber-500',
    heroGlow: 'bg-amber-500/15',
    fontClass: 'font-sans',
    badgeStyle: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    cardStyle: 'bg-neutral-900/90 border-neutral-800 hover:border-amber-500/50',
    buttonPrimary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 hover:from-amber-400 hover:to-amber-500 shadow-amber-500/20',
    buttonSecondary: 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-white',
    borderColor: 'border-amber-500/30',
    previewThumbnail: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias tradicionais, barbearias vintage e salões masculinos de alto padrão',
    sections: ['hero', 'services', 'appointment', 'gallery', 'contact'],
    focus: 'services',
  },
  'preto-esmeralda': {
    id: 'preto-esmeralda',
    slug: 'preto-esmeralda',
    name: 'Preto Fosco & Esmeralda Urbano',
    shortName: 'Preto Esmeralda',
    tagline: 'Bold Street & Streetwear • Alto Contraste',
    description: 'Visual moderno e urbano com alto contraste em preto fosco e verde esmeralda neon para estúdios contemporâneos.',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    accentBg: 'bg-emerald-500',
    heroGlow: 'bg-emerald-500/20',
    fontClass: 'font-sans font-bold',
    badgeStyle: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 uppercase tracking-widest',
    cardStyle: 'bg-neutral-950 border-neutral-800 hover:border-emerald-500/60 shadow-xl',
    buttonPrimary: 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-emerald-500/25',
    buttonSecondary: 'bg-neutral-950 border-emerald-900/50 text-emerald-300 hover:bg-emerald-950/40',
    borderColor: 'border-emerald-500/30',
    previewThumbnail: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias urbanas, barbearias jovens, conceito fade e freestyle',
    sections: ['gallery', 'hero', 'services', 'appointment', 'contact'],
    focus: 'portfolio',
  },
  'minimal-studio': {
    id: 'minimal-studio',
    slug: 'minimal-studio',
    name: 'Minimal Studio & Platina',
    shortName: 'Minimal Studio',
    tagline: 'Clean Modern & Arejado • Foco em Fotografia',
    description: 'Design minimalista, arejado e elegante com foco na fotografia dos trabalhos e tipografia limpa.',
    primaryColor: '#e2e8f0',
    secondaryColor: '#94a3b8',
    accentBg: 'bg-slate-200 text-neutral-950',
    heroGlow: 'bg-slate-400/10',
    fontClass: 'font-sans font-light',
    badgeStyle: 'bg-slate-900 text-slate-200 border-slate-700 tracking-wide',
    cardStyle: 'bg-slate-950/80 border-slate-800/80 hover:border-slate-600',
    buttonPrimary: 'bg-slate-100 hover:bg-white text-neutral-950 font-semibold shadow-slate-900/40',
    buttonSecondary: 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800',
    borderColor: 'border-slate-700',
    previewThumbnail: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Estúdios unissex, salões de beleza boutique, clínicas de estética e visagismo',
    sections: ['hero', 'contact', 'services', 'appointment', 'gallery'],  // 5 sections, ordem minimalista: hero primeiro, contact em segundo
    focus: 'essential',
  },
  'safira-executivo': {
    id: 'safira-executivo',
    slug: 'safira-executivo',
    name: 'Safira Real Executivo',
    shortName: 'Safira Executivo',
    tagline: 'Clube Corporativo & Navy VIP',
    description: 'Atmosfera executiva de clube masculino com azul safira profundo, transmitindo confiança, sobriedade e pontualidade.',
    primaryColor: '#3b82f6',
    secondaryColor: '#1d4ed8',
    accentBg: 'bg-blue-600',
    heroGlow: 'bg-blue-600/15',
    fontClass: 'font-sans',
    badgeStyle: 'bg-blue-950/80 text-blue-300 border-blue-600/40',
    cardStyle: 'bg-[#0b1329]/90 border-blue-950 hover:border-blue-500/50 shadow-blue-950/40',
    buttonPrimary: 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold shadow-blue-600/25',
    buttonSecondary: 'bg-[#0f172a] border-blue-900 text-blue-200 hover:bg-blue-950/80',
    borderColor: 'border-blue-500/30',
    previewThumbnail: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias executivas em centros comerciais, lounges VIP e barbearias de hotéis',
    sections: ['hero', 'products', 'services', 'gallery', 'contact'],
    focus: 'corporativo',
  },
  'rubi-lounge': {
    id: 'rubi-lounge',
    slug: 'rubi-lounge',
    name: 'Rubi & Vinho Lounge',
    shortName: 'Rubi Lounge',
    tagline: 'Velvet Aesthetic & Editorial Nobre',
    description: 'Tom bordô e rubi sofisticado com detalhes editoriais, criando uma experiência acolhedora e sensorial.',
    primaryColor: '#f43f5e',
    secondaryColor: '#be123c',
    accentBg: 'bg-rose-500',
    heroGlow: 'bg-rose-500/15',
    fontClass: 'font-serif',
    badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-800/40 font-sans tracking-wide',
    cardStyle: 'bg-[#18080c]/90 border-rose-950/80 hover:border-rose-500/50 shadow-rose-950/30',
    buttonPrimary: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-sans font-bold shadow-rose-500/25',
    buttonSecondary: 'bg-[#220a10] border-rose-900/60 text-rose-200 hover:bg-rose-950/80 font-sans',
    borderColor: 'border-rose-500/30',
    previewThumbnail: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Salões de beleza conceituais, spas urbanos, barbearias com bar & café',
    sections: ['hero', 'services', 'products', 'gallery', 'contact'],  // 5 sections, products antes da gallery
    focus: 'experience',
  },
};

export const SITE_TEMPLATES_LIST: SiteTemplateConfig[] = Object.values(SITE_TEMPLATES);

export function normalizeTemplateId(id?: string | null): SiteVariationId {
  if (!id) return 'ouro-classico';
  const clean = id.trim().toLowerCase();
  if (clean === 'preto-esmeralda' || clean === 'bold') return 'preto-esmeralda';
  if (clean === 'minimal-studio' || clean === 'minimal') return 'minimal-studio';
  if (clean === 'safira-executivo') return 'safira-executivo';
  if (clean === 'rubi-lounge' || clean === 'editorial') return 'rubi-lounge';
  return 'ouro-classico';
}

export interface SiteBusinessData {
  name: string;
  category: string;
  tagline?: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state?: string;
  logoUrl?: string;
  coverUrl?: string;
  instagramHandle?: string;
  instagramUrl?: string;
  googleMapsUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  services?: ServiceItem[];
  products?: ProductItem[];
  media?: MediaItem[];
  // Novos campos alinhados com os 18 do provedor (para SEO/copy)
  status?: string;           // Status operacional (active/inactive/suspended)
  note?: string;           // Nota / avaliação geral
  'quantidade-de-avaliacoes'?: string;  // Qtd de avaliações
  'faixa-de-preco'?: string;            // Faixa de preço
  horario?: string;        // Horário de funcionamento
}
