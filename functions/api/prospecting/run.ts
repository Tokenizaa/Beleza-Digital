interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // URL pública do Worker prospecting-scheduler (implantação própria).
  // Nunca expor segredos; apenas o endpoint público do worker.
  PROSPECTING_WORKER_URL?: string;
  // Segredo compartilhado para autenticar execuções manuais internas do worker.
  PROSPECTING_WORKER_SECRET?: string;
}
type Context = { request: Request; env: Env };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'x-content-type-options': 'nosniff',
  },
});

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

export async function onRequestPost({ request, env }: Context) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Autenticação obrigatória.' }, 401);

  const admin = await validatePlatformAdmin(env, authorization);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  // O Worker deve estar configurado para permitir execução imediata.
  if (!env.PROSPECTING_WORKER_URL?.trim() || !env.PROSPECTING_WORKER_SECRET?.trim()) {
    return json({
      error: 'Worker de prospecção não configurado.',
      detail: 'Configure PROSPECTING_WORKER_URL e PROSPECTING_WORKER_SECRET como secrets server-side das Pages Functions para permitir raspagem pontual imediata.',
      blocked: true,
      blocker: 'worker_not_configured',
    }, 503);
  }

  let body: { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown };
  try { body = (await request.json()) as { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown }; }
  catch { return json({ error: 'Envie um JSON válido com segment e region.' }, 400); }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Configuração do banco não disponível no servidor.', status: 503 });
  }

  const segment = typeof body.segment === 'string' && body.segment.trim() ? body.segment.trim() : null;
  const region = typeof body.region === 'string' && body.region.trim() ? body.region.trim() : null;
  if (!segment || !region) return json({ error: 'Informe segmento (nichos) e região (cidade/estado) para a busca.' }, 400);

  const limitRaw = Number(body.limit ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 100)) : 10;
  const countryCode = typeof body.countryCode === 'string' && body.countryCode.trim() ? body.countryCode.trim().toUpperCase() : 'BR';

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const headers = new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'content-type': 'application/json',
    prefer: 'return=representation',
  });

  const now = new Date().toISOString();
  const campaignName = `${segment} — ${region} — ${new Date().toLocaleDateString('pt-BR')} (busca pontual)`;

  // Campanha PONTUAL: schedule vazio (sem interval_minutes) para não criar recorrência.
  // next_run_at = now para o Worker processar imediatamente ao ser acionado.
  const campaignResult = await fetch(`${base}/rest/v1/prospecting_campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: campaignName,
      status: 'active',
      segment,
      region,
      country_code: countryCode,
      source_provider: 'google-maps-cloudflare-browser-playwright',
      source_config: { source: 'google-maps-public-listings', immediate: true },
      qualification_rules: { minimum_score: 50 },
      schedule: {}, // sem interval_minutes → não é campanha recorrente
      daily_discovery_limit: limit,
      last_run_at: null,
      next_run_at: now,
      created_by: admin.userId,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!campaignResult.ok) {
    return json({ error: 'Não foi possível registrar a campanha de busca.', detail: await campaignResult.text().catch(() => '') }, 503);
  }
  const created = await campaignResult.json() as Array<{ id: string }>;
  if (!created.length) return json({ error: 'Não foi possível registrar a campanha de busca.' }, 503);
  const campaignId = created[0].id;

  // Aciona o Worker imediatamente para processar a campanha (descoberta + captura + qualificação automática).
  let workerResult: { status: string; error?: string; [key: string]: unknown } | null = null;
  let workerError: string | null = null;
  try {
    const workerResponse = await fetch(env.PROSPECTING_WORKER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.PROSPECTING_WORKER_SECRET}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(60000),
    });
    const workerBody = await workerResponse.json().catch(() => ({})) as Record<string, unknown>;
    // Determina status baseado no body do worker, não apenas no HTTP ok.
    // O worker pode retornar 200 com status 'blocked' no body (ex: binding PROSPECTING_BROWSER ausente).
    // Determine worker status based on body and internal counts (blocked, succeeded, claimed).
    // Logic:
    // - If workerBody.status is "blocked"/"retryable"/"failed" → 503 as before
    // - If workerBody.status is "ok" AND blocked === 0 AND succeeded === claimed → 200 normal
    // - If workerBody.status is "ok" AND (blocked > 0 OR succeeded < claimed) → 503 blocked
    // - Otherwise fallback to HTTP ok status
    let workerStatus: string;
    if (workerBody.status === 'blocked' || workerBody.status === 'retryable' || workerBody.status === 'failed') {
      workerStatus = workerBody.status;
    } else if (workerBody.status === 'ok') {
      const blockedVal = (workerBody as Record<string, unknown>).blocked;
      const succeededVal = (workerBody as Record<string, unknown>).succeeded;
      const claimedVal = (workerBody as Record<string, unknown>).claimed;
      const hasBlocks = typeof blockedVal === 'number' && blockedVal > 0;
      const notFullySucceeded = typeof succeededVal === 'number' && typeof claimedVal === 'number' && succeededVal < claimedVal;
      if (hasBlocks || notFullySucceeded) {
        workerStatus = 'blocked';
      } else {
        workerStatus = 'ok';
      }
    } else {
      workerStatus = workerResponse.ok ? 'ok' : 'blocked';
    }
    workerResult = { ...workerBody, status: workerStatus };
    // Define workerError quando o worker reportou bloqueio/falha ou quando há bloques internos.
    if (workerStatus === 'blocked' || workerStatus === 'retryable' || workerStatus === 'failed' || !workerResponse.ok) {
      workerError = String(workerBody.error ?? workerBody.detail ?? `Worker ${workerStatus}`);
    }
  } catch (error) {
    workerError = error instanceof Error ? error.message : 'Falha ao acionar o Worker.';
    workerResult = { status: 'blocked', error: workerError };
  }

  // Marca a campanha conforme o resultado do acionamento do Worker.
  if (workerError) {
    await fetch(`${base}/rest/v1/prospecting_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'blocked', blocked_reason: workerError, updated_at: now }),
      signal: AbortSignal.timeout(8000),
    });
    return json({
      status: 'blocked',
      campaignId,
      detail: workerError,
      blocker: 'worker_unreachable_or_blocked',
      message: 'A campanha foi registrada, mas o Worker não pôde processá-la imediatamente. Verifique PROSPECTING_WORKER_URL, PROSPECTING_WORKER_SECRET e o binding BROWSER no Worker.',
    }, 503);
  }

  return json({
    status: 'ok',
    campaignId,
    message: 'Busca pontual iniciada imediatamente. O Worker está processando a descoberta, captura e qualificação automática.',
    campaign: { name: campaignName, segment, region, countryCode, limit },
    worker: workerResult,
    note: 'Esta é uma campanha pontual (sem recorrência automática). Não cria campanha recorrente como efeito colateral.',
  }, 200);
}

export async function onRequestGet() {
  return json({ error: 'Método não permitido. Use POST.' }, 405);
}
