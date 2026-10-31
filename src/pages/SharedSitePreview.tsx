import React, { useEffect, useState } from 'react';
import { SiteTemplateRenderer } from '../components/SiteTemplateRenderer';
import type { ServiceItem, ProductItem, MediaItem } from '../types';
import { normalizeTemplateId, SiteBusinessData, SITE_TEMPLATES, SITE_TEMPLATES_LIST, SiteVariationId } from '../types/templates';
import { SiteSEOMetadata } from '../components/SiteSEOMetadata';
import {
  Sparkles,
  MapPin,
  Star,
  Phone,
  MessageCircle,
  ExternalLink,
  X,
  Palette,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  ArrowRight
} from 'lucide-react';

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
  logoUrl?: string | null;
  coverUrl?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;                      // Status operacional (active/inactive/suspended)
  note?: string;                        // Nota / avaliação geral
  'quantidade-de-avaliacoes'?: string;  // Qtd de avaliações
  'faixa-de-preco'?: string;            // Faixa de preço
  horario?: string;                     // Horário de funcionamento
  qualification?: any;
  services?: ServiceItem[];
  products?: ProductItem[];
  media?: MediaItem[];
}

const MAX_PAYLOAD_LENGTH = 16000;

export function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function createShareablePreviewUrl(preview: ShareableSitePreview): string {
  const payload = toBase64Url(JSON.stringify(preview));
  if (typeof window === 'undefined') {
    return `/?site-preview=${payload}`;
  }
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('site-preview', payload);
  return url.toString();
}

export function readShareablePreview(searchOrUrl?: string): ShareableSitePreview | null {
  let queryString = searchOrUrl;

  if (typeof queryString !== 'string' && typeof window !== 'undefined') {
    queryString = window.location.search;
    // Fallback: check if hash contains site-preview (e.g. #site-preview=...)
    if (!queryString && window.location.hash.includes('site-preview=')) {
      queryString = '?' + window.location.hash.replace(/^[#?]/, '');
    }
  }

  if (!queryString) return null;

  // If a full URL was provided, extract the query string
  if (queryString.includes('?')) {
    queryString = queryString.slice(queryString.indexOf('?'));
  }

  const params = new URLSearchParams(queryString);
  const rawPayload = params.get('site-preview');
  if (!rawPayload) return null;

  const payload = rawPayload.trim();
  if (!payload || payload.length > MAX_PAYLOAD_LENGTH) return null;

  try {
    const jsonStr = fromBase64Url(payload);
    const value = JSON.parse(jsonStr) as Partial<ShareableSitePreview>;

    if (value.version !== 1 || typeof value.businessName !== 'string' || !value.businessName.trim()) {
      return null;
    }

    const safeText = (input: unknown, max = 500) =>
      typeof input === 'string' ? input.trim().slice(0, max) : '';

    const safeBusinessName = safeText(value.businessName, 120);

    return {
      version: 1,
      businessName: safeBusinessName,
      category: safeText(value.category, 100) || 'Salão de Beleza & Barbearia',
      tagline: safeText(value.tagline, 120) || null,
      description:
        safeText(value.description, 700) ||
        `Uma presença digital feita para apresentar os serviços de ${safeBusinessName} com clareza e facilitar o contato com novos clientes.`,
      phone: safeText(value.phone, 40) || '(51) 99345-6789',
      whatsapp: safeText(value.whatsapp, 40) || safeText(value.phone, 40) || '5551993456789',
      email: safeText(value.email, 120) || null,
      address: safeText(value.address, 200) || 'Endereço comercial verificado',
      city: safeText(value.city, 100) || 'Porto Alegre',
      state: safeText(value.state, 60) || 'RS',
      websiteUrl: safeText(value.websiteUrl, 300) || '',
      templateId: safeText(value.templateId, 60) || 'ouro-classico',
      templateName: safeText(value.templateName, 80) || 'Ouro & Âmbar Clássico',
      projectVersion:
        typeof value.projectVersion === 'number' && Number.isFinite(value.projectVersion)
          ? Math.max(1, Math.floor(value.projectVersion))
          : 1,
      generatedAt: safeText(value.generatedAt, 40) || new Date().toISOString(),
      logoUrl: safeText(value.logoUrl, 500) || null,
      coverUrl: safeText(value.coverUrl, 500) || null,
      instagramHandle: safeText(value.instagramHandle, 100) || null,
      instagramUrl: safeText(value.instagramUrl, 500) || null,
      googleMapsUrl: safeText(value.googleMapsUrl, 500) || null,
      latitude: typeof value.latitude === 'number' && Number.isFinite(value.latitude) ? value.latitude : null,
      longitude: typeof value.longitude === 'number' && Number.isFinite(value.longitude) ? value.longitude : null,
      status: value.status || 'OPERATIONAL',
      note: value.note || '4.9 ⭐ no Google Maps',
      'quantidade-de-avaliacoes': value['quantidade-de-avaliacoes'] || '128 avaliações',
      'faixa-de-preco': value['faixa-de-preco'] || '$$',
      horario: value.horario || 'Segunda a Sábado, 09h às 19h30',
      services: Array.isArray(value.services) ? value.services.slice(0, 40) as ServiceItem[] : [],
      products: Array.isArray(value.products) ? value.products.slice(0, 40) as ProductItem[] : [],
      media: Array.isArray(value.media) ? value.media.slice(0, 60) as MediaItem[] : [],
    };
  } catch {
    return null;
  }
}

export const SharedSitePreview: React.FC<{ preview: ShareableSitePreview | null; controlMode?: 'header' | 'sidebar' }> = ({ preview: initialPreview, controlMode = 'header' }) => {
  // Benchmark fallback caso o preview seja nulo ou link tenha expirado
  const [customBusinessName, setCustomBusinessName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isGeneratedLocally, setIsGeneratedLocally] = useState(false);

  const fallbackPreview: ShareableSitePreview = {
    version: 1,
    businessName: customBusinessName.trim() || 'Studio Yeshua & Estética Nobre',
    category: 'Salão de Beleza & Estética Avançada',
    tagline: 'Cortes de Precisão, Barba Tradicional & Bem-Estar',
    description: 'Espaço especializado em cortes de precisão, mechas iluminadas, tratamentos capilares profundos e bem-estar com agendamento online 24h.',
    phone: customPhone.trim() || '(51) 99345-6789',
    whatsapp: (customPhone.trim() || '5551993456789').replace(/\D/g, ''),
    email: 'contato@belezadigital.com.br',
    address: 'Av. Ipiranga, 6681 - Partenon, Porto Alegre - RS',
    city: customCity.trim() || 'Porto Alegre',
    state: 'RS',
    websiteUrl: '',
    templateId: 'ouro-classico',
    templateName: 'Ouro & Âmbar Clássico',
    projectVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'OPERATIONAL',
    note: '4.9 ⭐ no Google Maps',
    'quantidade-de-avaliacoes': '128 avaliações verificadas',
    'faixa-de-preco': '$$',
    horario: 'Segunda a Sábado, 09h às 19h30',
  };

  const preview = initialPreview || fallbackPreview;
  const isFallback = !initialPreview && !isGeneratedLocally;

  // Active variation state - allows the lead to toggle live between the 5 models
  const initialVar = normalizeTemplateId(preview.templateId);
  const [activeVariation, setActiveVariation] = useState<SiteVariationId>(initialVar);

  useEffect(() => {
    setActiveVariation(normalizeTemplateId(preview.templateId));
  }, [preview.templateId]);

  const currentTemplate = SITE_TEMPLATES[activeVariation] || SITE_TEMPLATES['ouro-classico'];
  const templateName = currentTemplate.name;
  const logoUrl = preview.logoUrl ?? undefined;

  // Atualiza SEO e metadados na página
  SiteSEOMetadata({ preview, templateName, logoUrl });

  const businessData: SiteBusinessData = {
    name: preview.businessName,
    category: preview.category,
    tagline: preview.tagline ?? undefined,
    description: preview.description,
    phone: preview.phone,
    whatsapp: preview.whatsapp ?? preview.phone,
    address: preview.address,
    city: preview.city || 'Localidade não informada',
    state: preview.state ?? undefined,
    logoUrl: preview.logoUrl ?? undefined,
    coverUrl: preview.coverUrl ?? undefined,
    instagramHandle: preview.instagramHandle ?? undefined,
    instagramUrl: preview.instagramUrl ?? undefined,
    googleMapsUrl: preview.googleMapsUrl ?? undefined,
    latitude: preview.latitude,
    longitude: preview.longitude,
    status: preview.status,
    note: preview.note,
    'quantidade-de-avaliacoes': preview['quantidade-de-avaliacoes'],
    'faixa-de-preco': preview['faixa-de-preco'],
    horario: preview.horario,
    services: preview.services ?? [],
    products: preview.products ?? [],
    media: preview.media ?? [],
  };

  // WhatsApp activation message
  const whatsappNumber = (preview.whatsapp || preview.phone || '5551993456789').replace(/\D/g, '');
  const activationPitch = `Olá! Vi a demonstração interativa do site para *${preview.businessName}* no modelo *${currentTemplate.name}* e gostaria de ativar com domínio próprio e agendamento online!`;
  const whatsappActivationUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(activationPitch)}`;

  const handleGenerateLocalPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (customBusinessName.trim()) {
      setIsGeneratedLocally(true);
      window.scrollTo({ top: 380, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* ========================================================================= */}
      {/* 1. SELETOR E CABEÇALHO UNIFICADO DE ALTA CONVERSÃO                        */}
      {/* ========================================================================= */}
      {controlMode === 'header' && <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 px-3 py-2.5 backdrop-blur-md shadow-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Identificação do Negócio */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-black shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold uppercase tracking-wider text-amber-300 text-[9px]">
                  Demonstração Interativa
                </span>
                <span className="text-xs font-bold text-neutral-100 truncate max-w-[180px] sm:max-w-xs">
                  {preview.businessName}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 truncate hidden sm:block">
                {preview.category} · {preview.city || 'Brasil'}
              </p>
            </div>
          </div>

          {/* Seletor dos 5 Modelos Visuais com Cores e Chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5" role="tablist">
            {SITE_TEMPLATES_LIST.map((tpl) => {
              const isSelected = activeVariation === tpl.id;
              return (
                <button
                  key={tpl.id}
                  onClick={() => setActiveVariation(tpl.id)}
                  role="tab"
                  aria-selected={isSelected}
                  title={`${tpl.name}: ${tpl.tagline}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-md scale-[1.02]'
                      : 'border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tpl.primaryColor }}
                  />
                  <span>{tpl.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Botões de Ação Comercial */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetailsModal(true)}
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
              title="Ver dados capturados e diagnóstico digital"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Ficha & Diagnóstico</span>
            </button>

            <a
              href={whatsappActivationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ativar no</span> WhatsApp
            </a>

            <a
              href={`/plataforma/acesso?mode=signup&name=${encodeURIComponent(preview.businessName)}&template=${activeVariation}`}
              className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition"
            >
              Quero Este Site
            </a>
          </div>
        </div>
      </header>}

      {controlMode === 'sidebar' && (
        <aside className="fixed left-3 top-1/2 z-[70] -translate-y-1/2 rounded-2xl border border-neutral-700 bg-neutral-950/95 p-2 shadow-2xl backdrop-blur-md">
          <div className="px-2 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Modelos</div>
          <div className="space-y-1" role="tablist" aria-label="Escolher modelo">
            {SITE_TEMPLATES_LIST.map((tpl) => {
              const selected = activeVariation === tpl.id;
              return <button key={tpl.id} onClick={() => setActiveVariation(tpl.id)} role="tab" aria-selected={selected}
                title={`${tpl.name}: ${tpl.tagline}`}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                  selected ? 'bg-amber-500 text-neutral-950 shadow-lg' : 'text-neutral-300 hover:bg-neutral-800'
                }`}>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tpl.primaryColor }} />
                <span className="hidden sm:inline">{tpl.shortName}</span>
                <span className="sm:hidden">Modelo</span>
              </button>;
            })}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 2. BANNER DE CAPTURA DE LEADS (Caso link expirou ou preview padrão)       */}
      {/* ========================================================================= */}
      {isFallback && (
        <section className="bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-neutral-900 border-b border-amber-500/30 px-4 py-6">
          <div className="mx-auto max-w-5xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Demonstração Oficial ao Vivo · 5 Modelos Visuais
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Veja seu estabelecimento com presença digital profissional em 24h
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl mx-auto">
              Esta é a demonstração interativa completa da plataforma. Navegue entre os 5 modelos acima ou preencha os dados do seu salão abaixo para personalizar na hora:
            </p>

            <form onSubmit={handleGenerateLocalPreview} className="mx-auto flex max-w-2xl flex-col sm:flex-row gap-2 pt-2">
              <input
                type="text"
                placeholder="Nome do seu salão ou barbearia"
                value={customBusinessName}
                onChange={(e) => setCustomBusinessName(e.target.value)}
                className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900/90 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="WhatsApp (ex: 51 99999-9999)"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="w-full sm:w-44 rounded-xl border border-neutral-700 bg-neutral-900/90 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-neutral-950 transition shadow-lg shadow-amber-500/20 cursor-pointer whitespace-nowrap"
              >
                Personalizar Agora
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. RENDERIZADOR DO TEMPLATE VISUAL SELECIONADO (Sem colisão de barra)      */}
      {/* ========================================================================= */}
      <SiteTemplateRenderer
        businessData={businessData}
        initialVariation={activeVariation}
        isDemoSelection={true}
        hideTopBar={true}
        onSelectVariation={(id) => setActiveVariation(id)}
        onContinueToActivation={() => {
          window.location.assign(
            `/plataforma/acesso?mode=signup&name=${encodeURIComponent(preview.businessName)}&template=${activeVariation}`
          );
        }}
      />

      {/* ========================================================================= */}
      {/* 4. BARRA FIXA INFERIOR MOBILE PARA CONVERSÃO IMEDIATA                     */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 border-t border-neutral-800 p-3 sm:hidden backdrop-blur-lg flex items-center justify-between gap-2 shadow-2xl">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold text-amber-400">Modelo Selecionado</p>
          <p className="text-xs font-bold text-white truncate">{currentTemplate.shortName}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={whatsappActivationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 flex items-center gap-1"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <a
            href={`/plataforma/acesso?mode=signup&name=${encodeURIComponent(preview.businessName)}&template=${activeVariation}`}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
          >
            Quero Este
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL DE FICHA TÉCNICA DO LEAD & DIAGNÓSTICO DIGITAL                   */}
      {/* ========================================================================= */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="max-w-lg w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-5 text-neutral-100 shadow-2xl relative">
            <button
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" /> Diagnóstico de Presença Digital
              </div>
              <h2 className="text-xl font-bold text-white">{preview.businessName}</h2>
              <p className="text-xs text-neutral-400">{preview.category}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Reputação Maps</span>
                <span className="text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {preview.note || '4.9 ⭐'}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  {preview['quantidade-de-avaliacoes'] || '128 avaliações públicas'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Status da Operação</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aberto / Operacional
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  {preview.horario || 'Seg a Sáb 09h às 19h30'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 col-span-2">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Endereço Comercial</span>
                <span className="text-neutral-200 font-medium flex items-start gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  {preview.address}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 col-span-2">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Oportunidade Comercial</span>
                <p className="text-neutral-300 text-[11px] mt-1 leading-relaxed">
                  Estabelecimento com forte demanda no Google Maps. A ativação deste site profissional elimina dependência exclusiva de agendamento manual no direct e gera novos agendamentos 24h por dia.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-800">
              <a
                href={whatsappActivationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Ativar via WhatsApp
              </a>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
