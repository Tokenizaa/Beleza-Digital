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
  onSelectVariation?: (variationId: SiteVariationId) => void;
  onContinueToActivation?: () => void;
}

// Fallback curated services per archetype when business doesn't provide explicit services
const ARCHETYPE_SERVICES: Record<SiteVariationId, Array<{ name: string; desc: string; price: number; duration: number; cat: string }>> = {
  'ouro-classico': [
    { name: 'Corte Clássico & Visagismo Nobre', desc: 'Corte tradicional personalizado com acabamento em navalha e toalha quente aromática.', price: 70, duration: 45, cat: 'Corte' },
    { name: 'Barboterapia Imperial com Ozônio', desc: 'Alinhamento completo, esfoliação facial, vapor de ozônio e toalha quente relaxante.', price: 55, duration: 40, cat: 'Barba' },
    { name: 'Combo Real (Corte + Barba + Sobrancelha)', desc: 'Experiência completa dos mestres com finalização em pomada nobre e loção pós-barba.', price: 115, duration: 75, cat: 'Combo' },
    { name: 'Tratamento Capilar Anti-Queda & Massagem', desc: 'Tonificação profunda do couro cabeludo com massagem craniofacial revigorante.', price: 65, duration: 35, cat: 'Tratamento' },
  ],
  'preto-esmeralda': [
    { name: 'Skin Fade Cirúrgico // Graduação Zero', desc: 'Degradê de alta precisão com navalhamento milimétrico e linhas de acabamento afiadas.', price: 65, duration: 40, cat: 'Fade' },
    { name: 'Barba Freestyle & Pigmentação HD', desc: 'Design e alinhamento angular de barba com realce óptico de pigmentação temporária.', price: 50, duration: 35, cat: 'Street' },
    { name: 'Combo Underground // Fade + Barba + Risco', desc: 'Pacote completo urbano com navalhado completo, desenho freestyle e finalização matte.', price: 110, duration: 70, cat: 'Combo' },
    { name: 'Texturização & Pompadour Street', desc: 'Modelagem moderna para cabelos médios/longos com pó texturizador profissional.', price: 45, duration: 30, cat: 'Styling' },
  ],
  'minimal-studio': [
    { name: 'Design Capilar Contemporâneo', desc: 'Corte estruturado e minimalista focado na anatomia e caimento natural dos fios.', price: 80, duration: 50, cat: 'Essencial' },
    { name: 'Harmonização de Fios & Hidratação Limpa', desc: 'Tratamento botânico sustentável com fórmulas puras, livres de sulfatos e parabenos.', price: 95, duration: 45, cat: 'Tratamento' },
    { name: 'Alinhamento Sutil de Barba & Cuidados', desc: 'Definição natural e hidratação profunda com óleos essenciais orgânicos.', price: 50, duration: 30, cat: 'Barba' },
    { name: 'Sessão Individual Privativa Completa', desc: 'Atendimento exclusivo 1-a-1 em sala privativa, incluindo café especial e análise estética.', price: 140, duration: 80, cat: 'Experiência' },
  ],
  'safira-executivo': [
    { name: 'Executive Quick Cut (30 min)', desc: 'Corte corporativo ágil e impecável, ideal para intervalos entre compromissos de negócios.', price: 75, duration: 30, cat: 'Express' },
    { name: 'Alinhamento Executivo & Barba VIP', desc: 'Navalha de precisão, contorno milimétrico e toalha morna com óleo de sândalo.', price: 60, duration: 35, cat: 'Executivo' },
    { name: 'Combo Presidencial (Corte + Barba + Massagem)', desc: 'Cuidado completo de imagem profissional com massagem relaxante anti-estresse.', price: 130, duration: 65, cat: 'VIP' },
    { name: 'Camuflagem Discreta de Fios Brancos', desc: 'Pigmentação sutil que preserva a maturidade e sofisticação sem parecer tingido.', price: 70, duration: 30, cat: 'Coloração' },
  ],
  'rubi-lounge': [
    { name: 'Ritual Capilar Nutritivo & Cronograma Velvet', desc: 'Tratamento profundo com óleos preciosos e infusão botânica para brilho sedoso imediato.', price: 120, duration: 60, cat: 'Ritual' },
    { name: 'Design de Olhar & Harmonização de Sobrancelhas', desc: 'Visagismo facial com pinçamento de precisão e hidratação com sérum de peptídeos.', price: 60, duration: 40, cat: 'Estética' },
    { name: 'Corte Visagista & Escova Modelada Lounge', desc: 'Análise de proporção áurea, corte de precisão e finalização editorial com ondas suaves.', price: 95, duration: 60, cat: 'Cabelos' },
    { name: 'Spa das Mãos & Esmaltação em Gel Nobre', desc: 'Esfoliação com cristais de açúcar, massagem com manteiga de karité e esmalte de longa duração.', price: 70, duration: 50, cat: 'Unhas' },
  ],
};

const ARCHETYPE_GALLERY: Record<SiteVariationId, Array<{ id: string; title: string; category: string; url: string }>> = {
  'ouro-classico': [
    { id: 'oc-1', title: 'Corte Clássico Pompadour', category: 'Cabelo', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80' },
    { id: 'oc-2', title: 'Barboterapia Tradicional', category: 'Barba', url: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80' },
    { id: 'oc-3', title: 'Navalha & Acabamento Retrô', category: 'Detalhe', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80' },
    { id: 'oc-4', title: 'Ambiente Imperial & Madeira', category: 'Espaço', url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80' },
  ],
  'preto-esmeralda': [
    { id: 'pe-1', title: 'Mid Skin Fade & Texturizado', category: 'Fade', url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80' },
    { id: 'pe-2', title: 'Taper Fade com Pigmentação', category: 'Freestyle', url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=80' },
    { id: 'pe-3', title: 'Barba Alinhada em Ângulo', category: 'Barba', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80' },
    { id: 'pe-4', title: 'High Contrast Streetwear Look', category: 'Street', url: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=800&q=80' },
  ],
  'minimal-studio': [
    { id: 'ms-1', title: 'Corte Geométrico Fluido', category: 'Design', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80' },
    { id: 'ms-2', title: 'Espaço Privativo & Iluminação Natural', category: 'Estúdio', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' },
    { id: 'ms-3', title: 'Cosmética Limpa & Botânica', category: 'Produtos', url: 'https://images.unsplash.com/photo-1608248597359-2e11894a4c58?auto=format&fit=crop&w=800&q=80' },
    { id: 'ms-4', title: 'Finalização Orgânica & Textura', category: 'Cabelo', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80' },
  ],
  'safira-executivo': [
    { id: 'se-1', title: 'Corte Executivo Impecável', category: 'Business', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80' },
    { id: 'se-2', title: 'Lounge Corporativo & Café', category: 'Espaço', url: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80' },
    { id: 'se-3', title: 'Barba de Alta Precisão', category: 'Barba', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80' },
    { id: 'se-4', title: 'Alinhamento Discreto de Fios', category: 'Grooming', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80' },
  ],
  'rubi-lounge': [
    { id: 'rl-1', title: 'Mechas Luminosas & Tons Veludo', category: 'Coloração', url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80' },
    { id: 'rl-2', title: 'Lounge Bar & Taça de Espumante', category: 'Hospitality', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' },
    { id: 'rl-3', title: 'Design de Olhar & Sobrancelhas', category: 'Visagismo', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80' },
    { id: 'rl-4', title: 'Ritual de Relaxamento & Cuidado', category: 'Spa', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80' },
  ],
};

export const SiteTemplateRenderer: React.FC<SiteTemplateRendererProps> = ({
  businessData,
  template: explicitTemplate,
  initialVariation = 'ouro-classico',
  isDemoSelection = false,
  onSelectVariation,
  onContinueToActivation,
}) => {
  const [currentVariation, setCurrentVariation] = useState<SiteVariationId>(initialVariation);
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

  // Resolve services: if businessData has services, use them; otherwise use curated archetype services
  const rawServices: ServiceItem[] = businessData.services && businessData.services.length > 0
    ? businessData.services
    : ARCHETYPE_SERVICES[activeVariation].map((s, idx) => ({
        id: `srv-${activeVariation}-${idx}`,
        name: s.name,
        category: s.cat,
        description: s.desc,
        price: s.price,
        durationMinutes: s.duration,
        featured: idx < 2,
      }));

  // Resolve media/gallery
  const rawMedia: MediaItem[] = businessData.media && businessData.media.length > 0
    ? businessData.media
    : ARCHETYPE_GALLERY[activeVariation].map((m) => ({
        id: m.id,
        establishmentId: 'est-demo',
        title: m.title,
        type: 'image' as const,
        url: m.url,
        category: (['Barbearia', 'Ambiente', 'Cabelos', 'Unhas', 'Sobrancelhas', 'Produtos', 'Tranças', 'Outros'].includes(m.category)
          ? m.category
          : 'Barbearia') as any,
        featured: true,
        dateAdded: new Date().toISOString(),
      }));

  const handleSelectVariation = (id: SiteVariationId) => {
    setCurrentVariation(id);
    if (onSelectVariation) onSelectVariation(id);
  };

  const whatsappClean = (businessData.whatsapp || businessData.phone || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Olá! Gostaria de agendar um atendimento na ${businessData.name}.`)}`;

  // ==========================================================================
  // RENDERER 1: OURO CLÁSSICO (Tradicional & Imperial • Estilo Yeshua)
  // ==========================================================================
  const renderOuroClassico = () => (
    <div className="bg-[#0e0d0b] text-[#f7f3e8] font-serif selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Heritage Badge */}
      <div className="border-b border-amber-600/20 bg-[#161410] px-4 py-2 text-center text-xs tracking-widest text-amber-400 uppercase font-sans">
        ♦ Tradição, Mestres Barbeiros & Atendimento de Alto Padrão ♦
      </div>

      {/* Hero Ouro Clássico */}
      <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden border-b border-amber-900/40 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-25">
          <img
            src={businessData.coverUrl || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=80'}
            alt="Ambiente Clássico"
            className="w-full h-full object-cover filter contrast-125 sepia-[0.25]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d0b] via-[#0e0d0b]/80 to-[#0e0d0b]/95" />
        </div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 text-amber-300 text-xs font-sans uppercase tracking-widest backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{businessData.category || 'Barbearia Clássica & Alta Estética'}</span>
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
            {businessData.description || 'A nobreza do corte clássico e o ritual da toalha quente combinados à precisão e técnicas contemporâneas.'}
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

      {/* Os 4 Rituais da Tradição */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-amber-900/30 font-sans">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Excelência & Mestria</span>
          <h2 className="text-2xl sm:text-3xl font-serif text-amber-100 font-bold">Os Rituais da Casa</h2>
          <p className="text-xs text-neutral-400">Cada atendimento é uma cerimônia de cuidado, precisão e bem-estar masculino.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Scissors, title: 'Navalha Tradicional', desc: 'Acabamento minucioso com lâmina descartável e precisão milimétrica.' },
            { icon: Flame, title: 'Toalha Quente & Ozônio', desc: 'Abertura dos poros, emoliência e hidratação profunda para barbear suave.' },
            { icon: Award, title: 'Cosméticos Nobres', desc: 'Pomadas, óleos essenciais e loções de altíssimo padrão artesanal.' },
            { icon: Coffee, title: 'Café & Cerveja Artesanal', desc: 'Ambiente aconchegante com bebidas cortesia preparadas na hora.' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-5 rounded-2xl bg-[#14120e] border border-amber-800/30 hover:border-amber-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-amber-100">{item.title}</h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Menu Board Tradicional com Linhas Pontilhadas */}
      <section id="servicos" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-amber-900/30 font-sans">
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
                    {service.durationMinutes ? `${service.durationMinutes} min` : '45 min'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-light max-w-xl">{service.description}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-amber-900/20">
                <span className="font-serif text-xl font-bold text-amber-300">
                  R$ {(service.price ?? 65).toFixed(2)}
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

      {/* Galeria Clássica */}
      <section id="galeria" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-amber-900/30 font-sans">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Galeria & Portfólio</span>
          <h2 className="text-2xl sm:text-3xl font-serif text-amber-100 font-bold">Trabalhos Realizados</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {rawMedia.slice(0, 4).map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-amber-900/40 cursor-pointer"
            >
              <img src={item.url} alt={item.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-end">
                <p className="text-xs font-serif font-bold text-amber-200">{item.title}</p>
                <span className="text-[10px] text-amber-400/80">{item.category}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
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
          <span>[ STATUS: OPERACIONAL // AGENDA ABERTA // STREET CULTURE ]</span>
        </div>
        <span className="hidden sm:inline">HIGH CONTRAST // MATTE BLACK</span>
      </div>

      {/* Hero Preto Esmeralda */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-neutral-800 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-20">
          <img
            src={businessData.coverUrl || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=80'}
            alt="Street Studio"
            className="w-full h-full object-cover filter grayscale contrast-150"
          />
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
            {businessData.description || 'Cultura de rua, técnica apurada de fade e visagismo urbano em alta definição.'}
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

      {/* PORTFOLIO FIRST: Destaque de Cortes & Fade Urbano */}
      <section id="galeria" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">// GALERIA & STREET VIBES</span>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mt-1">Portfolio & Cortes</h2>
          </div>
          <div className="flex gap-2">
            {['#SKIN_FADE', '#FREESTYLE', '#TAPER', '#DESIGN'].map((tag) => (
              <span key={tag} className="font-mono text-[10px] text-emerald-300/80 bg-emerald-950/50 border border-emerald-500/30 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rawMedia.slice(0, 4).map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group relative aspect-[4/5] rounded-lg overflow-hidden border border-neutral-800 hover:border-emerald-500 transition cursor-pointer"
            >
              <img src={item.url} alt={item.title} className="w-full h-full object-cover filter contrast-125 transition duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent p-4 flex flex-col justify-end">
                <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold">{item.category}</span>
                <p className="font-bold text-sm text-white group-hover:text-emerald-300 transition">{item.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Serviços Tech-Spec */}
      <section id="servicos" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-neutral-800">
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
                    R$ {(service.price ?? 60).toFixed(2)}
                  </span>
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">{service.durationMinutes ? `${service.durationMinutes}m` : '40m'}</p>
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
    </div>
  );

  // ==========================================================================
  // RENDERER 3: MINIMAL STUDIO (Clean Modern & Arejado • Platina & Ardósia)
  // ==========================================================================
  const renderMinimalStudio = () => (
    <div className="bg-[#0b0f17] text-slate-100 font-sans font-light selection:bg-slate-300/20 selection:text-white">
      {/* Discreet Header */}
      <div className="border-b border-slate-800/60 bg-[#0f1420] px-4 py-2 text-center text-xs tracking-wider text-slate-400 font-mono">
        espaço privativo • atendimento individual com hora marcada
      </div>

      {/* Hero Minimal Studio */}
      <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden border-b border-slate-800/60 px-4 sm:px-8 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-block text-xs uppercase tracking-[0.25em] text-slate-400 border border-slate-700/80 px-3.5 py-1 rounded-full">
            {businessData.category || 'Studio de Estética & Visagismo'}
          </span>

          <h1 className="text-4xl sm:text-6xl font-extralight tracking-tight text-slate-100">
            {businessData.name}
          </h1>

          <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed font-normal">
            {businessData.description || 'Uma abordagem consciente e intimista do cuidado com a sua imagem pessoal.'}
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
                className="w-full sm:w-auto px-6 py-3.5 rounded-full text-xs font-medium tracking-wide bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
              >
                Conversar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ESSENTIAL FIRST: 4 Pilares de Informação Clara */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-14 border-b border-slate-800/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Hora Marcada', desc: 'Sessões individuais sem atraso ou sobreposição.', icon: Clock },
            { title: 'Espaço Privativo', desc: 'Atendimento calmo em ambiente silencioso.', icon: ShieldCheck },
            { title: 'Fórmulas Limpas', desc: 'Produtos botânicos e livres de químicas pesadas.', icon: Feather },
            { title: 'Canal Direto', desc: 'Contato ágil com o profissional responsável.', icon: MessageCircle },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <Icon className="w-4 h-4 text-slate-300 mb-2" />
                <h3 className="text-sm font-semibold text-slate-200">{item.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tabela Minimalista de Serviços */}
      <section id="servicos" className="max-w-4xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-slate-800/60">
        <div className="mb-10 text-center sm:text-left">
          <span className="text-xs uppercase tracking-widest text-slate-400">Atendimentos</span>
          <h2 className="text-2xl font-light text-slate-100 mt-1">Serviços & Procedimentos</h2>
        </div>

        <div className="divide-y divide-slate-800/80">
          {rawServices.map((service) => (
            <div key={service.id} className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
              <div className="space-y-1">
                <h3 className="text-base font-normal text-slate-200 group-hover:text-white transition">{service.name}</h3>
                <p className="text-xs text-slate-400 max-w-lg">{service.description}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-slate-500 font-mono">{service.durationMinutes ? `${service.durationMinutes} min` : '50 min'}</span>
                <span className="text-base font-medium text-slate-200">R$ {(service.price ?? 80).toFixed(2)}</span>
                <a
                  href="#agendamento"
                  onClick={() => setBookingService(service.name)}
                  className="px-3.5 py-1.5 rounded-full text-xs border border-slate-700 hover:border-slate-400 text-slate-300 hover:text-white transition"
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  // ==========================================================================
  // RENDERER 4: SAFIRA EXECUTIVO (Clube Corporativo & Navy VIP)
  // ==========================================================================
  const renderSafiraExecutivo = () => (
    <div className="bg-[#070d1e] text-blue-50 font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Executive Header */}
      <div className="border-b border-blue-900/50 bg-[#0b142d] px-4 py-2 text-center text-xs tracking-wider text-blue-300 uppercase font-semibold">
        ★ Clube Corporativo • Pontualidade Britânica & Atendimento VIP ★
      </div>

      {/* Hero Safira Executivo */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-blue-900/50 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-20">
          <img
            src={businessData.coverUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=80'}
            alt="Executive Lounge"
            className="w-full h-full object-cover filter contrast-125"
          />
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
            {businessData.description || 'Precisão, conforto e rigor com seus horários. O padrão de imagem pessoal que sua trajetória corporativa exige.'}
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

      {/* O Padrão Executivo */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-blue-900/40">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold">Previsibilidade & Conforto</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">O Padrão Executivo</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Clock, title: 'Pontualidade Britânica', desc: 'Início pontual garantido. Seu tempo é tratado com respeito absoluto.' },
            { icon: Wifi, title: 'Infraestrutura Business', desc: 'Wi-Fi de 500MB, ambiente silencioso para chamadas e tomadas em todas as bancadas.' },
            { icon: Coffee, title: 'Lounge Nespresso & Bar', desc: 'Café expresso selecionado, água com gás e destilados premium cortesia.' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-6 rounded-2xl bg-[#0b142d] border border-blue-900/60 hover:border-blue-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="text-xs text-blue-200/70 mt-2 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Menu Executivo */}
      <section id="servicos" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-blue-900/40">
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
                    R$ {(service.price ?? 75).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-blue-200/70 mt-2 leading-relaxed">{service.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-900/40 flex items-center justify-between">
                <span className="text-[11px] text-blue-300/80 font-mono">Duração: {service.durationMinutes ? `${service.durationMinutes} min` : '35 min'}</span>
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
    </div>
  );

  // ==========================================================================
  // RENDERER 5: RUBI LOUNGE (Velvet Aesthetic & Editorial Nobre)
  // ==========================================================================
  const renderRubiLounge = () => (
    <div className="bg-[#140609] text-rose-50 font-serif selection:bg-rose-500/30 selection:text-rose-200">
      {/* Editorial Header */}
      <div className="border-b border-rose-950/80 bg-[#1c080d] px-4 py-2 text-center text-xs tracking-widest text-rose-300 font-sans uppercase">
        ♥ Experiência Sensorial, Beleza & Cuidado Imersivo ♥
      </div>

      {/* Hero Rubi Lounge */}
      <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden border-b border-rose-950/80 px-4 sm:px-8 py-20">
        <div className="absolute inset-0 z-0 opacity-25">
          <img
            src={businessData.coverUrl || 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1400&q=80'}
            alt="Velvet Lounge"
            className="w-full h-full object-cover filter contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#140609] via-[#140609]/80 to-[#140609]/95" />
        </div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-rose-500/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/80 text-rose-300 text-xs font-sans tracking-wide">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>{businessData.category || 'Velvet Lounge & Spa Capilar'}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-normal italic tracking-tight text-white font-serif">
            {businessData.name}
          </h1>

          <p className="text-base sm:text-lg text-rose-200/80 max-w-2xl mx-auto leading-relaxed font-sans font-light">
            {businessData.description || 'Onde o tempo desacelera e sua melhor versão é revelada através de rituais dedicados e acolhedores.'}
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

      {/* A Experiência no Lounge */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-rose-950/80 font-sans">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <span className="text-xs uppercase tracking-widest text-rose-400 font-semibold">Hospitalidade & Afeto</span>
          <h2 className="text-2xl sm:text-3xl font-serif italic text-white font-normal">A Experiência no Lounge</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Wine, title: 'Welcome Drink', desc: 'Taça de espumante gelado ou infusão botânica floral de boas-vindas.' },
            { icon: Sparkles, title: 'Consultoria de Visagismo', desc: 'Análise detalhada de harmonia facial antes de iniciar o procedimento.' },
            { icon: Coffee, title: 'Atmosfera Acolhedora', desc: 'Aromaterapia suave, iluminação quente e playlist especialmente curada.' },
            { icon: Feather, title: 'Rituais Prolongados', desc: 'Sem correria. Tempo generoso para que você se desconecte do mundo.' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-5 rounded-2xl bg-[#1b080d] border border-rose-950/80 hover:border-rose-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs text-rose-200/70 mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rituais de Beleza */}
      <section id="servicos" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20 border-b border-rose-950/80 font-sans">
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
                    R$ {(service.price ?? 90).toFixed(2)}
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
    </div>
  );

  // Common interactive booking section adapted to current theme
  const renderSharedBookingSection = () => {
    return (
      <section id="agendamento" className="max-w-4xl mx-auto px-4 sm:px-8 py-16 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300">
            Agendamento Online
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Escolha Seu Dia e Horário</h2>
          <p className="text-xs text-neutral-400">Reserve em segundos com confirmação imediata.</p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl border border-neutral-800 bg-neutral-950/80 backdrop-blur-xl shadow-2xl space-y-6">
          {bookingConfirmed ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Demonstração de Agendamento Confirmada!</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Horário reservado para <strong>{bookingDate}</strong> às <strong>{bookingTime}</strong>
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
                      {s.name} - R$ {(s.price ?? 60).toFixed(2)}
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
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  min={todayIso}
                  className="w-full p-3 rounded-xl border border-neutral-700 bg-neutral-900 text-white text-xs outline-none focus:border-amber-500"
                />

                <div className="pt-4">
                  <button
                    onClick={() => setBookingConfirmed(true)}
                    className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CalendarCheck className="w-4 h-4" /> Confirmar Demonstração de Reserva
                  </button>
                  <p className="text-[11px] text-neutral-500 text-center mt-2">
                    Simulação 100% funcional com integração de agenda White-Label.
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
          <p className="text-xs text-neutral-400 mt-1">{businessData.address || `${businessData.city || 'Porto Alegre'} - ${businessData.state || 'RS'}`}</p>
          {businessData.googleMapsUrl && (
            <a href={businessData.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline mt-2">
              Ver no Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <Clock className="w-5 h-5 text-emerald-400 mb-3" />
          <h3 className="font-bold text-sm text-white">Horário de Atendimento</h3>
          <p className="text-xs text-neutral-400 mt-1">{businessData.horario || 'Segunda a Sábado das 09h às 19h30'}</p>
          <span className="inline-block mt-2 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
            Atendimento Ativo
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <Phone className="w-5 h-5 text-blue-400 mb-3" />
          <h3 className="font-bold text-sm text-white">Contato & Reservas</h3>
          <p className="text-xs text-neutral-400 mt-1">{businessData.phone || '(51) 99345-6789'}</p>
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
        <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
};