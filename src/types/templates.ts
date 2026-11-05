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
  sections: string[];        // Seções completas na ordem visual de cada template
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
    secondaryColor: '#b45309',
    accentBg: 'bg-amber-600',
    heroGlow: 'bg-amber-500/20',
    fontClass: 'font-sans',
    badgeStyle: 'bg-amber-900/60 text-amber-200 border-amber-500/40 uppercase tracking-widest',
    cardStyle: 'bg-[#0e0d0b]/90 border-amber-900/40 hover:border-amber-500/60 shadow-amber-900/20',
    buttonPrimary: 'bg-gradient-to-r from-amber-500 to-amber-700 text-neutral-950 hover:from-amber-400 hover:to-amber-600 shadow-amber-500/30',
    buttonSecondary: 'bg-neutral-900 border-amber-700/50 text-amber-200 hover:bg-amber-900/40 hover:text-white',
    borderColor: 'border-amber-600/40',
    previewThumbnail: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias tradicionais, barbearias vintage e salões masculinos de alto padrão',
    sections: ['hero', 'services', 'gallery', 'instagram', 'products', 'appointment', 'contact'],
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
    secondaryColor: '#047857',
    accentBg: 'bg-emerald-600',
    heroGlow: 'bg-emerald-500/25',
    fontClass: 'font-sans font-black',
    badgeStyle: 'bg-emerald-900/70 text-emerald-200 border-emerald-500/50 uppercase tracking-widest',
    cardStyle: 'bg-[#050706]/90 border-neutral-800 hover:border-emerald-500/70 shadow-emerald-900/20',
    buttonPrimary: 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-emerald-500/35',
    buttonSecondary: 'bg-neutral-950 border-emerald-700/40 text-emerald-200 hover:bg-emerald-900/30 hover:text-white',
    borderColor: 'border-emerald-600/40',
    previewThumbnail: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias urbanas, barbearias jovens, conceito fade e freestyle',
    sections: ['hero', 'gallery', 'services', 'instagram', 'products', 'appointment', 'contact'],
    focus: 'portfolio',
  },
  'minimal-studio': {
    id: 'minimal-studio',
    slug: 'minimal-studio',
    name: 'Minimal Studio & Ártico',
    shortName: 'Minimal Studio',
    tagline: 'Clean Modern & Arejado • Foco em Fotografia',
    description: 'Design minimalista, arejado e elegante com foco na fotografia dos trabalhos e tipografia limpa.',
    primaryColor: '#94a3b8',
    secondaryColor: '#64748b',
    accentBg: 'bg-slate-500/10 text-neutral-950',
    heroGlow: 'bg-slate-500/10',
    fontClass: 'font-sans font-light',
    badgeStyle: 'bg-slate-800 text-slate-200 border-slate-600 tracking-wide',
    cardStyle: 'bg-[#f1f5f9]/90 border-slate-300/60 hover:border-slate-500 shadow-slate-200/50',
    buttonPrimary: 'bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-slate-900/40',
    buttonSecondary: 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50 hover:text-slate-950',
    borderColor: 'border-slate-500/40',
    previewThumbnail: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Estúdios unissex, salões de beleza boutique, clínicas de estética e visagismo',
    sections: ['hero', 'services', 'products', 'gallery', 'instagram', 'appointment', 'contact'],
    focus: 'essential',
  },
  'safira-executivo': {
    id: 'safira-executivo',
    slug: 'safira-executivo',
    name: 'Safira Real Executivo',
    shortName: 'Safira Executivo',
    tagline: 'Clube Corporativo & Navy VIP',
    description: 'Atmosfera executiva de clube masculino com azul safira profundo, transmitindo confiança, sobriedade e pontualidade.',
    primaryColor: '#2563eb',
    secondaryColor: '#1d4ed8',
    accentBg: 'bg-blue-700',
    heroGlow: 'bg-blue-600/20',
    fontClass: 'font-sans',
    badgeStyle: 'bg-blue-900/70 text-blue-200 border-blue-600/50',
    cardStyle: 'bg-[#081126]/90 border-blue-900/50 hover:border-blue-500/60 shadow-blue-900/30',
    buttonPrimary: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold shadow-blue-600/35',
    buttonSecondary: 'bg-[#0f172a] border-blue-800/50 text-blue-200 hover:bg-blue-900/40 hover:text-white',
    borderColor: 'border-blue-600/40',
    previewThumbnail: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Barbearias executivas em centros comerciais, lounges VIP e barbearias de hotéis',
    sections: ['hero', 'products', 'services', 'gallery', 'instagram', 'appointment', 'contact'],
    focus: 'corporativo',
  },
  'rubi-lounge': {
    id: 'rubi-lounge',
    slug: 'rubi-lounge',
    name: 'Rubi & Vinho Lounge',
    shortName: 'Rubi Lounge',
    tagline: 'Velvet Aesthetic & Editorial Nobre',
    description: 'Tom bordô e rubi sofisticado com detalhes editoriais, criando uma experiência acolhedora e sensorial.',
    primaryColor: '#be123c',
    secondaryColor: '#9f1239',
    accentBg: 'bg-rose-700',
    heroGlow: 'bg-rose-600/20',
    fontClass: 'font-serif',
    badgeStyle: 'bg-rose-900/70 text-rose-200 border-rose-700/50 font-sans tracking-wide',
    cardStyle: 'bg-[#140609]/90 border-rose-900/60 hover:border-rose-500/60 shadow-rose-900/30',
    buttonPrimary: 'bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 text-white font-sans font-bold shadow-rose-600/35',
    buttonSecondary: 'bg-[#220a10] border-rose-800/50 text-rose-200 hover:bg-rose-900/40 hover:text-white font-sans',
    borderColor: 'border-rose-600/40',
    previewThumbnail: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80',
    recommendedFor: 'Salões de beleza conceituais, spas urbanos, barbearias com bar & café',
    sections: ['hero', 'services', 'products', 'gallery', 'instagram', 'appointment', 'contact'],
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
  status?: string;           // Status operacional capturado na fonte
  rating?: number | null;
  reviewCount?: number | null;
  priceRange?: string | null;
  openingHours?: string | null;
  note?: string;           // Nota / avaliação geral
  'quantidade-de-avaliacoes'?: string;  // Qtd de avaliações
  'faixa-de-preco'?: string;            // Faixa de preço
  horario?: string;        // Horário de funcionamento
}
