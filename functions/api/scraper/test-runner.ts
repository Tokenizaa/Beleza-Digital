interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // Endpoint do Worker de prospecção (com BROWSER binding) que executa a captura.
  PROSPECTING_WORKER_URL?: string;
  PROSPECTING_WORKER_SECRET?: string;
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

/**
 * Endpoint de teste do runner de captura (src/server/scraper/runner.ts).
 *
 * Este endpoint não executa Puppeteer diretamente na Pages Function (edge não tem
 * binding BROWSER nem Puppeteer). Em vez disso, delega a execução real ao
 * Worker de prospecção (PROSPECTING_WORKER_URL), que possui o binding BROWSER
 * e roda a captura de forma isolada.
 *
 * Se o Worker não estiver configurado, retorna um erro informativo orientando a
 * configuração necessária para que a coleta funcione de fato.
 */
async function validatePlatformAdmin(env: Env, authorization: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Autenticação administrativa não configurada.", status: 503 };
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
  const adminCheck = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!adminCheck.ok) return { ok: false, error: "Não foi possível verificar a permissão administrativa.", status: 503 };
  const admins = await adminCheck.json() as unknown[];
  return admins.length ? { ok: true } : { ok: false, error: "Acesso restrito ao Admin Geral.", status: 403 };
}

export async function onRequestPost({ request, env }: Context) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Autenticação obrigatória." }, 401);
  const admin = await validatePlatformAdmin(env, authorization);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  if (!env.PROSPECTING_WORKER_URL?.trim() || !env.PROSPECTING_WORKER_SECRET?.trim()) {
    return json({
      error: "scraper_worker_not_configured",
      message:
        "O Worker de prospecção não está configurado neste ambiente. A coleta direta via runner requer PROSPECTING_WORKER_URL e PROSPECTING_WORKER_SECRET. Use /api/prospecting/run para enfileirar uma coleta que será processada quando o Worker estiver disponível.",
      required: [
        "PROSPECTING_WORKER_URL (URL pública do Worker prospecting-scheduler)",
        "PROSPECTING_WORKER_SECRET (segredo compartilhado para autenticação interna)",
        "PROSPECTING_BROWSER (binding de navegador configurado no wrangler do Worker)",
      ],
      alternative: "/api/prospecting/run",
    }, 503);
  }

  let body: { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown };
  try {
    body = (await request.json()) as { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown };
  } catch {
    body = {};
  }

  const segment = typeof body.segment === "string" && body.segment.trim().length > 0
    ? body.segment.trim()
    : "barbearia e salão";
  const region = typeof body.region === "string" && body.region.trim().length > 0
    ? body.region.trim()
    : "Porto Alegre - RS";
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
    ? body.limit
    : 5;
  const countryCode = typeof body.countryCode === "string" && body.countryCode.trim().length > 0
    ? body.countryCode.trim()
    : "BR";

  if (!segment || !region) {
    return json({ error: "missing_parameters", message: "Os campos 'segment' e 'region' são obrigatórios." }, 400);
  }

  try {
    const workerResponse = await fetch(env.PROSPECTING_WORKER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.PROSPECTING_WORKER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ segment, region, limit, countryCode }),
      signal: AbortSignal.timeout(60000),
    });

    const workerBody = await workerResponse.json().catch(() => ({})) as Record<string, unknown>;

    if (!workerResponse.ok) {
      return json({
        error: "scraper_worker_error",
        message: `Worker respondeu HTTP ${workerResponse.status}`,
        detail: workerBody.error ?? workerBody.detail ?? String(workerBody),
      }, 502);
    }

    return json({
      status: workerBody.status ?? "ok",
      message: workerBody.message ?? "Runner executado pelo Worker.",
      results: workerBody.results ?? null,
      counts: workerBody.counts ?? null,
      worker: workerBody,
    });
  } catch (error) {
    return json({
      error: "scraper_worker_unreachable",
      message: error instanceof Error ? error.message : "Não foi possível acionar o Worker de captura.",
    }, 502);
  }
}

export async function onRequestGet() {
  return json({ error: "Método não permitido. Use POST." }, 405);
}
