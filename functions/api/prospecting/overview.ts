interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
type Context = { request: Request; env: Env };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
async function countRows(env: Env, table: string, filters: Record<string, string> = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("overview_database_not_configured");
  const url = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), {
    method: "HEAD",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      prefer: "count=exact",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`overview_${table}_http_${response.status}`);
  const range = response.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+)$/);
  if (!match) throw new Error(`overview_${table}_count_unavailable`);
  return Number(match[1]);
}
export async function onRequestGet({ request, env }: Context) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "server_configuration_missing" }, 503);
  let auth: Response;
  try {
    auth = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization },
      signal: AbortSignal.timeout(5000),
    });
  } catch { return json({ error: "auth_service_unavailable" }, 502); }
  if (!auth.ok) return json({ error: "invalid_session" }, 401);
  const user = await auth.json() as { id?: string };
  if (!user.id) return json({ error: "invalid_session" }, 401);
  const adminCheck = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!adminCheck.ok) return json({ error: "admin_membership_check_unavailable" }, 503);
  const adminRows = await adminCheck.json() as unknown[];
  if (!adminRows.length) return json({ error: "platform_admin_required" }, 403);

  const executionId = new URL(request.url).searchParams.get("executionId");
  if (executionId) {
    if (!/^\d+$/.test(executionId)) return json({ error: "invalid_execution_id" }, 400);
    try {
      const taskResponse = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/prospecting_tasks?id=eq.${encodeURIComponent(executionId)}&select=id,status,result,last_error,completed_at,created_at,attempt_count&limit=1`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!taskResponse.ok) return json({ status: "blocked", error: `execution_lookup_http_${taskResponse.status}` }, 503);
      const tasks = await taskResponse.json() as Array<Record<string, unknown>>;
      if (!tasks.length) return json({ status: "not_found", error: "execution_not_found" }, 404);
      const task = tasks[0];
      return json({
        status: "ok",
        execution: {
          id: String(task.id),
          taskStatus: task.status,
          result: task.result ?? null,
          error: task.last_error ?? null,
          createdAt: task.created_at ?? null,
          completedAt: task.completed_at ?? null,
          attemptCount: task.attempt_count ?? null,
        },
      });
    } catch (error) {
      return json({ status: "blocked", error: error instanceof Error ? error.message : "execution_lookup_failed" }, 503);
    }
  }

  try {
    const entries = await Promise.all([
      ["campaigns", "prospecting_campaigns", {}],
      ["activeCampaigns", "prospecting_campaigns", { status: "eq.active" }],
      ["candidates", "prospecting_candidates", {}],
      ["qualifiedCandidates", "prospecting_candidates", { status: "eq.qualified" }],
      ["promotedCandidates", "prospecting_candidates", { status: "eq.promoted" }],
      ["pendingTasks", "prospecting_tasks", { status: "eq.pending" }],
      ["processingTasks", "prospecting_tasks", { status: "eq.processing" }],
      ["retryableTasks", "prospecting_tasks", { status: "eq.retryable" }],
      ["blockedTasks", "prospecting_tasks", { status: "eq.blocked" }],
      ["deadLetterTasks", "prospecting_tasks", { status: "eq.dead_letter" }],
      ["succeededTasks", "prospecting_tasks", { status: "eq.succeeded" }],
      ["queuedMessages", "prospect_outbound_messages", { status: "eq.queued" }],
      ["sentMessages", "prospect_outbound_messages", { status: "eq.sent" }],
      ["deliveredMessages", "prospect_outbound_messages", { status: "eq.delivered" }],
      ["optedOutMessages", "prospect_outbound_messages", { status: "eq.opted_out" }],
    ] as Array<[string, string, Record<string, string>]>);
    const counts = Object.fromEntries(await Promise.all(entries.map(async ([key, table, filters]) => [key, await countRows(env, table, filters)] as const)));
    return json({ status: "ok", checkedAt: new Date().toISOString(), counts });
  } catch (error) {
    return json({ status: "blocked", error: error instanceof Error ? error.message : "overview_failed" }, 503);
  }
}
