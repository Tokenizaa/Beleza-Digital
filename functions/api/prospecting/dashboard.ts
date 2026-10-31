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
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

async function fetchPage(
  base: string,
  serviceKey: string,
  table: string,
  select: string,
  limit: number,
  offset: number,
  order?: string,
  extraFilters?: Record<string, string>,
): Promise<{ data: unknown[]; total: number }> {
  const url = new URL(`/rest/v1/${table}`, base);
  url.searchParams.set("select", `${select},count`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (order) url.searchParams.set("order", order);
  for (const [key, value] of Object.entries(extraFilters ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    prefer: `count=exact`,
  };
  const response = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`dashboard_${table}_http_${response.status}`);
  const range = response.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+)$/);
  const total = match ? Number(match[1]) : 0;
  const data = (await response.json()) as unknown[];
  return { data, total };
}

async function validatePlatformAdmin(env: Env, authorization: string): Promise<{ ok: true; userId: string } | { ok: false; error: string; status: number }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, error: 'Autenticação Supabase não configurada no servidor.', status: 503 };
  }
  let auth: Response;
  try {
    auth = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization },
      signal: AbortSignal.timeout(5000),
    });
  } catch { return { ok: false, error: 'Serviço de autenticação indisponível.', status: 502 }; }
  if (!auth.ok) return { ok: false, error: 'Sessão inválida ou expirada.', status: 401 };
  const user = await auth.json() as { id?: string };
  if (!user.id) return { ok: false, error: 'Sessão inválida.', status: 401 };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: 'Configuração administrativa incompleta.', status: 503 };
  }
  const adminCheck = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!adminCheck.ok) return { ok: false, error: 'Não foi possível verificar a permissão administrativa.', status: 503 };
  const adminRows = await adminCheck.json() as unknown[];
  if (!adminRows.length) return { ok: false, error: 'Acesso restrito ao Admin Geral.', status: 403 };
  return { ok: true, userId: user.id };
}

export async function onRequestGet({ request, env }: Context) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);

  const admin = await validatePlatformAdmin(env, authorization);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server_configuration_missing" }, 503);
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Carrega tasks (execuções) paginadas
    const tasksResult = await fetchPage(
      base, serviceKey, "prospecting_tasks",
      "id,task_type,status,created_at,completed_at,last_error,result,payload,campaign_id",
      limit, offset,
      "created_at.desc",
    );

    // Carrega candidates (fichas de lead raspadas) paginadas
    const candidatesResult = await fetchPage(
      base, serviceKey, "prospecting_candidates",
      "id,business_name,category,city,region,address,phone,website_url,source_url,qualification_score,status,raw_evidence,created_at,prospect_id,normalized_website,normalized_phone",
      limit, offset,
      "created_at.desc",
    );

    // Estatísticas agregadas (contagens exatas)
    const statsEntries = await Promise.all([
      ["executions", "prospecting_tasks", {} as Record<string, string>],
      ["active", "prospecting_tasks", { status: "eq.processing" }],
      ["failed", "prospecting_tasks", { status: "eq.failed" }],
      ["collected", "prospecting_candidates", {} as Record<string, string>],
    ] as Array<[string, string, Record<string, string>]>);

    const stats: Record<string, number> = {};
    for (const [key, table, filters] of statsEntries) {
      const countUrl = new URL(`/rest/v1/${table}`, base);
      countUrl.searchParams.set("select", "id");
      countUrl.searchParams.set("limit", "1");
      for (const [fk, fv] of Object.entries(filters)) countUrl.searchParams.set(fk, fv);
      const countRes = await fetch(countUrl.toString(), {
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, prefer: "count=exact" },
        signal: AbortSignal.timeout(5000),
      });
      if (countRes.ok) {
        const range = countRes.headers.get("content-range") ?? "";
        const match = range.match(/\/(\d+)$/);
        stats[key] = match ? Number(match[1]) : 0;
      } else {
        stats[key] = 0;
      }
    }

    const tasks = (tasksResult.data ?? []).map((row: any) => ({
      id: row.id,
      task_type: row.task_type,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at ?? null,
      last_error: row.last_error ?? null,
      result: row.result ?? null,
      payload: row.payload ?? null,
    }));

    const candidates = (candidatesResult.data ?? []).map((row: any) => ({
      id: row.id,
      token: row.prospect_id ?? null,
      business_name: row.business_name,
      category: row.category ?? null,
      city: row.city ?? null,
      region: row.region ?? null,
      address: row.address ?? null,
      phone: row.normalized_phone || row.phone ?? null,
      website_url: row.normalized_website || row.website_url ?? null,
      source_url: row.source_url ?? null,
      qualification_score: row.qualification_score ?? null,
      status: row.status ?? null,
      raw_evidence: row.raw_evidence ?? null,
      created_at: row.created_at,
    }));

    return json({
      tasks,
      candidates,
      stats: {
        executions: stats.executions ?? 0,
        active: stats.active ?? 0,
        failed: stats.failed ?? 0,
        collected: stats.collected ?? 0,
      },
      fetchedAt: new Date().toISOString(),
      pagination: {
        limit,
        offset,
        total: tasksResult.total,
        hasMore: offset + limit < tasksResult.total,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "dashboard_failed" }, 503);
  }
}

export async function onRequestPost() {
  return json({ error: "Método não permitido. Use GET." }, 405);
}
