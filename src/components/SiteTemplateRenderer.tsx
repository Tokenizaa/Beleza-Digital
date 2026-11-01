import React, { useState } from 'react';
import {
  Sparkles,
  Scissors,
  ShoppingBag,
  Images,
  MessageCircle,
  ArrowRight,
  MapPin,
  Instagram,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Calendar,
  Lock,
  CalendarCheck,
  Star,
  Phone,
  Check,
  Building2,
  Share2,
  X,
  Award,
  Zap,
  Coffee,
  Wifi,
  Heart,
  Wine,
  Feather,
  Play,
  Flame,
  CheckSquare,
  Layers,
  Palette
} from 'lucide-react';
import { MonthCalendar } from './MonthCalendar';
import { MediaModal } from './MediaModal';
import { ProductDetailModal } from './ProductDetailModal';
import { ServiceItem, ProductItem, MediaItem } from '../types';
import { SiteTemplateConfig, SITE_TEMPLATES, SITE_TEMPLATES_LIST } from '../types/templates';

export type SiteVariationId =
  | 'ouro-classico'
  | 'preto-esmeralda'
  | 'minimal-studio'
  | 'safira-executivo'
  | 'rubi-lounge';

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
  status?: string;
  note?: string;
  'quantidade-de-avaliacoes'?: string | number;
  'faixa-de-preco'?: string;
  horario?: string;
}

interface SiteTemplateRendererProps {
  businessData: SiteBusinessData;
  template?: SiteTemplateConfig;
  initialVariation?: SiteVariationId;
  isDemoSelection?: boolean;
  hideTopBar?: boolean;
  onSelectVariation?: (variationId: SiteVariationId) => void;
  onContinueToActivation?: () => void;
}

export const SiteTemplateRenderer: React.FC<SiteTemplateRendererProps> = ({
  businessData,
  template: explicitTemplate,
  initialVariation = 'ouro-classico',
  isDemoSelection = false,
  hideTopBar = false,
  onSelectVariation,
  onContinueToActivation,
}) => {
  const [currentVariation, setCurrentVariation] = useState<SiteVariationId>(initialVariation);
  
  React.useEffect(() => {
    if (initialVariation) {
      setCurrentVariation(initialVariation);
    }
  }, [initialVariation]);

  const activeVariation = currentVariation || initialVariation;
  const templateConfig = explicitTemplate || SITE_TEMPLATES[activeVariation] || SITE_TEMPLATES['ouro-classico'];

  // Modal and Interactive States
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Calendar State for interactive booking simulation
  const todayIso = new Date().toISOString().split('T')[0];
  const [bookingDate, setBookingDate] = useState<string>(todayIso);
  const [bookingTime, setBookingTime] = useState<string>('14:00');
  const [bookingService, setBookingService] = useState<string>('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const timeslots = ['09:00', '10:00', '11:00', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30'];

  // Os modelos usam somente dados reais fornecidos pela demonstração.
  // Não preencher serviços, produtos ou fotos com conteúdo fictício.
  const rawServices: ServiceItem[] = businessData.services ?? [];
  const rawProducts: ProductItem[] = businessData.products ?? [];
  const rawMedia: MediaItem[] = businessData.media ?? [];

  const handleSelectVariation = (id: SiteVariationId) => {
    setCurrentVariation(id);
    if (onSelectVariation) onSelectVariation(id);
  };

  const whatsappClean = (businessData.whatsapp || businessData.phone || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Olá! Gostaria de agendar um atendimento na ${businessData.name}.`)}`;

  const galleryStyle: Record<SiteVariationId, { shell: string; heading: string; card: string; label: string }> = {
    'ouro-classico': { shell: 'border-y border-amber-900/30 bg-[#100e0a]', heading: 'font-serif text-amber-100', card: 'rounded-xl border border-amber-900/40', label: 'text-amber-300' },
    'preto-esmeralda': { shell: 'border-y border-emerald-900/40 bg-[#050706]', heading: 'font-black uppercase tracking-tight text-white', card: 'rounded-lg border border-neutral-800 hover:border-emerald-500/60', label: 'text-emerald-300' },
    'minimal-studio': { shell: 'border-y border-slate-200 bg-[#f8fafc] text-slate-900', heading: 'font-light tracking-tight text-slate-900', card: 'rounded-none border border-slate-200', label: 'text-slate-600' },
    'safira-executivo': { shell: 'border-y border-blue-900/50 bg-[#081126]', heading: 'font-extrabold text-white', card: 'rounded-xl border border-blue-900/60', label: 'text-blue-300' },
    'rubi-lounge': { shell: 'border-y border-rose-950/80 bg-[#1a080d]', heading: 'font-serif italic text-white', card: 'rounded-2xl border border-rose-950/80', label: 'text-rose-300' },
  };
  const productStyle: Record<SiteVariationId, { shell: string; heading: string; card: string; price: string; button: string }> = {
    'ouro-classico': { shell: 'bg-[#0e0d0b] border-amber-900/30', heading: 'font-serif text-amber-100', card: 'bg-[#17140f] border-amber-900/40 rounded-xl', price: 'text-amber-300', button: 'bg-amber-500 text-neutral-950 hover:bg-amber-400' },
    'preto-esmeralda': { shell: 'bg-[#050706] border-neutral-800', heading: 'font-black uppercase text-white', card: 'bg-[#090e0b] border-emerald-900/50 rounded-lg', price: 'text-emerald-300', button: 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400' },
    'minimal-studio': { shell: 'bg-[#f8fafc] border-slate-200', heading: 'font-light text-slate-900', card: 'bg-white border-slate-200 rounded-none', price: 'text-slate-900', button: 'bg-slate-900 text-white hover:bg-slate-700' },
    'safira-executivo': { shell: 'bg-[#070d1e] border-blue-900/50', heading: 'font-extrabold text-white', card: 'bg-[#0b142d] border-blue-900/60 rounded-xl', price: 'text-blue-300', button: 'bg-blue-600 text-white hover:bg-blue-500' },
    'rubi-lounge': { shell: 'bg-[#140609] border-rose-950/80', heading: 'font-serif italic text-white', card: 'bg-[#1c080e] border-rose-950 rounded-2xl', price: 'text-rose-300', button: 'bg-rose-500 text-white hover:bg-rose-400' },
  };

  const renderGallerySection = () => {
    if (rawMedia.length === 0) return null;
    const style = galleryStyle[activeVariation];
    return (
      <section id="galeria" className={`px-4 sm:px-8 py-16 ${style.shell}`}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${style.label}`}>Galeria</p>
              <h2 className={`mt-2 text-3xl sm:text-4xl ${style.heading}`}>Conheça nosso trabalho</h2>
            </div>
            <p className="max-w-md text-sm opacity-70">Imagens e vídeos apresentados pelo próprio estabelecimento.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {rawMedia.slice(0, 8).map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedMedia(item)} className={`group relative aspect-[4/5] overflow-hidden text-left ${style.card}`}>
                {item.thumbnailUrl || item.type === "image" ? <img src={item.thumbnailUrl || item.url} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full w-full place-items-center bg-black/50 text-white"><Play className="h-10 w-10" /></div>}
                {item.type === 'video' && <span className="absolute left-3 top-3 rounded-full bg-black/75 p-2 text-white"><Play className="h-4 w-4" /></span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 text-sm font-semibold text-white">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderInstagramSection = () => {
    const handle = (businessData.instagramHandle || '').replace(/^@/, '');
    const instagramUrl = businessData.instagramUrl || (handle ? 'https://www.instagram.com/' + handle + '/' : '');
    if (!instagramUrl) return null;
    const style = galleryStyle[activeVariation];
    return (
      <section className={`border-y px-4 py-12 sm:px-8 ${style.shell}`}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${style.label}`}>Instagram</p>
            <h2 className={`mt-2 text-2xl sm:text-3xl ${style.heading}`}>Acompanhe nosso trabalho</h2>
            <p className="mt-2 text-sm opacity-70">{businessData.instagramHandle || 'Veja novidades e trabalhos recentes'}</p>
          </div>
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-current/30 px-5 py-3 text-sm font-semibold transition hover:opacity-75">
            <Instagram className="h-4 w-4" /> Ver perfil no Instagram <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    );
  };

  const renderProductSection = () => {
    if (rawProducts.length === 0) return null;
    const style = productStyle[activeVariation];
    return (
      <section id="produtos" className={`border-y px-4 sm:px-8 py-16 ${style.shell}`}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Produtos</p>
            <h2 className={`mt-2 text-3xl sm:text-4xl ${style.heading}`}>Produtos em destaque</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rawProducts.slice(0, 8).map((product) => (
              <article key={product.id} className={`overflow-hidden border ${style.card}`}>
                <button type="button" onClick={() => setSelectedProduct(product)} className="block aspect-square w-full overflow-hidden bg-black/10">
                  <img src={product.mainImage} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                </button>
                <div className="space-y-3 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{product.category}</div>
                  <h3 className="min-h-10 text-base font-semibold">{product.name}</h3>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-bold ${style.price}`}>{Number(product.price || 0) > 0 ? 'R$ ' + Number(product.price).toFixed(2).replace('.', ',') : 'Consulte valor'}</span>
                    <button type="button" onClick={() => setSelectedProduct(product)} className={`rounded-lg px-3 py-2 text-xs font-bold ${style.button}`}>Ver produto</button>
                  </div>
                  {!product.available && <p className="text-xs opacity-60">Consulte disponibilidade</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  };

  // ==========================================================================
  // RENDERER 1: OURO CLÁSSICO (Tradicional & Imperial • Estilo Yeshua)
  // ==========================================================================
  const renderOuroClassico = () => (
    <div className="bg-[#0e0d0b] text-[#f7f3e8] font-serif selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Heritage Badge */}
      <div className="border-b border-amber-600/20 bg-[#161410] px-4 py-2 text-center text-xs tracking-widest text-amber-400 uppercase font-sans">
        ♦ ESTILO CLÁSSICO • ELEGÂNCIA ATEMPORAL ♦
      </div>

      {/* Hero Ouro Clássico */}
      <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden border-b border-amber-900/40 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-25">
          {businessData.coverUrl && (
            <img src={businessData.coverUrl} alt="Imagem do estabelecimento" className="w-full h-full object-cover filter contrast-125 sepia-[0.25]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d0b] via-[#0e0d0b]/80 to-[#0e0d0b]/95" />
        </div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 text-amber-300 text-xs font-sans uppercase tracking-widest backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{businessData.category || 'Categoria não informada'}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-amber-100 font-serif">
            {businessData.name}
          </h1>

          <div className="flex items-center justify-center gap-3 text-amber-500/80">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/60" />
            <span className="text-sm">♦ EST. TRADIÇÃO ♦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/60" />
          </div>

          <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed font-sans font-light">
            {businessData.description || businessData.tagline || 'Descrição não informada. Consulte diretamente o estabelecimento.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 font-sans">
            <a
              href="#agendamento"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 hover:from-amber-400 hover:to-amber-500 shadow-xl shadow-amber-500/20 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Agendar Atendimento Clássico
            </a>
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#1c1914] border border-amber-600/40 text-amber-300 hover:bg-[#28231c] transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Atendimento WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Menu Board Tradicional com Linhas Pontilhadas */}
      <section id="servicos" hidden={rawServices.length === 0} className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-amber-900/30 font-sans">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Tabela de Serviços</span>
          <h2 className="text-2xl sm:text-3xl font-serif text-amber-100 font-bold">Menu de Atendimentos</h2>
        </div>

        <div className="space-y-4">
          {rawServices.map((service) => (
            <div
              key={service.id}
              className="p-5 rounded-xl bg-[#14120e] border border-amber-900/30 hover:border-amber-500/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-baseline justify-between sm:justify-start gap-4">
                  <h3 className="font-serif text-lg font-bold text-amber-100">{service.name}</h3>
                  <span className="text-xs text-amber-400/80 uppercase tracking-wider bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/30">
                    {service.durationMinutes ? `${service.durationMinutes} min` : 'Duração sob consulta'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-light max-w-xl">{service.description}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-amber-900/20">
                <span className="font-serif text-xl font-bold text-amber-300">
                  {service.price != null ? 'R$ ' + service.price.toFixed(2).replace('.', ',') : 'Consulte valor'}
                </span>
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-neutral-950 transition"
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {renderGallerySection()}
      {renderInstagramSection()}
      {renderProductSection()}
    </div>
  );

  // ==========================================================================

// RENDERER 2: PRETO ESMERALDA (Bold Street & Streetwear • Alto Contraste)
  // ==========================================================================
  const renderPretoEsmeralda = () => (
    <div className="bg-[#050706] text-neutral-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Live Monospace Cyber Header */}
      <div className="border-b border-emerald-500/30 bg-[#090e0b] px-4 py-2 font-mono text-[11px] text-emerald-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>[ VISUAL URBANO // DESIGN CONTEMPORÂNEO ]</span>
        </div>
        <span className="hidden sm:inline">ALTO CONTRASTE // DESIGN</span>
      </div>

      {/* Hero Preto Esmeralda */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-neutral-800 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-20">
          {businessData.coverUrl && (
            <img src={businessData.coverUrl} alt="Imagem do estabelecimento" className="w-full h-full object-cover filter grayscale contrast-150" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050706] via-[#050706]/70 to-[#050706]/90" />
        </div>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md border border-emerald-500/50 bg-emerald-950/70 text-emerald-300 font-mono text-xs uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>FADE • FREESTYLE • STREETWEAR</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter text-white">
            {businessData.name}
          </h1>

          <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed font-medium">
            {businessData.description || 'Descrição não informada. Consulte diretamente o estabelecimento.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#agendamento"
              className="w-full sm:w-auto px-8 py-4 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/30 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" /> Marcar Horário Online
            </a>
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 rounded-lg text-xs font-bold uppercase tracking-wider bg-neutral-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40 transition flex items-center justify-center gap-2 font-mono"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Direct WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {renderGallerySection()}

      <section id="servicos" hidden={rawServices.length === 0} className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-neutral-800">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">// MENU DE PROCEDIMENTOS</span>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">Serviços Especializados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rawServices.map((service, index) => (
            <div
              key={service.id}
              className="p-6 rounded-xl bg-[#090d0b] border border-neutral-800 hover:border-emerald-500/60 transition group relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">0{index + 1} // {service.category}</span>
                  <h3 className="text-lg font-black uppercase text-white group-hover:text-emerald-300 transition mt-1">
                    {service.name}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{service.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {service.price != null ? 'R$ ' + service.price.toFixed(2).replace('.', ',') : 'Consulte valor'}
                  </span>
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">{service.durationMinutes ? `${service.durationMinutes}m` : 'Sob consulta'}</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-neutral-800/80 flex items-center justify-end">
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-4 py-2 rounded bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 text-emerald-300 hover:text-neutral-950 font-mono text-xs font-bold transition flex items-center gap-1.5"
                >
                  RESERVAR <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
      {renderInstagramSection()}
      {renderProductSection()}
    </div>
  );

  // ==========================================================================

// RENDERER 3: MINIMAL STUDIO (Clean Modern & Arejado • Platina & Ardósia)
  // ==========================================================================
  const renderMinimalStudio = () => (
    <div className="bg-[#f8fafc] text-slate-900 font-sans font-light selection:bg-slate-300/20 selection:text-white">
      {/* Discreet Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-center text-xs tracking-wider text-slate-400 font-mono">
        design minimalista • informação clara • contato direto
      </div>

      {/* Hero Minimal Studio */}
      <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden border-b border-slate-200 px-4 sm:px-8 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-block text-xs uppercase tracking-[0.25em] text-slate-600 border border-slate-300 px-3.5 py-1 rounded-full">
            {businessData.category || 'Categoria não informada'}
          </span>

          <h1 className="text-4xl sm:text-6xl font-extralight tracking-tight text-slate-100">
            {businessData.name}
          </h1>

          <p className="text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-normal">
            {businessData.description || 'Descrição não informada. Consulte diretamente o estabelecimento.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#agendamento"
              className="w-full sm:w-auto px-7 py-3.5 rounded-full text-xs font-semibold tracking-wide bg-slate-100 hover:bg-white text-neutral-950 transition shadow-lg shadow-slate-900/40"
            >
              Consultar Disponibilidade
            </a>
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 rounded-full text-xs font-medium tracking-wide bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                Conversar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Tabela Minimalista de Serviços */}
      <section id="servicos" hidden={rawServices.length === 0} className="max-w-4xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-slate-200">
        <div className="mb-10 text-center sm:text-left">
          <span className="text-xs uppercase tracking-widest text-slate-400">Atendimentos</span>
          <h2 className="text-2xl font-light text-slate-100 mt-1">Serviços & Procedimentos</h2>
        </div>

        <div className="divide-y divide-slate-200">
          {rawServices.map((service) => (
            <div key={service.id} className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
              <div className="space-y-1">
                <h3 className="text-base font-normal text-slate-900 group-hover:text-slate-600 transition">{service.name}</h3>
                <p className="text-xs text-slate-600 max-w-lg">{service.description}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-slate-500 font-mono">{service.durationMinutes ? `${service.durationMinutes} min` : 'Duração sob consulta'}</span>
                <span className="text-base font-medium text-slate-900">{service.price != null ? 'R$ ' + service.price.toFixed(2).replace('.', ',') : 'Consulte valor'}</span>
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-3.5 py-1.5 rounded-full text-xs border border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 transition"
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
      {renderProductSection()}
      {renderGallerySection()}
      {renderInstagramSection()}
    </div>
  );

  // ==========================================================================

// RENDERER 4: SAFIRA EXECUTIVO (Clube Corporativo & Navy VIP)
  // ==========================================================================
  const renderSafiraExecutivo = () => (
    <div className="bg-[#070d1e] text-blue-50 font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Executive Header */}
      <div className="border-b border-blue-900/50 bg-[#0b142d] px-4 py-2 text-center text-xs tracking-wider text-blue-300 uppercase font-semibold">
        ★ DESIGN EXECUTIVO • ELEGÂNCIA E CLAREZA ★
      </div>

      {/* Hero Safira Executivo */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-blue-900/50 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-20">
          {businessData.coverUrl && (
            <img src={businessData.coverUrl} alt="Imagem do estabelecimento" className="w-full h-full object-cover filter contrast-125" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d1e] via-[#070d1e]/80 to-[#070d1e]/95" />
        </div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-blue-500/40 bg-blue-950/80 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>EXECUTIVE GROOMING CLUB</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
            {businessData.name}
          </h1>

          <p className="text-base sm:text-lg text-blue-200/80 max-w-2xl mx-auto leading-relaxed">
            {businessData.description || 'Descrição não informada. Consulte diretamente o estabelecimento.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#agendamento"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/30 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Reserva Prioritária
            </a>
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#0c1630] border border-blue-800 text-blue-200 hover:bg-[#132247] transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Concierge WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Menu Executivo */}
      {renderProductSection()}
      <section id="servicos" hidden={rawServices.length === 0} className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-blue-900/40">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold">Tabela Corporativa</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Serviços Corporativos</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rawServices.map((service) => (
            <div
              key={service.id}
              className="p-5 rounded-xl bg-[#0b142d] border border-blue-950 hover:border-blue-500/50 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-base text-white">{service.name}</h3>
                  <span className="text-base font-extrabold text-blue-400 shrink-0">
                    {service.price != null ? 'R$ ' + service.price.toFixed(2).replace('.', ',') : 'Consulte valor'}
                  </span>
                </div>
                <p className="text-xs text-blue-200/70 mt-2 leading-relaxed">{service.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-900/40 flex items-center justify-between">
                <span className="text-[11px] text-blue-300/80 font-mono">Duração: {service.durationMinutes ? `${service.durationMinutes} min` : 'sob consulta'}</span>
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white transition"
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
      {renderGallerySection()}
      {renderInstagramSection()}
    </div>
  );

  // ==========================================================================

// RENDERER 5: RUBI LOUNGE (Velvet Aesthetic & Editorial Nobre)
  // ==========================================================================
  const renderRubiLounge = () => (
    <div className="bg-[#140609] text-rose-50 font-serif selection:bg-rose-500/30 selection:text-rose-200">
      {/* Editorial Header */}
      <div className="border-b border-rose-950/80 bg-[#1c080d] px-4 py-2 text-center text-xs tracking-widest text-rose-300 font-sans uppercase">
        ♥ ESTÉTICA EDITORIAL • BELEZA & CUIDADO ♥
      </div>

      {/* Hero Rubi Lounge */}
      <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden border-b border-rose-950/80 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-25">
          {businessData.coverUrl && (
            <img src={businessData.coverUrl} alt="Imagem do estabelecimento" className="w-full h-full object-cover filter contrast-125" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#140609] via-[#140609]/80 to-[#140609]/95" />
        </div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-rose-500/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/80 text-rose-300 text-xs font-sans tracking-wide">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>{businessData.category || 'Categoria não informada'}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-normal italic tracking-tight text-white font-serif">
            {businessData.name}
          </h1>

          <p className="text-base sm:text-lg text-rose-200/80 max-w-2xl mx-auto leading-relaxed font-sans font-light">
            {businessData.description || 'Descrição não informada. Consulte diretamente o estabelecimento.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 font-sans">
            <a
              href="#agendamento"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-xl shadow-rose-500/25 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Reservar Meu Momento
            </a>
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#220a10] border border-rose-900/60 text-rose-200 hover:bg-rose-950/80 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Conversar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Rituais de Beleza */}
      <section id="servicos" hidden={rawServices.length === 0} className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-rose-950/80 font-sans">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-rose-400 font-semibold">Menu Sensorial</span>
          <h2 className="text-2xl sm:text-3xl font-serif italic text-white font-normal">Rituais & Cuidados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rawServices.map((service) => (
            <div
              key={service.id}
              className="p-6 rounded-2xl bg-[#1c080e] border border-rose-950 hover:border-rose-500/50 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-lg font-bold text-rose-100">{service.name}</h3>
                  <span className="text-lg font-bold text-rose-300 shrink-0 font-sans">
                    {service.price != null ? 'R$ ' + service.price.toFixed(2).replace('.', ',') : 'Consulte valor'}
                  </span>
                </div>
                <p className="text-xs text-rose-200/70 mt-2 leading-relaxed">{service.description}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-rose-950/80 flex items-center justify-between">
                <span className="text-[11px] text-rose-400/80 font-sans">Tempo: {service.durationMinutes ? `${service.durationMinutes} min` : '50 min'}</span>
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white transition shadow-sm"
                >
                  Reservar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
      {renderProductSection()}
      {renderGallerySection()}
      {renderInstagramSection()}
    </div>
  );


  // Common interactive booking section adapted to current theme
  const renderSharedBookingSection = () => {
    return (
      <section id="agendamento" hidden={rawServices.length === 0} className="max-w-4xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300">
            Agendamento Online
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Escolha Seu Dia e Horário</h2>
          <p className="text-xs text-neutral-400">Veja como o agendamento poderá funcionar no site do estabelecimento.</p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl border border-neutral-800 bg-neutral-950/80 backdrop-blur-xl shadow-2xl space-y-6">
          {bookingConfirmed ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Simulação de agendamento concluída</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Horário reservado para <strong>{new Date(bookingDate + "T00:00:00").toLocaleDateString("pt-BR")}</strong> às <strong>{bookingTime}</strong>
                {bookingService ? ` (${bookingService})` : ''} na {businessData.name}.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setBookingConfirmed(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition"
                >
                  Simular Novo Agendamento
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  1. Selecione o Serviço
                </label>
                <select
                  value={bookingService}
                  onChange={(e) => setBookingService(e.target.value)}
                  className="w-full p-3 rounded-xl border border-neutral-700 bg-neutral-900 text-white text-xs outline-none focus:border-amber-500"
                >
                  <option value="">Selecione um serviço...</option>
                  {rawServices.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} - {s.price != null ? 'R$ ' + s.price.toFixed(2).replace('.', ',') : 'Consulte valor'}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider pt-2">
                  2. Escolha o Horário
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {timeslots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBookingTime(t)}
                      className={`p-2.5 rounded-lg text-xs font-bold transition border ${
                        bookingTime === t
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  3. Selecione a Data
                </label>
                <MonthCalendar selectedDate={bookingDate} onSelectDate={setBookingDate} appointments={[]} minDate={todayIso} />

                <div className="pt-4">
                  <button
                    onClick={() => setBookingConfirmed(true)}
                    className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CalendarCheck className="w-4 h-4" /> Simular Agendamento
                  </button>
                  <p className="text-[11px] text-neutral-500 text-center mt-2">
                    Prévia interativa. A disponibilidade real será configurada na ativação do site.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  // Localização & Contato
  const renderContactFooter = () => (
    <section id="contato" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-t border-neutral-800/80">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <MapPin className="w-5 h-5 text-amber-400 mb-3" />
          <h3 className="font-bold text-sm text-white">Localização</h3>
          <p className="text-xs text-neutral-400 mt-1">{businessData.address || [businessData.city, businessData.state].filter(Boolean).join(' - ') || 'Endereço não informado'}</p>
          {businessData.googleMapsUrl && (
            <a href={businessData.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline mt-2">
              Ver no Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <Clock className="w-5 h-5 text-emerald-400 mb-3" />
          <h3 className="font-bold text-sm text-white">Horário de Atendimento</h3>
          <p className="text-xs text-neutral-400 mt-1">{businessData.horario || 'Horário não informado'}</p>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <Phone className="w-5 h-5 text-blue-400 mb-3" />
          <h3 className="font-bold text-sm text-white">Contato & Reservas</h3>
          <p className="text-xs text-neutral-400 mt-1">{businessData.phone || 'Telefone não informado'}</p>
          {whatsappClean && (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline mt-2">
              Chamar no WhatsApp <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <footer className="mt-14 pt-8 border-t border-neutral-800/80 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} {businessData.name}. Todos os direitos reservados.</p>
        <p className="text-[11px] text-neutral-500 mt-1">Plataforma White-Label de Alta Conversão BelezaDigital</p>
      </footer>
    </section>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* ================================================================= */}
      {/* BARRA SUPERIOR DE SELEÇÃO ENTRE OS 5 TEMPLATES                    */}
      {/* ================================================================= */}
      {!hideTopBar && (
        <div className="sticky top-0 z-50 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 px-4 py-3 shadow-xl">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-black">
                5
              </span>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-400" /> Modelos Visuais Distintos
                </p>
                <p className="text-[11px] text-neutral-400 hidden sm:block">
                  Alterne e veja 5 arquiteturas de design reais para o mesmo estabelecimento
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0" role="tablist">
              {SITE_TEMPLATES_LIST.map((tpl) => {
                const isSelected = activeVariation === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectVariation(tpl.id)}
                    role="tab"
                    aria-selected={isSelected}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-md'
                        : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tpl.primaryColor }}
                    />
                    <span>{tpl.shortName}</span>
                  </button>
                );
              })}
            </div>

            {onContinueToActivation && (
              <button
                onClick={onContinueToActivation}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md transition shrink-0"
              >
                Quero Este Modelo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Render the specific visual archetype layout */}
      <main className="flex-1">
        {activeVariation === 'ouro-classico' && renderOuroClassico()}
        {activeVariation === 'preto-esmeralda' && renderPretoEsmeralda()}
        {activeVariation === 'minimal-studio' && renderMinimalStudio()}
        {activeVariation === 'safira-executivo' && renderSafiraExecutivo()}
        {activeVariation === 'rubi-lounge' && renderRubiLounge()}

        {/* Agendamento & Contato */}
        {renderSharedBookingSection()}
        {renderContactFooter()}
      </main>

      {/* Modais */}
      {selectedMedia && (
        <MediaModal media={selectedMedia} whatsappNumber={businessData.whatsapp || businessData.phone} onClose={() => setSelectedMedia(null)} />
      )}
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} whatsappNumber={businessData.whatsapp || businessData.phone} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
};