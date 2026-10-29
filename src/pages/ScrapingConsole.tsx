import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, Database, ExternalLink, LoaderCircle, Play, RefreshCw, Search, XCircle, LayoutGrid, Table2, MapPin, Phone, Globe, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { supabase } from "../lib/supabase";

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
  business_name: string;
  category?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  description?: string | null;
  provider?: string | null;
  provider_record_id?: string | null;
  qualification_score?: number | null;
  qualification_reasons?: unknown[] | null;
  missing_fields?: unknown[] | null;
  status?: string | null;
  raw_evidence?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
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

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function evidenceValue(candidate: ScrapeCandidate, keys: string[]): unknown {
  const evidence = candidate.raw_evidence ?? {};
  const mapsFields = evidence.mapsScrapeFields && typeof evidence.mapsScrapeFields === "object"
    ? evidence.mapsScrapeFields as Record<string, unknown> : {};
  for (const key of keys) {
    if (evidence[key] !== undefined && evidence[key] !== null && evidence[key] !== "") return evidence[key];
    if (mapsFields[key] !== undefined && mapsFields[key] !== null && mapsFields[key] !== "") return mapsFields[key];
  }
  return null;
}

function displayEvidence(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Não observado nesta captura";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayEvidence).join(" · ");
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function candidateMedia(candidate: ScrapeCandidate): Array<{ url: string; title: string; type: string }> {
  const evidence = candidate.raw_evidence ?? {};
  const mapsFields = evidence.mapsScrapeFields && typeof evidence.mapsScrapeFields === "object"
    ? evidence.mapsScrapeFields as Record<string, unknown> : {};
  const values = [
    ...(Array.isArray(evidence.images) ? evidence.images : []),
    ...(Array.isArray(evidence.mediaItems) ? evidence.mediaItems : []),
    ...(Array.isArray(mapsFields.images) ? mapsFields.images : []),
    ...(Array.isArray(mapsFields.media_items) ? mapsFields.media_items : []),
  ];
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const item = typeof value === "string" ? { url: value, title: "", type: "image" }
      : value && typeof value === "object" && !Array.isArray(value)
        ? { url: String((value as Record<string, unknown>).url ?? (value as Record<string, unknown>).src ?? (value as Record<string, unknown>).thumbnail_url ?? ""), title: String((value as Record<string, unknown>).title ?? ""), type: String((value as Record<string, unknown>).type ?? "image") }
        : null;
    const url = safeHttpUrl(item?.url);
    if (!item || !url || seen.has(url)) return [];
    seen.add(url);
    return [{ ...item, url }];
  }).slice(0, 20);
}

function evidenceArray(candidate: ScrapeCandidate, key: string): unknown[] {
  const value = evidenceValue(candidate, [key]);
  return Array.isArray(value) ? value : [];
}

export function ScrapingConsole() {
  const [segment, setSegment] = useState("salão de beleza");
  const [region, setRegion] = useState("São Paulo - SP");
  const [countryCode, setCountryCode] = useState("BR");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [selected, setSelected] = useState<ScrapeCandidate | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const token = useCallback(async () => {
    const client = supabase;
    if (!client) throw new Error("Supabase não está configurado.");
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
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
      const body = await response.json() as { status?: string; message?: string; error?: string; detail?: string; executionId?: string };
      if (!response.ok && response.status !== 202) throw new Error(body.error || body.detail || "Não foi possível iniciar a busca.");
      setNotice(body.message || "Busca enviada. A execução será acompanhada pelo painel.");
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a busca.");
    } finally {
      setStarting(false);
    }
  };

  const candidates = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase("pt-BR");
    return (data?.candidates ?? []).filter((candidate) =>
      !needle || [candidate.business_name, candidate.category, candidate.city, candidate.region, candidate.address, candidate.phone]
        .some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(needle))
    );
  }, [data?.candidates, filter]);

  return (
    <div className="min-h-screen bg-[#090b0a] text-neutral-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-[#0c1710] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              <Database className="h-3.5 w-3.5" /> Motor de coleta próprio
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Central de prospecção</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">Pesquise estabelecimentos, acompanhe execuções e explore os registros capturados pelo motor nativo, com origem e evidências preservadas.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </header>

        <form onSubmit={startSearch} className="grid gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-[0_18px_60px_-40px_rgba(16,185,129,0.25)] sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2 text-xs font-semibold text-neutral-300 lg:col-span-2">
            Segmento / consulta
            <input value={segment} onChange={(e) => setSegment(e.target.value)} required maxLength={160} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex.: barbearias" />
          </label>
          <label className="space-y-2 text-xs font-semibold text-neutral-300 lg:col-span-2">
            Cidade / região
            <input value={region} onChange={(e) => setRegion(e.target.value)} required maxLength={160} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex.: Porto Alegre - RS" />
          </label>
          <label className="space-y-2 text-xs font-semibold text-neutral-300">
            País
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="BR">Brasil</option><option value="US">Estados Unidos</option><option value="PT">Portugal</option><option value="AR">Argentina</option><option value="CL">Chile</option>
            </select>
          </label>
          <label className="space-y-2 text-xs font-semibold text-neutral-300">
            Limite de resultados
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500">
              {[10,20,30,50,100].map((n) => <option key={n} value={n}>{n} estabelecimentos</option>)}
            </select>
          </label>
          <div className="flex items-end lg:col-span-4">
            <p className="text-xs leading-5 text-neutral-500">A busca é pontual. O limite restringe os resultados desta execução; não cria uma campanha recorrente.</p>
          </div>
          <button type="submit" disabled={starting || !segment.trim() || !region.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? "Enfileirando busca…" : "Iniciar scraping"}
          </button>
        </form>

        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Estabelecimentos coletados", value: data?.stats.collected ?? "—", icon: Database },
            { label: "Execuções recentes", value: data?.stats.executions ?? "—", icon: Activity },
            { label: "Execuções em andamento", value: data?.stats.active ?? "—", icon: Clock3 },
            { label: "Execuções com falha/bloqueio", value: data?.stats.failed ?? "—", icon: AlertCircle },
          ].map((item) => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4"><div className="flex items-center justify-between text-xs text-neutral-400"><span>{item.label}</span><Icon className="h-4 w-4" /></div><p className="mt-3 text-3xl font-bold text-white">{item.value}</p></div>; })}
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 border-b border-neutral-800 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Database className="h-4 w-4" /></span><h2 className="font-bold text-white">Estabelecimentos encontrados</h2></div>
              <p className="mt-2 text-xs text-neutral-500">{data?.pagination.total ?? 0} registros persistidos · Campos ausentes permanecem sem preenchimento inferido.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500" placeholder="Buscar nome, cidade, telefone…" /></label>
              <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-950 p-1" aria-label="Modo de visualização">
                <button type="button" onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${viewMode === "cards" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-white"}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</button>
                <button type="button" onClick={() => setViewMode("table")} aria-pressed={viewMode === "table"} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${viewMode === "table" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-white"}`}><Table2 className="h-3.5 w-3.5" />Tabela</button>
              </div>
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((candidate) => <article key={candidate.id} className="group flex min-w-0 flex-col rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 transition hover:border-emerald-500/40 hover:bg-neutral-900/80">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-white" title={candidate.business_name}>{candidate.business_name}</p><p className="mt-1 truncate text-xs text-neutral-500">{candidate.category || "Categoria não observada"}</p></div>
                  <span className="shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs font-bold tabular-nums text-emerald-300">{candidate.qualification_score ?? "—"}<span className="ml-1 font-normal text-emerald-400/70">pts</span></span>
                </div>
                <div className="mt-4 space-y-2.5 text-xs text-neutral-400">
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" /><span>{[candidate.city, candidate.region].filter(Boolean).join(" · ") || candidate.address || "Localização não observada"}</span></p>
                  <p className="flex items-start gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" /><span>{candidate.phone || "Telefone não observado"}</span></p>
                  <p className="flex items-start gap-2"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" />{candidate.website_url ? <a href={candidate.website_url} target="_blank" rel="noreferrer" className="truncate text-emerald-300 hover:underline">{candidate.website_url}</a> : <span>Site não observado</span>}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3">
                  <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-400">{candidate.status || "Status não informado"}</span>
                  <div className="flex items-center gap-3">{candidate.source_url && <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline">Fonte <ExternalLink className="h-3 w-3" /></a>}<button type="button" onClick={() => setSelected(candidate)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800">Inspecionar</button></div>
                </div>
              </article>)}
              {!candidates.length && <div className="col-span-full rounded-xl border border-dashed border-neutral-800 px-4 py-14 text-center"><Filter className="mx-auto h-5 w-5 text-neutral-600" /><p className="mt-3 text-sm font-medium text-neutral-300">{loading ? "Carregando resultados…" : "Nenhum estabelecimento encontrado"}</p><p className="mt-1 text-xs text-neutral-500">{filter ? "Tente ajustar os termos do filtro." : "Os resultados aparecerão aqui quando houver registros persistidos."}</p></div>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-neutral-950/70 text-[11px] uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Estabelecimento</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Qualificação</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Detalhes</th></tr></thead>
                <tbody className="divide-y divide-neutral-800">
                  {candidates.map((candidate) => <tr key={candidate.id} className="transition hover:bg-neutral-800/30">
                    <td className="px-4 py-3"><p className="font-semibold text-white">{candidate.business_name}</p><p className="mt-1 text-xs text-neutral-500">{candidate.category || "Categoria não observada"}</p></td>
                    <td className="px-4 py-3 text-xs text-neutral-300">{[candidate.city, candidate.region].filter(Boolean).join(" · ") || candidate.address || "Não observado"}</td>
                    <td className="px-4 py-3 text-xs text-neutral-300">{candidate.phone || "Telefone não observado"}<p className="mt-1 text-neutral-500">{candidate.website_url || "Site não observado"}</p></td>
                    <td className="px-4 py-3"><span className="rounded-lg border border-neutral-700 px-2 py-1 text-xs">{candidate.qualification_score ?? "—"}</span><p className="mt-1 text-[11px] text-neutral-500">{candidate.status || "sem status"}</p></td>
                    <td className="px-4 py-3">{candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline">Abrir fonte <ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-neutral-500">Não observada</span>}</td>
                    <td className="px-4 py-3"><button type="button" onClick={() => setSelected(candidate)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800">Ver dados</button></td>
                  </tr>)}
                  {!candidates.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-500">{loading ? "Carregando resultados…" : "Nenhum estabelecimento encontrado para este filtro."}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-neutral-800 bg-neutral-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">Exibindo {(data?.pagination.total ?? 0) > 0 ? (data?.pagination.offset ?? 0) + 1 : 0}–{Math.min((data?.pagination.offset ?? 0) + (data?.candidates.length ?? 0), data?.pagination.total ?? 0)} de {data?.pagination.total ?? 0} registros. O filtro se aplica à página carregada.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0 || loading} className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Anterior</button>
              <span className="px-2 text-xs tabular-nums text-neutral-500">Página {page + 1}</span>
              <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!data?.pagination.hasMore || loading} className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50">
          <div className="border-b border-neutral-800 p-4"><h2 className="font-bold text-white">Histórico de execuções</h2><p className="mt-1 text-xs text-neutral-500">A tela atualiza automaticamente enquanto houver tarefas ativas.</p></div>
          <div className="divide-y divide-neutral-800">
            {(data?.tasks ?? []).map((task) => {
              const active = ["pending", "processing", "retryable"].includes(task.status);
              const failed = ["blocked", "failed", "dead_letter"].includes(task.status);
              return <div key={task.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-amber-400" : failed ? "bg-rose-400" : "bg-emerald-400"}`} /><div className="min-w-0"><p className="font-semibold text-white">#{task.id} · {task.task_type}</p><p className="mt-1 text-xs text-neutral-500">{formatDate(task.created_at)}</p>{task.last_error && <p className="mt-1 break-words text-xs text-rose-300">{task.last_error}</p>}</div></div>
                <div className="flex items-center gap-2 text-xs text-neutral-300"><span>{statusLabel[task.status] || task.status}</span>{active ? <LoaderCircle className="h-4 w-4 animate-spin text-amber-300" /> : failed ? <XCircle className="h-4 w-4 text-rose-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}</div>
              </div>;
            })}
            {!data?.tasks.length && <p className="p-8 text-center text-sm text-neutral-500">Nenhuma execução registrada.</p>}
          </div>
        </section>
      </div>

      {selected && (() => {
        const evidence = selected.raw_evidence ?? {};
        const media = candidateMedia(selected);
        const rating = evidenceValue(selected, ["rating", "stars"]);
        const reviews = evidenceValue(selected, ["reviewsCount", "reviewCount", "review_count", "reviews_count"]);
        const completeness = evidenceValue(selected, ["completenessScore"]);
        const fieldStatus = evidenceValue(selected, ["fieldStatus", "field_status"]);
        const reasons = selected.qualification_reasons ?? evidenceArray(selected, "opportunityReasons");
        const missing = selected.missing_fields ?? [];
        const website = safeHttpUrl(selected.website_url);
        const source = safeHttpUrl(selected.source_url ?? evidenceValue(selected, ["sourceUrl", "mapsUrl", "maps_url"]));
        const booking = safeHttpUrl(evidenceValue(selected, ["bookingUrl", "booking_url"]));
        const hours = evidenceValue(selected, ["openingHours", "opening_hours", "hours"]);
        const socials = evidenceValue(selected, ["socialLinks", "social_links"]);
        const attrs = evidenceValue(selected, ["additionalAttributes", "additional_attributes", "attributes"]);
        const latitude = evidenceValue(selected, ["latitude", "lat"]);
        const longitude = evidenceValue(selected, ["longitude", "lng", "lon"]);
        const coordinates = latitude != null && longitude != null ? `${String(latitude)}, ${String(longitude)}` : null;
        return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Ficha individual de ${selected.business_name}`} onClick={() => setSelected(null)}>
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-[#0b0e0c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b border-neutral-800 bg-gradient-to-r from-neutral-950 to-[#102016] p-5 sm:p-6">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ficha individual</span>
                  <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] text-neutral-300">{selected.status || "Status não informado"}</span>
                  {selected.category && <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] text-neutral-400">{selected.category}</span>}
                </div>
                <h2 className="break-words text-xl font-bold text-white sm:text-2xl">{selected.business_name}</h2>
                <p className="mt-1 text-xs text-neutral-400">{[selected.city, selected.region, selected.country_code].filter(Boolean).join(" · ") || "Localização não observada"}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="shrink-0 rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800" aria-label="Fechar ficha individual"><XCircle className="h-5 w-5" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-xs text-neutral-500">Qualificação</p><p className="mt-2 text-2xl font-bold text-emerald-300">{selected.qualification_score ?? "—"}<span className="ml-1 text-xs font-medium text-neutral-500">pts</span></p></div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-xs text-neutral-500">Avaliação pública</p><p className="mt-2 text-2xl font-bold text-white">{typeof rating === "number" ? rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : displayEvidence(rating)}<span className="ml-2 text-xs font-normal text-neutral-500">/ 5</span></p></div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-xs text-neutral-500">Quantidade de avaliações</p><p className="mt-2 text-2xl font-bold text-white">{displayEvidence(reviews)}</p></div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-xs text-neutral-500">Completude observada</p><p className="mt-2 text-2xl font-bold text-white">{typeof completeness === "number" ? `${completeness}%` : displayEvidence(completeness)}</p></div>
              </div>

              {media.length > 0 && <section className="mt-5">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Fotos e mídia capturadas</h3><span className="text-xs text-neutral-500">{media.length} itens observados</span></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {media.slice(0, 10).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
                    {item.type.toLowerCase().includes("video") ? <div className="flex aspect-[4/3] items-center justify-center px-3 text-center text-xs text-neutral-300">Prévia de vídeo indisponível</div> : <img src={item.url} alt={item.title || `Mídia de ${selected.business_name}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.03]" />}
                    <p className="truncate px-2 py-2 text-[10px] text-neutral-500">{item.title || (item.type.toLowerCase().includes("video") ? "Vídeo" : "Foto")}</p>
                  </a>)}
                </div>
              </section>}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <h3 className="mb-3 font-semibold text-white">Contato e localização</h3>
                  <dl className="space-y-3 text-sm">
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">Endereço</dt><dd className="mt-1 break-words text-neutral-200">{selected.address || "Não observado nesta captura"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">Telefone</dt><dd className="mt-1 text-neutral-200">{selected.phone || "Não observado nesta captura"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">E-mail</dt><dd className="mt-1 break-words text-neutral-200">{selected.email || "Não observado nesta captura"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">Site</dt><dd className="mt-1 break-all">{website ? <a className="text-emerald-300 hover:underline" href={website} target="_blank" rel="noopener noreferrer">{website}</a> : <span className="text-neutral-500">Não observado nesta captura</span>}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">Coordenadas</dt><dd className="mt-1 text-neutral-200">{coordinates || "Não observadas"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wider text-neutral-500">Faixa de preço</dt><dd className="mt-1 text-neutral-200">{displayEvidence(evidenceValue(selected, ["priceLevel", "price_level", "priceRange", "price_range"]))}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10">Abrir fonte <ExternalLink className="h-3.5 w-3.5" /></a>}
                    {booking && <a href={booking} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800">Agendamento <ExternalLink className="h-3.5 w-3.5" /></a>}
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <h3 className="mb-3 font-semibold text-white">Descrição e funcionamento</h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">{selected.description || String(evidenceValue(selected, ["editorialSummary", "editorial_summary"]) ?? "Descrição não observada nesta captura")}</p>
                  <div className="mt-4"><h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Horários observados</h4>
                    {hours ? <pre className="whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-300">{displayEvidence(hours)}</pre> : <p className="text-sm text-neutral-500">Horários não observados nesta captura.</p>}
                  </div>
                  {socials && <div className="mt-4"><h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Redes sociais</h4><pre className="whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-300">{displayEvidence(socials)}</pre></div>}
                  {attrs && <div className="mt-4"><h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Atributos adicionais</h4><pre className="whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-300">{displayEvidence(attrs)}</pre></div>}
                </section>
              </div>

              {(reasons.length > 0 || missing.length > 0) && <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {reasons.length > 0 && <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"><h3 className="mb-3 font-semibold text-white">Critérios da qualificação</h3><ul className="space-y-2 text-sm text-neutral-300">{reasons.map((reason, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{displayEvidence(reason)}</span></li>)}</ul></section>}
                {missing.length > 0 && <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><h3 className="mb-3 font-semibold text-white">Campos não observados</h3><div className="flex flex-wrap gap-2">{missing.map((field, index) => <span key={index} className="rounded-lg border border-amber-500/20 px-2.5 py-1.5 text-xs text-amber-200">{displayEvidence(field)}</span>)}</div><p className="mt-3 text-xs leading-5 text-neutral-500">A ausência indica que o campo não foi observado nesta captura; não comprova que a informação inexista.</p></section>}
              </div>}

              {fieldStatus && <details className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"><summary className="cursor-pointer text-sm font-semibold text-neutral-200">Estado da captura por campo</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-400">{displayEvidence(fieldStatus)}</pre></details>}
              <details className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"><summary className="cursor-pointer text-sm font-semibold text-neutral-200">Evidência bruta completa (JSON)</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-400">{JSON.stringify(evidence, null, 2)}</pre></details>
              <footer className="mt-5 flex flex-col gap-2 border-t border-neutral-800 pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                <div><p>Provedor: {selected.provider || "não informado"}</p><p className="mt-1">Capturado em: {formatDate(String(evidenceValue(selected, ["observedAt", "capturedAt"]) ?? selected.created_at ?? ""))}</p></div>
                <p className="break-all">ID do registro: {selected.id}</p>
              </footer>
            </div>
          </div>
        </div>;
      })()}
    </div>
  );
}
