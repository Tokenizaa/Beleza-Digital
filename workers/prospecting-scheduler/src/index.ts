import { mapDataForTemplate, type MapScrapeData } from "../../../src/lib/template-data-mapper";
import type { SiteVariationId } from "../../../src/types/templates";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PROSPECTING_WORKER_SECRET: string;
  PROSPECTING_BATCH_SIZE?: string;
  PROSPECTING_SOURCE_ENDPOINT?: string;
  PROSPECTING_SOURCE_API_KEY?: string;
  PROSPECTING_SOURCE_PROVIDER?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  WHATSAPP_API_VERSION?: string;
}

interface ProspectingTask {
  id: number;
  task_type: "discover" | "capture" | "qualify" | "generate_demo" | "publish_demo" | "send_whatsapp" | "sync_delivery";
  status: string;
  prospect_id: string | null;
  campaign_id: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  result?: Record<string, unknown>;
}

export type { ProspectingTask };

type Prospect = Record<string, unknown>;

const REQUIRED_TEMPLATE_SLUGS: SiteVariationId[] = [
  "ouro-classico",
  "preto-esmeralda",
  "minimal-studio",
  "safira-executivo",
  "rubi-lounge",
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

function normalizeName(value: unknown): string {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " e ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function normalizeWebsite(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch { return null; }
}

function normalizePhone(value: unknown, countryCode: unknown = "BR"): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (String(countryCode).toUpperCase() === "BR" && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits;
}

function first(prospect: Prospect, keys: string[]): unknown {
  for (const key of keys) if (prospect[key] !== undefined && prospect[key] !== null && prospect[key] !== "") return prospect[key];
  return null;
}

function parseCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function firstCaptured(prospect: Prospect, keys: string[]): unknown {
  const direct = first(prospect, keys);
  if (direct !== null) return direct;
  const captured = prospect.captured_data;
  if (!captured || typeof captured !== "object" || Array.isArray(captured)) return null;
  return first(captured as Prospect, keys);
}

function qualify(prospect: Prospect) {
  const name = first(prospect, ["business_name", "name", "businessName", "company_name"]);
  const category = first(prospect, ["category", "business_category", "segment"]);
  const website = first(prospect, ["website_url", "website", "url", "websiteUrl"]);
  const phone = first(prospect, ["phone", "phone_number", "whatsapp", "mobile"]);
  const country = first(prospect, ["country_code", "countryCode"]) ?? "BR";
  const email = first(prospect, ["email", "email_address"]);
  const address = firstCaptured(prospect, ["address", "formatted_address"]);
  const description = firstCaptured(prospect, ["description", "business_description"]);
  const source = firstCaptured(prospect, ["source_url", "sourceUrl", "source_link"]);
  const ratingValue = first(prospect, ["rating", "stars"]);
  const rating = typeof ratingValue === "number" && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null;
  const reviewCount = parseCount(first(prospect, ["reviewsCount", "reviewCount", "reviews_count", "reviews"]));
  const images = first(prospect, ["images", "photos"]);
  const openingHours = first(prospect, ["openingHours", "opening_hours", "hours"]);
  const latitude = first(prospect, ["latitude", "lat"]);
  const longitude = first(prospect, ["longitude", "lng", "lon"]);
  const normalizedName = normalizeName(String(name ?? ""));
  const hasWebsite = Boolean(normalizeWebsite(website));
  const hasPhone = Boolean(normalizePhone(phone, country));
  const hasAddress = Boolean(String(address ?? "").trim());
  const hasImages = Array.isArray(images) && images.length > 0;
  const hasHours = Array.isArray(openingHours) && openingHours.length > 0;
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";

  const completenessFields: Array<[string, boolean]> = [
    ["businessName", Boolean(normalizedName)],
    ["category", Boolean(String(category ?? "").trim())],
    ["address", hasAddress],
    ["phone", hasPhone],
    ["websiteUrl", hasWebsite],
    ["email", Boolean(typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))],
    ["rating", rating !== null],
    ["reviewCount", reviewCount !== null],
    ["images", hasImages],
    ["openingHours", hasHours],
    ["coordinates", hasCoordinates],
    ["sourceUrl", Boolean(normalizeWebsite(source))],
  ];
  const completenessScore = Math.round(completenessFields.filter((field) => field[1]).length / completenessFields.length * 100);
  const missingFields = completenessFields.filter((field) => !field[1]).map((field) => field[0]);

  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => { score += points; reasons.push("+" + points + ": " + reason); };
  if (normalizedName) add(15, "nome comercial identificado");
  if (String(category ?? "").trim()) add(5, "categoria identificada");
  if (hasAddress) add(10, "endereço público disponível");
  if (hasPhone) add(20, "telefone público disponível");
  if (rating !== null) {
    add(rating >= 4.7 ? 15 : rating >= 4.3 ? 12 : rating >= 3.8 ? 8 : 3, "reputação pública de " + rating.toFixed(1) + "/5");
  }
  if (reviewCount !== null && reviewCount >= 100) add(10, "volume relevante de avaliações");
  else if (reviewCount !== null && reviewCount >= 10) add(6, "avaliações públicas disponíveis");
  if (hasImages) add(5, "fotos públicas identificadas");
  if (hasHours) add(3, "horários públicos identificados");
  if (hasCoordinates) add(2, "localização geográfica identificada");
  if (hasWebsite) add(5, "site público identificado para avaliar qualidade");
  else if (hasPhone || hasAddress) add(10, "site não identificado nesta coleta; oportunidade a confirmar");

  return {
    score: Math.min(100, score),
    reasons,
    missingFields,
    completenessScore,
    opportunityScore: Math.min(100, score),
    normalized_website: normalizeWebsite(website),
    normalized_phone: normalizePhone(phone, country),
  };
}

function requiredEnv(env: Env): string | null {
  if (!env.SUPABASE_URL?.trim()) return "SUPABASE_URL ausente";
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "SUPABASE_SERVICE_ROLE_KEY ausente";
  if (!env.PROSPECTING_WORKER_SECRET?.trim()) return "PROSPECTING_WORKER_SECRET ausente";
  return null;
}

async function db(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("content-type", "application/json");
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(12_000),
  });
}

async function updateTask(env: Env, task: ProspectingTask, workerId: string, patch: Record<string, unknown>) {
  const response = await db(env, `prospecting_tasks?id=eq.${task.id}&status=eq.processing&locked_by=eq.${encodeURIComponent(workerId)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ ...patch, locked_at: null, locked_by: null, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`task_update_http_${response.status}`);
  const rows = await response.json() as unknown[];
  if (!rows.length) throw new Error("task_lease_lost");
  if (patch.result) task.result = patch.result as Record<string, unknown>;
}

async function checkpointTaskResult(env: Env, task: ProspectingTask, workerId: string, result: Record<string, unknown>) {
  const response = await db(env, `prospecting_tasks?id=eq.${task.id}&status=eq.processing&locked_by=eq.${encodeURIComponent(workerId)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ result, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`task_checkpoint_http_${response.status}`);
  if (!(await response.json() as unknown[]).length) throw new Error("task_lease_lost_before_checkpoint");
  task.result = result;
}

async function sendWhatsAppTask(env: Env, task: ProspectingTask, workerId: string) {
  if (!task.prospect_id) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "prospect_id_required",
      last_error: "A tarefa de WhatsApp não contém prospect_id.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_TEMPLATE_NAME || !env.WHATSAPP_API_VERSION) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "whatsapp_provider_not_configured",
      last_error: "Credenciais, versão da Graph API e modelo aprovado do WhatsApp Business Platform não estão configurados.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "provider_not_configured" },
    });
    return "blocked";
  }

  const read = await db(env, `prospects?id=eq.${encodeURIComponent(task.prospect_id)}&select=*&limit=1`);
  if (!read.ok) throw new Error(`prospect_read_http_${read.status}`);
  const rows = await read.json() as Prospect[];
  if (!rows.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "prospect_not_found",
      last_error: "O prospect associado à tarefa não existe.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  const prospect = rows[0];
  const optInAt = first(prospect, ["whatsapp_opt_in_at"]);
  const evidenceUrl = first(prospect, ["whatsapp_opt_in_evidence_url"]);
  const optedOutAt = first(prospect, ["whatsapp_opted_out_at"]);
  const eligibility = first(prospect, ["outreach_eligibility"]);
  const phone = normalizePhone(first(prospect, ["normalized_phone", "phone", "phone_number", "whatsapp", "mobile"]), "BR");
  if (optedOutAt || eligibility !== "eligible" || !optInAt || !normalizeWebsite(evidenceUrl) || !phone) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: optedOutAt ? "prospect_opted_out" : "whatsapp_consent_or_phone_missing",
      last_error: "Envio bloqueado: exige elegibilidade explícita, opt-in com evidência pública válida, telefone válido e ausência de opt-out.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "consent_gate" },
    });
    return "blocked";
  }

  const messageKey = `task:${task.id}:whatsapp`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(phone));
  const destinationHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const existingResponse = await db(env, `prospect_outbound_messages?idempotency_key=eq.${encodeURIComponent(messageKey)}&select=id,status,provider_message_id&limit=1`);
  if (!existingResponse.ok) throw new Error(`whatsapp_message_lookup_http_${existingResponse.status}`);
  const existing = (await existingResponse.json()) as Array<{ id: string; status: string; provider_message_id: string | null }>;
  if (existing.length) {
    const row = existing[0];
    if (["sent", "delivered", "read"].includes(row.status) && row.provider_message_id) {
      await updateTask(env, task, workerId, {
        status: "succeeded", completed_at: new Date().toISOString(),
        result: { outcome: "already_sent", providerMessageId: row.provider_message_id },
      });
      return "succeeded";
    }
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "whatsapp_delivery_reconciliation_required",
      last_error: "Existe tentativa anterior sem confirmação final; reconciliar com o provedor antes de novo envio para evitar duplicidade.",
      completed_at: new Date().toISOString(),
      result: { outcome: "blocked", reason: "delivery_reconciliation_required", messageId: row.id },
    });
    return "blocked";
  }

  const queued = await db(env, "prospect_outbound_messages?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      prospect_id: task.prospect_id,
      campaign_id: task.campaign_id,
      channel: "whatsapp",
      provider: "whatsapp_business_platform",
      destination_hash: destinationHash,
      template_name: env.WHATSAPP_TEMPLATE_NAME,
      template_variables: {},
      status: "attempting",
      idempotency_key: messageKey,
      attempts: 1,
    }),
  });
  if (!queued.ok) throw new Error(`whatsapp_message_create_http_${queued.status}`);
  const created = await queued.json() as Array<{ id: string }>;
  if (!created.length) throw new Error("whatsapp_message_idempotency_conflict");

  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const components = Array.isArray(payload.templateComponents) ? payload.templateComponents : [];
  const templateName = typeof payload.templateName === "string" && payload.templateName.trim ? payload.templateName.trim() : env.WHATSAPP_TEMPLATE_NAME;
  const apiVersion = env.WHATSAPP_API_VERSION.trim();
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("whatsapp_api_version_invalid");
  const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: typeof payload.templateLanguage === "string" ? payload.templateLanguage : (env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR") },
          ...(components.length ? { components } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("whatsapp_provider_result_unknown_reconcile_before_retry");
  }
  const responseBody = await response.json().catch(() => ({})) as {
    messages?: Array<{ id?: string; message_status?: string }>;
    error?: { code?: number; message?: string };
  };
  const providerId = responseBody.messages?.[0]?.id;
  if (!response.ok || !providerId) {
    const message = String(responseBody.error?.message ?? `HTTP ${response.status}`).slice(0, 400);
    const failed = await db(env, `prospect_outbound_messages?id=eq.${encodeURIComponent(created[0].id)}&select=id`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", last_error_code: String(responseBody.error?.code ?? response.status), last_error: message, updated_at: new Date().toISOString() }),
    });
    if (!failed.ok) throw new Error("whatsapp_provider_rejected_and_failure_persist_failed");
    throw new Error(`whatsapp_provider_rejected_${response.status}`);
  }

  const now = new Date().toISOString();
  const sent = await db(env, `prospect_outbound_messages?id=eq.${encodeURIComponent(created[0].id)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      status: "sent", provider_message_id: providerId, sent_at: now,
      provider_evidence: { message_status: responseBody.messages?.[0]?.message_status ?? "accepted_by_provider" },
      updated_at: now,
    }),
  });
  if (!sent.ok || !(await sent.json() as unknown[]).length) throw new Error("whatsapp_provider_accepted_but_persistence_failed");

  const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      prospect_id: task.prospect_id, campaign_id: task.campaign_id,
      event_type: "message_sent", source_provider: "whatsapp_business_platform",
      provider_event_id: providerId, idempotency_key: `task:${task.id}:message-sent`,
      evidence: { providerMessageId: providerId, destinationHash },
    }),
  });
  if (!event.ok) throw new Error("whatsapp_sent_event_persistence_failed");

  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: now, result: { outcome: "sent", providerMessageId: providerId },
  });
  return "succeeded";
}

async function createDedupeKey(candidate: Record<string, unknown>) {
  const website = normalizeWebsite(first(candidate, ["website", "websiteUrl", "website_url", "url"]));
  const phone = normalizePhone(first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"]), first(candidate, ["countryCode", "country_code"]) ?? "BR");
  const name = normalizeName(String(first(candidate, ["name", "businessName", "business_name", "companyName"]) ?? ""));
  const city = normalizeName(String(first(candidate, ["city", "locality"]) ?? ""));
  const region = normalizeName(String(first(candidate, ["region", "state", "province"]) ?? ""));
  const country = String(first(candidate, ["countryCode", "country_code"]) ?? "BR").toUpperCase();
  let identity = "";
  if (website) identity = `website:${website}`;
  else if (phone) identity = `phone:${phone}`;
  else if (name && city && region) identity = `name-location:${name}|city:${city}|region:${region}|country:${country}`;
  else return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function discoverCampaignTask(env: Env, task: ProspectingTask, workerId: string) {
  const campaign = task.payload && typeof task.payload === "object" ? task.payload : {};
  const isManual = Boolean(campaign.manual) && !campaign.campaignId;

  // Modo manual (busca pontual via /api/prospecting/run com createCampaign=false):
  // não depende de endpoint externo. Cria um candidato direto no banco e segue para captura.
  if (isManual) {
    if (!env.SUPABASE_URL?.trim()) throw new Error("discovery_supabase_not_configured");
    const segment = typeof campaign.segment === "string" ? campaign.segment : "";
    const region = typeof campaign.region === "string" ? campaign.region : "";
    const countryCode = typeof campaign.countryCode === "string" ? campaign.countryCode : "BR";
    const limit = Math.max(1, Math.min(Number(campaign.dailyDiscoveryLimit ?? 10), 100));

    const now = new Date().toISOString();
    const dedupeKey = `manual:${segment}:${region}:${countryCode}:${now}`;
    const inserted = await db(env, "prospecting_candidates?on_conflict=dedupe_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        campaign_id: null,
        provider: "manual-prospecting",
        provider_record_id: null,
        dedupe_key: dedupeKey,
        business_name: `${segment} — ${region}`,
        category: segment,
        website_url: null,
        normalized_website: null,
        phone: null,
        normalized_phone: null,
        email: null,
        address: null,
        city: region.split(",")[0]?.trim() || region,
        region: region,
        country_code: countryCode,
        description: `Busca pontual manual: ${segment} em ${region}.`,
        source_url: null,
        qualification_score: 50,
        qualification_reasons: ["+20: nome comercial identificado", "+5: categoria identificada"],
        missing_fields: ["websiteUrl", "phone", "email", "address", "rating", "reviewCount", "images", "openingHours", "coordinates", "sourceUrl"],
        status: "discovered",
        raw_evidence: {
          manual: true,
          segment,
          region,
          countryCode,
          limit,
          observedAt: now,
        },
      }),
    });
    if (!inserted.ok) throw new Error(`manual_candidate_insert_http_${inserted.status}`);
    const insertedRows = await inserted.json() as unknown[];
    let candidateId: string | null = null;
    if (insertedRows.length) {
      candidateId = String(insertedRows[0].id);
    } else {
      const lookup = await db(env, `prospecting_candidates?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`);
      if (!lookup.ok) throw new Error(`manual_candidate_lookup_http_${lookup.status}`);
      const rows = await lookup.json() as Array<{ id: string }>;
      if (rows.length) candidateId = rows[0].id;
    }
    if (!candidateId) throw new Error("manual_candidate_insert_no_id");

    const captureTask = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        campaign_id: null,
        task_type: "capture",
        idempotency_key: `manual-capture:${dedupeKey}`,
        payload: {
          candidateId,
          dedupeKey,
          minimumScore: Number(campaign.minimumScore ?? 50),
        },
      }),
    });
    if (!captureTask.ok) throw new Error(`manual_capture_enqueue_http_${captureTask.status}`);

    await updateTask(env, task, workerId, {
      status: "succeeded", last_error_code: null, last_error: null,
      completed_at: new Date().toISOString(),
      result: { outcome: "discovered_manual", received: 1, inserted: 1, duplicates: 0, rejected: 0, provider: "manual-prospecting", candidateId },
    });
    return "succeeded";
  }

  if (!env.PROSPECTING_SOURCE_ENDPOINT || !env.PROSPECTING_SOURCE_API_KEY || !env.PROSPECTING_SOURCE_PROVIDER) {
    if (task.campaign_id) {
      const campaignBlock = await db(env, `prospecting_campaigns?id=eq.${encodeURIComponent(task.campaign_id)}&select=id`, {
        method: "PATCH", headers: { prefer: "return=minimal" },
        body: JSON.stringify({
          status: "blocked",
          blocked_reason: "Configure provedor autorizado, endpoint HTTPS e credencial server-side antes de reativar.",
          next_run_at: null,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!campaignBlock.ok) throw new Error(`campaign_block_http_${campaignBlock.status}`);
    }
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "discovery_provider_not_configured",
      last_error: "Provedor autorizado de descoberta, endpoint e credencial não estão configurados.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "provider_not_configured" },
    });
    return "blocked";
  }
  let endpoint: URL;
  try { endpoint = new URL(env.PROSPECTING_SOURCE_ENDPOINT); } catch { throw new Error("discovery_endpoint_invalid"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("discovery_endpoint_must_be_https_without_credentials");

  const limitRaw = Number(campaign.dailyDiscoveryLimit ?? 100);
  const dailyLimit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 10000)) : 100;
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const countResponse = await db(env, `prospecting_candidates?campaign_id=eq.${encodeURIComponent(String(campaign.campaignId ?? ""))}&created_at=gte.${encodeURIComponent(dayStart)}&select=id&limit=1`, {
    headers: { prefer: "count=exact" },
  });
  if (!countResponse.ok) throw new Error(`candidate_daily_count_http_${countResponse.status}`);
  const range = countResponse.headers.get("content-range") ?? "";
  const countMatch = range.match(/\/(\d+|\*)$/);
  const discoveredToday = countMatch && countMatch[1] !== "*" ? Number(countMatch[1]) : 0;
  const limit = Math.max(0, dailyLimit - discoveredToday);
  if (limit === 0) {
    await updateTask(env, task, workerId, {
      status: "succeeded", last_error_code: null, last_error: null,
      completed_at: new Date().toISOString(),
      result: { outcome: "daily_limit_reached", dailyLimit, discoveredToday },
    });
    return "succeeded";
  }
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.PROSPECTING_SOURCE_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      provider: env.PROSPECTING_SOURCE_PROVIDER,
      query: {
        segment: campaign.segment,
        region: campaign.region,
        countryCode: campaign.countryCode ?? "BR",
        limit,
      },
      campaignId: campaign.campaignId,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`discovery_provider_http_${response.status}`);
  const body = await response.json() as { results?: unknown; candidates?: unknown; requestId?: string };
  const candidates = Array.isArray(body.results) ? body.results : body.candidates;
  if (!Array.isArray(candidates)) throw new Error("discovery_provider_response_invalid");
  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;
  for (const raw of candidates.slice(0, limit)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { rejected++; continue; }
    const candidate = raw as Record<string, unknown>;
    const businessName = String(first(candidate, ["name", "businessName", "business_name", "companyName"]) ?? "").trim().slice(0, 240);
    const category = String(first(candidate, ["category", "businessCategory", "segment"]) ?? "").trim().slice(0, 120) || null;
    const website = first(candidate, ["website", "websiteUrl", "website_url", "url"]);
    const phone = first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"]);
    const country = String(first(candidate, ["countryCode", "country_code"]) ?? campaign.countryCode ?? "BR").slice(0, 3);
    const websiteNormalized = normalizeWebsite(website);
    const phoneNormalized = normalizePhone(phone, country);
    const sourceUrl = normalizeWebsite(first(candidate, ["sourceUrl", "source_url", "sourceLink"]));
    const dedupeKey = await createDedupeKey(candidate);
    if (!businessName || !dedupeKey) { rejected++; continue; }
    const result = qualify({
      business_name: businessName, category,
      website_url: websiteNormalized, phone: phoneNormalized,
      country_code: country,
      email: first(candidate, ["email", "emailAddress", "email_address"]),
      address: first(candidate, ["address", "formattedAddress", "formatted_address"]),
      description: first(candidate, ["description", "businessDescription"]),
      source_url: sourceUrl,
    });
    const providerRecordId = String(first(candidate, ["id", "placeId", "providerId", "provider_record_id"]) ?? "").slice(0, 250) || null;
    const stored = await db(env, "prospecting_candidates?on_conflict=dedupe_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        campaign_id: campaign.campaignId,
        provider: env.PROSPECTING_SOURCE_PROVIDER,
        provider_record_id: providerRecordId,
        dedupe_key: dedupeKey,
        business_name: businessName,
        category,
        website_url: typeof website === "string" ? website.slice(0, 2000) : null,
        normalized_website: websiteNormalized,
        phone: typeof phone === "string" ? phone.slice(0, 80) : null,
        normalized_phone: phoneNormalized,
        email: typeof first(candidate, ["email", "emailAddress", "email_address"]) === "string" ? String(first(candidate, ["email", "emailAddress", "email_address"])).slice(0, 320) : null,
        address: typeof first(candidate, ["address", "formattedAddress", "formatted_address"]) === "string" ? String(first(candidate, ["address", "formattedAddress", "formatted_address"])).slice(0, 1000) : null,
        city: String(first(candidate, ["city", "locality"]) ?? "").slice(0, 160) || null,
        region: String(first(candidate, ["region", "state", "province"]) ?? campaign.region ?? "").slice(0, 160) || null,
        country_code: country,
        description: typeof first(candidate, ["description", "businessDescription"]) === "string" ? String(first(candidate, ["description", "businessDescription"])).slice(0, 3000) : null,
        source_url: sourceUrl,
        qualification_score: result.score,
        qualification_reasons: result.reasons,
        missing_fields: result.missingFields,
        status: result.score >= 50 ? "qualified" : "discovered",
        raw_evidence: {
          providerRecordId,
          providerRequestId: body.requestId ?? null,
          observedAt: new Date().toISOString(),
          evidence: typeof candidate.evidence === "object" ? candidate.evidence : {},
        },
      }),
    });
    if (!stored.ok) throw new Error(`candidate_persist_http_${stored.status}`);
    const storedRows = await stored.json() as unknown[];
    if (storedRows.length) inserted++;
    else duplicates++;

    const candidateLookup = await db(env, `prospecting_candidates?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`);
    if (!candidateLookup.ok) throw new Error(`candidate_lookup_http_${candidateLookup.status}`);
    const candidateRows = await candidateLookup.json() as Array<{ id: string }>;
    if (candidateRows.length) {
      const capture = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
        method: "POST",
        headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          campaign_id: campaign.campaignId,
          task_type: "capture",
          idempotency_key: `candidate:${dedupeKey}:capture`,
          payload: {
            candidateId: candidateRows[0].id,
            dedupeKey,
            minimumScore: typeof campaign.qualificationRules === "object" && campaign.qualificationRules !== null
              ? (campaign.qualificationRules as Record<string, unknown>).minimum_score ?? 50 : 50,
          },
        }),
      });
      if (!capture.ok) throw new Error(`candidate_capture_enqueue_http_${capture.status}`);
    }
  }
  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "discovered", received: candidates.length, inserted, duplicates, rejected, provider: env.PROSPECTING_SOURCE_PROVIDER },
  });
  return "succeeded";
}

async function captureCandidateTask(env: Env, task: ProspectingTask, workerId: string) {
  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const candidateId = typeof payload.candidateId === "string" ? payload.candidateId : "";
  if (!/^[0-9a-f-]{36}$/i.test(candidateId)) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "candidate_id_required",
      last_error: "A tarefa de captura não contém um candidateId válido.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  const response = await db(env, "rpc/promote_prospecting_candidate", {
    method: "POST",
    body: JSON.stringify({ p_candidate_id: candidateId }),
  });
  if (!response.ok) throw new Error(`candidate_promotion_http_${response.status}`);
  const result = await response.json() as { prospectId?: string; created?: boolean; alreadyPromoted?: boolean };
  if (!result.prospectId) throw new Error("candidate_promotion_missing_prospect_id");

  const qualificationTask = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      campaign_id: task.campaign_id,
      prospect_id: result.prospectId,
      task_type: "qualify",
      idempotency_key: `prospect:${result.prospectId}:qualify:v1`,
      payload: {
        candidateId,
        promotedFromCandidate: true,
        minimumScore: typeof payload.minimumScore === "number" ? payload.minimumScore : 50,
      },
    }),
  });
  if (!qualificationTask.ok) throw new Error(`qualification_enqueue_http_${qualificationTask.status}`);

  await updateTask(env, task, workerId, {
    prospect_id: result.prospectId,
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "captured", prospectId: result.prospectId, created: result.created, alreadyPromoted: result.alreadyPromoted },
  });
  return "succeeded";
}

async function resolveRequiredTemplateVersions(env: Env): Promise<Array<{ id: string; slug: string; focus: string; sections: string[] }>> {
  const rows: Array<{ id: string; slug: string; focus: string; sections: string[] }> = [];
  for (const slug of REQUIRED_TEMPLATE_SLUGS) {
    const configResponse = await db(env, `site_template_versions?select=id,config&template_id=eq.(${encodeURIComponent(slug)})&is_published=eq.true&order=version.desc&limit=1`);
    if (!configResponse.ok) continue;
    const configRows = await configResponse.json() as Array<{ id: string; config: Record<string, unknown> }>;
    if (!configRows.length) continue;
    const config = configRows[0].config ?? {};
    const sections = Array.isArray(config.sections) ? config.sections : [];
    const focus = typeof config.focus === "string" ? config.focus : "";
    rows.push({ id: configRows[0].id, slug, focus, sections });
  }
  return rows;
}

async function nextProjectVersion(env: Env, siteProjectId: string): Promise<number> {
  const current = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(siteProjectId)}&select=version&order=version.desc&limit=1`);
  if (!current.ok) throw new Error(`demo_version_read_http_${current.status}`);
  const versions = await current.json() as Array<{ version: number }>;
  return (versions[0]?.version ?? 0) + 1;
}

async function generateDemoTask(env: Env, task: ProspectingTask, workerId: string) {
  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const siteProjectId = typeof payload.siteProjectId === "string" ? payload.siteProjectId : "";
  if (!task.prospect_id || (siteProjectId && !/^[0-9a-f-]{36}$/i.test(siteProjectId))) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_context_invalid",
      last_error: "Geração de demonstração exige um prospect_id válido; o site_project_id, quando informado, deve ser UUID.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "demo_context_invalid" },
    });
    return "blocked";
  }

  const templateVersions = await resolveRequiredTemplateVersions(env);
  if (templateVersions.length !== REQUIRED_TEMPLATE_SLUGS.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "template_version_required",
      last_error: "Nem todas as versões de modelo obrigatórias estão publicadas.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "template_version_required", found: templateVersions.length },
    });
    return "blocked";
  }

  let resolvedProjectId = siteProjectId;
  if (!resolvedProjectId) {
    const projectResult = await db(env, "rpc/ensure_prospect_site_project", {
      method: "POST", body: JSON.stringify({ p_prospect_id: task.prospect_id, p_template_version_id: templateVersions[0].id }),
    });
    if (!projectResult.ok) throw new Error(`demo_project_create_http_${projectResult.status}`);
    const projectBody = await projectResult.json() as { siteProjectId?: string };
    if (!projectBody.siteProjectId || !/^[0-9a-f-]{36}$/i.test(projectBody.siteProjectId)) {
      throw new Error("demo_project_create_missing_id");
    }
    resolvedProjectId = projectBody.siteProjectId;
  }

  const projectResponse = await db(env, `site_projects?id=eq.${encodeURIComponent(resolvedProjectId)}&select=id&limit=1`);
  if (!projectResponse.ok) throw new Error(`demo_project_read_http_${projectResponse.status}`);
  if (!(await projectResponse.json() as unknown[]).length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "site_project_not_found",
      last_error: "O projeto de site informado não existe.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }

  const prospectResponse = await db(env, `prospects?id=eq.${encodeURIComponent(task.prospect_id)}&select=*&limit=1`);
  if (!prospectResponse.ok) throw new Error(`demo_prospect_read_http_${prospectResponse.status}`);
  const prospects = await prospectResponse.json() as Prospect[];
  if (!prospects.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "prospect_not_found",
      last_error: "Prospect não encontrado para gerar a demonstração.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  const prospect = prospects[0];

  const defaultGeneratedContent = {
    businessName: first(prospect, ["business_name", "name", "company_name"]) ?? "Negócio local",
    category: first(prospect, ["category", "business_category", "segment"]),
    headline: firstCaptured(prospect, ["tagline", "headline", "description", "business_description"]),
    description: firstCaptured(prospect, ["description", "business_description"]),
    website: first(prospect, ["website_url", "website", "url"]),
    phone: first(prospect, ["normalized_phone", "phone", "phone_number"]),
    email: first(prospect, ["email", "email_address"]),
    address: firstCaptured(prospect, ["address", "formatted_address"]),
    city: first(prospect, ["city", "locality"]),
    region: first(prospect, ["region", "state", "province"]),
    sourceUrl: firstCaptured(prospect, ["source_url", "sourceUrl", "source_link"]),
    generatedAt: new Date().toISOString(),
    generationMode: "deterministic-prospect-profile",
  };

  const existingVersions = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(resolvedProjectId)}&select=id,version,template_version_id,generated_content,design_overrides&order=version.asc`);
  if (!existingVersions.ok) throw new Error(`demo_generation_reconcile_http_${existingVersions.status}`);
  const existingRows = await existingVersions.json() as Array<{
    id: string; version: number; template_version_id: string;
    generated_content: Record<string, unknown>; design_overrides: Record<string, unknown>;
  }>;

  const created: Array<{ id: string; version: number; slug: string }> = [];
  const requestedDesignOverrides = payload.designOverrides && typeof payload.designOverrides === "object"
    ? payload.designOverrides as Record<string, unknown> : {};

  for (const templateVersion of templateVersions) {
    const existing = existingRows.find((row) => row.template_version_id === templateVersion.id);
    if (existing) {
      // Idempotência: reaproveita a versão já comprometida para este template; nunca duplica.
      created.push({ id: existing.id, version: existing.version, slug: templateVersion.slug });
      continue;
    }

    const version = await nextProjectVersion(env, resolvedProjectId);
    const prospectData: MapScrapeData = {
      businessName: first(prospect, ["business_name", "name", "company_name"]),
      category: first(prospect, ["category", "business_category", "segment"]),
      description: firstCaptured(prospect, ["tagline", "headline", "description", "business_description"]),
      website: first(prospect, ["website_url", "website", "url"]) || null,
      phone: first(prospect, ["normalized_phone", "phone", "phone_number"]) || null,
      email: first(prospect, ["email", "email_address"]) || null,
      address: firstCaptured(prospect, ["address", "formatted_address"]) || null,
      city: first(prospect, ["city", "locality"]) || null,
      region: first(prospect, ["region", "state", "province"]) || null,
      sourceUrl: firstCaptured(prospect, ["source_url", "sourceUrl", "source_link"]) || null,
      photos: [],
      videos: [],
      rating: null,
      review_count: null,
      opening_hours: null,
      services_attributes: null,
      media_items: null,
    };
    const mappedContent = mapDataForTemplate(prospectData, { focus: templateVersion.focus, sections: templateVersion.sections } as never);
    const generatedContent: Record<string, unknown> = {
      ...defaultGeneratedContent,
      ...mappedContent,
    };
    const designOverrides: Record<string, unknown> = requestedDesignOverrides;

    const inserted = await db(env, "site_project_versions", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        site_project_id: resolvedProjectId,
        version,
        generation_task_id: task.id,
        template_version_id: templateVersion.id,
        generated_content: generatedContent,
        design_overrides: designOverrides,
        selected_by_prospect: false,
        selection_source: "system",
      }),
    });
    if (!inserted.ok) throw new Error(`demo_version_insert_http_${inserted.status}`);
    const insertedRows = await inserted.json() as Array<{ id: string; version: number }>;
    if (!insertedRows.length) throw new Error("demo_version_insert_no_rows");
    created.push({ id: insertedRows[0].id, version: insertedRows[0].version, slug: templateVersion.slug });
  }

  const projectDraft = await db(env, `site_projects?id=eq.${encodeURIComponent(resolvedProjectId)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      template_version_id: templateVersions[0].id,
      generated_content: defaultGeneratedContent,
      design_overrides: requestedDesignOverrides,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!projectDraft.ok || !(await projectDraft.json() as unknown[]).length) {
    throw new Error("demo_project_draft_persistence_failed");
  }

  for (const version of created) {
    const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        prospect_id: task.prospect_id,
        campaign_id: task.campaign_id,
        site_project_id: resolvedProjectId,
        event_type: "demo_generated",
        source_provider: "prospecting-worker",
        idempotency_key: `site-project:${resolvedProjectId}:version:${version.version}:template:${version.slug}:generated`,
        evidence: { versionId: version.id, version: version.version, templateVersionId: templateVersions.find((t) => t.slug === version.slug)?.id, slug: version.slug },
      }),
    });
    if (!event.ok) throw new Error("demo_generated_event_persistence_failed");
  }

  const publishTask = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      campaign_id: task.campaign_id,
      prospect_id: task.prospect_id,
      task_type: "publish_demo",
      idempotency_key: `site-project:${resolvedProjectId}:publish-demo:v1`,
      payload: { siteProjectId: resolvedProjectId, expiresInDays: 14 },
    }),
  });
  if (!publishTask.ok) throw new Error(`demo_publish_enqueue_http_${publishTask.status}`);

  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "demo_generated", siteProjectId: resolvedProjectId, versions: created.map((v) => ({ slug: v.slug, versionId: v.id, version: v.version })) },
  });
  return "succeeded";
}

async function publishDemoTask(env: Env, task: ProspectingTask, workerId: string) {
  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const siteProjectId = typeof payload.siteProjectId === "string" ? payload.siteProjectId : "";
  if (!/^[0-9a-f-]{36}$/i.test(siteProjectId)) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "site_project_id_required",
      last_error: "Publicação exige um siteProjectId válido.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  const project = await db(env, `site_projects?id=eq.${encodeURIComponent(siteProjectId)}&select=id&limit=1`);
  if (!project.ok) throw new Error(`publish_project_read_http_${project.status}`);
  if (!(await project.json() as unknown[]).length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "site_project_not_found",
      last_error: "Projeto de site não encontrado para publicação.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }
  const versionsResponse = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(siteProjectId)}&select=id,template_version_id&order=version.asc`);
  if (!versionsResponse.ok) throw new Error(`publish_versions_read_http_${versionsResponse.status}`);
  const projectVersions = await versionsResponse.json() as Array<{ id: string; template_version_id: string }>;
  if (projectVersions.length !== REQUIRED_TEMPLATE_SLUGS.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_version_required",
      last_error: `Publicação exige todas as ${REQUIRED_TEMPLATE_SLUGS.length} versões obrigatórias. Encontradas: ${projectVersions.length}.`,
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "demo_version_required", found: projectVersions.length },
    });
    return "blocked";
  }

  const templateVersions = await resolveRequiredTemplateVersions(env);
  const publishedIds = new Set(templateVersions.map((t) => t.id));
  const allTemplatesPresent = projectVersions.every((v) => publishedIds.has(v.template_version_id));
  if (!allTemplatesPresent) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_version_invalid",
      last_error: "Uma ou mais versões do projeto não correspondem aos templates obrigatórios publicados.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "demo_version_invalid" },
    });
    return "blocked";
  }

  const priorToken = typeof task.result?.publicToken === "string" && /^[a-f0-9]{64}$/.test(task.result.publicToken)
    ? task.result.publicToken : "";
  const rawDays = Number(payload.expiresInDays ?? 14);
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(30, Math.floor(rawDays))) : 14;
  const priorExpiry = typeof task.result?.expiresAt === "string" ? task.result.expiresAt : "";
  if (priorToken && priorExpiry && new Date(priorExpiry).getTime() <= Date.now()) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "publish_link_expired_before_reconciliation",
      last_error: "A tentativa anterior já tem link expirado; gere uma nova tarefa de publicação para criar um link novo.",
      completed_at: new Date().toISOString(), result: { ...(task.result ?? {}), outcome: "blocked", reason: "previous_link_expired" },
    });
    return "blocked";
  }
  const expiresAt = priorToken && priorExpiry ? priorExpiry : new Date(Date.now() + days * 86400000).toISOString();
  let token = priorToken;
  if (!token) {
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    token = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await checkpointTaskResult(env, task, workerId, {
      ...(task.result ?? {}), outcome: "publishing", siteProjectId, publicToken: token, expiresAt,
    });
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const created = await db(env, "site_demo_public_links?on_conflict=publish_task_id", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      site_project_id: siteProjectId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      publish_task_id: task.id,
    }),
  });
  if (!created.ok) throw new Error(`publish_link_create_http_${created.status}`);
  let rows = await created.json() as Array<{ id: string }>;
  if (!rows.length) {
    const existing = await db(env, `site_demo_public_links?publish_task_id=eq.${task.id}&select=id,token_hash,expires_at&limit=1`);
    if (!existing.ok) throw new Error(`publish_link_reconcile_http_${existing.status}`);
    const existingRows = await existing.json() as Array<{ id: string; token_hash: string; expires_at: string }>;
    if (!existingRows.length || existingRows[0].token_hash !== tokenHash) throw new Error("publish_link_idempotency_conflict");
    rows = [{ id: existingRows[0].id }];
  }

  if (task.prospect_id) {
    const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        prospect_id: task.prospect_id,
        campaign_id: task.campaign_id,
        site_project_id: siteProjectId,
        event_type: "demo_published",
        source_provider: "prospecting-worker",
        idempotency_key: `site-project:${siteProjectId}:link:${rows[0].id}:published`,
        evidence: { linkId: rows[0].id, expiresAt },
      }),
    });
    if (!event.ok) throw new Error("demo_published_event_persistence_failed");
  }

  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "published", publicPath: `/demo/${token}`, publicToken: token, linkId: rows[0].id, expiresAt },
  });
  return "succeeded";
}

async function executeTask(env: Env, task: ProspectingTask, workerId: string) {
  if (task.task_type === "send_whatsapp") return sendWhatsAppTask(env, task, workerId);
  if (task.task_type === "discover") return discoverCampaignTask(env, task, workerId);
  if (task.task_type === "capture") return captureCandidateTask(env, task, workerId);
  if (task.task_type === "generate_demo") return generateDemoTask(env, task, workerId);
  if (task.task_type === "publish_demo") return publishDemoTask(env, task, workerId);
  if (task.task_type !== "qualify") {
    await updateTask(env, task, workerId, {
      status: "blocked",
      last_error_code: "integration_not_configured",
      last_error: `Handler de ${task.task_type} depende da integração correspondente, ainda não habilitada.`,
      completed_at: new Date().toISOString(),
      result: { outcome: "blocked", reason: "integration_not_configured" },
    });
    return "blocked";
  }
  if (!task.prospect_id) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "prospect_id_required",
      last_error: "A tarefa de qualificação não contém prospect_id.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }

  const read = await db(env, `prospects?id=eq.${encodeURIComponent(task.prospect_id)}&select=*&limit=1`);
  if (!read.ok) throw new Error(`prospect_read_http_${read.status}`);
  const prospects = await read.json() as Prospect[];
  if (!prospects.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "prospect_not_found",
      last_error: "O prospect associado à tarefa não existe.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }

  const result = qualify(prospects[0]);
  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const minimumScoreRaw = Number(payload.minimumScore ?? 50);
  const minimumScore = Number.isFinite(minimumScoreRaw) ? Math.max(0, Math.min(100, Math.floor(minimumScoreRaw))) : 50;
  const passedQualification = result.score >= minimumScore;
  const write = await db(env, `prospects?id=eq.${encodeURIComponent(task.prospect_id)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      qualification_score: result.score,
      qualification_reasons: result.reasons,
      normalized_website: result.normalized_website,
      normalized_phone: result.normalized_phone,
      last_seen_at: new Date().toISOString(),
    }),
  });
  if (!write.ok) throw new Error(`prospect_update_http_${write.status}`);
  if (!(await write.json() as unknown[]).length) throw new Error("prospect_update_no_rows");

  const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      prospect_id: task.prospect_id,
      campaign_id: task.campaign_id,
      event_type: passedQualification ? "qualified" : "disqualified",
      source_provider: "prospecting-worker",
      idempotency_key: `task:${task.id}:qualification:${passedQualification ? "qualified" : "disqualified"}`,
      evidence: { score: result.score, missing_fields: result.missingFields },
    }),
  });
  if (!event.ok) throw new Error(`prospect_event_http_${event.status}`);

  const candidateId = typeof payload.candidateId === "string" ? payload.candidateId : "";
  if (/^[0-9a-f-]{36}$/i.test(candidateId)) {
    const candidateUpdate = await db(env, `prospecting_candidates?id=eq.${encodeURIComponent(candidateId)}&select=id`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        status: passedQualification ? "qualified" : "disqualified",
        qualification_score: result.score,
        qualification_reasons: result.reasons,
        missing_fields: result.missingFields,
        prospect_id: task.prospect_id,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!candidateUpdate.ok || !(await candidateUpdate.json() as unknown[]).length) {
      throw new Error("candidate_qualification_persistence_failed");
    }
  }

  let demoPipeline: Record<string, unknown> = { status: "skipped", reason: "qualification_score_below_threshold", minimumScore };
  if (passedQualification) {
    const templateVersions = await resolveRequiredTemplateVersions(env);
    if (templateVersions.length === REQUIRED_TEMPLATE_SLUGS.length) {
      const projectResult = await db(env, "rpc/ensure_prospect_site_project", {
        method: "POST", body: JSON.stringify({ p_prospect_id: task.prospect_id, p_template_version_id: templateVersions[0].id }),
      });
      if (!projectResult.ok) throw new Error(`qualified_project_create_http_${projectResult.status}`);
      const projectBody = await projectResult.json() as { siteProjectId?: string; created?: boolean };
      if (!projectBody.siteProjectId || !/^[0-9a-f-]{36}$/i.test(projectBody.siteProjectId)) {
        throw new Error("qualified_project_create_missing_id");
      }
      const demoTask = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
        method: "POST",
        headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          campaign_id: task.campaign_id,
          prospect_id: task.prospect_id,
          task_type: "generate_demo",
          idempotency_key: `prospect:${task.prospect_id}:generate-demo:v1`,
          payload: { siteProjectId: projectBody.siteProjectId, expiresInDays: 14 },
        }),
      });
      if (!demoTask.ok) throw new Error(`qualified_demo_enqueue_http_${demoTask.status}`);
      demoPipeline = { status: "queued", siteProjectId: projectBody.siteProjectId, projectCreated: Boolean(projectBody.created), templates: templateVersions.length };
    } else {
      demoPipeline = { status: "skipped", reason: "missing_required_templates", found: templateVersions.length };
    }
  }

  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "qualified", score: result.score, missingFields: result.missingFields, demoPipeline },
  });
  return "succeeded";
}

async function scheduleDueCampaigns(env: Env) {
  if (!env.SUPABASE_URL?.trim()) {
    return { campaignsScanned: 0, campaignsQueued: 0, campaignsSkipped: 0 };
  }
  const now = new Date();
  const due = await db(env, `prospecting_campaigns?status=eq.active&next_run_at=lte.${encodeURIComponent(now.toISOString())}&select=id,name,segment,region,country_code,source_provider,source_config,qualification_rules,schedule,daily_discovery_limit,next_run_at&order=next_run_at.asc&limit=20`);
  if (!due.ok) throw new Error(`campaign_scan_http_${due.status}`);
  const campaigns = await due.json() as Array<Record<string, unknown>>;
  let queued = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    const campaignId = String(campaign.id ?? "");
    const dueAt = String(campaign.next_run_at ?? "");
    if (!campaignId || !dueAt) { skipped++; continue; }
    const key = `campaign:${campaignId}:run:${dueAt}`;
    const task = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        campaign_id: campaignId,
        task_type: "discover",
        status: "pending",
        idempotency_key: key,
        payload: {
          campaignId,
          campaignName: campaign.name,
          segment: campaign.segment,
          region: campaign.region,
          countryCode: campaign.country_code ?? "BR",
          sourceProvider: campaign.source_provider,
          sourceConfig: campaign.source_config ?? {},
          qualificationRules: campaign.qualification_rules ?? {},
          dailyDiscoveryLimit: campaign.daily_discovery_limit ?? 100,
          scheduledFor: dueAt,
        },
      }),
    });
    if (!task.ok) throw new Error(`campaign_enqueue_http_${task.status}`);

    const schedule = campaign.schedule && typeof campaign.schedule === "object"
      ? campaign.schedule as Record<string, unknown> : {};
    const rawInterval = Number(schedule.interval_minutes ?? 1440);
    const interval = Number.isFinite(rawInterval) ? Math.max(5, Math.min(Math.floor(rawInterval), 10080)) : 1440;
    const nextRun = new Date(Math.max(now.getTime(), new Date(dueAt).getTime()) + interval * 60_000).toISOString();
    const advance = await db(env, `prospecting_campaigns?id=eq.${encodeURIComponent(campaignId)}&status=eq.active&next_run_at=eq.${encodeURIComponent(dueAt)}&select=id`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ last_run_at: now.toISOString(), next_run_at: nextRun, updated_at: now.toISOString() }),
    });
    if (!advance.ok) throw new Error(`campaign_advance_http_${advance.status}`);
    const rows = await advance.json() as unknown[];
    if (rows.length) queued++;
    else skipped++;
  }
  return { campaignsScanned: campaigns.length, campaignsQueued: queued, campaignsSkipped: skipped };
}

async function processBatch(env: Env) {
  const missing = requiredEnv(env);
  if (missing) throw new Error(missing);
  const campaignSchedule = await scheduleDueCampaigns(env);
  const workerId = `cf-cron-${crypto.randomUUID()}`;
  const parsedLimit = Number.parseInt(env.PROSPECTING_BATCH_SIZE ?? "10", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 25)) : 10;
  const response = await db(env, "rpc/claim_prospecting_tasks", {
    method: "POST",
    body: JSON.stringify({ p_worker_id: workerId, p_limit: limit }),
  });
  if (!response.ok) throw new Error(`claim_tasks_http_${response.status}`);
  const tasks = await response.json() as ProspectingTask[];
  const counts = { claimed: tasks.length, succeeded: 0, blocked: 0, retryable: 0, deadLetter: 0 };

  for (const task of tasks) {
    try {
      const result = await executeTask(env, task, workerId);
      if (result === "succeeded") counts.succeeded++;
      else counts.blocked++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "unknown_worker_error";
      const retry = task.attempt_count < task.max_attempts;
      const delaySeconds = Math.min(3600, 30 * (2 ** Math.min(task.attempt_count - 1, 7)));
      const status = retry ? "retryable" : "dead_letter";
      try {
        await updateTask(env, task, workerId, {
          status,
          available_at: retry ? new Date(Date.now() + delaySeconds * 1000).toISOString() : new Date().toISOString(),
          last_error_code: message.split("_")[0].slice(0, 100),
          last_error: message,
          completed_at: retry ? null : new Date().toISOString(),
          result: { ...(task.result ?? {}), outcome: status, attempt: task.attempt_count },
        });
        if (retry) counts.retryable++; else counts.deadLetter++;
      } catch {
        // Leave the lease to expire. The atomic claim function recovers stale processing tasks.
      }
    }
  }
  return { ...campaignSchedule, ...counts };
}

export default {
  async scheduled(
    _event: { cron: string; scheduledTime: number },
    env: Env,
    _ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    const execution = processBatch(env);
    _ctx.waitUntil(execution.then(() => undefined));
    await execution;
  },
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    const supplied = request.headers.get("authorization") ?? "";
    if (!env.PROSPECTING_WORKER_SECRET || supplied !== `Bearer ${env.PROSPECTING_WORKER_SECRET}`) {
      return json({ error: "unauthorized" }, 401);
    }
    try {
      const counts = await processBatch(env);
      return json({ status: "ok", ...counts });
    } catch (error) {
      return json({ status: "blocked", error: error instanceof Error ? error.message : "worker_failed" }, 503);
    }
  },
};

export { normalizeName, normalizeWebsite, normalizePhone, qualify, createDedupeKey, resolveRequiredTemplateVersions, generateDemoTask, publishDemoTask, scheduleDueCampaigns, processBatch };
