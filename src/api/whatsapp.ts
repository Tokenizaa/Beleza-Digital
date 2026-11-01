interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;
}
type Context = { request: Request; env: Env };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function db(env: Env, path: string, init: RequestInit = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("webhook_database_not_configured");
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("content-type", "application/json");
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
}
function normalizedPhone(value: string) { return value.replace(/\D/g, ""); }
export async function onRequest({ request, env }: Context) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && constantTimeEqual(token, env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) && challenge) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    }
    return json({ error: "webhook_verification_failed" }, 403);
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!env.WHATSAPP_APP_SECRET) return json({ error: "webhook_secret_not_configured" }, 503);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature.startsWith("sha256=")) return json({ error: "signature_required" }, 401);
  const expected = await hmac(env.WHATSAPP_APP_SECRET, rawBody);
  if (!constantTimeEqual(signature.slice(7).toLowerCase(), expected)) return json({ error: "invalid_signature" }, 401);

  let payload: {
    entry?: Array<{ changes?: Array<{ value?: {
      statuses?: Array<{ id?: string; status?: string; timestamp?: string; recipient_id?: string; errors?: unknown[] }>;
      messages?: Array<{ from?: string; id?: string; type?: string; text?: { body?: string }; timestamp?: string }>;
    } }> }>;
  };
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }

  let receipts = 0;
  let optOuts = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue;
        const state = status.status.toLowerCase();
        const mapped = state === "sent" ? "sent" : state === "delivered" ? "delivered" : state === "read" ? "read" : state === "failed" ? "failed" : null;
        if (!mapped) continue;
        const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
        const lookup = await db(env, `prospect_outbound_messages?provider_message_id=eq.${encodeURIComponent(status.id)}&select=id,prospect_id,campaign_id,status&limit=1`);
        if (!lookup.ok) throw new Error(`message_lookup_http_${lookup.status}`);
        const messages = await lookup.json() as Array<{ id: string; prospect_id: string; campaign_id: string | null; status: string }>;
        if (!messages.length) continue;
        const message = messages[0];
        const update: Record<string, unknown> = { status: mapped, provider_evidence: { webhookStatus: state, errors: status.errors ?? [], receivedAt: new Date().toISOString() }, updated_at: new Date().toISOString() };
        if (mapped === "sent") update.sent_at = timestamp;
        if (mapped === "delivered") update.delivered_at = timestamp;
        if (mapped === "read") update.read_at = timestamp;
        if (mapped === "failed") { update.last_error_code = "whatsapp_delivery_failed"; update.last_error = JSON.stringify(status.errors ?? []).slice(0, 500); }
        const statusGuard = mapped === "sent"
          ? "&status=not.in.(delivered,read,failed,opted_out)"
          : mapped === "delivered"
            ? "&status=not.in.(read,failed,opted_out)"
            : mapped === "failed"
              ? "&status=not.in.(delivered,read,opted_out)"
              : "";
        const saved = await db(env, `prospect_outbound_messages?id=eq.${encodeURIComponent(message.id)}${statusGuard}&select=id`, {
          method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(update),
        });
        if (!saved.ok) throw new Error(`message_update_http_${saved.status}`);
        if (mapped === "delivered" || mapped === "read" || mapped === "failed") {
          const eventType = mapped === "failed" ? "message_failed" : mapped === "delivered" ? "message_delivered" : "message_delivered";
          const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
            method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
            body: JSON.stringify({
              prospect_id: message.prospect_id, campaign_id: message.campaign_id, event_type: eventType,
              source_provider: "whatsapp_business_platform", provider_event_id: `${status.id}:${mapped}`,
              idempotency_key: `whatsapp:${status.id}:${mapped}`,
              evidence: { status: state, timestamp, errors: status.errors ?? [] },
            }),
          });
          if (!event.ok) throw new Error("message_event_persist_failed");
        }
        receipts++;
      }

      for (const incoming of value.messages ?? []) {
        const body = incoming.type === "text" ? incoming.text?.body ?? "" : "";
        if (!incoming.from || !/^(sair|parar|cancelar|stop|unsubscribe|não quero|nao quero)$/i.test(body.trim())) continue;
        const phone = normalizedPhone(incoming.from);
        const prospectsResponse = await db(env, `prospects?normalized_phone=eq.${encodeURIComponent(phone)}&select=id&limit=100`);
        if (!prospectsResponse.ok) throw new Error("optout_prospect_lookup_failed");
        const prospects = await prospectsResponse.json() as Array<{ id: string }>;
        for (const prospect of prospects) {
          const now = new Date().toISOString();
          const update = await db(env, `prospects?id=eq.${encodeURIComponent(prospect.id)}&select=id`, {
            method: "PATCH", headers: { prefer: "return=representation" },
            body: JSON.stringify({ outreach_eligibility: "opted_out", whatsapp_opted_out_at: now, whatsapp_consent_updated_at: now }),
          });
          if (!update.ok) throw new Error("optout_persist_failed");
          const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
            method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
            body: JSON.stringify({
              prospect_id: prospect.id, event_type: "opted_out",
              source_provider: "whatsapp_business_platform", provider_event_id: incoming.id ?? null,
              idempotency_key: `whatsapp-optout:${incoming.id ?? `${prospect.id}:${phone}:${incoming.timestamp ?? ""}`}`,
              evidence: { source: "inbound_keyword", receivedAt: now },
            }),
          });
          if (!event.ok) throw new Error("optout_event_persist_failed");
          optOuts++;
        }
      }
    }
  }
  return json({ status: "ok", receiptsProcessed: receipts, optOutsProcessed: optOuts });
}
