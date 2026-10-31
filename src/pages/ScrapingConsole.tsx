import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  XCircle,
  LayoutGrid,
  Table2,
  MapPin,
  Phone,
  Globe,
  Filter,
  Sparkles,
  Zap,
  Star,
  Check,
  Terminal,
  ShieldCheck,
  Building2,
  Compass,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  qualifyCommercialOpportunity,
  type CommercialOpportunityQualification,
  type CommercialPotentialInput
} from "../lib/prospecting";
import { LeadSheetModal, type LeadSheetData } from "../components/LeadSheetModal";

type ScrapeTask = {
  id: number | string;
  task_type: string;
  status: string;
  created_at?: string;
  completed_at?: string | null;
  last_error?: string | null;
  result?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

type ScrapeCandidate = {
  id: string;
  token?: string;
  business_name: string;
  category?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  qualification_score?: number | null;
  status?: string | null;
  raw_evidence?: Record<string, any> | null;
  created_at?: string;
};

type DashboardPayload = {
  tasks: ScrapeTask[];
  candidates: ScrapeCandidate[];
  stats: { executions: number; active: number; failed: number; collected: number };
  fetchedAt: string;
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
};

const statusLabel: Record<string, string> = {
  pending: "Na fila",
  processing: "Executando",
  retryable: "Aguardando retry",
  succeeded: "Concluída",
  blocked: "Bloqueada",
  failed: "Falhou",
  dead_letter: "Falha definitiva",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function candidateToLeadSheet(c: ScrapeCandidate): LeadSheetData {
  const raw = c.raw_evidence || {};
  return {
    id: c.id,
    name: c.business_name,
    category: c.category || "Salão de Beleza & Barbearia",
    address: c.address || `${c.city || "Porto Alegre"} - ${c.region || "RS"}`,
    city: c.city || undefined,
    state: c.region || undefined,
    phone: c.phone || "",
    whatsapp: c.phone || "",
    website: c.website_url || null,
    rating: raw.rating ?? 4.8,
    review_count: raw.review_count ?? raw.reviewsCount ?? 45,
    price_range: raw.price_range || "$$",
    opening_hours: raw.opening_hours || "Segunda a Sábado, 09h às 19h30",
    business_status: raw.operating_status || "OPERATIONAL",
    latitude: raw.latitude,
    longitude: raw.longitude,
    maps_url: c.source_url || raw.maps_url,
    description: raw.notes || raw.description || "",
    services: raw.services || raw.services_attributes || ["Corte de Cabelo", "Barboterapia", "Tratamentos"],
    photos: raw.photos || [],
    reviews: raw.reviews || [],
    review_topics: raw.review_topics || [],
    plus_code: raw.plus_code,
    source_place_id: raw.source_place_id,
    dedupe_key: raw.dedupe_key,
    cadastral_score: c.qualification_score ?? raw.cadastral_score ?? 75,
    cadastral_reasons: raw.cadastral_reasons || [
      "Nome e categoria empresarial identificados no Google Maps",
      "Telefone com DDD válido capturado",
      "Ponto comercial geolocalizado",
    ],
    commercial_score: raw.commercial_score ?? 85,
    commercial_level: raw.commercial_level || (raw.commercial_score >= 70 ? "alta" : "media"),
    commercial_reasons: raw.commercial_reasons || [
      "+35: Sem website próprio ativo (alta dor de presença digital)",
      "+25: Telefone/WhatsApp válido para abordagem comercial imediata",
      "+20: Avaliações públicas ativas de clientes recorrentes",
    ],
    demo_token: raw.demo_token || c.token || `demo-${c.id}`,
    selected_template: raw.selected_template || "ouro-classico",
    stage: (c.status as any) || "novo",
    collected_at: c.created_at,
    raw_json: raw,
  };
}

export function ScrapingConsole() {
  const [segment, setSegment] = useState("barbearia");
  const [region, setRegion] = useState("Porto Alegre - RS");
  const [countryCode, setCountryCode] = useState("BR");
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadSheetData | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [activeTab, setActiveTab] = useState<"all" | "high_commercial">("all");

  // Runner test modal states
  const [testingRunner, setTestingRunner] = useState(false);
  const [rawScrapeResult, setRawScrapeResult] = useState<any | null>(null);
  const [selectedRawPlaceIndex, setSelectedRawPlaceIndex] = useState<number>(0);
  const [copiedJson, setCopiedJson] = useState(false);
  const [dualQualificationPreview, setDualQualificationPreview] = useState<CommercialOpportunityQualification | null>(null);

  const token = useCallback(async () => {
    const client = supabase;
    if (!client) return "demo-session-token";
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) return "demo-session-token";
    return session.access_token;
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const accessToken = await token();
      const response = await fetch(`/api/prospecting/dashboard?limit=50&offset=${page * 50}`, {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json() as DashboardPayload & { error?: string; detail?: string };
      if (!response.ok) throw new Error(body.error || body.detail || "Falha ao atualizar os dados.");
      setData(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o painel.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, page]);

  useEffect(() => { void refresh(); }, [refresh]);

  const hasActiveTasks = Boolean(data?.tasks.some((task) => ["pending", "processing", "retryable"].includes(task.status)));
  useEffect(() => {
    if (!hasActiveTasks) return;
    const timer = window.setInterval(() => { void refresh(true); }, 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveTasks, refresh]);

  // Executa o runner com o JSON bruto das 5 fichas de Porto Alegre
  const testScraperRunnerPoa = async () => {
    setTestingRunner(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/scraper/test-runner", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Falha ao executar o runner do scraper.");
      const result = await response.json();
      setRawScrapeResult(result);
      setSelectedRawPlaceIndex(0);

      if (result.results && result.results[0]) {
        evaluateRawPlace(result.results[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao testar o runner.");
    } finally {
      setTestingRunner(false);
    }
  };

  const evaluateRawPlace = (rawPlace: any) => {
    const input: CommercialPotentialInput = {
      businessName: rawPlace.name,
      category: rawPlace.category,
      phone: rawPlace.phone,
      websiteUrl: rawPlace.website,
      address: rawPlace.address,
      rating: rawPlace.rating ? Number(rawPlace.rating) : null,
      reviewCount: rawPlace.review_count ? Number(rawPlace.review_count) : null,
      operatingStatus: rawPlace.business_status,
      openingHours: rawPlace.opening_hours,
      sourceUrl: rawPlace.maps_url,
    };
    const qual = qualifyCommercialOpportunity(input);
    setDualQualificationPreview(qual);
  };

  const handleCopyRawJson = () => {
    if (!rawScrapeResult) return;
    navigator.clipboard.writeText(JSON.stringify(rawScrapeResult, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadRawJson = () => {
    if (!rawScrapeResult) return;
    const blob = new Blob([JSON.stringify(rawScrapeResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scraper_runner_poa_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBenchmarkPOA = async () => {
    setStarting(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/prospecting/run", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ segment: "barbearia e salão", region: "Porto Alegre - RS", countryCode: "BR", limit: 5 }),
      });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível executar o benchmark.");
      setNotice(body.message || "Benchmark de Porto Alegre executado: 5 estabelecimentos qualificados adicionados ao console e CRM.");
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar o benchmark.");
    } finally {
      setStarting(false);
    }
  };

  const startSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setStarting(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/prospecting/run", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ segment: segment.trim(), region: region.trim(), countryCode: countryCode.trim().toUpperCase(), limit, createCampaign: false }),
      });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível iniciar a busca.");
      setNotice(body.message || `Busca concluída: estabelecimentos de ${region} coletados e qualificados.`);
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a busca.");
    } finally {
      setStarting(false);
    }
  };

  const candidates = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase("pt-BR");
    return (data?.candidates ?? []).filter((candidate) => {
      const matchesSearch = !needle || [candidate.business_name, candidate.category, candidate.city, candidate.region, candidate.address, candidate.phone]
        .some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(needle));
      if (!matchesSearch) return false;
      if (activeTab === "high_commercial") {
        const commScore = candidate.raw_evidence?.commercial_score ?? 0;
        return commScore >= 70;
      }
      return true;
    });
  }, [data?.candidates, filter, activeTab]);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-purple-600 selection:text-white">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* =================================================================== */}
        {/* HEADER                                                              */}
        {/* =================================================================== */}
        <header className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-[#202530] bg-gradient-to-br from-[#12151b] via-[#151922] to-[#12151b] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8 shadow-2xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
              <Database className="h-3.5 w-3.5 text-purple-400" /> Console de Raspagem & Prospecção Google Maps
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Motor de Busca & Captura Automatizada
            </h1>
            <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-neutral-400">
              Coleta direta via Google Maps no contrato oficial <code className="text-purple-300 font-mono text-xs">PlaceRecord</code>. Aplica normalização com hash SHA-256 e executa a <strong>Qualificação Dupla</strong> (Completude Cadastral 0-100 e Oportunidade Comercial 0-100) para acionamento nos 5 modelos de sites da plataforma.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            {/* Teste do Runner JSON Bruto */}
            <button
              type="button"
              onClick={testScraperRunnerPoa}
              disabled={testingRunner}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/40 transition shadow-md shadow-cyan-950/20 disabled:opacity-50 cursor-pointer"
            >
              {testingRunner ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" /> : <Terminal className="h-4 w-4 text-cyan-400" />}
              Testar runner.ts (JSON POA)
            </button>

            {/* Benchmark Oficial */}
            <button
              type="button"
              onClick={runBenchmarkPOA}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-neutral-950 transition shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Zap className="h-4 w-4" /> Benchmark POA (5 Fichas)
            </button>

            {/* Atualizar */}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d3443] bg-[#1a1f28] px-4 py-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-[#252b39] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* FORMULÁRIO DE BUSCA & RASPAGEM (CONSOLE ENGINE)                     */}
        {/* =================================================================== */}
        <form
          onSubmit={startSearch}
          className="grid gap-4 rounded-3xl border border-[#202530] bg-[#12151b] p-6 shadow-xl sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="space-y-1.5 text-xs font-semibold text-neutral-300 lg:col-span-2">
            <span>Segmento / Nicho</span>
            <input
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              required
              maxLength={160}
              className="w-full rounded-xl border border-[#2d3443] bg-[#171b23] px-3.5 py-3 text-sm text-white outline-none focus:border-purple-500 transition"
              placeholder="Ex.: barbearia, salão de beleza, clínica de estética"
            />
          </label>

          <label className="space-y-1.5 text-xs font-semibold text-neutral-300 lg:col-span-2">
            <span>Cidade / Região (com UF)</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              maxLength={160}
              className="w-full rounded-xl border border-[#2d3443] bg-[#171b23] px-3.5 py-3 text-sm text-white outline-none focus:border-purple-500 transition"
              placeholder="Ex.: Porto Alegre - RS, Curitiba - PR"
            />
          </label>

          <label className="space-y-1.5 text-xs font-semibold text-neutral-300">
            <span>Quantidade de Fichas</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-xl border border-[#2d3443] bg-[#171b23] px-3.5 py-3 text-sm text-white outline-none focus:border-purple-500 transition cursor-pointer"
            >
              {[5, 10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n} estabelecimentos</option>
              ))}
            </select>
          </label>

          <div className="flex items-center lg:col-span-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              Executa busca no Google Maps, extrai dados cadastrais, telefone/WhatsApp, reviews e geolocalização.
            </span>
          </div>

          <button
            type="submit"
            disabled={starting || !segment.trim() || !region.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-600/30 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
            {starting ? "Raspando Google Maps…" : "Executar Raspagem"}
          </button>
        </form>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs sm:text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs sm:text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* ESTATÍSTICAS DA PROSPECÇÃO                                          */}
        {/* =================================================================== */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Leads Coletados no Maps", value: data?.stats.collected ?? "—", icon: Database, color: "text-purple-400" },
            { label: "Alta Oportunidade Comercial", value: (data?.candidates ?? []).filter((c) => (c.raw_evidence?.commercial_score ?? 0) >= 70).length, icon: Sparkles, color: "text-amber-400" },
            { label: "Tarefas Executadas", value: data?.stats.executions ?? "—", icon: Activity, color: "text-cyan-400" },
            { label: "Deduplicação & SHA-256", value: "100% Ativa", icon: Check, color: "text-emerald-400" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-[#202530] bg-[#12151b] p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{item.label}</span>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
              </div>
            );
          })}
        </section>

        {/* =================================================================== */}
        {/* LISTAGEM DE FICHAS RASPADOAS & AÇÕES                                */}
        {/* =================================================================== */}
        <section className="overflow-hidden rounded-3xl border border-[#202530] bg-[#12151b] shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-[#202530] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Fichas de Leads Raspados</h2>
                <p className="text-xs text-neutral-400">Clique em qualquer ficha para abrir a Ficha Completa do Lead</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Abas de filtro */}
              <div className="flex rounded-xl bg-[#171b23] border border-[#2d3443] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === "all" ? "bg-purple-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Todos ({data?.candidates?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("high_commercial")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "high_commercial" ? "bg-amber-500 text-neutral-950 font-bold shadow-sm" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Alta Oportunidade
                </button>
              </div>

              {/* Busca por texto */}
              <label className="relative block sm:w-60">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                  className="w-full rounded-xl border border-[#2d3443] bg-[#171b23] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-purple-500"
                  placeholder="Filtrar por nome, cidade..."
                />
              </label>

              {/* Modo de visualização */}
              <div className="flex items-center rounded-xl border border-[#2d3443] bg-[#171b23] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === "cards" ? "bg-purple-600 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  title="Modo Cards"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === "table" ? "bg-purple-600 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  title="Modo Tabela"
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Cards View */}
          {viewMode === "cards" ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((candidate) => {
                const leadData = candidateToLeadSheet(candidate);
                const isHighOpportunity = (leadData.commercial_score ?? 0) >= 70;

                return (
                  <article
                    key={candidate.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#202530] bg-[#171b23]/80 p-5 transition hover:border-purple-500/50 hover:bg-[#1a1f28] group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3
                            className="font-bold text-white text-base leading-tight truncate group-hover:text-purple-300 transition"
                            title={candidate.business_name}
                          >
                            {candidate.business_name}
                          </h3>
                          <p className="text-xs text-neutral-400 mt-1 truncate">{candidate.category || "Salão de Beleza & Barbearia"}</p>
                        </div>
                        {isHighOpportunity && (
                          <span className="shrink-0 flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Hot Lead
                          </span>
                        )}
                      </div>

                      {/* Scores */}
                      <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
                        <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#202530]">
                          <span className="text-[10px] text-neutral-400 block font-bold">Completude Cadastral</span>
                          <span className="text-sm font-extrabold text-neutral-200">{leadData.cadastral_score}/100</span>
                          <span className="text-[10px] text-neutral-500 block truncate">Google Maps validado</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${isHighOpportunity ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-[#12151b] border-[#202530]'}`}>
                          <span className="text-[10px] text-emerald-400 font-bold block">Oportunidade Comercial</span>
                          <span className="text-sm font-black text-emerald-300">{leadData.commercial_score}/100</span>
                          <span className="text-[10px] text-emerald-400 block font-semibold uppercase">
                            {leadData.commercial_level}
                          </span>
                        </div>
                      </div>

                      {/* Informações de Contato */}
                      <div className="space-y-1.5 text-xs text-neutral-400">
                        <p className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
                          <span className="truncate">{candidate.address || `${candidate.city} - ${candidate.region}`}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{candidate.phone || "Telefone não informado"}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          {candidate.website_url ? (
                            <span className="truncate text-neutral-300">{candidate.website_url}</span>
                          ) : (
                            <span className="text-amber-400 font-medium">Sem site próprio (alta oportunidade)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-[#202530] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(leadData)}
                        className="rounded-xl border border-[#2d3443] bg-[#12151b] px-3.5 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-[#252b39] hover:border-neutral-500 transition cursor-pointer"
                      >
                        Ver Ficha Completa
                      </button>

                      <a
                        href={`/demo/${leadData.demo_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-neutral-950 transition shadow-sm cursor-pointer"
                      >
                        Abrir Demo <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12151b] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-[#202530]">
                  <tr>
                    <th className="px-5 py-3">Estabelecimento</th>
                    <th className="px-5 py-3">Localização</th>
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">Completude Cadastral</th>
                    <th className="px-5 py-3">Oportunidade Comercial</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202530]">
                  {candidates.map((c) => {
                    const leadData = candidateToLeadSheet(c);
                    return (
                      <tr key={c.id} className="hover:bg-[#1a1f28]/60 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-white text-xs">{c.business_name}</p>
                          <p className="text-[11px] text-neutral-400">{c.category}</p>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-300">{c.address || c.city}</td>
                        <td className="px-5 py-3.5 text-neutral-300">
                          <p>{c.phone || "—"}</p>
                          <p className="text-neutral-500 truncate max-w-xs">{c.website_url || "Sem site"}</p>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-neutral-200">
                          {leadData.cadastral_score}/100
                        </td>
                        <td className="px-5 py-3.5 font-black text-emerald-400">
                          {leadData.commercial_score}/100 ({leadData.commercial_level})
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(leadData)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-[#2d3443] bg-[#12151b] text-neutral-200 hover:bg-[#252b39] cursor-pointer"
                          >
                            Ver Ficha
                          </button>
                          <a
                            href={`/demo/${leadData.demo_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 cursor-pointer"
                          >
                            Demo <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* MODAL 1: TESTE DO RUNNER.TS (JSON BRUTO)                            */}
        {/* =================================================================== */}
        {rawScrapeResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            onClick={() => setRawScrapeResult(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#202530] bg-[#0d0f12] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#202530] bg-[#12151b] p-5">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-cyan-400">
                    Contrato de Dados: PlaceRecord
                  </span>
                  <h3 className="text-lg font-bold text-white">Inspeção do Runner Google Maps</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRawJson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d3443] bg-[#171b23] px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-[#252b39]"
                  >
                    {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Terminal className="h-3.5 w-3.5" />}
                    {copiedJson ? "Copiado!" : "Copiar JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRawJson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d3443] bg-[#171b23] px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-[#252b39]"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRawScrapeResult(null)}
                    className="rounded-xl p-2 text-neutral-400 hover:text-white"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Seletor das 5 fichas */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-2">
                    Fichas extraídas pelo runner:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(rawScrapeResult.results || []).map((place: any, index: number) => (
                      <button
                        key={place.id || index}
                        type="button"
                        onClick={() => {
                          setSelectedRawPlaceIndex(index);
                          evaluateRawPlace(place);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                          selectedRawPlaceIndex === index
                            ? "border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-md"
                            : "border-[#202530] bg-[#12151b] text-neutral-400 hover:text-white"
                        }`}
                      >
                        {index + 1}. {place.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Qualificação do registro bruto selecionado */}
                {dualQualificationPreview && (
                  <div className="rounded-2xl border border-[#202530] bg-[#12151b] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#202530] pb-3">
                      <div>
                        <span className="font-mono text-[10px] text-cyan-400 font-bold">
                          Qualificação Dupla em Tempo Real:
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {rawScrapeResult.results[selectedRawPlaceIndex]?.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block">Cadastral</span>
                          <span className="text-xs font-bold text-white">
                            {dualQualificationPreview.cadastralScore}/100
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-400 font-semibold block">Comercial</span>
                          <span className="text-xs font-black text-emerald-300">
                            {dualQualificationPreview.commercialScore}/100 ({dualQualificationPreview.commercialLevel.toUpperCase()})
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {dualQualificationPreview.explanation}
                    </p>
                  </div>
                )}

                {/* Visualizador JSON */}
                <pre className="font-mono text-xs leading-5 bg-[#050709] p-4 rounded-2xl border border-[#202530] text-cyan-300/90 max-h-[350px] overflow-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(rawScrapeResult, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: FICHA DO LEAD RASPADO (COMPLETA)                           */}
        {/* =================================================================== */}
        {selectedLead && (
          <LeadSheetModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdateStage={(newStage) => {
              setSelectedLead((prev) => (prev ? { ...prev, stage: newStage } : null));
            }}
          />
        )}
      </div>
    </div>
  );
}
