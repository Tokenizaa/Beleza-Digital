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
  Play,
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
  X
} from 'lucide-react';
import { MonthCalendar } from './MonthCalendar';
import { MediaModal } from './MediaModal';
import { ProductDetailModal } from './ProductDetailModal';
import { ServiceItem, ProductItem, MediaItem } from '../types';
import { SiteTemplateConfig, SITE_TEMPLATES } from '../types/templates';
import { mapDataForTemplate } from '../lib/template-data-mapper';

export type SiteVariationId =
  | 'ouro-classico'
  | 'preto-esmeralda'
  | 'minimal-studio'
  | 'safira-executivo'
  | 'rubi-lounge';

export interface SiteVariationConfig {
  id: SiteVariationId;
  name: string;
  tagline: string;
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
}

export const SITE_VARIATIONS: Record<SiteVariationId, SiteVariationConfig> = {
  'ouro-classico': {
    id: 'ouro-classico',
    name: 'Ouro & Âmbar Clássico',
    tagline: 'Imperial & Tradicional • Estilo Yeshua',
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
  },
  'preto-esmeralda': {
    id: 'preto-esmeralda',
    name: 'Preto Fosco & Esmeralda Urbano',
    tagline: 'Bold Street & Streetwear • Alto Contraste',
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
  },
  'minimal-studio': {
    id: 'minimal-studio',
    name: 'Minimal Studio & Platina',
    tagline: 'Clean Modern & Arejado • Foco em Fotografia',
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
  },
  'safira-executivo': {
    id: 'safira-executivo',
    name: 'Safira Real Executivo',
    tagline: 'Clube Corporativo & Navy VIP',
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
  },
  'rubi-lounge': {
    id: 'rubi-lounge',
    name: 'Rubi & Vinho Lounge',
    tagline: 'Velvet Aesthetic & Editorial Nobre',
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
  },
};

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
  latitude?: number;
  longitude?: number;
  services?: ServiceItem[];
  products?: ProductItem[];
  media?: MediaItem[];
}

interface SiteTemplateRendererProps {
  businessData: SiteBusinessData;
  template?: SiteTemplateConfig;
  initialVariation?: SiteVariationId;
  isDemoSelection?: boolean;
  onSelectVariation?: (variationId: SiteVariationId) => void;
  onContinueToActivation?: () => void;
}

export const SiteTemplateRenderer: React.FC<SiteTemplateRendererProps> = ({
  businessData,
  template: explicitTemplate,
  initialVariation = 'ouro-classico',
  isDemoSelection = false,
  onSelectVariation,
  onContinueToActivation,
}) => {
  // Use explicit template if provided, otherwise derive from initialVariation
  const template = explicitTemplate || SITE_TEMPLATES[initialVariation] || SITE_TEMPLATES['ouro-classico'];
  const theme = SITE_VARIATIONS[initialVariation] || SITE_VARIATIONS['ouro-classico'];

  // Focus-based color palette classes (5 paletas distintas)
  const focusClassMap: Record<string, string> = {
    services: 'focus-services',
    portfolio: 'focus-portfolio',
    essential: 'focus-essential',
    corporativo: 'focus-corporativo',
    experience: 'focus-experience',
    default: '',
  };
  const focusClass = focusClassMap[template.focus] || focusClassMap.default;

  // Section order defined by the template (5 sections, ordem específica por template)
  const sectionsOrder: string[] = template.sections || ['hero', 'services', 'appointment', 'gallery', 'contact'];

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

  // Never invent business services, products, or portfolio items.
  const servicesList: ServiceItem[] = businessData.services ?? [];
  const productsList: ProductItem[] = businessData.products ?? [];
  const mediaList: MediaItem[] = businessData.media ?? [];

  const handleSelectVariation = (id: SiteVariationId) => {
    setCurrentVariation(id);
    if (onSelectVariation) onSelectVariation(id);
  };

  const whatsappClean = (businessData.whatsapp || businessData.phone).replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Olá! Gostaria de agendar um atendimento na ${businessData.name}.`)}`;

// Section renderer functions for each of the 6 possible section types
  const renderHeroSection = (): JSX.Element => {
    const { coverUrl, name, description, tagline, servicesList: servicesForHero, productsList: productsForHero, mediaList: mediaForHero } = businessData;
    return (
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-neutral-800/60 px-4 sm:px-6 lg:px-8 py-16">
        {/* Cover Background with Luxury Filter */}
        <div className="absolute inset-0 z-0 opacity-30">
          <img
            src={coverUrl || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80'}
            alt="Imagem ilustrativa de barbearia"
            className="w-full h-full object-cover filter contrast-125 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/90" />
        </div>

        {/* Ambient Glow Colors based on Theme */}
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${theme.heroGlow} rounded-full blur-3xl pointer-events-none`} />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          {/* Badge de Categoria */}
          <div hidden={!tagline && !name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md mx-auto" style={{ borderColor: theme.primaryColor, color: theme.primaryColor, backgroundColor: `${theme.primaryColor}15` }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{tagline || name}</span>
          </div>

          {/* Nome Comercial */}
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
            {name}
          </h1>

          {/* Slogan & Descrição */}
          {description && (
            <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>
          )}

          {isDemoSelection && (
            <p className="text-xs text-amber-300" role="note">
              Demonstração visual. Avaliações, horários, serviços e preços só serão exibidos quando informados e verificados.
            </p>
          )}

          {/* Hero CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            {servicesForHero.length > 0 && (
              <a
                href="#agendamento"
                className={`w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl transition transform active:scale-95 ${theme.buttonPrimary}`}
              >
                <Calendar className="w-4 h-4" /> Ver demonstração de agendamento
              </a>
            )}
            {whatsappClean && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={`w-full sm:w-auto px-6 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${theme.buttonSecondary}`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> WhatsApp
              </a>
            )}
            {businessData.status && (
              <div className="text-xs text-neutral-400 mt-1">
                <span className="font-medium text-white">Status:</span>
                <span className="text-amber-400">{businessData.status}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderServicesSection = (): JSX.Element => {
    return (
      <section id="servicos" hidden={servicesList.length === 0} className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-t border-neutral-800/60">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.badgeStyle} px-3 py-1 rounded-full border`}>
            Menu de Atendimentos
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Serviços Especializados</h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Técnicas modernas com produtos de linha profissional para garantir o melhor resultado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servicesList.map((service) => (
            <div
              key={service.id}
              className={`p-6 rounded-2xl border ${theme.cardStyle} flex flex-col justify-between transition group`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
                      <Scissors className="h-5 w-5" style={{ color: theme.primaryColor }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition">
                        {service.name}
                      </h3>
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {service.durationMinutes ? `${service.durationMinutes} min` : 'Duração sob consulta'}
                      </span>
                    </div>
                  </div>

                  <span className="text-lg font-black text-white shrink-0">
                    R$ {(service.price ?? 0).toFixed(2)}{service.priceRange ? ` (${service.priceRange})` : ''}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 pl-13 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-neutral-800/60 flex items-center justify-between pl-13">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  {service.category}
                </span>
                <a
                  href="#agendamento"
                  onClick={() => {
                    setBookingService(service.name);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${theme.buttonPrimary}`}
                >
                  Agendar <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderAppointmentSection = (): JSX.Element => {
    return (
      <section id="agendamento" hidden={servicesList.length === 0} className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.badgeStyle} px-3 py-1 rounded-full border`}>
            Agendamento Online
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Escolha o Dia e Horário Desejado
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Selecione a data, seu serviço favorito e confirme seu atendimento em segundos.
          </p>
        </div>

        <div className={`p-6 sm:p-8 rounded-3xl border ${theme.cardStyle} max-w-4xl mx-auto`}>
          {bookingConfirmed ? (
            <div className="py-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-amber-300">Simulação de agendamento</h3>
              <p className="text-sm text-neutral-300 max-w-md mx-auto">
                Esta é apenas uma demonstração visual. Nenhum horário foi reservado ou enviado para {businessData.name}.
              </p>
              <button
                onClick={() => setBookingConfirmed(false)}
                className={`mt-4 px-6 py-2.5 rounded-xl text-xs font-bold ${theme.buttonPrimary}`}
              >
                Voltar à demonstração
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Calendário */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  1. Escolha a data
                </label>
                <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                  <MonthCalendar
                    selectedDate={bookingDate}
                    onSelectDate={setBookingDate}
                    appointments={[]}
                  />
                </div>
              </div>

              {/* Horários & Serviço */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    2. Escolha o horário para {new Date(bookingDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeslots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setBookingTime(slot)}
                        className={`py-2 rounded-xl text-xs font-bold transition border ${
                          bookingTime === slot
                            ? `${theme.accentBg} text-neutral-950 border-transparent shadow-md`
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    3. Selecione o serviço
                  </label>
                  <select
                    value={bookingService || servicesList[0]?.name}
                    onChange={(e) => setBookingService(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-amber-400"
                  >
                    {servicesList.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} — R$ {(s.price ?? 0).toFixed(2)} ({s.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setBookingConfirmed(true)}
                  className={`w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl transition cursor-pointer ${theme.buttonPrimary}`}
                >
                  <CalendarCheck className="w-4 h-4" /> Confirmar Horário ({bookingTime})
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderGallerySection = (): JSX.Element => {
    return (
      <section id="galeria" hidden={mediaList.length === 0} className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-t border-neutral-800/60">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.badgeStyle} px-3 py-1 rounded-full border`}>
            Portfólio & Transformações
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Nossos Trabalhos</h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Confira a precisão e o acabamento dos nossos profissionais.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mediaList.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 cursor-pointer shadow-lg"
            >
              <img
                src={item.url}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {item.category}
                </span>
                <p className="text-xs font-bold text-white line-clamp-1">{item.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderProductsSection = (): JSX.Element => {
    return (
      <section id="produtos" hidden={productsList.length === 0} className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-t border-neutral-800/60">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.badgeStyle} px-3 py-1 rounded-full border`}>
            Linha Profissional
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Produtos Exclusivos</h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Cuide do seu visual em casa com a mesma linha de produtos que usamos no salão.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {productsList.map((product) => (
            <div
              key={product.id}
              className={`p-5 rounded-2xl border ${theme.cardStyle} flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative">
                  <img
                    src={product.mainImage}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition"
                  />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white backdrop-blur-sm">
                    {product.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">{product.name}</h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase block font-semibold">Preço</span>
                  <span className="text-base font-black text-white">R$ {(product.price ?? 0).toFixed(2)}</span>
                </div>

                <a
                  href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${product.name} (R$ ${(product.price ?? 0).toFixed(2)}).`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${theme.buttonPrimary}`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Comprar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderContactSection = (): JSX.Element => {
    return (
      <section id="localizacao" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-t border-neutral-800/60">
        <div className={`p-8 sm:p-12 rounded-3xl border ${theme.cardStyle} relative overflow-hidden`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <span className={`text-xs font-bold uppercase tracking-widest ${theme.badgeStyle} px-3 py-1 rounded-full border`}>
                Venha nos Visitar
              </span>
              <h2 className="text-3xl font-black text-white">{businessData.name}</h2>

              <div className="space-y-3 text-sm text-neutral-300">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.primaryColor }} />
                  <div>
                    <span className="font-bold text-white block">Endereço</span>
                    <p className="text-neutral-400">{businessData.address || 'Endereço não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-bold text-white block">Contato & Agendamentos</span>
                    <p className="text-neutral-400">{businessData.phone || businessData.whatsapp || 'Contato não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.primaryColor }} />
                  <div>
                    <span className="font-bold text-white block">Horário de Atendimento</span>
                    <p className="text-neutral-400">{businessData.horario || 'Horários não informados'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                {whatsappClean && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition ${theme.buttonPrimary}`}
                  >
                    <MessageCircle className="w-4 h-4" /> Conversar no WhatsApp
                  </a>
                )}
                <a
                  href={businessData.googleMapsUrl || (businessData.latitude && businessData.longitude ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${businessData.latitude},${businessData.longitude}`)}` : `https://maps.google.com/?q=${encodeURIComponent(`${businessData.name} ${businessData.address} ${businessData.city}`)}`)}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition ${theme.buttonSecondary}`}
                >
                  <ExternalLink className="w-4 h-4" /> Ver no Google Maps
                </a>
              </div>
            </div>

            {/* Visual Location Card */}
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 relative flex items-center justify-center p-6 text-center">
              <div className="space-y-3">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center shadow-inner">
                  <MapPin className="h-8 w-8" style={{ color: theme.primaryColor }} />
                </div>
                <h3 className="text-base font-bold text-white">{businessData.city}</h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Localização de fácil acesso e estacionamento para clientes no local.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 ${theme.fontClass} ${focusClass} transition-colors duration-300 relative`}>
      {/* ---------------------------------------------------- */}
      {/* SELETOR STICKY DAS 5 VARIAÇÕES (QUANDO EM DEMO)     */}
      {/* ---------------------------------------------------- */}
      {isDemoSelection && (
        <header className="sticky top-0 z-50 bg-[#12151b]/95 backdrop-blur-md border-b border-[#2d3443] px-4 py-3 shadow-2xl">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                Escolha seu Modelo
              </span>
              <span className="text-xs text-neutral-300 font-medium hidden sm:inline">
                5 Variações oficiais do site disponíveis para o seu salão:
              </span>
            </div>

            {/* Botoes das 5 variações */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(Object.keys(SITE_VARIATIONS) as SiteVariationId[]).map((vId) => {
                const v = SITE_VARIATIONS[vId];
                const active = currentVariation === vId;
                return (
                  <button
                    key={vId}
                    onClick={() => handleSelectVariation(vId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      active
                        ? `${v.accentBg} text-neutral-950 shadow-lg scale-105`
                        : 'bg-[#1c212c] text-neutral-300 hover:text-white border border-[#2d3443]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.primaryColor }} />
                    {v.name.split('&')[0].trim()}
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>

            {/* CTA de contratação */}
            {onContinueToActivation && (
              <button
                onClick={onContinueToActivation}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Quero Este Site
              </button>
            )}
          </div>
        </header>
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. NAVBAR / CABEÇALHO DO SITE DO SALÃO              */}
      {/* ---------------------------------------------------- */}
      <nav className="border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl overflow-hidden border ${theme.borderColor} bg-neutral-900 flex items-center justify-center shrink-0`}>
            {businessData.logoUrl ? (
              <img src={businessData.logoUrl} alt={businessData.name} className="w-full h-full object-cover" />
            ) : (
              <Scissors className="w-5 h-5" style={{ color: theme.primaryColor }} />
            )}
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white line-clamp-1">{businessData.name}</h1>
            <p className="text-[11px] text-neutral-400">{businessData.category || 'Categoria não informada'}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-300">
          <a hidden={servicesList.length === 0} href="#servicos" className="hover:text-white transition">Serviços</a>
          <a hidden={servicesList.length === 0} href="#agendamento" className="hover:text-white transition">Agendamento</a>
          <a hidden={mediaList.length === 0} href="#galeria" className="hover:text-white transition">Galeria</a>
          <a hidden={productsList.length === 0} href="#produtos" className="hover:text-white transition">Produtos</a>
          <a href="#localizacao" className="hover:text-white transition">Localização</a>
        </div>

        <a
          hidden={servicesList.length === 0}
          href="#agendamento"
          className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition ${theme.buttonPrimary}`}
        >
          Ver demonstração
        </a>
      </nav>

      {/* Dynamic sections rendered based on template.sections order (5 sections per template) */}
      {sectionsOrder.map((sectionKey, i) => {
        switch (sectionKey) {
          case 'hero':
            return renderHeroSection();
          case 'services':
            return renderServicesSection();
          case 'appointment':
            return renderAppointmentSection();
          case 'gallery':
            return renderGallerySection();
          case 'products':
            return renderProductsSection();
          case 'contact':
            return renderContactSection();
          default:
            return null;
        }
      })}

      {/* ---------------------------------------------------- */}
      {/* FOOTER                                               */}
      {/* ---------------------------------------------------- */}
      <footer className="border-t border-neutral-800/80 py-8 px-4 sm:px-8 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} {businessData.name}. Todos os direitos reservados.</p>
        <p className="text-[11px] text-neutral-400 mt-1">Plataforma White-Label de Alta Performance para Salões e Barbearias</p>
        {businessData['quantidade-de-avaliacoes'] && (
          <p className="text-[10px] text-neutral-500 mt-1">
            {businessData['quantidade-de-avaliacoes']} {businessData['quantidade-de-avaliacoes'] === 1 ? 'avaliação' : 'avaliações'}
          </p>
        )}
      </footer>

      {/* Modais de Foto e Produto */}
      {selectedMedia && (
        <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};