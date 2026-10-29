interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
type Context = { request: Request; env: Env };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
  },
});

async function authorizeAdmin(env: Env, authorization: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Autenticação administrativa não configurada no servidor.", status: 503 };
  }
  let auth: Response;
  try {
    auth = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return { ok: false, error: "Serviço de autenticação indisponível.", status: 502 };
  }
  if (!auth.ok) return { ok: false, error: "Sessão inválida ou expirada.", status: 401 };
  const user = await auth.json() as { id?: string };
  if (!user.id) return { ok: false, error: "Sessão inválida.", status: 401 };

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const check = await fetch(`${base}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!check.ok) return { ok: false, error: "Não foi possível verificar a permissão administrativa.", status: 503 };
  if (!(await check.json() as unknown[]).length) return { ok: false, error: "Acesso restrito ao Admin Geral.", status: 403 };
  return { ok: true };
}

export async function onRequestGet({ request, env }: Context) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Autenticação obrigatória." }, 401);
  const allowed = await authorizeAdmin(env, authorization);
  if (!allowed.ok) return json({ error: allowed.error }, allowed.status);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Banco não configurado." }, 503);

  const params = new URL(request.url).searchParams;
  const rawLimit = Number(params.get("limit") ?? 30);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 30;
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    accept: "application/json",
    prefer: "count=exact",
  };
  try {
    const [tasksResponse, candidatesResponse] = await Promise.all([
      fetch(`${base}/rest/v1/prospecting_tasks?select=id,task_type,status,prospect_id,campaign_id,idempotency_key,attempt_count,max_attempts,created_at,updated_at,completed_at,last_error_code,last_error,result,payload&order=created_at.desc&limit=${limit}`, {
        headers, signal: AbortSignal.timeout(10000),
      }),
      fetch(`${base}/rest/v1/prospecting_candidates?select=id,campaign_id,provider,provider_record_id,dedupe_key,business_name,category,website_url,normalized_website,phone,normalized_phone,email,address,city,region,country_code,description,source_url,qualification_score,qualification_reasons,missing_fields,status,raw_evidence,created_at,updated_at&order=created_at.desc&limit=${limit}`, {
        headers, signal: AbortSignal.timeout(10000),
      }),
    ]);
    if (!tasksResponse.ok) return json({ error: "Falha ao consultar execuções.", detail: await tasksResponse.text() }, 502);
    if (!candidatesResponse.ok) return json({ error: "Falha ao consultar estabelecimentos coletados.", detail: await candidatesResponse.text() }, 502);
    const tasks = await tasksResponse.json() as Array<Record<string, unknown>>;
    const candidates = await candidatesResponse.json() as Array<Record<string, unknown>>;
    const totalRange = candidatesResponse.headers.get("content-range") ?? "";
    const totalMatch = totalRange.match(/\/(\d+|\*)$/);
    const candidateTotal = totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : candidates.length;
    return json({
      tasks,
      candidates,
      stats: {
        executions: tasks.length,
        active: tasks.filter((task) => ["pending", "processing", "retryable"].includes(String(task.status))).length,
        failed: tasks.filter((task) => ["blocked", "failed", "dead_letter"].includes(String(task.status))).length,
        collected: candidateTotal,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ error: "Não foi possível consultar o painel de scraping.", detail: error instanceof Error ? error.message : "unknown_error" }, 502);
  }
}
