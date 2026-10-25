import { FormEvent, useCallback, useEffect, useState } from "react";
import { Activity, CircleAlert, ExternalLink, LoaderCircle, Pause, Play, Plus, RefreshCw, Users } from "lucide-react";
import { supabase } from "../lib/supabase";

type Campaign = {
  id: string; name: string; status: string; segment: string; region: string;
  country_code: string; source_provider: string | null; daily_discovery_limit: number;
  last_run_at: string | null; next_run_at: string | null; blocked_reason: string | null;
};
type Candidate = {
  id: string; business_name: string; category: string | null; city: string | null;
  region: string | null; normalized_website: string | null; qualification_score: number | null;
  status: string; source_url: string | null; created_at: string;
};
type Event = { id: number; event_type: string; source_provider: string | null; occurred_at: string; evidence: Record<string, unknown> };
type Metrics = Record<string, number>;
type DemoLink = { id: number; prospectId: string | null; url: string; expiresAt: string; createdAt: string };

export function ProspectingConsole() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [demoLinks, setDemoLinks] = useState<DemoLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showScrapeForm, setShowScrapeForm] = useState(false);
  const [scrapeForm, setScrapeForm] = useState({ segment: "salão de beleza e barbearia", region: "", countryCode: "BR", limit: "10" });
  const [siteProjectId, setSiteProjectId] = useState("");
  const [form, setForm] = useState({ name: "", segment: "salão de beleza e barbearia", region: "", countryCode: "BR", dailyLimit: "100" });

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setBusy(true); setError("");
    const [campaignResult, candidateResult, eventResult] = await Promise.all([
      supabase.from("prospecting_campaigns").select("id,name,status,segment,region,country_code,source_provider,daily_discovery_limit,last_run_at,next_run_at,blocked_reason").order("created_at", { ascending: false }).limit(50),
      supabase.from("prospecting_candidates").select("id,business_name,category,city,region,normalized_website,qualification_score,status,source_url,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("prospect_events").select("id,event_type,source_provider,occurred_at,evidence").order("occurred_at", { ascending: false }).limit(20),
    ]);
    if (campaignResult.error) setError("Não foi possível carregar campanhas. Verifique as permissões administrativas e as migrations.");
    else setCampaigns((campaignResult.data ?? []) as Campaign[]);
    if (!candidateResult.error) setCandidates((candidateResult.data ?? []) as Candidate[]);
    if (!eventResult.error) setEvents((eventResult.data ?? []) as Event[]);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      const headers = { authorization: `Bearer ${accessToken}` };
      const [overviewResponse, linksResponse] = await Promise.allSettled([
        fetch("/api/prospecting/overview", { headers }),
        fetch("/api/prospecting/demo-links", { headers }),
      ]);
      if (overviewResponse.status === "fulfilled") {
        try {
          const body = await overviewResponse.value.json();
          if (overviewResponse.value.ok && body.status === "ok") setMetrics(body.counts as Metrics);
        } catch { /* Preserve last known metrics if the endpoint returns invalid JSON. */ }
      }
      if (linksResponse.status === "fulfilled") {
        try {
          const body = await linksResponse.value.json();
          if (linksResponse.value.ok && Array.isArray(body.links)) setDemoLinks(body.links as DemoLink[]);
        } catch { /* Keep the console usable when link history is unavailable. */ }
      }
    }
    setBusy(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!form.name.trim() || !form.segment.trim() || !form.region.trim()) { setError("Informe nome, segmento e região da campanha."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("prospecting_campaigns").insert({
      name: form.name.trim(), segment: form.segment.trim(), region: form.region.trim(),
      country_code: form.countryCode, daily_discovery_limit: Math.max(1, Math.min(10000, Number(form.dailyLimit) || 100)),
      status: "paused", schedule: { interval_minutes: 1440 },
      qualification_rules: { minimum_score: 50 },
      source_provider: null, source_config: {},
    });
    setBusy(false);
    if (insertError) { setError("Falha ao salvar a campanha. Confira as permissões e o esquema do banco."); return; }
    setNotice("Campanha criada pausada. Configure o provedor de descoberta no ambiente server-side antes de ativá-la.");
    setForm({ name: "", segment: "salão de beleza e barbearia", region: "", countryCode: "BR", dailyLimit: "100" });
    setShowForm(false);
    await refresh();
  }

  async function runScrape(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!scrapeForm.segment.trim() || !scrapeForm.region.trim()) { setError("Informe o segmento e a região da raspagem."); return; }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Sua sessão expirou. Entre novamente."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/prospecting/run", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ segment: scrapeForm.segment.trim(), region: scrapeForm.region.trim(), countryCode: scrapeForm.countryCode, limit: Math.max(1, Math.min(100, Number(scrapeForm.limit) || 10)), createCampaign: false, executionId: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.detail ?? "Não foi possível iniciar a raspagem.");
      setNotice(result.message ?? "Busca enviada. Atualize a lista para conferir os registros persistidos.");
      setShowScrapeForm(false);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao iniciar a raspagem."); }
    finally { setBusy(false); }
  }

  async function toggleCampaign(campaign: Campaign) {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const activate = campaign.status !== "active";
    const { error: updateError } = await supabase.from("prospecting_campaigns").update({
      status: activate ? "active" : "paused",
      next_run_at: activate ? new Date().toISOString() : null,
      blocked_reason: activate ? null : campaign.blocked_reason,
      updated_at: new Date().toISOString(),
    }).eq("id", campaign.id);
    setBusy(false);
    if (updateError) { setError("Não foi possível atualizar a campanha."); return; }
    setNotice(activate ? "Campanha ativada. O worker verificará a fila no próximo ciclo." : "Campanha pausada.");
    await refresh();
  }

  async function createDemoLink(siteProjectId: string) {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Sua sessão expirou. Entre novamente."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/prospecting/demo-links", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ siteProjectId, expiresInDays: 14 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar o link.");
      setNotice(`Link privado criado: ${result.url}`);
      await navigator.clipboard?.writeText(result.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar link."); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-amber-300">Automação comercial</p><h2 className="mt-1 text-xl font-semibold">Prospecção e demonstrações</h2><p className="mt-1 text-sm text-neutral-400">Campanhas, candidatos descobertos e eventos persistidos no banco.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Atualizar</button><button onClick={() => setShowScrapeForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950"><Play size={15} /> Raspar agora</button><button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm"><Plus size={15} /> Nova campanha</button></div>
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</div>}
    {showScrapeForm && <form onSubmit={runScrape} className="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:grid-cols-2">
      <label className="text-xs text-neutral-400">Segmento<input required value={scrapeForm.segment} onChange={(e) => setScrapeForm({ ...scrapeForm, segment: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" /></label>
      <label className="text-xs text-neutral-400">Cidade / região<input required value={scrapeForm.region} onChange={(e) => setScrapeForm({ ...scrapeForm, region: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" placeholder="Porto Alegre, RS" /></label>
      <label className="text-xs text-neutral-400">País<select value={scrapeForm.countryCode} onChange={(e) => setScrapeForm({ ...scrapeForm, countryCode: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm"><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="US">Estados Unidos</option></select></label>
      <label className="text-xs text-neutral-400">Limite de estabelecimentos<input type="number" min="1" max="100" value={scrapeForm.limit} onChange={(e) => setScrapeForm({ ...scrapeForm, limit: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" /></label>
      <div className="flex items-center justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setShowScrapeForm(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Cancelar</button><button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50">{busy ? "Iniciando..." : "Iniciar raspagem"}</button></div>
    </form>}
    {showForm && <form onSubmit={createCampaign} className="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:grid-cols-2">
      <label className="text-xs text-neutral-400">Nome da campanha<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" placeholder="Ex.: Barbearias Porto Alegre" /></label>
      <label className="text-xs text-neutral-400">Segmento<input required value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" /></label>
      <label className="text-xs text-neutral-400">Região alvo<input required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100" placeholder="Cidade, estado ou região" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs text-neutral-400">País<select value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm"><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="US">Estados Unidos</option></select></label><label className="text-xs text-neutral-400">Limite por execução<input type="number" min="1" max="10000" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm" /></label></div>
      <div className="flex items-center justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Cancelar</button><button disabled={busy} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50">{busy ? "Salvando..." : "Criar pausada"}</button></div>
    </form>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Campanhas ativas</p><p className="mt-2 text-2xl font-semibold">{metrics?.activeCampaigns ?? campaigns.filter((item) => item.status === "active").length}</p></div>
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Candidatos persistidos</p><p className="mt-2 text-2xl font-semibold">{metrics?.candidates ?? candidates.length}</p></div>
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Tarefas pendentes</p><p className="mt-2 text-2xl font-semibold">{metrics?.pendingTasks ?? "—"}</p></div>
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Tarefas bloqueadas</p><p className="mt-2 text-2xl font-semibold">{metrics?.blockedTasks ?? "—"}</p></div>
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Fila de falhas definitivas</p><p className="mt-2 text-2xl font-semibold">{metrics?.deadLetterTasks ?? "—"}</p></div>
      <div className="rounded-xl border border-neutral-800 p-4"><p className="text-xs text-neutral-500">Mensagens confirmadas</p><p className="mt-2 text-2xl font-semibold">{(metrics?.sentMessages ?? 0) + (metrics?.deliveredMessages ?? 0)}</p></div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3"><Activity size={17} /><h3 className="font-medium">Campanhas</h3></div>
      {campaigns.length === 0 ? <p className="p-5 text-sm text-neutral-500">Nenhuma campanha cadastrada.</p> : <div className="divide-y divide-neutral-800">{campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{campaign.name}</p><span className={`rounded-full px-2 py-1 text-[11px] ${campaign.status === "active" ? "bg-emerald-950 text-emerald-300" : "bg-neutral-800 text-neutral-400"}`}>{campaign.status}</span></div><p className="mt-1 text-sm text-neutral-400">{campaign.segment} · {campaign.region} · limite {campaign.daily_discovery_limit}</p>{campaign.blocked_reason && <p className="mt-1 text-xs text-amber-300">{campaign.blocked_reason}</p>}</div>
        <button disabled={busy} onClick={() => void toggleCampaign(campaign)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs disabled:opacity-50">{campaign.status === "active" ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Ativar</>}</button>
      </div>)}</div>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3"><Users size={17} /><h3 className="font-medium">Candidatos recentes</h3></div>
      {candidates.length === 0 ? <p className="p-5 text-sm text-neutral-500">Ainda não há candidatos persistidos.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-neutral-900 text-xs text-neutral-500"><tr><th className="px-4 py-3">Negócio</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Pontuação</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Origem</th></tr></thead><tbody className="divide-y divide-neutral-800">{candidates.map((candidate) => <tr key={candidate.id}><td className="px-4 py-3"><p className="font-medium">{candidate.business_name}</p><p className="text-xs text-neutral-500">{candidate.category ?? "Sem categoria"}</p></td><td className="px-4 py-3 text-neutral-400">{[candidate.city, candidate.region].filter(Boolean).join(", ") || "—"}</td><td className="px-4 py-3 tabular-nums">{candidate.qualification_score ?? "—"}</td><td className="px-4 py-3">{candidate.status}</td><td className="px-4 py-3">{candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-300"><ExternalLink size={13} /> Fonte</a> : "—"}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3"><ExternalLink size={17} /><h3 className="font-medium">Demonstrações geradas automaticamente</h3></div>
      {demoLinks.length === 0 ? <p className="p-5 text-sm text-neutral-500">Os links aparecerão aqui após a geração e publicação automáticas de uma demonstração.</p> : <div className="divide-y divide-neutral-800">{demoLinks.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0"><a href={link.url} target="_blank" rel="noreferrer" className="break-all text-sm text-amber-300 hover:underline">{link.url}</a><p className="mt-1 text-xs text-neutral-500">Expira em {new Date(link.expiresAt).toLocaleString("pt-BR")}</p></div>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(link.url); setNotice("Link da demonstração copiado."); }} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs">Copiar link</button>
      </div>)}</div>}
    </div>
    <div className="rounded-2xl border border-neutral-800 p-4">
      <div className="flex items-center gap-2"><ExternalLink size={17} /><h3 className="font-medium">Criar link manual</h3></div>
      <p className="mt-1 text-sm text-neutral-400">Use apenas para republicar manualmente um projeto existente. O fluxo automatizado publica os links e os lista acima.</p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (siteProjectId.trim()) void createDemoLink(siteProjectId.trim()); }}>
        <input value={siteProjectId} onChange={(event) => setSiteProjectId(event.target.value)} required placeholder="UUID do projeto de site" className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm" />
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50"><ExternalLink size={15} /> Criar link privado</button>
      </form>
    </div>
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3"><Activity size={17} /><h3 className="font-medium">Eventos do funil</h3></div>
      {events.length === 0 ? <p className="p-5 text-sm text-neutral-500">Os eventos serão exibidos quando houver atividade persistida.</p> : <div className="divide-y divide-neutral-800">{events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm">{event.event_type.replace(/_/g, " ")}</p><p className="mt-1 text-xs text-neutral-500">{event.source_provider ?? "Sistema"}</p></div><time className="text-xs text-neutral-500">{new Date(event.occurred_at).toLocaleString("pt-BR")}</time></div>)}</div>}
    </div>
    {busy && <p className="flex items-center gap-2 text-xs text-neutral-500"><LoaderCircle size={14} className="animate-spin" /> Sincronizando dados...</p>}
  </section>;
}
