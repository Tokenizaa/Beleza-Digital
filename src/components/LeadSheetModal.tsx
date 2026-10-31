import React, { useState } from 'react';
import {
  X,
  MapPin,
  Phone,
  Globe,
  Star,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  Layers,
  ChevronRight,
  Share2,
  Download,
  Building2,
  Tag,
  Compass,
  FileJson
} from 'lucide-react';
import { SITE_TEMPLATES_LIST, normalizeTemplateId, SiteVariationId } from '../types/templates';

export interface LeadSheetData {
  id: string;
  name: string;
  category: string;
  address: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone: string;
  whatsapp?: string;
  website?: string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
  price_range?: string;
  opening_hours?: string;
  business_status?: string;
  latitude?: string | number;
  longitude?: string | number;
  maps_url?: string;
  description?: string;
  services?: string[] | string;
  photos?: string[] | string;
  reviews?: Array<{ author?: string; rating?: number; text?: string; time?: string }> | string;
  review_topics?: Array<{ topic?: string; count?: number }> | string;
  plus_code?: string;
  source_place_id?: string;
  dedupe_key?: string;
  cadastral_score?: number;
  cadastral_reasons?: string[];
  commercial_score?: number;
  commercial_level?: 'alta' | 'media' | 'baixa';
  commercial_reasons?: string[];
  demo_token?: string;
  selected_template?: string;
  stage?: 'novo' | 'contatado' | 'respondeu' | 'reuniao' | 'fechado';
  collected_at?: string;
  raw_json?: any;
}

interface LeadSheetModalProps {
  lead: LeadSheetData;
  onClose: () => void;
  onUpdateStage?: (stage: 'novo' | 'contatado' | 'respondeu' | 'reuniao' | 'fechado') => void;
  onUpdateTemplate?: (templateId: SiteVariationId) => void;
}

export const LeadSheetModal: React.FC<LeadSheetModalProps> = ({
  lead,
  onClose,
  onUpdateStage,
  onUpdateTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'visao-geral' | 'avaliacoes' | 'qualificacao' | 'modelos' | 'json'
  >('visao-geral');

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<SiteVariationId>(
    (normalizeTemplateId(lead.selected_template || 'ouro-classico') as SiteVariationId) || 'ouro-classico'
  );
  const [currentStage, setCurrentStage] = useState(lead.stage || 'novo');

  // Parse fields safely
  const parsedServices: string[] = (() => {
    if (Array.isArray(lead.services)) return lead.services;
    if (typeof lead.services === 'string' && lead.services.trim()) {
      try {
        const val = JSON.parse(lead.services);
        if (Array.isArray(val)) return val;
      } catch {
        return lead.services.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  })();

  const parsedPhotos: string[] = (() => {
    if (Array.isArray(lead.photos)) return lead.photos;
    if (typeof lead.photos === 'string' && lead.photos.trim()) {
      try {
        const val = JSON.parse(lead.photos);
        if (Array.isArray(val)) return val;
      } catch {
        return lead.photos.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  })();

  const parsedReviews: Array<{ author?: string; rating?: number; text?: string; time?: string }> = (() => {
    if (Array.isArray(lead.reviews)) return lead.reviews;
    if (typeof lead.reviews === 'string' && lead.reviews.trim()) {
      try {
        const val = JSON.parse(lead.reviews);
        if (Array.isArray(val)) return val;
      } catch {
        return [];
      }
    }
    return [];
  })();

  const parsedTopics: Array<{ topic?: string; count?: number }> = (() => {
    if (Array.isArray(lead.review_topics)) return lead.review_topics;
    if (typeof lead.review_topics === 'string' && lead.review_topics.trim()) {
      try {
        const val = JSON.parse(lead.review_topics);
        if (Array.isArray(val)) return val;
      } catch {
        return [];
      }
    }
    return [];
  })();

  const ratingNum = lead.rating ? Number(lead.rating) : null;
  const reviewCountNum = lead.review_count ? Number(lead.review_count) : null;
  const cadastralScore = lead.cadastral_score ?? 75;
  const commercialScore = lead.commercial_score ?? 85;
  const commercialLevel = lead.commercial_level || (commercialScore >= 70 ? 'alta' : commercialScore >= 40 ? 'media' : 'baixa');

  const cleanPhone = (lead.whatsapp || lead.phone || '').replace(/\D/g, '');
  const demoToken = lead.demo_token || `demo-${lead.id}`;
  const demoUrl = `/demo/${demoToken}`;

  const whatsappMessage = `Olá! Estive analisando o perfil de ${lead.name} e preparei uma demonstração exclusiva de site profissional com sistema de agendamento online integrado:\n\n${window.location.origin}${demoUrl}\n\nPodemos conversar sobre como atrair mais clientes para o seu salão?`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${demoUrl}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleCopyJson = () => {
    const fullPayload = lead.raw_json || lead;
    navigator.clipboard.writeText(JSON.stringify(fullPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleSelectTemplate = (tplId: SiteVariationId) => {
    setCurrentTemplate(tplId);
    if (onUpdateTemplate) onUpdateTemplate(tplId);
  };

  const handleStageChange = (newStage: 'novo' | 'contatado' | 'respondeu' | 'reuniao' | 'fechado') => {
    setCurrentStage(newStage);
    if (onUpdateStage) onUpdateStage(newStage);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md overflow-hidden"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#202530] bg-[#0d0f12] text-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===================================================================== */}
        {/* MODAL HEADER                                                          */}
        {/* ===================================================================== */}
        <header className="border-b border-[#202530] bg-[#12151b] p-5 sm:p-6 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  <Compass className="w-3 h-3 text-purple-400" /> Ficha do Lead Raspado
                </span>
                {lead.business_status && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> {lead.business_status}
                  </span>
                )}
                {lead.price_range && (
                  <span className="inline-flex items-center rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-300">
                    Faixa: {lead.price_range}
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate" title={lead.name}>
                {lead.name}
              </h2>
              <p className="text-xs text-neutral-400 flex items-center gap-2">
                <span>{lead.category || 'Salão de Beleza / Barbearia'}</span>
                <span>•</span>
                <span className="truncate">{lead.city || lead.address || 'Localização observada'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}` : '#'}
                target="_blank"
                rel="noreferrer"
                disabled={!cleanPhone}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-40"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <a
                href={demoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-neutral-950 transition shadow-sm cursor-pointer"
              >
                Abrir Demo <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-neutral-400 hover:text-white hover:bg-[#1a1f28] transition"
                aria-label="Fechar ficha"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Dual Score Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-[#202530]/80">
            <div className="bg-[#171b23] p-2.5 rounded-xl border border-[#2d3443]/60">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Completude Cadastral</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-extrabold text-neutral-200">{cadastralScore}</span>
                <span className="text-[10px] text-neutral-500">/100</span>
              </div>
            </div>

            <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">Oportunidade Comercial</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-emerald-300">{commercialScore}</span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">({commercialLevel})</span>
              </div>
            </div>

            <div className="bg-[#171b23] p-2.5 rounded-xl border border-[#2d3443]/60">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Google Maps Reviews</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-sm font-bold text-white">
                  {ratingNum !== null ? ratingNum.toFixed(1) : '—'}
                </span>
                <span className="text-[10px] text-neutral-400">
                  ({reviewCountNum !== null ? `${reviewCountNum} avaliações` : 'sem dados'})
                </span>
              </div>
            </div>

            <div className="bg-[#171b23] p-2.5 rounded-xl border border-[#2d3443]/60">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Presença na Web</span>
              <p className="text-xs font-semibold mt-0.5 truncate text-white">
                {lead.website ? (
                  <span className="text-purple-300">Site Detectado</span>
                ) : (
                  <span className="text-amber-400 font-bold">Sem Site Próprio</span>
                )}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-0.5 text-xs font-semibold">
            {[
              { id: 'visao-geral', label: 'Visão Geral & Cadastro', icon: Building2 },
              { id: 'avaliacoes', label: 'Avaliações & Mídia', icon: Star },
              { id: 'qualificacao', label: 'Qualificação Dupla', icon: Sparkles },
              { id: 'modelos', label: 'Demonstração & CRM', icon: Layers },
              { id: 'json', label: 'Rastreabilidade JSON', icon: FileJson },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-[#1a1f28]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* ===================================================================== */}
        {/* MODAL BODY TABS                                                       */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-neutral-300">
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'visao-geral' && (
            <div className="space-y-6">
              {/* Contato & Localização */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                  <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">
                    Canais de Contato
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[10px] text-neutral-500 font-bold block">TELEFONE / WHATSAPP</span>
                      <p className="text-sm font-semibold text-white flex items-center gap-2 mt-0.5">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        {lead.phone || 'Não observado no Google Maps'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-500 font-bold block">WEBSITE OFICIAL</span>
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-purple-300 hover:underline flex items-center gap-1.5 mt-0.5 truncate"
                        >
                          <Globe className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="truncate">{lead.website}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <p className="text-xs text-amber-400 font-medium flex items-center gap-1.5 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          Nenhum website cadastrado (Excelente oportunidade de abordagem)
                        </p>
                      )}
                    </div>

                    {lead.maps_url && (
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold block">PERFIL NO GOOGLE MAPS</span>
                        <a
                          href={lead.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cyan-300 hover:underline flex items-center gap-1.5 mt-0.5"
                        >
                          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Abrir ficha oficial no Google Maps</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                  <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">
                    Localização & Georreferenciamento
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[10px] text-neutral-500 font-bold block">ENDEREÇO COMPLETO</span>
                      <p className="text-xs text-white leading-relaxed mt-0.5">
                        {lead.address || 'Endereço não disponível'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold block">CIDADE / ESTADO</span>
                        <p className="text-neutral-200">{lead.city || '—'} {lead.state ? `/ ${lead.state}` : ''}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold block">CEP</span>
                        <p className="text-neutral-200">{lead.postal_code || '—'}</p>
                      </div>
                    </div>

                    {lead.latitude && lead.longitude && (
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold block">COORDENADAS (LAT, LNG)</span>
                        <p className="font-mono text-[11px] text-neutral-300">
                          {lead.latitude}, {lead.longitude}
                        </p>
                      </div>
                    )}

                    {lead.plus_code && (
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold block">PLUS CODE</span>
                        <p className="font-mono text-[11px] text-neutral-400">{lead.plus_code}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Horários & Descrição */}
              <div className="p-4 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">
                  Horário de Atendimento & Operação
                </h4>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-white">
                      {lead.opening_hours || 'Horário de atendimento não especificado no Google Maps'}
                    </p>
                    {lead.description && (
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed border-t border-[#202530] pt-2">
                        {lead.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Serviços Observados */}
              {parsedServices.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                  <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">
                    Serviços & Atributos Identificados ({parsedServices.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {parsedServices.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#1a1f28] border border-[#2d3443] text-xs font-medium text-neutral-200"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AVALIAÇÕES & MÍDIA */}
          {activeTab === 'avaliacoes' && (
            <div className="space-y-6">
              {/* Avaliações Overview */}
              <div className="p-5 rounded-2xl bg-[#12151b] border border-[#202530] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center text-amber-400">
                    <span className="text-2xl font-black">{ratingNum ? ratingNum.toFixed(1) : '—'}</span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-2 h-2 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Reputação Pública no Google</h4>
                    <p className="text-xs text-neutral-400">
                      Total de {reviewCountNum ?? 0} avaliações registradas por clientes no Google Maps.
                    </p>
                  </div>
                </div>

                {parsedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-sm">
                    {parsedTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-[#1a1f28] text-[10px] text-neutral-300 border border-[#2d3443]"
                      >
                        {topic.topic} ({topic.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Avaliações */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">
                  Comentários de Clientes Capturados ({parsedReviews.length})
                </h4>
                {parsedReviews.length > 0 ? (
                  <div className="grid gap-3">
                    {parsedReviews.map((rev, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-[#12151b] border border-[#202530] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{rev.author || 'Cliente Google'}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400 font-bold text-xs">{rev.rating || 5}★</span>
                            {rev.time && <span className="text-[10px] text-neutral-500">{rev.time}</span>}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-300 italic leading-relaxed">
                          "{rev.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 p-4 rounded-xl bg-[#12151b] border border-[#202530]">
                    Nenhum texto de review individual foi extraído desta ficha.
                  </p>
                )}
              </div>

              {/* Fotos Capturadas */}
              {parsedPhotos.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" /> Fotos Observadas ({parsedPhotos.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {parsedPhotos.map((photo, i) => (
                      <div
                        key={i}
                        className="aspect-video rounded-xl overflow-hidden border border-[#202530] bg-[#12151b] group relative"
                      >
                        <img
                          src={photo}
                          alt={`Foto ${i + 1} de ${lead.name}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUALIFICAÇÃO DUPLA */}
          {activeTab === 'qualificacao' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30">
                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Metodologia de Qualificação em Duas Dimensões
                </h4>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  O motor separa rigorosamente a <strong>Completude Cadastral</strong> (quanto o robô conseguiu identificar no Google Maps) da <strong>Oportunidade Comercial</strong> (o quão propenso e necessitado o salão está de contratar o BelezaDigital).
                </p>
              </div>

              {/* Dimensão 1: Completude Cadastral */}
              <div className="p-5 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider">Dimensão 1</span>
                    <h4 className="text-sm font-bold text-white">Completude Cadastral do Estabelecimento</h4>
                  </div>
                  <span className="text-lg font-black text-cyan-300">{cadastralScore}/100</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Mede a densidade de campos válidos capturados: nome, endereço verificado, telefone válido, horários de funcionamento, reviews e fotos.
                </p>

                {Array.isArray(lead.cadastral_reasons) && lead.cadastral_reasons.length > 0 && (
                  <ul className="space-y-1.5 pt-2 border-t border-[#202530]">
                    {lead.cadastral_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Dimensão 2: Oportunidade Comercial */}
              <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Dimensão 2</span>
                    <h4 className="text-sm font-bold text-white">Oportunidade Comercial (Potencial de Conversão)</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-300">{commercialScore}/100</span>
                    <span className="text-[10px] font-bold text-emerald-400 block uppercase">Nível: {commercialLevel}</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-300">
                  Fatores de conversão: estabelecimentos com alta reputação de clientes (muitas avaliações e nota alta) mas <strong>sem site oficial próprio</strong> representam o perfil ideal para adoção imediata da plataforma.
                </p>

                {Array.isArray(lead.commercial_reasons) && lead.commercial_reasons.length > 0 && (
                  <ul className="space-y-1.5 pt-2 border-t border-emerald-500/20">
                    {lead.commercial_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MODELOS & CRM */}
          {activeTab === 'modelos' && (
            <div className="space-y-6">
              {/* Seletor de Templates Oficiais */}
              <div className="p-5 rounded-2xl bg-[#12151b] border border-[#202530] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Modelos Visuais Oficiais do BelezaDigital</h4>
                    <p className="text-xs text-neutral-400">
                      Selecione qual identidade visual melhor representa a estética deste estabelecimento:
                    </p>
                  </div>
                  <span className="text-xs font-bold text-purple-400">5 Modelos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SITE_TEMPLATES_LIST.map((tmpl) => {
                    const isSelected = currentTemplate === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-md ring-1 ring-purple-500'
                            : 'border-[#2d3443] bg-[#171b23] text-neutral-400 hover:border-neutral-500 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: tmpl.primaryColor }}
                            />
                            {tmpl.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                              Selecionado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">{tmpl.tagline}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estágio no Funil CRM */}
              <div className="p-5 rounded-2xl bg-[#12151b] border border-[#202530] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Estágio no Funil do CRM</h4>
                    <p className="text-xs text-neutral-400">Acompanhe a evolução da negociação deste lead:</p>
                  </div>
                  <select
                    value={currentStage}
                    onChange={(e) => handleStageChange(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-[#1a1f28] border border-[#2d3443] text-white text-xs font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="novo">1. Novo (Descoberto)</option>
                    <option value="contatado">2. Contatado (Mensagem Enviada)</option>
                    <option value="respondeu">3. Respondeu (Em Conversa)</option>
                    <option value="reuniao">4. Reunião / Demonstração Marcada</option>
                    <option value="fechado">5. Fechado / Cliente Ativo</option>
                  </select>
                </div>
              </div>

              {/* Ações Comerciais Imediatas */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/30 to-amber-950/20 border border-[#202530] space-y-4">
                <h4 className="text-sm font-bold text-white">Disparo de Proposta & Apresentação</h4>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir Demonstração Ao Vivo
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-xl bg-[#1a1f28] hover:bg-[#252b39] border border-[#2d3443] text-neutral-200 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link da Demo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                  >
                    {copiedMessage ? <Check className="w-4 h-4 text-white" /> : <MessageCircle className="w-4 h-4" />}
                    <span>{copiedMessage ? 'Mensagem Copiada!' : 'Copiar Pitch WhatsApp'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#0d0f12] border border-[#202530] text-[11px] text-neutral-300 font-mono leading-relaxed whitespace-pre-line">
                  {whatsappMessage}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: JSON BRUTO & RASTREABILIDADE */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Payload Integral do Scraper (JSON)</h4>
                  <p className="text-xs text-neutral-400">
                    Contrato de dados completo extraído pelo extrator Google Maps com integridade SHA-256.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1a1f28] hover:bg-[#252b39] border border-[#2d3443] text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>

              {lead.dedupe_key && (
                <div className="p-3 rounded-xl bg-[#12151b] border border-[#202530] font-mono text-[11px]">
                  <span className="text-neutral-500 block text-[10px]">DEDUPE KEY (SHA-256):</span>
                  <span className="text-emerald-400 break-all">{lead.dedupe_key}</span>
                </div>
              )}

              <pre className="font-mono text-xs leading-5 bg-[#07090b] p-4 rounded-2xl border border-[#202530] text-purple-300/90 max-h-[380px] overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(lead.raw_json || lead, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* MODAL FOOTER                                                          */}
        {/* ===================================================================== */}
        <footer className="border-t border-[#202530] bg-[#12151b] p-4 flex items-center justify-between shrink-0 text-xs">
          <div className="text-[11px] text-neutral-500">
            ID: <span className="font-mono text-neutral-400">{lead.id}</span>
            {lead.collected_at && <span> • Coletado em {new Date(lead.collected_at).toLocaleString('pt-BR')}</span>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1a1f28] hover:bg-[#252b39] border border-[#2d3443] text-neutral-300 font-semibold transition"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};
