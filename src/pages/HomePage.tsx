import React, { useState } from 'react';
import { PageView } from '../types';
import { useStore } from '../data/store';
import { SharedSitePreview, type ShareableSitePreview } from './SharedSitePreview';
import { SITE_TEMPLATES, SITE_TEMPLATES_LIST, SiteVariationId, normalizeTemplateId } from '../types/templates';
import {
  Sparkles,
  Palette,
  CheckCircle2,
  MapPin,
  Star,
  Phone,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  ArrowRight,
  Zap,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

interface HomePageProps {
  setCurrentPage?: (page: PageView) => void;
  onBookService?: (serviceId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  setCurrentPage,
  onBookService,
}) => {
  const { company } = useStore();

  // Dados ilustrativos do estabelecimento benchmark (Studio Yeshua & Estética Nobre)
  const illustrativePreview: ShareableSitePreview = {
    version: 1,
    businessName: company?.name || 'Studio Yeshua & Estética Nobre',
    category: 'Salão de Beleza & Estética Avançada',
    tagline: company?.tagline || 'Cortes de Precisão, Barba Tradicional & Bem-Estar',
    description:
      company?.description ||
      'Espaço de referência em Porto Alegre, especializado em corte de precisão, mechas iluminadas, barboterapia imperial, tratamentos profundos e bem-estar.',
    phone: company?.phone || '(51) 99345-6789',
    whatsapp: (company?.whatsapp || '5551993456789').replace(/\D/g, ''),
    email: company?.email || 'contato@belezadigital.com.br',
    address: company?.address || 'Av. Ipiranga, 6681 - Partenon, Porto Alegre - RS',
    city: company?.city || 'Porto Alegre',
    state: company?.state || 'RS',
    websiteUrl: '',
    templateId: 'ouro-classico',
    templateName: 'Ouro & Âmbar Clássico',
    projectVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'OPERATIONAL',
    note: '4.9 ⭐ no Google Maps',
    'quantidade-de-avaliacoes': '128 avaliações públicas',
    'faixa-de-preco': '$$',
    horario: 'Segunda a Sábado, 09h às 19h30',
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* ========================================================================= */}
      {/* BANNER INSTITUCIONAL SUPERIOR: APRESENTAÇÃO DO PROJETO & CONTRATAÇÃO      */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-amber-950/40 border-b border-amber-500/30 px-4 py-4 sm:py-5">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-950">
                  Plataforma Oficial
                </span>
                <span className="text-xs font-bold text-neutral-300">
                  BelezaDigital · Presença & Agendamento 24h
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">
                Demonstração ao vivo dos 5 modelos de site para salões e barbearias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <a
              href="/plataforma/acesso?mode=login"
              className="px-3.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900/80 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            >
              Já sou Cliente / Login
            </a>
            <a
              href="/plataforma/acesso?mode=signup"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              Contratar Projeto <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PÁGINA DE DEMONSTRAÇÃO E CAPTURA COMPLETA (COM DADOS ILUSTRATIVOS)       */}
      {/* ========================================================================= */}
      <SharedSitePreview preview={illustrativePreview} />
    </div>
  );
};
