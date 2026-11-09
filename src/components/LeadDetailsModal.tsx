import React, { useState, useMemo } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Globe,
  MapPin,
  Star,
  ExternalLink,
  Sparkles,
  Calendar,
  Clock,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Send,
  Plus,
  User,
  DollarSign,
  Tag,
  ArrowRight,
  TrendingUp,
  Share2,
  Search,
  Code,
  Layers,
  FileText,
  HelpCircle,
  ShieldCheck,
  Laptop,
} from 'lucide-react';
import type { LeadCompany, LeadStage, OpportunityLevel, LeadTemplateKey } from '../pages/LeadsDashboard';
import { TEMPLATE_NAMES } from '../pages/LeadsDashboard';

export const STAGE_CONFIG: Record<
  LeadStage,
  { label: string; badgeClass: string; borderClass: string; dotClass: string }
> = {
  novo: {
    label: '1. Novo Lead',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    borderClass: 'border-slate-700',
    dotClass: 'bg-slate-400',
  },
  contatado: {
    label: '2. Contatado',
    badgeClass: 'bg-blue-950/70 text-blue-300 border-blue-500/40',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  respondeu: {
    label: '3. Respondeu',
    badgeClass: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40',
    borderClass: 'border-indigo-500/40',
    dotClass: 'bg-indigo-400',
  },
  reuniao: {
    label: '4. Reunião',
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  fechado: {
    label: '5. Fechado / Ganho',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
};

type LeadSheetTab = 'comercial' | 'empresa' | 'digital' | 'avaliacoes_midia';

interface Props {
  company: LeadCompany;
  onClose: () => void;
}

export const LeadDetailsModal: React.FC<Props> = ({
  company,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LeadSheetTab>('comercial');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLogContactOpen, setIsLogContactOpen] = useState<boolean>(false);
  const [contactType, setContactType] = useState<string>('ligacao');
  const [contactNotes, setContactNotes] = useState<string>('');
  const [contactOutcome, setContactOutcome] = useState<string>('sucesso');
  const [nextContactDate, setNextContactDate] = useState<string>('');
  const [nextActionInput, setNextActionInput] = useState<string>('');
  const [isSavingInteraction, setIsSavingInteraction] = useState<boolean>(false);
  const [isEditingDeal, setIsEditingDeal] = useState<boolean>(false);
  const [dealValueInput, setDealValueInput] = useState<string>('');
  const [contactNameInput, setContactNameInput] = useState<string>('');
  const [assignedToInput, setAssignedToInput] = useState<string>('');
  const [isTechnicalAreaExpanded, setIsTechnicalAreaExpanded] = useState<boolean>(false);
  const [technicalSearch, setTechnicalSearch] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const stageConfig = STAGE_CONFIG[company.stage];
  const score = 0;
  const qualificationTier = company.opportunity === 'alta' ? 'A+' : company.opportunity === 'media' ? 'B' : 'C';

  const photos: string[] = [];
  const videos: string[] = [];
  const allFieldEntries = useMemo(() => {
    const entries: Array<[string, string]> = [
      ['id', company.id],
      ['nome', company.name],
      ['categoria', company.category],
      ['endereco', company.address],
      ['telefone', company.phone],
      ['whatsapp', company.whatsapp],
      ['site', company.websiteUrl],
      ['demo_url', company.demoUrl ?? ''],
      ['instagram', company.instagramUrl ?? ''],
      ['nota', String(company.rating ?? '')],
      ['quantidade_avaliacoes', String(company.reviewsCount ?? '')],
      ['diagnostico_digital', company.digitalDiagnosis],
      ['oportunidade', company.opportunity],
      ['estagio', company.stage],
      ['template', company.selectedTemplate],
      ['status_operacional', company.status ?? ''],
      ['faixa_preco', company.faixaDePreco ?? company['faixa-de-preco'] ?? ''],
      ['horario', company.horario ?? ''],
      ['plano_comercial', company.planoComercial ?? ''],
      ['periodo_cobranca', company.billing_period ?? ''],
      ['data_criacao', company.createdAt],
      ['observacao', company.note ?? ''],
    ];
    return entries;
  }, [company]);

  const filteredFields = useMemo(() => {
    if (!technicalSearch.trim()) return allFieldEntries;
    const q = technicalSearch.toLowerCase();
    return allFieldEntries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || String(v ?? '').toLowerCase().includes(q)
    );
  }, [allFieldEntries, technicalSearch]);

  const whatsappNumber = (company.whatsapp || company.phone || '').replace(/\D/g, '');
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}` : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 lg:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        className="max-h-[95vh] w-full max-w-6xl xl:max-w-7xl flex flex-col rounded-2xl bg-[#080d1a] border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* 1. CABEÇALHO COMERCIAL OBJETIVO */}
        <div className="border-b border-slate-800 bg-[#0a1122] px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
                  {company.category || 'Empresa'}
                </span>
                {(company.city || company.state) && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      {company.city || ''}
                      {company.state ? ` / ${company.state}` : ''}
                    </span>
                  </span>
                )}
                {company.rating && (
                  <span className="text-xs text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{company.rating}</span>
                    {company.reviewsCount && <span className="text-slate-400 font-normal">({company.reviewsCount})</span>}
                  </span>
                )}
                {score !== undefined && (
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Score {score}/100 · Tier {qualificationTier}</span>
                  </span>
                )}
              </div>
              <h2 id="lead-title" className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                {company.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                {company.phone ? (
                  <span className="flex items-center gap-1 font-mono text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {company.phone}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Telefone não cadastrado</span>
                )}
                {company.websiteUrl ? (
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:underline truncate max-w-xs"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{company.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </a>
                ) : (
                  <span className="text-slate-500 italic">Sem site institucional</span>
                )}
                {company.instagramUrl && (
                  <a
                    href={company.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Instagram</span>
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-start lg:items-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Etapa no Pipeline
                </span>
                <select
                  value={company.stage}
                  onChange={() => {}}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors outline-none cursor-pointer ${stageConfig?.badgeClass || 'bg-slate-900 text-slate-200 border-slate-700'}`}
                >
                  {Object.entries(STAGE_CONFIG).map(([stg, cfg]) => (
                    <option key={stg} value={stg} className="bg-slate-900 text-slate-200">
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={onClose} aria-label="Fechar ficha do lead" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Ações Principais Comerciais */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all" title="Iniciar conversa no WhatsApp">
                  <MessageCircle className="w-3.5 h-3.5" /> <span>WhatsApp</span>
                </a>
              ) : (
                <button type="button" disabled className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed opacity-60" title="Telefone não disponível para discagem">
                  <MessageCircle className="w-3.5 h-3.5" /> <span>Sem WhatsApp</span>
                </button>
              )}
              <button type="button" onClick={() => setIsLogContactOpen((prev) => !prev)} className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${isLogContactOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'}`}>
                <Plus className="w-3.5 h-3.5" /> <span>Registrar Contato</span>
              </button>
              <button type="button" disabled={isAnalyzing} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer" title="Qualificar com IA">
                <Sparkles className={`w-3.5 h-3.5 text-blue-400 ${isAnalyzing ? 'animate-spin' : ''}`} /> <span>{isAnalyzing ? 'Analisando...' : 'Qualificar com IA'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. NAVEGAÇÃO POR 4 ABAS */}
        <div className="border-b border-slate-800 bg-[#060a16] px-6 py-2 flex items-center gap-2 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab('comercial')} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${activeTab === 'comercial' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}>
            <Sparkles className="w-4 h-4 text-blue-300" /> <span>1. Comercial & Diagnóstico</span>
          </button>
          <button type="button" onClick={() => setActiveTab('empresa')} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${activeTab === 'empresa' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}>
            <Building2 className="w-4 h-4 text-slate-300" /> <span>2. Empresa & Operação</span>
          </button>
          <button type="button" onClick={() => setActiveTab('digital')} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${activeTab === 'digital' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}>
            <Globe className="w-4 h-4 text-emerald-400" /> <span>3. Presença Digital & Evidências</span>
          </button>
          <button type="button" onClick={() => setActiveTab('avaliacoes_midia')} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${activeTab === 'avaliacoes_midia' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}>
            <Star className="w-4 h-4 text-amber-400" /> <span>4. Avaliações & Mídia</span>
          </button>
        </div>

        {/* 3. CONTEÚDO PRINCIPAL DAS ABAS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: COMERCIAL */}
          {activeTab === 'comercial' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-800 bg-[#091122] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Valor Estimado da Proposta</span>
                    {isEditingDeal ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">R$</span>
                        <input type="number" placeholder="0,00" value={dealValueInput} onChange={(e) => setDealValueInput(e.target.value)} className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-emerald-300 font-mono font-bold" />
                      </div>
                    ) : (
                      <span className="text-lg font-bold font-mono text-emerald-400">{dealValueInput || 'Não orçado'}</span>
                    )}
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Contato / Decisor</span>
                    {isEditingDeal ? (
                      <input type="text" placeholder="Nome do decisor" value={contactNameInput} onChange={(e) => setContactNameInput(e.target.value)} className="mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-200">{contactNameInput || 'A identificar'}</span>
                    )}
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Responsável Interno</span>
                    {isEditingDeal ? (
                      <input type="text" placeholder="Vendedor responsável" value={assignedToInput} onChange={(e) => setAssignedToInput(e.target.value)} className="mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-200">{assignedToInput || 'Não atribuído'}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEditingDeal ? (
                    <>
                      <button type="button" onClick={() => {}} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer">Salvar Alterações</button>
                      <button type="button" onClick={() => setIsEditingDeal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer">Cancelar</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setIsEditingDeal(true)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer">Editar Dados Comerciais</button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Quem é a Empresa & Operação</h3>
                  </div>
                  <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                    <p><strong className="text-slate-100">Resumo: </strong> {company.note || 'Estabelecimento comercial coletado via Google Maps. Aguardando enriquecimento.'}</p>
                    <p><strong className="text-slate-100">Categoria: </strong> {company.category}</p>
                    <p><strong className="text-slate-100">Diagnóstico Digital: </strong> {company.digitalDiagnosis.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Diagnóstico & Oportunidades</h3>
                  </div>
                  <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                    <p><strong className="text-slate-100">Nível de Oportunidade: </strong> {company.opportunity.toUpperCase()}</p>
                    <p><strong className="text-slate-100">Ação recomendada: </strong> {company.opportunity === 'alta' ? 'Enviar proposta imediata com demonstração personalizada.' : company.opportunity === 'media' ? 'Enriquecer contatos antes da proposta.' : 'Reavaliar dados cadastrais.'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-blue-800/40">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-200">Solução Comercial Recomendada</h3>
                  </div>
                </div>
                <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                  <p><strong className="text-blue-300">Justificativa: </strong> A plataforma BelezaDigital oferece site profissional com agendamento online integrado, ideal para estabelecimentos que buscam presença digital moderna.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-xs">Site responsivo otimizado mobile</span>
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-xs">Agendamento online integrado</span>
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-xs">WhatsApp Business configurado</span>
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-xs">Galeria de serviços e produtos</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Perguntas de Sondagem para o Vendedor (Discovery)</h3>
                  </div>
                  <span className="text-xs text-slate-400">Roteiro para Ligação ou WhatsApp</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    'Como vocês controlam os pedidos recebidos pelos canais digitais atualmente?',
                    'Qual o maior gargalo operacional na gestão de clientes e vendas hoje?',
                    'Vocês utilizam algum software integrado de frente de caixa e estoque?',
                  ].map((question, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
                      <span className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug flex-1">"{question}"</p>
                      <button type="button" onClick={() => handleCopy(question, `question_${idx}`)} className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer shrink-0" title="Copiar pergunta">
                        {copiedKey === `question_${idx}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Histórico de Interações & Acompanhamento</h3>
                  </div>
                  <button type="button" onClick={() => setIsLogContactOpen(true)} className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer">+ Novo Contato</button>
                </div>
                <div className="py-6 text-center text-xs text-slate-500">Nenhum contato registrado ainda. Clique em "Registrar Contato" para registrar a primeira tentativa.</div>
                {isLogContactOpen && (
                  <form onSubmit={(e) => { e.preventDefault(); setIsSavingInteraction(true); setTimeout(() => { setIsSavingInteraction(false); setIsLogContactOpen(false); }, 1000); }} className="mt-3 p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Registrar Interação / Contato Comercial</span>
                      <button type="button" onClick={() => setIsLogContactOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs">Cancelar</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Tipo de Contato</label>
                        <select value={contactType} onChange={(e) => setContactType(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500">
                          <option value="ligacao">📞 Ligação Telefônica</option>
                          <option value="whatsapp">💬 WhatsApp</option>
                          <option value="reuniao">🤝 Reunião / Visita</option>
                          <option value="email">✉️ E-mail</option>
                          <option value="outro">📋 Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Desfecho</label>
                        <select value={contactOutcome} onChange={(e) => setContactOutcome(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500">
                          <option value="sucesso">✅ Sucesso / Falou com decisor</option>
                          <option value="sem_resposta">📵 Sem resposta / Caixa postal</option>
                          <option value="reagendado">📅 Reagendado retorno</option>
                          <option value="recusado">❌ Sem interesse no momento</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Próxima Data de Retorno</label>
                        <input type="date" value={nextContactDate} onChange={(e) => setNextContactDate(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Notas da Conversa / Observações</label>
                      <textarea rows={2} value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Ex: Falou com o gerente..." className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500 resize-none" required />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <input type="text" placeholder="Próxima ação" value={nextActionInput} onChange={(e) => setNextActionInput(e.target.value)} className="flex-1 max-w-md px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500" />
                      <button type="submit" disabled={isSavingInteraction || !contactNotes.trim()} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer">{isSavingInteraction ? 'Salvando...' : 'Salvar Registro'}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EMPRESA & OPERAÇÃO */}
          {activeTab === 'empresa' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Informações Cadastrais</h3>
                  </div>
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Nome Oficial:</span>
                      <span className="font-semibold text-slate-100">{company.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Categoria Primária:</span>
                      <span className="font-semibold text-slate-100">{company.category || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Endereço Completo:</span>
                      <span className="font-semibold text-slate-100 text-right max-w-xs">{company.address || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Bairro:</span>
                      <span className="font-semibold text-slate-100">—</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Cidade / UF:</span>
                      <span className="font-semibold text-slate-100">{company.city || '—'}{company.state ? ` / ${company.state}` : ''}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">CEP:</span>
                      <span className="font-mono text-slate-100">—</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Status Operacional:</span>
                      <span className="font-semibold text-slate-100">{company.status || 'Aberto'}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Estrutura Operacional</h3>
                  </div>
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Canais de Atendimento:</span>
                      <span className="font-semibold text-slate-100">{company.phone ? 'Telefone, Balcão' : 'Balcão físico'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Estimativa de Unidades:</span>
                      <span className="font-semibold text-slate-100">1 unidade</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Venda Online / E-commerce:</span>
                      <span className="font-semibold text-slate-100">Não identificado</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Agendamento ou Pedidos Online:</span>
                      <span className="font-semibold text-slate-100">Não identificado</span>
                    </div>
                  </div>
                </div>
              </div>

              {company.horario && (
                <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Horários de Atendimento</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {company.horario.split('\n').map((line, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRESENÇA DIGITAL & EVIDÊNCIAS */}
          {activeTab === 'digital' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-[#091124]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Website Institucional</span>
                  {company.websiteUrl ? (
                    <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-400 hover:underline flex items-center gap-1 truncate">
                      <Globe className="w-4 h-4 shrink-0" /> <span className="truncate">{company.websiteUrl.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Sem site institucional</span>
                  )}
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-[#091124]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Maturidade Digital</span>
                  <span className="text-sm font-bold text-emerald-300">{company.digitalDiagnosis === 'site_identificado' ? 'Intermediário' : 'Básico / Local'}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-[#091124]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Processos Digitais</span>
                  <span className="text-xs text-slate-300 line-clamp-2">Presença inicial no Google Maps</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Evidências e Fontes da Coleta</h3>
                  </div>
                  <span className="text-xs text-slate-400">Rastreabilidade dos dados coletados</span>
                </div>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-200 block">Google Maps</span>
                      <span className="text-slate-500 text-[11px] block">Dados de coleta</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-300 border-blue-500/30">Dados Maps</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AVALIAÇÕES & MÍDIA */}
          {activeTab === 'avaliacoes_midia' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-[#091124] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-1">Reputação no Google Maps</h3>
                    <p className="text-xs text-slate-400">Opinião pública e notas deixadas por clientes no perfil comercial.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-extrabold text-amber-300 font-mono">{company.rating && !isNaN(Number(company.rating)) ? Number(company.rating).toFixed(1) : '—'}</span>
                    <div>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${company.rating && !isNaN(Number(company.rating)) && i < Math.floor(Number(company.rating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{company.reviewsCount ? `${company.reviewsCount} avaliações` : 'Sem avaliações'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Galeria de Fotos Públicas ({photos.length})</h3>
                </div>
                <div className="p-8 text-center text-xs text-slate-500 rounded-xl border border-slate-800 bg-[#091124]">Nenhuma foto pública foi coletada na ficha.</div>
              </div>
            </div>
          )}

          {/* 4. ÁREA SECUNDÁRIA: DADOS TÉCNICOS & JSON */}
          <div className="border-t border-slate-800 bg-[#060a16]">
            <button type="button" onClick={() => setIsTechnicalAreaExpanded((prev) => !prev)} className="w-full px-6 py-2.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-slate-500" />
                <span>Dados Técnicos, Campos Coletados & JSON</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-normal">{isTechnicalAreaExpanded ? 'Recolher área técnica' : 'Expandir dados brutos'}</span>
                {isTechnicalAreaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {isTechnicalAreaExpanded && (
              <div className="p-6 border-t border-slate-800 bg-[#050812] max-h-96 overflow-y-auto space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="text" value={technicalSearch} onChange={(e) => setTechnicalSearch(e.target.value)} placeholder="Filtrar campos por chave ou valor..." className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500" />
                  </div>
                  <button type="button" onClick={() => handleCopy(JSON.stringify(company, null, 2), 'raw_json')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 cursor-pointer">
                    {copiedKey === 'raw_json' ? (<> <Check className="w-3.5 h-3.5 text-emerald-400" /> <span>Copiado!</span> </>) : (<> <Copy className="w-3.5 h-3.5" /> <span>Copiar JSON Completo</span> </>)}
                  </button>
                </div>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                      <tr><th className="py-2 px-3">Campo</th><th className="py-2 px-3">Valor</th><th className="py-2 px-3 text-right">Ação</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredFields.map(([k, v]) => (
                        <tr key={k} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-semibold text-slate-300">{k}</td>
                          <td className="py-2 px-3 text-slate-400 max-w-md truncate">{v !== null && v !== undefined && v !== '' ? String(v) : '—'}</td>
                          <td className="py-2 px-3 text-right">
                            {v && (
                              <button type="button" onClick={() => handleCopy(String(v), `field_${k}`)} className="text-slate-500 hover:text-slate-200 p-1 cursor-pointer" title="Copiar valor">
                                {copiedKey === `field_${k}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

