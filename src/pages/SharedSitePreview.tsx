import React from 'react';
import { SiteTemplateRenderer } from '../components/SiteTemplateRenderer';
import { normalizeTemplateId, SiteBusinessData } from '../types/templates';
import { SiteSEOMetadata } from '../components/SiteSEOMetadata';

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
  status?: string;           // Status operacional (active/inactive/suspended)
  note?: string;           // Nota / avaliação geral
  'quantidade-de-avaliacoes'?: string;  // Qtd de avaliações
  'faixa-de-preco'?: string;            // Faixa de preço
  horario?: string;        // Horário de funcionamento
  qualification?: any;
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
      category: safeText(value.category, 100),
      tagline: safeText(value.tagline, 120) || null,
      description:
        safeText(value.description, 700) ||
        `Uma presença digital feita para apresentar os serviços de ${safeBusinessName} com clareza e facilitar o contato com novos clientes.`,
      phone: safeText(value.phone, 40),
      whatsapp: safeText(value.whatsapp, 40) || safeText(value.phone, 40) || null,
      email: safeText(value.email, 120) || null,
      address: safeText(value.address, 200),
      city: safeText(value.city, 100) || null,
      state: safeText(value.state, 60) || null,
      websiteUrl: safeText(value.websiteUrl, 300),
      templateId: safeText(value.templateId, 60) || 'ouro-classico',
      templateName: safeText(value.templateName, 80) || 'Modelo Oficial',
      projectVersion:
        typeof value.projectVersion === 'number' && Number.isFinite(value.projectVersion)
          ? Math.max(1, Math.floor(value.projectVersion))
          : 1,
      generatedAt: safeText(value.generatedAt, 40),
      logoUrl: safeText(value.logoUrl, 500) || null,
      coverUrl: safeText(value.coverUrl, 500) || null,
      instagramHandle: safeText(value.instagramHandle, 100) || null,
      instagramUrl: safeText(value.instagramUrl, 500) || null,
      googleMapsUrl: safeText(value.googleMapsUrl, 500) || null,
      latitude: typeof value.latitude === 'number' && Number.isFinite(value.latitude) ? value.latitude : null,
      longitude: typeof value.longitude === 'number' && Number.isFinite(value.longitude) ? value.longitude : null,
      // Novos campos alinhados com os 18 do provedor
      status: value.status,
      note: value.note,
      'quantidade-de-avaliacoes': value['quantidade-de-avaliacoes'],
      'faixa-de-preco': value['faixa-de-preco'],
      horario: value.horario,
    };
  } catch {
    return null;
  }
}

export const SharedSitePreview: React.FC<{ preview: ShareableSitePreview | null }> = ({ preview }) => {
  // Injeta metadados SEO automaticamente quando há preview
  const templateName = preview?.templateName || 'Modelo Oficial';
  const logoUrl = preview?.logoUrl ?? undefined;
  
  SiteSEOMetadata({ preview, templateName, logoUrl });
  
  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-5 text-neutral-100">
        <div className="max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            ⚠️
          </div>
          <h1 className="text-2xl font-semibold">Demonstração indisponível</h1>
          <p className="mt-3 text-sm text-neutral-400">
            O link de demonstração está incompleto, expirou ou contém dados malformados.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

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
  };

  const initialVar = normalizeTemplateId(preview.templateId);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteSEOMetadata preview={preview} templateName={preview.templateName} logoUrl={preview.logoUrl ?? undefined} />
      {/* Top Banner differentiating proposal demo from published site */}
      <header className="sticky top-0 z-50 border-b border-amber-500/30 bg-neutral-950/95 px-4 py-2.5 text-xs text-amber-300 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-300 text-[10px]">
              Demonstração Interativa
            </span>
            <span className="font-semibold text-neutral-200">
              {preview.businessName} · Proposta de Site Profissional (v{preview.projectVersion})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-400 hidden md:inline">
              Compare os 5 modelos no seletor abaixo e veja seu site completo funcionando
            </span>
            <a
              href={`/plataforma/cadastro?name=${encodeURIComponent(preview.businessName)}`}
              className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition"
            >
              Quero Este Site
            </a>
          </div>
        </div>
      </header>

      <SiteTemplateRenderer
        businessData={businessData}
        initialVariation={initialVar}
        isDemoSelection={true}
        onContinueToActivation={() => {
          window.location.assign(`/plataforma/cadastro?name=${encodeURIComponent(preview.businessName)}`);
        }}
      />
    </div>
  );
};
