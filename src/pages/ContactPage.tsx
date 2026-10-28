import React from 'react';
import { useStore } from '../data/store';
import {
  MapPin,
  Phone,
  Instagram,
  Clock,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Navigation,
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { company, store } = useStore();

  const mapsQuery = company.latitude && company.longitude
      ? `${company.latitude},${company.longitude}`
      : encodeURIComponent(`${company.address || ''}, ${company.cityState}`);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-widest">
          <Phone className="w-3.5 h-3.5" />
          <span>Canais de Atendimento</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold font-display uppercase tracking-wider text-neutral-100">
          Localização & Atendimento
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
          Consulte os canais de atendimento e as informações configuradas pelo estabelecimento.
        </p>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* WhatsApp */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-emerald-500/40 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Atendimento Principal
              </span>
              <h3 className="text-xl font-bold font-display text-neutral-100 mt-1">
                WhatsApp Oficial
              </h3>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Agendamentos de horários, valores sob consulta e pedidos de produtos.
            </p>
            <p className="text-base font-semibold text-emerald-400">
              {company.whatsapp}
            </p>
          </div>

          <a
            href={store.buildServiceAppointmentUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition-colors"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Conversar no WhatsApp</span>
          </a>
        </div>

        {company.instagramUrl && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-pink-500/40 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Rede Social Oficial
              </span>
              <h3 className="text-xl font-bold font-display text-neutral-100 mt-1">
                Instagram do Estabelecimento
              </h3>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Acompanhe as novidades e publicações do estabelecimento.
            </p>
            <p className="text-base font-semibold text-pink-400">
              {company.instagramHandle}
            </p>
          </div>

          <a
            href={company.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-pink-300 font-semibold text-sm transition-colors"
          >
            <span>Ver Perfil Oficial</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        )}

        {company.address && company.cityState && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-amber-500/40 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Ponto de Atendimento
              </span>
              <h3 className="text-xl font-bold font-display text-neutral-100 mt-1">
                Endereço do Estabelecimento
              </h3>
            </div>
            <p className="text-sm text-neutral-300 font-medium">
              {company.address}
            </p>
            <p className="text-xs text-neutral-400">
              {company.cityState}
            </p>
            {company.openingHoursNote && (
              <p className="text-xs text-amber-400/90 pt-1">
                {company.openingHoursNote}
              </p>
            )}
          </div>

          <a
            href={company.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-300 font-semibold text-sm transition-colors"
          >
            <Navigation className="w-4 h-4" />
            <span>Traçar Rota no Mapa</span>
          </a>
        </div>

        )}
      </div>

      {company.address && company.cityState && (
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold font-display text-neutral-100">
              Mapa de Localização
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Consulte o endereço cadastrado pelo estabelecimento.
            </p>
          </div>

          <a
            href={company.googleMapsUrl || ("https://www.google.com/maps/search/?api=1&query=" + mapsQuery)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
          >
            <span>Abrir no Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="w-full h-96 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 relative">
          <iframe
            title={"Localização de " + company.name}
            src={"https://maps.google.com/maps?q=" + mapsQuery + "&t=&z=16&ie=UTF8&iwloc=&output=embed"}
            className="w-full h-full border-0 filter invert contrast-90 hue-rotate-180 brightness-95"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      )}
    </div>
  );
};
