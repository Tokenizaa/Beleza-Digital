import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Users,
  Compass,
  Building2,
  Calendar,
  MessageCircle,
  Globe,
  Instagram,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Phone,
  MapPin,
  Star,
  Flame,
  AlertCircle,
  X,
  Share2,
  Check,
  RotateCw,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { createShareablePreviewUrl } from './SharedSitePreview';
import { SITE_TEMPLATES, SITE_TEMPLATES_LIST, SiteVariationId, normalizeTemplateId } from '../types/templates';
import { supabase } from '../lib/supabase';

export type LeadStage = 'novo' | 'contatado' | 'respondeu' | 'reuniao' | 'fechado';
export type OpportunityLevel = 'alta' | 'media' | 'baixa';

export type LeadTemplateKey =
  | SiteVariationId
  | 'modelo-inicial'
  | 'minimal'
  | 'bold'
  | 'editorial';

export interface LeadCompany {
  id: string;
  name: string;
  niche: string;
  category: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  whatsapp: string;
  websiteUrl: string;
  demoUrl?: string;
  demoExpiresAt?: string;
  instagramUrl?: string;
  rating: number | null;
  reviewsCount: number | null;
  digitalDiagnosis: 'site_identificado' | 'nao_identificado' | 'perfil_sem_foto' | 'site_desatualizado' | 'site_amador' | 'sem_site';
  opportunity: OpportunityLevel;
  stage: LeadStage;
  selectedTemplate: LeadTemplateKey;
  notes: string[];
  followUpDate?: string;
  createdAt: string;
}

export const TEMPLATE_NAMES: Record<string, string> = {
  'ouro-classico': '1. Ouro & Âmbar Clássico (Imperial / Yeshua)',
  'preto-esmeralda': '2. Preto Fosco & Esmeralda (Urbano & Street)',
  'minimal-studio': '3. Minimal Studio & Platina (Clean & Arejado)',
  'safira-executivo': '4. Safira Real Executivo (Navy VIP)',
  'rubi-lounge': '5. Rubi & Vinho Lounge (Velvet Aesthetic)',
  'modelo-inicial': '1. Ouro & Âmbar Clássico (Imperial)',
  'bold': '2. Preto Fosco & Esmeralda (Urbano)',
  'minimal': '3. Minimal Studio & Platina (Clean)',
  'editorial': '5. Rubi & Vinho Lounge (Velvet)',
};

const INITIAL_COMPANIES: LeadCompany[] = [];

export interface LeadsDashboardProps {
  initialTab?: 'hoje' | 'buscar' | 'empresas';
  onTabChange?: (tab: 'hoje' | 'buscar' | 'empresas') => void;
  embeddedInUnifiedAdmin?: boolean;
}

export const LeadsDashboard: React.FC<LeadsDashboardProps> = ({
  initialTab = 'hoje',
  onTabChange,
  embeddedInUnifiedAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<'hoje' | 'buscar' | 'empresas'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const switchTab = (tab: 'hoje' | 'buscar' | 'empresas') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  // Never seed operational CRM with sample businesses. Persist only after a server-backed API is connected.
  const [companies, setCompanies] = useState<LeadCompany[]>(INITIAL_COMPANIES);
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmNotice, setCrmNotice] = useState<string | null>(null);

  const loadCompanies = async () => {
    if (!supabase) {
      setCrmError('Supabase não está configurado neste ambiente. Configure a URL e a chave pública no build do Cloudflare Pages.');
      setCrmLoading(false);
      return;
    }
    setCrmLoading(true);
    setCrmError(null);
    const [candidateResult, stateResult] = await Promise.all([
      supabase.from('prospecting_candidates').select('id,prospect_id,business_name,category,city,region,address,phone,normalized_phone,website_url,normalized_website,qualification_score,status,source_url,raw_evidence,created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('prospecting_crm_state').select('candidate_id,stage,selected_template,notes,follow_up_date'),
    ]);
    if (candidateResult.error) {
      setCrmError('Não foi possível carregar empresas persistidas. Verifique a sessão de Admin Geral, as permissões e as migrations do Supabase.');
      setCrmLoading(false);
      return;
    }
    if (stateResult.error) {
      setCrmError('A tabela de estado do CRM não está acessível. Confirme a migration prospecting_crm_persistence e a permissão administrativa.');
      setCrmLoading(false);
      return;
    }
    const states = new Map<string, any>((stateResult.data ?? []).map((item: any) => [String(item.candidate_id), item]));
    const demoLinksByProspect = new Map<string, { url: string; expiresAt: string }>();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      try {
        const linksResponse = await fetch('/api/prospecting/demo-links', {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(8000),
        });
        if (linksResponse.ok) {
          const linksBody = await linksResponse.json() as { links?: Array<{ prospectId?: string | null; url?: string; expiresAt?: string }> };
          for (const link of linksBody.links ?? []) {
            if (link.prospectId && link.url && link.expiresAt) {
              demoLinksByProspect.set(link.prospectId, { url: link.url, expiresAt: link.expiresAt });
            }
          }
        }
      } catch {
        // Falha ao carregar links não deve transformar uma prévia local em demonstração publicada.
      }
    }
    const mapped: LeadCompany[] = (candidateResult.data ?? []).map((row: any) => {
      const state: any = states.get(row.id);
      const demoLink = row.prospect_id ? demoLinksByProspect.get(String(row.prospect_id)) : undefined;
      const phone = String(row.normalized_phone || row.phone || '').replace(/\D/g, '');
      const websiteUrl = String(row.normalized_website || row.website_url || '');
      const category = String(row.category || 'Empresa local');
      return {
        id: row.id,
        name: String(row.business_name || 'Empresa sem nome'),
        niche: category,
        category,
        city: String(row.city || row.address || ''),
        state: String(row.region || ''),
        address: String(row.address || ''),
        phone,
        whatsapp: phone,
        websiteUrl,
        demoUrl: demoLink?.url,
        demoExpiresAt: demoLink?.expiresAt,
        rating: typeof row.raw_evidence?.rating === 'number' ? row.raw_evidence.rating : null,
        reviewsCount: typeof row.raw_evidence?.reviewsCount === 'number' ? row.raw_evidence.reviewsCount : null,
        digitalDiagnosis: websiteUrl ? 'site_identificado' : 'nao_identificado',
        opportunity: Number(row.qualification_score || 0) >= 70 ? 'alta' : Number(row.qualification_score || 0) >= 40 ? 'media' : 'baixa',
        stage: state?.stage || 'novo',
        selectedTemplate: (state?.selected_template || 'ouro-classico') as LeadTemplateKey,
        notes: Array.isArray(state?.notes) ? state.notes : [],
        followUpDate: state?.follow_up_date || undefined,
        createdAt: row.created_at,
      };
    });
    setCompanies(mapped);
    setCrmLoading(false);
  };

  useEffect(() => { void loadCompanies(); }, []);

  const persistCrmState = async (companyId: string, patch: Record<string, unknown>): Promise<boolean> => {
    if (!supabase) {
      setCrmError('Banco indisponível. A alteração não foi aplicada.');
      return false;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user.id) {
      setCrmError('Sessão administrativa ausente ou expirada. Entre novamente antes de alterar o CRM.');
      return false;
    }
    const { error } = await supabase.from('prospecting_crm_state').upsert({
      candidate_id: companyId,
      ...patch,
      updated_by: sessionData.session.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'candidate_id' });
    if (error) {
      setCrmError('A alteração não foi salva no banco. Nenhuma alteração local foi aplicada; verifique as permissões da tabela prospecting_crm_state.');
      return false;
    }
    setCrmError(null);
    return true;
  };

  const searchHistory: Array<{ niche: string; location: string; count: number; date: string }> = [];

  // ------------------------------------------------------------------
  // Estado da operação de busca (acionamento imediato via /api/prospecting/run)
  // ------------------------------------------------------------------
  type SearchOperationResult = {
    found: number;
    inserted: number;
    updated: number;
    duplicates: number;
    qualified: number | null;
    rejected: number | null;
    blocked: number;
    provider: string | null;
  };

  // Estados explícitos da operação de busca
  type SearchStatus =
    | 'idle'                           // Nenhuma busca em andamento
    | 'pending'                        // Aguardando início (debounce/preparação)
    | 'running'                        // Busca em execução (Worker processando)
    | 'completed'                      // Busca concluída com resultados
    | 'completed_partial'              // Concluída parcialmente (limite diário, sem dados)
    | 'blocked'                        // Worker bloqueado / configuracao incompleta
    | 'failed'                         // Falha definitiva (erro de configuração, rede, etc.)

  // Estado detalhado da operação para persistência e polling
  interface SearchExecution {
    executionId: string;          // ID único para correlacionar polling
    status: SearchStatus;
    startedAt: string;            // Quando a busca foi iniciada
    finishedAt?: string;          // Quando terminou (se terminou)
    result?: SearchOperationResult | null;
    error?: string;
    blockedReason?: string;
  }

  const [searchOperation, setSearchOperation] = useState<{
    status: SearchStatus;
    campaignId: string | null;
    message: string | null;
    error: string | null;
    result: SearchOperationResult | null;
  }>({
    status: 'idle',
    campaignId: null,
    message: null,
    error: null,
    result: null,
  });

  // Controle de polling e execução
  const [searchExecution, setSearchExecution] = useState<SearchExecution>({ executionId: '', status: 'idle', startedAt: '', result: null });
  const executionRef = useRef<number | null>(null);

  const getSessionToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // Form states for "Nova busca"
  const [searchNiche, setSearchNiche] = useState('Barbearia');
  const [searchState, setSearchState] = useState('RS');
  const [searchCity, setSearchCity] = useState('Porto Alegre');
  const [searchLimit, setSearchLimit] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccessMessage, setSearchSuccessMessage] = useState<string | null>(null);

  // CRM Filter states
  const [crmSearchQuery, setCrmSearchQuery] = useState('');
  const [crmViewMode, setCrmViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedCompany, setSelectedCompany] = useState<LeadCompany | null>(null);
  const [proposalCopied, setProposalCopied] = useState(false);

  // CRM stage and template changes are persisted in prospecting_crm_state.

  // Metrics calculation (dados reais do CRM persistido)
  const metrics = useMemo(() => {
    const total = companies.length;
    const novos = companies.filter((c) => c.stage === 'novo').length;
    const contatadas = companies.filter((c) => c.stage === 'contatado').length;
    const avancaram = companies.filter((c) => ['respondeu', 'reuniao', 'fechado'].includes(c.stage)).length;
    const reunioes = companies.filter((c) => c.stage === 'reuniao').length;
    const fechadas = companies.filter((c) => c.stage === 'fechado').length;
    return { total, novos, contatadas, avancaram, reunioes, fechadas };
  }, [companies]);

  // Métricas da última operação de busca (dados reais, quando disponíveis)
  const operationMetrics = useMemo(() => {
    if (!searchOperation.result) return null;
    const { found, inserted, updated, duplicates, qualified, rejected, blocked, provider } = searchOperation.result;
    return { found, inserted, updated, duplicates, qualified, rejected, blocked, provider };
  }, [searchOperation.result]);

  // Handle stage change
  const handleStageChange = async (companyId: string, newStage: LeadStage) => {
    const saved = await persistCrmState(companyId, { stage: newStage });
    if (!saved) return;
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, stage: newStage } : c)));
    if (selectedCompany?.id === companyId) {
      setSelectedCompany((prev) => (prev ? { ...prev, stage: newStage } : null));
    }
  };

  // Change Template for proposal
  const handleTemplateChange = async (companyId: string, template: LeadCompany['selectedTemplate']) => {
    const saved = await persistCrmState(companyId, { selected_template: template });
    if (!saved) return;
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, selectedTemplate: template } : c)));
    if (selectedCompany?.id === companyId) {
      setSelectedCompany((prev) => (prev ? { ...prev, selectedTemplate: template } : null));
    }
  };

  const handleExecuteSearch = async () => {
    if (!supabase) {
      setSearchSuccessMessage('Supabase não está configurado neste ambiente. Nenhuma busca foi iniciada.');
      setSearchOperation({ status: 'failed' as const, campaignId: null, message: null, error: 'Supabase não configurado neste resultado', result: null });
      return;
    }
    if (!searchNiche.trim() || !searchCity.trim() || !searchState.trim()) {
      setSearchSuccessMessage('Informe nicho, cidade e estado para iniciar a busca.');
      return;
    }
    setIsSearching(true);
    setSearchSuccessMessage(null);
    setCrmError(null);

    // Gerar ID único para esta execução e registrar início
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    setSearchExecution({
      executionId,
      status: 'running',
      startedAt,
      result: null,
    });

    // Limpar qualquer polling anterior
    if (executionRef.current !== null) {
      clearTimeout(executionRef.current);
      executionRef.current = null;
    }

    setSearchOperation({
      status: 'running' as const,
      campaignId: null,
      message: 'Busca iniciada. Worker processando descoberta e qualificação automática.',
      error: null,
      result: null,
    });

    const token = await getSessionToken();
    if (!token) {
      setSearchExecution((prev) => ({
        ...prev,
        status: 'failed' as const,
        finishedAt: new Date().toISOString(),
        error: 'Sessão expirada. Entre novamente no Admin Geral.',
      }));
      setIsSearching(false);
      return;
    }

    const region = `${searchCity.trim()} - ${searchState.trim()}`;
    try {
      const response = await fetch('/api/prospecting/run', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          segment: searchNiche.trim(),
          region,
          limit: Math.max(1, Math.min(100, Number(searchLimit) || 5)),
          countryCode: 'BR',
          executionId,
          createCampaign: false,
        }),
        signal: AbortSignal.timeout(60000),
      });

      const responseBody = await response.json().catch(() => ({})) as {
        status?: string;
        campaignId?: string;
        message?: string;
        detail?: string;
        error?: string;
        blocker?: string;
        worker?: Record<string, unknown>;
        executionId?: string;
      };

      // Atualizar estado imediatamente com resposta inicial
      if (!response.ok) {
        setSearchExecution((prev) => ({
          ...prev,
          status: 'failed' as const,
          finishedAt: new Date().toISOString(),
          error: responseBody.detail || responseBody.error || 'Falha ao iniciar a busca.',
        }));
        setSearchSuccessMessage(responseBody.detail || responseBody.error || 'Falha ao iniciar a busca.');
        setIsSearching(false);
        return;
      }

      // Estado inicial recebido do Worker
      const initialStatus: SearchStatus = ['ok', 'running', 'pending', 'retryable'].includes(String(responseBody.status ?? 'ok')) ? 'running' : (responseBody.status === 'blocked' || responseBody.status === 'failed' ? responseBody.status : 'blocked');
      const initialMessage = responseBody.message || 'Busca iniciada. Aguardando processamento do Worker…';
      const initialDetail = responseBody.detail || responseBody.error;

      setSearchExecution((prev) => ({
        ...prev,
        executionId: responseBody.executionId || prev?.executionId || executionId,
        status: initialStatus,
        message: initialMessage,
        error: initialDetail || undefined,
      }));

      setSearchSuccessMessage(
        initialMessage ||
          'Busca pontual iniciada imediatamente. O Worker está processando a coleta e qualificação. Resultados podem ser menores que solicitados por limite diário, disponibilidade de dados no Google Maps ou deduplicação.'
      );

      // Se o worker reportou bloqueio imediato, marcar como bloqueado
      if (((responseBody as { blocked?: number }).blocked ?? 0) > 0 || responseBody.status === 'blocked') {
        setSearchExecution((prev) => ({
          ...prev,
          status: 'blocked' as const,
          blockedReason: responseBody.detail || 'Worker reportou tarefas bloqueadas.',
        }));
      }

      // Consultar o estado persistido da tarefa específica, nunca contadores globais.
      const taskId = responseBody.executionId;
      if (!taskId) {
        setSearchExecution((prev) => ({ ...prev, status: 'failed', finishedAt: new Date().toISOString(), error: 'O servidor não retornou o identificador persistido da execução.' }));
        setIsSearching(false);
        return;
      }
      let attempts = 0;
      const maxAttempts = 120; // até 6 minutos; atingir o limite não significa que a tarefa terminou
      const poll = async () => {
        attempts++;
        try {
          const pollResponse = await fetch(`/api/prospecting/overview?executionId=${encodeURIComponent(taskId)}`, {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000),
          });
          const pollBody = await pollResponse.json().catch(() => ({})) as {
            status?: string;
            execution?: { id?: string; taskStatus?: string; result?: Record<string, unknown> | null; error?: string | null };
            error?: string;
          };
          if (pollResponse.ok && pollBody.status === 'ok' && pollBody.execution) {
            const execution = pollBody.execution;
            const taskStatus = execution.taskStatus;
            const terminal = ['succeeded', 'blocked', 'dead_letter', 'cancelled'].includes(String(taskStatus));
            const taskResult = execution.result ?? {};
            const mappedStatus: SearchStatus =
              taskStatus === 'succeeded' ? 'completed' :
              taskStatus === 'blocked' ? 'blocked' :
              taskStatus === 'dead_letter' ? 'failed' :
              'running';
            if (terminal) {
              const result: SearchOperationResult = {
                found: Number(taskResult.received ?? 0),
                inserted: Number(taskResult.inserted ?? 0),
                updated: 0,
                duplicates: Number(taskResult.duplicates ?? 0),
                qualified: typeof taskResult.qualified === 'number' ? taskResult.qualified : null,
                rejected: typeof taskResult.rejected === 'number' ? taskResult.rejected : null,
                blocked: mappedStatus === 'blocked' ? 1 : 0,
                provider: typeof taskResult.provider === 'string' ? taskResult.provider : null,
              };
              setSearchOperation((prev) => ({
                ...prev,
                status: mappedStatus,
                message: mappedStatus === 'completed' ? 'Coleta concluída. A qualificação e demais tarefas podem continuar na fila.' : 'A execução terminou sem sucesso.',
                error: execution.error ?? null,
                result,
              }));
              setSearchExecution((prev) => ({
                ...prev,
                status: mappedStatus,
                finishedAt: new Date().toISOString(),
                error: execution.error ?? undefined,
                result,
              }));
              await loadCompanies();
              setIsSearching(false);
              executionRef.current = null;
              return;
            }
          } else if (pollResponse.status === 404) {
            setSearchExecution((prev) => ({ ...prev, status: 'failed', finishedAt: new Date().toISOString(), error: 'A execução não foi encontrada no banco.' }));
            setIsSearching(false);
            executionRef.current = null;
            return;
          }
        } catch {
          // Falha temporária de consulta não altera o estado persistido da execução.
        }

        if (attempts >= maxAttempts) {
          setSearchSuccessMessage('A execução continua sem estado terminal confirmado. Consulte novamente; ela não foi marcada como concluída.');
          setIsSearching(false);
          executionRef.current = null;
          return;
        }
        executionRef.current = window.setTimeout(() => { void poll(); }, 3000);
      };

      // Iniciar polling
      executionRef.current = window.setTimeout(() => { void poll(); }, 3000);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha inesperada ao iniciar a busca.';
      setSearchExecution((prev) => ({
        ...prev,
        status: 'failed' as const,
        finishedAt: new Date().toISOString(),
        error: message,
      }));
      setSearchSuccessMessage(message);
      setIsSearching(false);
    }
  };

  // Generate proposal link for a lead
  const getProposalUrl = (company: LeadCompany) => {
    if (company.demoUrl) return company.demoUrl;
    const templateKey = normalizeTemplateId(company.selectedTemplate);
    return `${window.location.origin}${createShareablePreviewUrl({
      version: 1,
      businessName: company.name,
      category: company.category,
      description: `Site profissional e sistema de agendamento online exclusivo para ${company.name}, com atendimento rápido e alta conversão via WhatsApp.`,
      phone: company.phone,
      email: '',
      address: company.address,
      websiteUrl: company.websiteUrl,
      templateId: templateKey,
      templateName: TEMPLATE_NAMES[templateKey] || 'Modelo Oficial',
      projectVersion: 1,
      generatedAt: new Date().toISOString(),
    })}`;
  };

  // WhatsApp click-to-chat with tailored copy
  const getWhatsAppProposalMessage = (company: LeadCompany) => {
    const proposalLink = getProposalUrl(company);
    const introduction = company.demoUrl
      ? `Olá! Preparei uma demonstração publicada do site para ${company.name}:`
      : `Olá! Preparei uma prévia visual local para ${company.name}. Ela ainda não está publicada:`;
    const text = `${introduction}\n\n${proposalLink}\n\nO que achou da proposta?`;
    return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  // Filtered companies for CRM
  const filteredCompanies = useMemo(() => {
    const q = crmSearchQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.niche.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [companies, crmSearchQuery]);

  const stages: Array<{ key: LeadStage; label: string }> = [
    { key: 'novo', label: 'Novo' },
    { key: 'contatado', label: 'Contatado' },
    { key: 'respondeu', label: 'Respondeu' },
    { key: 'reuniao', label: 'Reunião' },
    { key: 'fechado', label: 'Fechado' }
  ];

  return (
    <div className={`flex min-h-screen bg-[#0d0f12] text-neutral-100 font-sans antialiased selection:bg-purple-600 selection:text-white ${embeddedInUnifiedAdmin ? 'w-full' : ''}`}>
      {/* ---------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION (INSPIRADA NO ALVANTO)            */}
      {/* ---------------------------------------------------- */}
      {!embeddedInUnifiedAdmin && (
        <aside className="w-16 md:w-20 bg-[#12151b] border-r border-[#202530] flex flex-col items-center py-5 justify-between shrink-0 z-20">
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Logo Badge */}
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/30 text-white font-black text-lg cursor-pointer">
              A
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col items-center gap-2 w-full px-2 mt-4">
              <button
                onClick={() => switchTab('hoje')}
                title="Hoje (Dashboard)"
                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === 'hoje'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1f28]'
                }`}
              >
                <Compass className="h-5 w-5" />
              </button>

              <button
                onClick={() => switchTab('buscar')}
                title="Nova busca de leads"
                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === 'buscar'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1f28]'
                }`}
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                onClick={() => switchTab('empresas')}
                title="CRM / Empresas"
                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === 'empresas'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1f28]'
                }`}
              >
                <Users className="h-5 w-5" />
              </button>
            </nav>
          </div>

          {/* User profile / Return Link */}
          <div className="flex flex-col items-center gap-4">
            <a
              href="/plataforma/admin"
              title="Voltar ao Painel Geral da Plataforma"
              className="text-[10px] text-neutral-400 hover:text-white uppercase font-bold text-center leading-tight hover:underline p-1"
            >
              Admin
            </a>
            <div className="h-9 w-9 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200 font-bold text-xs flex items-center justify-center shadow-inner">
              NF
            </div>
          </div>
        </aside>
      )}


      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                    */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-[#202530] bg-[#12151b]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct Tab Switcher Pills */}
            <div className="flex items-center bg-[#181c24] p-1 rounded-xl border border-[#2d3443]">
              <button
                type="button"
                onClick={() => switchTab('hoje')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'hoje'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => switchTab('buscar')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'buscar'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Nova busca
              </button>
              <button
                type="button"
                onClick={() => switchTab('empresas')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'empresas'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                CRM / Empresas
              </button>
            </div>

            <span className="hidden md:inline-flex text-[11px] bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded-full font-medium">
              5 Modelos Integrados
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/"
              className="text-xs text-neutral-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-[#1c212c]"
            >
              Ver Site
            </a>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1c212c] px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#2d3443] text-xs">
              <span className={`h-2 w-2 rounded-full ${supabase ? "bg-emerald-400" : "bg-red-400"}`}></span>
              <span className="text-neutral-300 font-medium hidden sm:inline">{supabase ? "Banco conectado" : "Banco não configurado"}</span>
            </div>
          </div>
        </header>

        {(crmError || crmNotice) && <div className={`border-b px-4 py-3 text-xs sm:px-6 ${crmError ? 'border-red-800/70 bg-red-950/40 text-red-200' : 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200'}`} role="status">{crmError || crmNotice}</div>}

        {/* -------------------------------------------------- */}
        {/* VIEW 1: HOJE (DASHBOARD DIÁRIO)                   */}
        {/* -------------------------------------------------- */}
        {activeTab === 'hoje' && (
          <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
            {/* Header Titles & CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                  HOJE · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toLocaleUpperCase('pt-BR')}
                </p>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                  {companies.filter((company) => company.stage === 'respondeu').length} retornos e {metrics.novos} empresas novas.
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => switchTab('empresas')}
                  className="px-4 py-2.5 rounded-xl bg-[#1c212c] hover:bg-[#252b39] border border-[#2d3443] text-sm font-medium text-neutral-200 transition cursor-pointer"
                >
                  Ver empresas
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('buscar')}
                  className="px-5 py-2.5 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-neutral-950 text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-yellow-500/10 cursor-pointer"
                >
                  <Search className="h-4 w-4" /> Nova busca
                </button>
              </div>
            </div>

            {/* Top Grid: Fila de hoje + Métricas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column (2 cols): Fila de Hoje */}
              <div className="lg:col-span-2 bg-[#12151b] border border-[#202530] rounded-2xl p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Fila de hoje</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">Retornos marcados para hoje</p>
                  </div>
                </div>

                <div className="my-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <div className="h-12 w-12 rounded-2xl bg-[#1c212c] border border-[#2d3443] flex items-center justify-center text-purple-400 mb-3">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Nenhum retorno marcado para hoje</h3>
                  <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                    Seus {companies.length} leads estão no CRM. Marque um retorno no detalhe do lead e ele aparece aqui no dia certo.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab('empresas')}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#1c212c] hover:bg-[#252b39] border border-[#2d3443] text-xs font-semibold text-neutral-200 transition cursor-pointer"
                  >
                    Marcar um retorno
                  </button>
                </div>
              </div>

              {/* Right Column (1 col): Saldo & Semana */}
              <div className="space-y-6">
                {/* Saldo do Ciclo */}
                <div className="bg-[#12151b] border border-[#202530] rounded-2xl p-6">
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                    <span>Saldo do ciclo</span>
                    <span className="text-white font-bold">0 disponíveis</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-neutral-300">
                    <span>Mês</span>
                    <span className="font-semibold">{companies.length}/5</span>
                  </div>
                  <div className="w-full bg-[#1c212c] rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-500 h-1.5 rounded-full w-full"></div>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-3 leading-tight flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                    Só cobramos empresa nova. Quem já está no seu CRM não consome saldo.
                  </p>
                </div>

                {/* Sua Semana */}
                <div className="bg-[#12151b] border border-[#202530] rounded-2xl p-6">
                  <div className="flex items-center justify-between text-xs">
                    <h3 className="font-bold text-white">Sua semana</h3>
                    <span className="text-neutral-400">Últimos 7 dias</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-5 text-center">
                    <div>
                      <span className="text-2xl font-black text-white">{metrics.contatadas}</span>
                      <p className="text-[11px] text-neutral-400 mt-1">Contatadas</p>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-white">{metrics.avancaram}</span>
                      <p className="text-[11px] text-neutral-400 mt-1">Avançaram</p>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-white">{metrics.reunioes}</span>
                      <p className="text-[11px] text-neutral-400 mt-1">Reuniões</p>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-emerald-400">{metrics.fechadas}</span>
                      <p className="text-[11px] text-neutral-400 mt-1 font-semibold">Fechadas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Empresas Novas */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Empresas novas</h2>
                <p className="text-xs text-neutral-400">Da última busca, ainda em estágio Novo</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies
                  .filter((c) => c.stage === 'novo')
                  .slice(0, 6)
                  .map((company) => (
                    <div
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className="bg-[#12151b] hover:bg-[#171b23] border border-[#202530] hover:border-purple-600/40 rounded-2xl p-5 cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition line-clamp-1">
                            {company.name}
                          </h3>
                          <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-purple-400 transition" />
                        </div>
                        <p className="text-xs text-neutral-400">
                          {company.city} · {company.state}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/40 px-2.5 py-1 rounded-lg">
                          Oportunidade {company.opportunity}
                        </span>

                        {(company.digitalDiagnosis === 'site_amador' || company.digitalDiagnosis === 'site_identificado') && (
                          <span className="text-[10px] font-semibold bg-[#1c212c] text-neutral-300 border border-[#2d3443] px-2.5 py-1 rounded-lg">
                            {company.digitalDiagnosis === 'site_identificado' ? 'Site identificado — não avaliado' : 'Site amador'}
                          </span>
                        )}

                        {(company.digitalDiagnosis === 'sem_site' || company.digitalDiagnosis === 'nao_identificado') && (
                          <span className="text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2.5 py-1 rounded-lg">
                            {company.digitalDiagnosis === 'nao_identificado' ? 'Site não identificado na coleta' : 'Sem site próprio'}
                          </span>
                        )}

                        {company.digitalDiagnosis === 'perfil_sem_foto' && (
                          <span className="text-[10px] font-semibold bg-[#1c212c] text-neutral-300 border border-[#2d3443] px-2.5 py-1 rounded-lg">
                            Perfil sem foto
                          </span>
                        )}

                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-medium ml-auto">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          {company.rating === null ? 'Sem avaliação capturada' : company.rating.toFixed(1)} · {company.reviewsCount === null ? 'contagem indisponível' : `${company.reviewsCount} avaliações`}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </main>
        )}

        {/* -------------------------------------------------- */}
        {/* VIEW 2: NOVA BUSCA (SCRAPER & DISCOVERY)           */}
        {/* -------------------------------------------------- */}
        {activeTab === 'buscar' && (
          <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                NOVA BUSCA
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                Encontre quem precisa do que você vende.
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2 bg-[#12151b] border border-[#202530] rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-[#202530] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Nova busca</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">Nicho e cidade. A busca só exibirá dados retornados por uma fonte real.</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-purple-400" />
                </div>

                {searchSuccessMessage && (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-200 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{searchSuccessMessage}</span>
                  </div>
                )}

                {/* Estado da operação de busca em tempo real */}
                {searchOperation.status !== 'idle' && (
                  <div className="p-4 rounded-xl border bg-[#171b23] text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          searchOperation.status === 'completed'
                            ? 'bg-emerald-500'
                            : searchOperation.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-purple-500 animate-pulse'
                        }`}
                      />
                      <span className="font-bold text-neutral-200">
                        {searchOperation.status === 'completed'
                          ? 'Concluída'
                          : searchOperation.status === 'blocked'
                          ? 'Bloqueada'
                          : searchOperation.status === 'failed'
                          ? 'Falha'
                          : searchOperation.status === 'completed_partial'
                          ? 'Concluída parcialmente'
                          : 'Processando…'}
                      </span>
                    </div>
                    {searchOperation.message && <p className="text-neutral-400 text-[11px] mb-2">{searchOperation.message}</p>}
                    {searchOperation.error && (
                      <p className="text-red-400 text-[11px] mb-2">{searchOperation.error}</p>
                    )}
                    {searchOperation.result && searchOperation.result.blocked > 0 && (
                      <p className="text-[10px] text-red-300 text-[11px] mb-2">
                        {searchOperation.error || 'Worker reportou tarefas bloqueadas. '
                        }{searchOperation.result.blocked} tarefa(s) não puderam ser processadas.
                      </p>
                    )}
                    {searchOperation.result && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                        <div className="bg-[#12151b] p-2 rounded border border-[#202530]">
                          <span className="text-neutral-500 block">Encontrados</span>
                          <span className="text-white font-bold">{searchOperation.result.found}</span>
                        </div>
                        <div className="bg-[#12151b] p-2 rounded border border-[#202530]">
                          <span className="text-neutral-500 block">Novos</span>
                          <span className="text-emerald-400 font-bold">{searchOperation.result.inserted}</span>
                        </div>
                        <div className="bg-[#12151b] p-2 rounded border border-[#202530]">
                          <span className="text-neutral-500 block">Duplicados</span>
                          <span className="text-neutral-400 font-bold">{searchOperation.result.duplicates}</span>
                        </div>
                        <div className="bg-[#12151b] p-2 rounded border border-[#202530]">
                          <span className="text-neutral-500 block">Qualificados</span>
                          <span className="text-amber-400 font-bold">{searchOperation.result.qualified ?? '—'}</span>
                        </div>
                        {searchOperation.result.blocked > 0 && (
                          <div className="bg-[#12151b] p-2 rounded border border-[#202530]">
                            <span className="text-neutral-500 block">Bloqueados</span>
                            <span className="text-red-400 font-bold">{searchOperation.result.blocked}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Nicho</label>
                    <input
                      type="text"
                      value={searchNiche}
                      onChange={(e) => setSearchNiche(e.target.value)}
                      placeholder="Ex: Barbearia, Salão de Beleza, Clínica Estética"
                      className="w-full px-3.5 py-3 rounded-xl bg-[#171b23] border border-[#2d3443] text-neutral-100 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Estado</label>
                    <select
                      value={searchState}
                      onChange={(e) => setSearchState(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl bg-[#171b23] border border-[#2d3443] text-neutral-100 text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="RS">Rio Grande do Sul (RS)</option>
                      <option value="SP">São Paulo (SP)</option>
                      <option value="RJ">Rio de Janeiro (RJ)</option>
                      <option value="MG">Minas Gerais (MG)</option>
                      <option value="PR">Paraná (PR)</option>
                      <option value="SC">Santa Catarina (SC)</option>
                      <option value="BA">Bahia (BA)</option>
                      <option value="AM">Amazonas (AM)</option>
                      <option value="DF">Distrito Federal (DF)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Cidade</label>
                  <input
                    type="text"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    placeholder="Digite a cidade..."
                    className="w-full px-3.5 py-3 rounded-xl bg-[#171b23] border border-[#2d3443] text-neutral-100 text-sm focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    Nicho e cidade fora da lista podem ser escritos. Bairro e raio ficam para um refinamento posterior.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-300">Quantidade</label>
                    <span className="text-xs font-bold text-purple-400">{searchLimit} empresas</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={searchLimit}
                    onChange={(e) => setSearchLimit(Number(e.target.value))}
                    className="w-full accent-purple-600 bg-[#1c212c] rounded-lg h-2"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                    <span>5 empresas</span>
                    <span>20</span>
                    <span>35</span>
                    <span>50 empresas</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Limite diário aplicado. Quantidade real pode ser menor se limite diário expirado ou dados indisponíveis no Google Maps.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    disabled={isSearching || !searchNiche || !searchCity}
                    onClick={handleExecuteSearch}
                    className="w-full py-3.5 rounded-xl bg-[#facc15] hover:bg-[#fde047] disabled:opacity-50 text-neutral-950 text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-yellow-500/10 cursor-pointer"
                  >
                    {isSearching ? (
                      <>
                        <RotateCw className="h-4 w-4 animate-spin" /> Registrando busca...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" /> Buscar {searchLimit} empresas
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-neutral-500 mt-2">
                    A busca é processada pelo Worker do Cloudflare. Os resultados só aparecem após a coleta real e a gravação no banco.
                  </p>
                </div>
              </div>

              {/* Sidebar Info & History */}
              <div className="space-y-6">
                <div className="bg-[#12151b] border border-[#202530] rounded-2xl p-6">
                  <div className="flex items-center justify-between text-xs mb-4">
                    <h3 className="font-bold text-white">Suas buscas</h3>
                    <span className="text-neutral-400 font-medium">Histórico</span>
                  </div>

                  <div className="space-y-3">
                    {searchHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#171b23] border border-[#202530] rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white line-clamp-1">{item.niche} em {item.location}</span>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            Concluída
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <span>{item.count} empresas novas</span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                    ))}
                    {searchOperation.result && (
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>Encontrados: {searchOperation.result.found}</span>
                        <span className="font-medium">de {searchLimit} solicitadas</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* -------------------------------------------------- */}
        {/* VIEW 3: EMPRESAS (CRM KANBAN PIPELINE)             */}
        {/* -------------------------------------------------- */}
        {activeTab === 'empresas' && (
          <main className="p-6 md:p-8 flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-400">
                  {crmLoading ? 'Carregando empresas…' : `${filteredCompanies.length} empresas`}
                </span>
                <div className="relative">
                  <Search className="h-4 w-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={crmSearchQuery}
                    onChange={(e) => setCrmSearchQuery(e.target.value)}
                    placeholder="Buscar empresa..."
                    className="pl-9 pr-4 py-2 rounded-xl bg-[#171b23] border border-[#2d3443] text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-purple-500 w-56 sm:w-72"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#171b23] border border-[#2d3443] rounded-xl p-1">
                  <button
                    onClick={() => setCrmViewMode('kanban')}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      crmViewMode === 'kanban' ? 'bg-[#252b39] text-white' : 'text-neutral-400'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCrmViewMode('list')}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      crmViewMode === 'list' ? 'bg-[#252b39] text-white' : 'text-neutral-400'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab('buscar')}
                  className="px-4 py-2 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Search className="h-3.5 w-3.5" /> Encontrar empresas
                </button>
              </div>
            </div>

            {/* Kanban Columns */}
            {crmViewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1 items-start overflow-x-auto pb-4">
                {stages.map((stage) => {
                  const stageCompanies = filteredCompanies.filter((c) => c.stage === stage.key);
                  return (
                    <div
                      key={stage.key}
                      className="bg-[#12151b] border border-[#202530] rounded-2xl p-3.5 flex flex-col min-h-[500px]"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-[#202530] mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{stage.label}</span>
                          <span className="text-[11px] font-bold bg-[#1c212c] text-neutral-400 px-2 py-0.5 rounded-full">
                            {stageCompanies.length}
                          </span>
                        </div>
                      </div>

                      {/* Cards in column */}
                      <div className="space-y-3 flex-1 overflow-y-auto">
                        {stageCompanies.length === 0 ? (
                          <div className="border border-dashed border-[#202530] rounded-xl p-6 text-center text-xs text-neutral-500 mt-4">
                            Mova uma empresa para {stage.label.toLowerCase()}
                          </div>
                        ) : (
                          stageCompanies.map((company) => (
                            <div
                              key={company.id}
                              className="bg-[#171b23] hover:bg-[#1c212c] border border-[#252c3a] hover:border-purple-600/50 rounded-xl p-3.5 space-y-3 transition group"
                            >
                              {/* Top: Name & Details Button */}
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  onClick={() => setSelectedCompany(company)}
                                  className="cursor-pointer"
                                >
                                  <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition line-clamp-1">
                                    {company.name}
                                  </h4>
                                  <p className="text-[11px] text-neutral-400 mt-0.5">
                                    {company.niche} · {company.city}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setSelectedCompany(company)}
                                  className="h-6 w-6 rounded-lg bg-[#252c3a] hover:bg-purple-600/30 text-neutral-400 hover:text-purple-200 flex items-center justify-center shrink-0 transition"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Badges */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(company.digitalDiagnosis === 'site_amador' || company.digitalDiagnosis === 'site_identificado') && (
                                  <span className="text-[9px] font-semibold bg-[#252c3a] text-neutral-300 px-2 py-0.5 rounded">
                                    {company.digitalDiagnosis === 'site_identificado' ? 'Site identificado — não avaliado' : 'Site amador'}
                                  </span>
                                )}
                                {(company.digitalDiagnosis === 'sem_site' || company.digitalDiagnosis === 'nao_identificado') && (
                                  <span className="text-[9px] font-semibold bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded">
                                    Sem site
                                  </span>
                                )}
                                {company.digitalDiagnosis === 'perfil_sem_foto' && (
                                  <span className="text-[9px] font-semibold bg-[#252c3a] text-neutral-300 px-2 py-0.5 rounded">
                                    Perfil sem foto
                                  </span>
                                )}
                                <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                                  {company.rating === null ? 'Sem avaliação' : company.rating.toFixed(1)} · {company.reviewsCount === null ? 'contagem indisponível' : company.reviewsCount}
                                </span>
                              </div>

                              {/* Opportunity indicator */}
                              <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                                <span className="capitalize">Oportunidade {company.opportunity}</span>
                                <div className="flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${company.opportunity === 'alta' ? 'bg-purple-500' : 'bg-purple-500/80'}`}></span>
                                  <span className={`h-1.5 w-1.5 rounded-full ${company.opportunity !== 'baixa' ? 'bg-purple-500' : 'bg-neutral-600'}`}></span>
                                  <span className={`h-1.5 w-1.5 rounded-full ${company.opportunity === 'alta' ? 'bg-purple-500' : 'bg-neutral-600'}`}></span>
                                </div>
                              </div>

                              {/* Quick Actions (WhatsApp, Web Preview, Instagram) */}
                              <div className="pt-2 border-t border-[#202530] flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {/* WhatsApp with tailored proposal copy */}
                                  <a
                                    href={getWhatsAppProposalMessage(company)}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Chamar no WhatsApp com a proposta do modelo"
                                    className="p-1.5 rounded-lg bg-[#252c3a] hover:bg-emerald-600 text-neutral-300 hover:text-white transition"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </a>

                                  {/* Web Preview of Proposal with the chosen template */}
                                  <a
                                    href={getProposalUrl(company)}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`Abrir proposta no modelo: ${TEMPLATE_NAMES[company.selectedTemplate]}`}
                                    className="p-1.5 rounded-lg bg-[#252c3a] hover:bg-purple-600 text-neutral-300 hover:text-white transition"
                                  >
                                    <Globe className="h-3.5 w-3.5" />
                                  </a>

                                  {company.instagramUrl && (
                                    <a
                                      href={company.instagramUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Abrir Instagram"
                                      className="p-1.5 rounded-lg bg-[#252c3a] hover:bg-pink-600 text-neutral-300 hover:text-white transition"
                                    >
                                      <Instagram className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>

                                {/* Dropdown to change stage */}
                                <select
                                  value={company.stage}
                                  onChange={(e) => handleStageChange(company.id, e.target.value as LeadStage)}
                                  className="text-[10px] bg-[#12151b] text-neutral-300 border border-[#2d3443] rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500"
                                >
                                  <option value="novo">Novo</option>
                                  <option value="contatado">Contatado</option>
                                  <option value="respondeu">Respondeu</option>
                                  <option value="reuniao">Reunião</option>
                                  <option value="fechado">Fechado</option>
                                </select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List Mode */
              <div className="bg-[#12151b] border border-[#202530] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#171b23] text-neutral-400 font-bold border-b border-[#202530]">
                    <tr>
                      <th className="p-4">Empresa</th>
                      <th className="p-4">Cidade</th>
                      <th className="p-4">Diagnóstico</th>
                      <th className="p-4">Modelo Escolhido</th>
                      <th className="p-4">Estágio</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202530] text-neutral-200">
                    {filteredCompanies.map((c) => (
                      <tr key={c.id} className="hover:bg-[#171b23]/60 transition">
                        <td className="p-4 font-bold text-white">
                          <button onClick={() => setSelectedCompany(c)} className="hover:text-purple-300 text-left">
                            {c.name}
                          </button>
                        </td>
                        <td className="p-4 text-neutral-400">{c.city} - {c.state}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-[#252c3a] text-[10px]">
                            {c.digitalDiagnosis.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-purple-300 font-medium">
                          {TEMPLATE_NAMES[c.selectedTemplate]}
                        </td>
                        <td className="p-4">
                          <span className="capitalize font-semibold text-xs">
                            {c.stage}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <a
                            href={getWhatsAppProposalMessage(c)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block p-1.5 rounded-lg bg-[#252c3a] hover:bg-emerald-600 text-neutral-300 hover:text-white"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={getProposalUrl(c)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block p-1.5 rounded-lg bg-[#252c3a] hover:bg-purple-600 text-neutral-300 hover:text-white"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL DE DETALHES DA EMPRESA & PROPOSTA DE SITE      */}
      {/* ---------------------------------------------------- */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151b] border border-[#2d3443] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#202530] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                  Detalhes do Lead & Proposta
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{selectedCompany.name}</h3>
                <p className="text-xs text-neutral-400">{selectedCompany.category} · {selectedCompany.city} - {selectedCompany.state}</p>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="h-8 w-8 rounded-full bg-[#1c212c] text-neutral-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Contatos & Diagnóstico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#171b23] p-4 rounded-2xl border border-[#202530]">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold block mb-1">LOCALIZAÇÃO</span>
                  <p className="text-neutral-200 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-purple-400 shrink-0" /> {selectedCompany.address}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold block mb-1">CONTATO / WHATSAPP</span>
                  <p className="text-neutral-200 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> {selectedCompany.phone}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold block mb-1">AVALIAÇÕES GOOGLE</span>
                  <p className="text-neutral-200 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                    {selectedCompany.rating === null ? 'Sem avaliação capturada' : selectedCompany.rating.toFixed(1)} ({selectedCompany.reviewsCount === null ? 'contagem indisponível' : `${selectedCompany.reviewsCount} avaliações`})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold block mb-1">DIAGNÓSTICO DIGITAL</span>
                  <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/40 text-purple-300 font-medium">
                    {selectedCompany.digitalDiagnosis.replace('_', ' ')} (Oportunidade {selectedCompany.opportunity})
                  </span>
                </div>
              </div>

              {/* SELEÇÃO DO MODELO DE SITE PARA A PROPOSTA */}
              <div className="bg-[#171b23] p-5 rounded-2xl border border-[#202530] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Modelo de Site Selecionado</h4>
                    <p className="text-[11px] text-neutral-400">Escolha qual dos 5 modelos oficiais da plataforma apresentar na proposta:</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-purple-400" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {SITE_TEMPLATES_LIST.map((tmpl) => {
                    const isSelected = normalizeTemplateId(selectedCompany.selectedTemplate) === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleTemplateChange(selectedCompany.id, tmpl.id)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-md ring-1 ring-purple-500'
                            : 'border-[#2d3443] bg-[#12151b] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-white flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: tmpl.primaryColor }}
                            />
                            {tmpl.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
                              Ativo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-1.5 line-clamp-1">
                          {tmpl.tagline}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ESTÁGIO NO CRM */}
              <div className="flex items-center justify-between bg-[#171b23] p-4 rounded-2xl border border-[#202530]">
                <div>
                  <span className="font-bold text-white block">Estágio no Funil CRM</span>
                  <span className="text-[11px] text-neutral-400">Atualize o progresso da negociação</span>
                </div>

                <select
                  value={selectedCompany.stage}
                  onChange={(e) => handleStageChange(selectedCompany.id, e.target.value as LeadStage)}
                  className="px-3 py-2 rounded-xl bg-[#12151b] border border-[#2d3443] text-neutral-100 font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="novo">Novo</option>
                  <option value="contatado">Contatado</option>
                  <option value="respondeu">Respondeu</option>
                  <option value="reuniao">Reunião</option>
                  <option value="fechado">Fechado</option>
                </select>
              </div>

              {/* AÇÕES DE PROPOSTA */}
              <div className="space-y-3">
                <h4 className="font-bold text-white">Abordagem Comercial</h4>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={getWhatsAppProposalMessage(selectedCompany)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition text-center shadow-lg shadow-emerald-900/20"
                  >
                    <MessageCircle className="h-4 w-4" /> Enviar Proposta via WhatsApp
                  </a>

                  <a
                    href={getProposalUrl(selectedCompany)}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-2 transition text-center"
                  >
                    <Globe className="h-4 w-4" /> {selectedCompany.demoUrl ? 'Abrir demonstração publicada' : 'Abrir prévia local'}
                  </a>
                </div>

                <div className="p-3 bg-[#171b23] rounded-xl border border-[#202530] flex items-center justify-between text-xs">
                  <span className="text-neutral-400 truncate max-w-sm">
                    {getProposalUrl(selectedCompany)}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getProposalUrl(selectedCompany));
                      setProposalCopied(true);
                      setTimeout(() => setProposalCopied(false), 2000);
                    }}
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 shrink-0 ml-2"
                  >
                    {proposalCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                    {proposalCopied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
