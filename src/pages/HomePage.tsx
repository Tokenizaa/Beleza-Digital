import React, { useState } from 'react';
import { PageView, ServiceItem, ProductItem, MediaItem } from '../types';
import { useStore } from '../data/store';
import { MediaModal } from '../components/MediaModal';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { MonthCalendar } from '../components/MonthCalendar';
import { InstagramSection } from '../components/InstagramSection';
import { PWAInstallButton } from '../components/PWAInstallButton';
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
} from 'lucide-react';

interface HomePageProps {
  setCurrentPage: (page: PageView) => void;
  onBookService?: (serviceId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  setCurrentPage,
  onBookService,
}) => {
  const { company, services, products, media, appointments, store } = useStore();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Home Calendar & Availability State
  const todayIso = new Date().toISOString().split('T')[0];
  const [homeSelectedDate, setHomeSelectedDate] = useState<string>(todayIso);
  const [homeSelectedTime, setHomeSelectedTime] = useState<string>('14:00');
  const [homeSelectedServiceId, setHomeSelectedServiceId] = useState<string>(
    services[0]?.id || ''
  );

  const homeTimeslots = [
    '09:00',
    '09:45',
    '10:30',
    '11:15',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '18:45',
    '19:30',
  ];

  const confirmedTimesForHomeDate = appointments
    .filter((a) => a.date === homeSelectedDate && a.status === 'confirmado')
    .map((a) => a.time);

  // Filter highlights
  const featuredServices = services.filter((s) => s.featured).slice(0, 4);
  const recentWork = media.filter((m) => m.type === 'image').slice(0, 6);
  const featuredVideos = media.filter((m) => m.type === 'video').slice(0, 3);
  const featuredProducts = products.filter((p) => p.featured).slice(0, 3);

  return (
    <div className="space-y-20 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden border-b border-neutral-800/60 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 px-4 sm:px-6 lg:px-8 py-16">
        {/* Subtle Luxury Atmospheric Background */}
        <div className="absolute inset-0 z-0 opacity-30">
          <img
            src={company.coverUrl || "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80"}
            alt={company.name}
            className="w-full h-full object-cover filter contrast-115 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/90" />
        </div>

        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-7">
          {/* Official Logo Crest & Badge */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-amber-500/50 bg-neutral-900 shadow-2xl p-0.5 group">
              <img
                src={company.logoUrl || '/logo.jpg'}
                alt={company.name}
                className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-medium backdrop-blur-md shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{company.tagline || "Personalize a identidade do seu estabelecimento"}</span>
            </div>
          </div>

          {/* Description */}
          {company.description && (
            <p className="mt-2 text-neutral-300 text-sm leading-relaxed">
              {company.description}
            </p>
          )}

          {/* Title */}
          <div className="space-y-4">
            <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider text-neutral-100 leading-tight">
              {company.name}
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-300 leading-relaxed font-light">
              Harmonia, visagismo e autocuidado completo em um só lugar. Cortes masculinos impecáveis, design de sobrancelhas, cílios volumosos, tranças e cosméticos selecionados.
            </p>
          </div>

          {/* Hero CTAs: Agendar, WhatsApp, Serviços, Produtos */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              onClick={() => {
                if (onBookService) onBookService();
                else setCurrentPage('agendamento');
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-base shadow-xl hover:shadow-amber-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Calendar className="w-5 h-5 text-neutral-950" />
              <span>Agendar Horário Online</span>
            </button>

            <a
              href={store.buildServiceAppointmentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-100 font-medium text-base transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-emerald-400 text-emerald-400" />
              <span>WhatsApp Direto</span>
            </a>

            <button
              onClick={() => {
                setCurrentPage('servicos');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-100 font-medium text-base transition-all cursor-pointer"
            >
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>Ver Serviços</span>
            </button>
          </div>

          {/* Quick Info Bar */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto border-t border-neutral-800/60 text-left">
            <div className="flex items-center gap-3 p-2">
              <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="text-neutral-400 block">Endereço</span>
                <span className="text-neutral-200 font-medium">{company.address || 'Endereço não informado'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <Instagram className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="text-neutral-400 block">Instagram</span>
                <span className="text-neutral-200 font-medium">{company.instagramHandle || 'Não informado'}</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-2">
              <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="text-neutral-400 block">WhatsApp</span>
                <span className="text-neutral-200 font-medium">{company.whatsapp}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA INSTALL BANNER (IPHONE & ANDROID) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2">
        <PWAInstallButton variant="banner" />
      </section>

      {/* 2. FEATURED SERVICES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
              Especialidades
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-neutral-100 mt-1">
              Serviços em Destaque
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Cuidado com os melhores produtos e atendimento personalizado para homens e mulheres.
            </p>
          </div>

          <button
            onClick={() => {
              setCurrentPage('servicos');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors group cursor-pointer"
          >
            <span>Ver todos os serviços</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredServices.map((service) => (
            <div
              key={service.id}
              className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden group hover:border-amber-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-4/3 overflow-hidden bg-neutral-950">
                  <img
                    src={
                      service.imageUrl ||
                      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'
                    }
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-neutral-950/80 text-amber-300 border border-amber-500/20 backdrop-blur-xs">
                      {service.category}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h3 className="text-lg font-bold font-display text-neutral-100 group-hover:text-amber-200 transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                    {service.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-xs text-neutral-400">
                    {service.durationMinutes ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {service.durationMinutes} min
                      </span>
                    ) : (
                      <span>Sob agendamento</span>
                    )}

                    {typeof service.price === 'number' && (
                      <span className="font-bold text-amber-400 text-sm">
                        R$ {service.price.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0 flex gap-2">
                <button
                  onClick={() => {
                    if (onBookService) onBookService(service.id);
                    else setCurrentPage('agendamento');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-neutral-950" />
                  <span>Agendar Horário</span>
                </button>
                <a
                  href={store.buildServiceAppointmentUrl(service.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-semibold text-xs border border-neutral-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                  title="WhatsApp Direto"
                >
                  <MessageCircle className="w-4 h-4 fill-emerald-400" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2.5 CALENDÁRIO & DISPONIBILIDADE EM TEMPO REAL (ANTI-CONFLITO) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-neutral-800 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Agenda Aberta & Transparência</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-neutral-100">
                Disponibilidade & Agendamento em Tempo Real
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Navegue pelos meses, verifique horários disponíveis e solicite seu atendimento diretamente pelo WhatsApp. Os horários confirmados ficam automaticamente bloqueados para evitar qualquer conflito.
              </p>
            </div>

            <button
              onClick={() => {
                if (onBookService) onBookService(homeSelectedServiceId);
                else setCurrentPage('agendamento');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
            >
              <span>Abrir Agendador Completo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid: Calendário Mensal à Esquerda + Horários do Dia à Direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna 1: Calendário com Avanço de Meses (5 colunas) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                <span>Selecione uma data para consultar:</span>
                <span className="text-amber-400 font-bold">
                  {homeSelectedDate.split('-').reverse().join('/')}
                </span>
              </div>

              <MonthCalendar
                selectedDate={homeSelectedDate}
                onSelectDate={(newDate) => {
                  setHomeSelectedDate(newDate);
                  // se o horário atual estiver ocupado no novo dia, procura o primeiro livre
                  const busyOnNewDate = appointments
                    .filter((a) => a.date === newDate && a.status === 'confirmado')
                    .map((a) => a.time);
                  if (busyOnNewDate.includes(homeSelectedTime)) {
                    const firstFree = homeTimeslots.find((t) => !busyOnNewDate.includes(t));
                    if (firstFree) setHomeSelectedTime(firstFree);
                  }
                }}
                appointments={appointments}
              />

              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-neutral-200">Proteção contra conflitos de horário:</strong> Quando o administrador confirma um horário, ele fica visivelmente travado com o cadeado <span className="text-rose-400 font-semibold">Reservado</span> para todos os clientes.
                </p>
              </div>
            </div>

            {/* Coluna 2: Horários do Dia Selecionado & Solicitação Rápida (7 colunas) */}
            <div className="lg:col-span-7 bg-neutral-950/70 border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                    Grade de Atendimento para
                  </span>
                  <h3 className="text-lg font-bold font-display text-neutral-100 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>
                      {new Date(homeSelectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {confirmedTimesForHomeDate.length > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950/50 border border-rose-900/60 text-rose-300 font-medium">
                      <Lock className="w-3 h-3 text-rose-400" />
                      <span>{confirmedTimesForHomeDate.length} ocupado(s)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-900/60 text-emerald-300 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Todos os horários livres</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Seletor de Serviço */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-300">
                  Procedimento Desejado:
                </label>
                <select
                  value={homeSelectedServiceId}
                  onChange={(e) => setHomeSelectedServiceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs sm:text-sm focus:border-amber-400 focus:outline-none"
                >
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} {srv.durationMinutes ? `(${srv.durationMinutes} min)` : ''}{' '}
                      {srv.price ? `— R$ ${srv.price.toFixed(2).replace('.', ',')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade de Horários */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-300 font-semibold">
                  <span>Escolha o horário de preferência:</span>
                  <span className="text-amber-400">
                    Horário escolhido: <strong>{homeSelectedTime}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {homeTimeslots.map((time) => {
                    const isBooked = confirmedTimesForHomeDate.includes(time);
                    const isSelected = homeSelectedTime === time && !isBooked;

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        onClick={() => {
                          if (!isBooked) setHomeSelectedTime(time);
                        }}
                        className={`p-2.5 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 ${
                          isBooked
                            ? 'bg-neutral-900/40 border-rose-950/60 text-neutral-500 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-500 text-neutral-950 border-amber-300 font-bold shadow-md cursor-pointer'
                            : 'bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-850 cursor-pointer'
                        }`}
                      >
                        <span className={isBooked ? 'line-through text-neutral-500' : ''}>
                          {time}
                        </span>

                        {isBooked ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-rose-400 bg-rose-950/80 px-1 py-0.2 rounded border border-rose-900/50">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Reservado</span>
                          </span>
                        ) : (
                          <span className={`text-[9px] ${isSelected ? 'text-neutral-950 font-bold' : 'text-emerald-400'}`}>
                            Livre
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const chosenService = services.find((s) => s.id === homeSelectedServiceId);
                    const serviceName = chosenService ? chosenService.name : 'Serviço';
                    const [year, month, day] = homeSelectedDate.split('-');
                    const formattedDate = `${day}/${month}/${year}`;

                    // Registrar pedido pendente no store
                    store.addAppointment({
                      clientName: 'Cliente via Site (WhatsApp)',
                      clientPhone: 'WhatsApp do Cliente',
                      serviceId: homeSelectedServiceId || 'geral',
                      serviceName,
                      serviceDuration: chosenService?.durationMinutes,
                      servicePrice: chosenService?.price,
                      date: homeSelectedDate,
                      time: homeSelectedTime,
                      status: 'pendente',
                    });

                    // Mensagem pronta
                    const msg = [
                      `*SOLICITAÇÃO DE AGENDAMENTO — ${company.name}*`,
                      '',
                      `✂️ *Serviço:* ${serviceName}`,
                      `📅 *Data Escolhida:* ${formattedDate}`,
                      `⏰ *Horário Preferencial:* ${homeSelectedTime}`,
                      '',
                      `Olá equipe de ${company.name}! Solicito confirmar meu atendimento neste horário.`,
                    ].join('\n');

                    window.open(store.buildWhatsAppUrl(msg), '_blank');
                  }}
                  disabled={confirmedTimesForHomeDate.includes(homeSelectedTime)}
                  className="flex-1 inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs sm:text-sm shadow-lg hover:shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Solicitar {homeSelectedTime} no WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onBookService) onBookService(homeSelectedServiceId);
                    else setCurrentPage('agendamento');
                  }}
                  className="py-3.5 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Preencher com Meus Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. RECENT WORKS (GALERIA DE FOTOS RECENTES) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
              Portfólio & Transformações
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-neutral-100 mt-1">
              Trabalhos Recentes
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Explore os trabalhos e mídias cadastrados pelo estabelecimento.
            </p>
          </div>

          <button
            onClick={() => {
              setCurrentPage('galeria');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors group cursor-pointer"
          >
            <span>Explorar galeria completa</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {recentWork.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 cursor-pointer hover:border-amber-500/40 transition-all"
            >
              <img
                src={item.url || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80'}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                  {item.category}
                </span>
                <p className="text-xs text-neutral-100 font-medium truncate">
                  {item.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. REELS & VIDEOS SECTION */}
      {featuredVideos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
              Vídeos & Reels
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-neutral-100 mt-1">
              Conteúdo em Destaque
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Assista aos bastidores e resultados dos nossos procedimentos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => setSelectedMedia(video)}
                className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 cursor-pointer group hover:border-amber-500/40 transition-all flex flex-col"
              >
                <div className={`relative bg-neutral-950 flex items-center justify-center overflow-hidden ${video.isReelVertical ? 'aspect-9/16 max-h-[380px]' : 'aspect-video'}`}>
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-950 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-neutral-700" />
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center group-hover:bg-neutral-950/20 transition-all">
                    <div className="w-14 h-14 rounded-full bg-amber-500/90 text-neutral-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-neutral-950 ml-0.5" />
                    </div>
                  </div>

                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-neutral-950/80 text-amber-300 border border-amber-500/20 backdrop-blur-xs">
                    {video.category}
                  </span>
                </div>

                <div className="p-4 bg-neutral-900 flex-1 flex items-center justify-between border-t border-neutral-800">
                  <h4 className="text-sm font-semibold text-neutral-200 group-hover:text-amber-200 transition-colors truncate">
                    {video.title}
                  </h4>
                  <span className="text-xs text-amber-400 font-medium shrink-0 ml-2">
                    Assistir
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. FEATURED PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
              Cosméticos & Cuidados
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-neutral-100 mt-1">
              Produtos em Destaque
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Linha especial para manutenção do seu estilo em casa. Peça e retire na barbearia.
            </p>
          </div>

          <button
            onClick={() => {
              setCurrentPage('produtos');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors group cursor-pointer"
          >
            <span>Ver todo o catálogo</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden group hover:border-amber-500/40 transition-all flex flex-col justify-between"
            >
              <div
                onClick={() => setSelectedProduct(product)}
                className="cursor-pointer"
              >
                <div className="relative aspect-square overflow-hidden bg-neutral-950">
                  <img
                    src={product.mainImage || 'https://images.unsplash.com/photo-1556228578-0d85b4874995?auto=format&fit=crop&w=400&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-neutral-950/80 text-amber-300 border border-amber-500/20 backdrop-blur-xs">
                      {product.category}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h3 className="text-lg font-bold font-display text-neutral-100 group-hover:text-amber-200 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>

                  <div className="pt-2 text-xl font-bold font-display text-amber-400">
                    R$ {(product.price ?? 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0 flex gap-2">
                <button
                  onClick={() => setSelectedProduct(product)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Ver Detalhes
                </button>
                <a
                  href={store.buildProductInquiryUrl(product.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  <span>Comprar</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. INSTAGRAM EMBED & FEED INTERATIVO */}
      <InstagramSection
        onSelectServiceForBooking={(serviceName) => {
          if (onBookService) onBookService();
        }}
      />

      {/* 7. LOCALIZAÇÃO SECTION */}
      {company.address && company.cityState && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-10">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
                Onde Estamos
              </span>
              <h3 className="text-3xl font-bold font-display text-neutral-100 mt-1">
                Localização do Estabelecimento
              </h3>
            </div>

            <div className="space-y-4 text-sm text-neutral-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-100 block text-base font-semibold">
                    {company.address}
                  </strong>
                  <p className="text-neutral-400">{company.cityState}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-100 block">Horário de Atendimento</strong>
                  <p className="text-neutral-400">{company.openingHoursNote}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-100 block">Atendimento por WhatsApp</strong>
                  <p className="text-neutral-400">{company.whatsapp}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href={company.googleMapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(company.address + ', ' + company.cityState))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold transition-all"
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Abrir no Google Maps</span>
              </a>

              <a
                href={store.buildServiceAppointmentUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-neutral-950" />
                <span>Combinar no WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Interactive Map Embed */}
          <div className="w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 relative">
            <iframe
              title={"Localização de " + company.name}
              src={"https://maps.google.com/maps?q=" + encodeURIComponent(company.address + ", " + company.cityState) + "&t=&z=15&ie=UTF8&iwloc=&output=embed"}
              className="w-full h-full border-0 filter invert contrast-90 hue-rotate-180 brightness-95"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      )}

      {/* 8. FINAL WHATSAPP CTA BANNER */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-neutral-900 to-neutral-950 p-8 sm:p-12 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-wider text-neutral-100">
            Pronto para transformar seu visual?
          </h3>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-neutral-300">
            Consulte a disponibilidade e entre em contato com {company.name} para solicitar seu horário.
          </p>
          <div className="pt-2">
            <a
              href={store.buildServiceAppointmentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-base shadow-xl hover:shadow-emerald-600/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-6 h-6 fill-white" />
              <span>Falar no WhatsApp com {company.name}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Modals */}
      <MediaModal
        media={selectedMedia}
        onClose={() => setSelectedMedia(null)}
      />
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
