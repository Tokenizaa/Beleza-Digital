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
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  qualification_score?: number | null;
  status?: string | null;
  raw_evidence?: Record<string, unknown> | null;
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

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Dados coletados de ${selected.business_name}`} onClick={() => setSelected(null)}>
        <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-neutral-800 p-4"><div><h2 className="font-bold text-white">{selected.business_name}</h2><p className="mt-1 text-xs text-neutral-500">Registro bruto e evidências preservados</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800" aria-label="Fechar detalhes"><XCircle className="h-5 w-5" /></button></div>
          <div className="max-h-[calc(90vh-72px)] overflow-auto p-4"><pre className="whitespace-pre-wrap break-words rounded-xl bg-neutral-900 p-4 text-xs leading-5 text-neutral-200">{JSON.stringify(selected, null, 2)}</pre></div>
        </div>
      </div>}
    </div>
  );
}
