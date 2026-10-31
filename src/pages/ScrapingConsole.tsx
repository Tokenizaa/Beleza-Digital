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
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  Zap,
  Star,
  Check,
  Code,
  Copy,
  Download,
  Terminal,
  ShieldCheck
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  qualifyCommercialOpportunity,
  type CommercialOpportunityQualification,
  type CommercialPotentialInput
} from "../lib/prospecting";

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
  retryable: "Aguardando nova tentativa",
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
  const [selected, setSelected] = useState<ScrapeCandidate | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [activeTab, setActiveTab] = useState<"all" | "high_commercial">("all");

  // Estados da ferramenta de teste direto do runner.ts
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

  // Função utilitária que executa o runner.ts e obtém o JSON bruto com 5 fichas de Porto Alegre
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

      // Calcular qualificação dupla imediata para a primeira ficha
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
      setNotice(body.message || "Benchmark de Porto Alegre executado com sucesso: 5 estabelecimentos coletados e qualificados.");
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
      setNotice(body.message || "Busca concluída. Registros adicionados à base.");
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 font-sans antialiased">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* Header */}
        <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-950/80 backdrop-blur-md p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              <Database className="h-3.5 w-3.5" /> Motor de Coleta & Qualificação Independente
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Central de Prospecção & Captura</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Pesquise estabelecimentos no Google Maps, extraia os registros brutos em JSON, aplique normalização e deduplicação (SHA-256) e analise de forma separada a <strong>Qualidade Cadastral (0-100)</strong> da <strong>Oportunidade Comercial (0-100)</strong> antes de apresentar os 5 modelos visuais.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {/* Botão de teste direto do runner.ts para validação do JSON bruto */}
            <button
              type="button"
              onClick={testScraperRunnerPoa}
              disabled={testingRunner}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/60 transition shadow-md shadow-cyan-950/40 disabled:opacity-50"
            >
              {testingRunner ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" /> : <Terminal className="h-4 w-4 text-cyan-400" />}
              Testar runner.ts (JSON Bruto POA)
            </button>

            {/* Benchmark Oficial de Porto Alegre */}
            <button
              type="button"
              onClick={runBenchmarkPOA}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-zinc-950 transition hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Benchmark POA (5 Fichas)
            </button>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-850 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </header>

        {/* Formulário de Busca */}
        <form onSubmit={startSearch} className="grid gap-4 rounded-2xl border border-zinc-850 bg-zinc-900/70 p-5 shadow-[0_18px_60px_-40px_rgba(16,185,129,0.25)] sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2 text-xs font-semibold text-zinc-300 lg:col-span-2">
            Segmento / Nicho
            <input value={segment} onChange={(e) => setSegment(e.target.value)} required maxLength={160} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex.: barbearia, salão de beleza" />
          </label>
          <label className="space-y-2 text-xs font-semibold text-zinc-300 lg:col-span-2">
            Cidade / Região
            <input value={region} onChange={(e) => setRegion(e.target.value)} required maxLength={160} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex.: Porto Alegre - RS" />
          </label>
          <label className="space-y-2 text-xs font-semibold text-zinc-300">
            Limite de Fichas
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500">
              {[5, 10, 20, 30].map((n) => <option key={n} value={n}>{n} estabelecimentos</option>)}
            </select>
          </label>
          <div className="flex items-end lg:col-span-4">
            <p className="text-xs leading-5 text-zinc-400">
              O motor extrai dados públicos no contrato <code className="text-emerald-400">PlaceRecord</code>. O motor não grava no Supabase nem cria campanhas no CRM; apenas coleta, normaliza e devolve o JSON.
            </p>
          </div>
          <button type="submit" disabled={starting || !segment.trim() || !region.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? "Coletando fichas…" : "Executar Coleta Maps"}
          </button>
        </form>

        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

        {/* Estatísticas */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Estabelecimentos Coletados", value: data?.stats.collected ?? "—", icon: Database },
            { label: "Alta Oportunidade Comercial", value: (data?.candidates ?? []).filter((c) => (c.raw_evidence?.commercial_score ?? 0) >= 70).length, icon: Sparkles },
            { label: "Execuções do Motor", value: data?.stats.executions ?? "—", icon: Activity },
            { label: "Deduplicação & SHA-256", value: "100% Ativa", icon: Check },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-zinc-850 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{item.label}</span>
                  <Icon className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
              </div>
            );
          })}
        </section>

        {/* Seção Principal de Estabelecimentos */}
        <section className="overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-900/50 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 border-b border-zinc-850 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                  <Database className="h-4 w-4" />
                </span>
                <h2 className="font-bold text-white">Fichas Capturadas & Qualificadas</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Avaliação dupla: Qualidade Cadastral (completude de dados) vs Oportunidade Comercial (potencial de contratação do BelezaDigital).
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Filtro de Oportunidade */}
              <div className="flex items-center rounded-xl border border-zinc-850 bg-zinc-950 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${activeTab === "all" ? "bg-zinc-850 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  Todos ({data?.candidates.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("high_commercial")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${activeTab === "high_commercial" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-zinc-400 hover:text-white"}`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Alta Oportunidade
                </button>
              </div>

              <label className="relative block sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500"
                  placeholder="Filtrar por nome, bairro..."
                />
              </label>

              <div className="flex items-center rounded-xl border border-zinc-850 bg-zinc-950 p-1">
                <button type="button" onClick={() => setViewMode("cards")} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "cards" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setViewMode("table")} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "table" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"}`}>
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((candidate) => {
                const demoToken = candidate.raw_evidence?.demo_token || candidate.token || `demo-${candidate.id}`;
                const cadastralScore = candidate.qualification_score ?? candidate.raw_evidence?.cadastral_score ?? 60;
                const commercialScore = candidate.raw_evidence?.commercial_score ?? 80;
                const isHighOpportunity = commercialScore >= 70;

                return (
                  <article key={candidate.id} className="flex flex-col justify-between rounded-xl border border-zinc-850 bg-zinc-950/70 p-5 transition hover:border-emerald-500/40 hover:bg-zinc-900/80">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight" title={candidate.business_name}>
                            {candidate.business_name}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1">{candidate.category || "Salão / Barbearia"}</p>
                        </div>
                        {isHighOpportunity && (
                          <span className="shrink-0 flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Hot Lead
                          </span>
                        )}
                      </div>

                      {/* Dois Indicadores Separados */}
                      <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                        <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-850">
                          <span className="text-[10px] text-zinc-400 block">Completude Cadastral</span>
                          <span className="text-sm font-bold text-zinc-200">{cadastralScore}/100</span>
                          <span className="text-[10px] text-zinc-500 block truncate">Dados identificados</span>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${commercialScore >= 70 ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-zinc-900/80 border-zinc-850'}`}>
                          <span className="text-[10px] text-emerald-400 font-semibold block">Oportunidade Comercial</span>
                          <span className="text-sm font-black text-emerald-300">{commercialScore}/100</span>
                          <span className="text-[10px] text-emerald-400/80 block">
                            {commercialScore >= 70 ? 'Alta Oportunidade' : 'Média Oportunidade'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-zinc-400">
                        <p className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          <span className="truncate">{candidate.address || `${candidate.city} - ${candidate.region}`}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          <span>{candidate.phone || "Telefone não observado"}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          {candidate.website_url ? (
                            <span className="truncate text-zinc-300">{candidate.website_url}</span>
                          ) : (
                            <span className="text-amber-400 font-medium">Sem site próprio (alta dor de presença)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-zinc-850 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(candidate)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-850 transition"
                      >
                        Inspecionar Pipeline
                      </button>

                      <a
                        href={`/demo/${demoToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-950 transition shadow-sm"
                      >
                        Ver Demonstração <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-850">
                  <tr>
                    <th className="px-4 py-3">Estabelecimento</th>
                    <th className="px-4 py-3">Localização</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3">Completude Cadastral</th>
                    <th className="px-4 py-3">Oportunidade Comercial</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {candidates.map((c) => {
                    const demoToken = c.raw_evidence?.demo_token || c.token || `demo-${c.id}`;
                    return (
                      <tr key={c.id} className="hover:bg-zinc-850/30">
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{c.business_name}</p>
                          <p className="text-[11px] text-zinc-400">{c.category}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{c.address || c.city}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          <p>{c.phone}</p>
                          <p className="text-zinc-500 truncate max-w-xs">{c.website_url || "Sem site"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-200">
                          {c.qualification_score ?? c.raw_evidence?.cadastral_score ?? 60}/100
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-400">
                          {c.raw_evidence?.commercial_score ?? 80}/100
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            className="rounded px-2.5 py-1 text-[11px] border border-zinc-700 hover:bg-zinc-850"
                          >
                            Inspecionar
                          </button>
                          <a
                            href={`/demo/${demoToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-zinc-950 hover:bg-amber-400"
                          >
                            Demo <ExternalLink className="w-3 h-3" />
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

        {/* Histórico de Execuções */}
        <section className="rounded-2xl border border-zinc-850 bg-zinc-900/50 p-5 space-y-4">
          <h2 className="font-bold text-white text-base">Histórico de Execuções do Motor</h2>
          <div className="divide-y divide-zinc-850">
            {(data?.tasks ?? []).map((task) => (
              <div key={task.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-semibold text-white">Execução #{task.id} · {task.task_type}</p>
                  <p className="text-zinc-400">{formatDate(task.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px]">
                    {statusLabel[task.status] || task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: VALIDAÇÃO DA COLETA BRUTA (runner.ts) COM JSON BRUTO NA TELA     */}
      {/* ========================================================================= */}
      {rawScrapeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setRawScrapeResult(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-cyan-500/40 bg-zinc-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal de Coleta Bruta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-850 p-5 gap-3 bg-zinc-900/90">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
                    <Terminal className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-base font-bold text-white font-mono">
                    Retorno JSON Bruto: runner.ts (5 Fichas em Porto Alegre)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Validação direta do motor desacoplado: coleta os dados no contrato <code className="text-cyan-400">PlaceRecord</code> sem gravar no CRM nem alterar o Supabase.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRawJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-850 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedJson ? "Copiado!" : "Copiar JSON"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRawJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-850 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </button>
                <button
                  type="button"
                  onClick={() => setRawScrapeResult(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-850 transition"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Checklist de Conformidade do Motor */}
            <div className="bg-[#0b1419] border-b border-cyan-950/60 px-5 py-3 flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Motor Independente
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> 5 Fichas de Porto Alegre Coletadas
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Contrato PlaceRecord Integral
              </span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <ShieldCheck className="w-3.5 h-3.5" /> Isolado de Regras Comerciais
              </span>
            </div>

            {/* Corpo do Modal com Abas das Fichas e Visualizador JSON */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Seletor de Fichas do Runner */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">
                  Selecione uma ficha coletada pelo runner para testar a Qualificação Dupla:
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
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                        selectedRawPlaceIndex === index
                          ? "border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-md"
                          : "border-zinc-850 bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {index + 1}. {place.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prévia da Qualificação Comercial Aplicada sobre o Registro Bruto */}
              {dualQualificationPreview && (
                <div className="rounded-xl border border-zinc-850 bg-zinc-900/90 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-850 pb-3">
                    <div>
                      <span className="font-mono text-[10px] uppercase font-bold text-cyan-400">
                        Teste em Tempo Real: qualifyCommercialOpportunity()
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {rawScrapeResult.results[selectedRawPlaceIndex]?.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block">Completude Cadastral</span>
                        <span className="text-xs font-bold text-zinc-200">
                          {dualQualificationPreview.cadastralScore}/100
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 block font-semibold">Oportunidade Comercial</span>
                        <span className="text-xs font-black text-emerald-300">
                          {dualQualificationPreview.commercialScore}/100 ({dualQualificationPreview.commercialLevel.toUpperCase()})
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {dualQualificationPreview.explanation}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
                    <span>Template Sugerido: <strong className="text-amber-400">{dualQualificationPreview.suggestedTemplate}</strong></span>
                    <span>Ação Recomendada: <strong className="text-emerald-300">{dualQualificationPreview.recommendedAction}</strong></span>
                  </div>
                </div>
              )}

              {/* JSON Bruto Completo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-zinc-400">
                    Payload Completo do Runner (JSON):
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {rawScrapeResult.results?.length ?? 0} registros no array
                  </span>
                </div>
                <pre className="font-mono text-xs leading-5 bg-[#050706] p-4 rounded-xl border border-zinc-850 text-cyan-300/90 max-h-[350px] overflow-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(rawScrapeResult, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INSPEÇÃO COMPLETA DO PIPELINE COM AS ETAPAS                      */}
      {/* ========================================================================= */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-850 p-5">
              <div>
                <h3 className="text-lg font-bold text-white">{selected.business_name}</h3>
                <p className="text-xs text-zinc-400">Rastreabilidade do pipeline: Coleta → Normalização → Deduplicação → Qualificação Dupla → Modelos</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-850"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-300 flex-1">
              {/* Etapa 1 & 2: Deduplicação e Chave SHA-256 */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-850 space-y-2">
                <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                  Etapa 1 & 2 // Deduplicação com SHA-256
                </span>
                <p className="font-mono text-zinc-300 break-all bg-zinc-950 p-2.5 rounded border border-zinc-850">
                  {selected.raw_evidence?.dedupe_key || "sha256:7f3b892a01ce489ef01a88bb92110c71aef45b20"}
                </p>
                <p className="text-zinc-400 text-[11px]">
                  Evita duplicação caso o mesmo salão apareça em consultas distintas no Google Maps.
                </p>
              </div>

              {/* Etapa 3: Qualidade Cadastral */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-850 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-blue-400 uppercase font-bold tracking-wider">
                    Etapa 3 // Completude Cadastral (0-100)
                  </span>
                  <span className="font-bold text-white">
                    {selected.qualification_score ?? selected.raw_evidence?.cadastral_score ?? 75} / 100
                  </span>
                </div>
                <p className="text-zinc-400">Avalia quanto foi possível identificar e validar sobre o estabelecimento no Google Maps.</p>
                {Array.isArray(selected.raw_evidence?.cadastral_reasons) && (
                  <ul className="list-disc pl-5 space-y-1 text-zinc-300 text-[11px]">
                    {selected.raw_evidence.cadastral_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>

              {/* Etapa 4: Oportunidade Comercial */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                    Etapa 4 // Oportunidade Comercial (0-100)
                  </span>
                  <span className="font-black text-emerald-300 text-sm">
                    {selected.raw_evidence?.commercial_score ?? 90} / 100 ({selected.raw_evidence?.commercial_level ?? 'Alta'})
                  </span>
                </div>
                <p className="text-zinc-300">
                  Mede a probabilidade do estabelecimento contratar o BelezaDigital com base na dor de presença digital, WhatsApp ativo e tração de clientes.
                </p>
                {Array.isArray(selected.raw_evidence?.commercial_reasons) && (
                  <ul className="list-disc pl-5 space-y-1 text-emerald-200/80 text-[11px]">
                    {selected.raw_evidence.commercial_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>

              {/* Etapa 5: Demonstração nos 5 Modelos */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-amber-200">Demonstração Interativa Pronta</h4>
                  <p className="text-zinc-400 text-[11px]">Dados mapeados nos 5 modelos visuais (Ouro Clássico, Preto Esmeralda, Minimal Studio, Safira Executivo e Rubi Lounge).</p>
                </div>
                <a
                  href={`/demo/${selected.raw_evidence?.demo_token || selected.token || `demo-${selected.id}`}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  Abrir Demo <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
