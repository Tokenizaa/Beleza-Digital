interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
type Context = { request: Request; env: Env };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function onRequestPost({ request, env }: Context) {
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

  let body: { siteProjectId?: unknown; expiresInDays?: unknown };
  try { body = await request.json() as { siteProjectId?: unknown; expiresInDays?: unknown }; } catch { return json({ error: "invalid_json" }, 400); }
  if (typeof body.siteProjectId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.siteProjectId)) return json({ error: "site_project_id_invalid" }, 400);
  const daysRaw = Number(body.expiresInDays ?? 14);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.floor(daysRaw))) : 14;
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const tokenHash = await digest(token);
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  const headers = new Headers({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "return=representation" });
  const result = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_demo_public_links`, {
    method: "POST", headers,
    body: JSON.stringify({ site_project_id: body.siteProjectId, token_hash: tokenHash, expires_at: expiresAt, created_by: user.id }),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) return json({ error: "demo_link_create_failed" }, 503);
  const created = await result.json() as Array<{ id: string }>;
  if (!created.length) return json({ error: "demo_link_create_failed" }, 503);
  const url = new URL(request.url);
  return json({ id: created[0].id, token, url: `${url.origin}/demo/${token}`, expiresAt }, 201);
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

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const adminCheck = await fetch(`${base}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
    headers, signal: AbortSignal.timeout(5000),
  });
  if (!adminCheck.ok) return json({ error: "admin_membership_check_unavailable" }, 503);
  if (!(await adminCheck.json() as unknown[]).length) return json({ error: "platform_admin_required" }, 403);

  let tasksResponse: Response;
  try {
    tasksResponse = await fetch(`${base}/rest/v1/prospecting_tasks?task_type=eq.publish_demo&status=eq.succeeded&select=id,prospect_id,result,created_at&order=created_at.desc&limit=100`, {
      headers, signal: AbortSignal.timeout(8000),
    });
  } catch { return json({ error: "demo_links_unavailable" }, 502); }
  if (!tasksResponse.ok) return json({ error: "demo_links_unavailable" }, 503);

  const rows = await tasksResponse.json() as Array<{
    id: number; prospect_id: string | null; result: Record<string, unknown>; created_at: string;
  }>;
  if (!rows.length) return json({ links: [] });
  const nowIso = new Date().toISOString();
  const taskIds = rows.map((row) => String(row.id)).join(",");
  const activeLinksUrl = base + "/rest/v1/site_demo_public_links?publish_task_id=in.(" +
    taskIds + ")&status=eq.active&expires_at=gt." + encodeURIComponent(nowIso) +
    "&select=publish_task_id";
  const activeLinksResponse = await fetch(activeLinksUrl, {
    headers, signal: AbortSignal.timeout(8000),
  });
  if (!activeLinksResponse.ok) return json({ error: "demo_links_unavailable" }, 503);
  const activeLinks = await activeLinksResponse.json() as Array<{ publish_task_id: number }>;
  const activeTaskIds = new Set(activeLinks.map((link) => String(link.publish_task_id)));
  const now = Date.now();
  const origin = new URL(request.url).origin;
  const links = rows.flatMap((row) => {
    if (!activeTaskIds.has(String(row.id))) return [];
    const result = row.result ?? {};
    const token = typeof result.publicToken === "string" ? result.publicToken : "";
    const expiresAt = typeof result.expiresAt === "string" ? result.expiresAt : "";
    if (!/^[a-f0-9]{64}$/.test(token) || !expiresAt || new Date(expiresAt).getTime() <= now) return [];
    return [{
      id: row.id,
      prospectId: row.prospect_id,
      url: `${origin}/demo/${token}`,
      expiresAt,
      createdAt: row.created_at,
    }];
  });
  return json({ links });
}
