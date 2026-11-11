export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PROSPECTING_WORKER_SECRET: string;
  PROSPECTING_BATCH_SIZE?: string;
  BROWSERLESS_TOKEN: string;
  BROWSERLESS_BASE_URL?: string;
  // WhatsApp — Evolution API (futuro) ou manual por enquanto
  // WHATSAPP_EVOLUTION_URL?: string;
  // WHATSAPP_EVOLUTION_API_KEY?: string;
  // WHATSAPP_EVOLUTION_INSTANCE?: string;
  // Legacy Meta Cloud API (mantido para compatibilidade futura)
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  WHATSAPP_API_VERSION?: string;
}

// Import rich extractor and normalizer from migrated mais-clientes-v2 logic
import { discoverGoogleMapsWithBrowserless } from "./browserless";
import {
  normalizeAddress,
  normalizePhone,
  normalizeWebsite,
  normalizeBusinessStatus,
  normalizeRating,
  normalizeReviewCount,
  normalizePriceRange,
  parseAddressComponents,
  parseSearchLocationFallback,
  extractSourcePlaceId,
  cleanBusinessName,
  sanitizeRating,
  sanitizeReviewCount,
  sanitizePhotos,
} from './normalizer';

// Import shared qualification logic from frontend library
import {
  normalizeBusinessName,
  createProspectDedupeKey,
  qualifyProspect,
  qualifyCommercialOpportunity,
  type CommercialPotentialInput,
  type CommercialOpportunityQualification,
} from "../../../src/lib/prospecting";
import { validateAndHydrateMessageTemplate } from "../../../src/lib/message-templates";
import { mapDataForTemplate } from "../../../src/lib/template-data-mapper";
import { SITE_TEMPLATES } from "../../../src/types/templates";

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

type Prospect = Record<string, unknown>;

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

// Use shared preferredTemplateSlug logic
function preferredTemplateSlug(prospect: Prospect): string {
  const signal = normalizeBusinessName([
    first(prospect, ["category", "business_category", "segment"]),
    first(prospect, ["business_name", "name", "company_name"]),
    first(prospect, ["description", "business_description"]),
  ].filter(Boolean).join(" "));
  if (/barbearia|barber/.test(signal)) return "preto-esmeralda";
  if (/executiv|premium|luxo|vip/.test(signal)) return "safira-executivo";
  if (/salao|cabeleireir|hair|rubi|lounge/.test(signal)) return "rubi-lounge";
  if (/estetica|clinica|spa|studio|manicure|depilacao/.test(signal)) return "minimal-studio";
  return "ouro-classico";
}

function qualify(prospect: Prospect): {
  score: number;
  completenessScore: number;
  reasons: string[];
  missingFields: string[];
} {
  let score = 0;
  let completenessScore = 0;
  const reasons: string[] = [];
  const missingFields: string[] = [];

  const name = first(prospect, ["name", "business_name", "company_name"]);
  if (name && typeof name === "string" && name.trim()) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: nome comercial identificado");
  } else {
    missingFields.push("businessName");
  }

  const category = first(prospect, ["category", "business_category", "segment"]);
  if (category && typeof category === "string" && category.trim()) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: categoria identificada");
  } else {
    missingFields.push("category");
  }

  const website = normalizeWebsite(first(prospect, ["website", "website_url", "url"]));
  if (website) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: site público identificado");
  } else {
    missingFields.push("websiteUrl");
  }

  const phone = normalizePhone(first(prospect, ["phone", "normalized_phone"]), first(prospect, ["countryCode", "country_code"]) || "BR");
  if (phone) {
    score += 15;
    completenessScore += 10;
    reasons.push("+15: telefone válido");
  } else {
    missingFields.push("phone");
  }

  const email = first(prospect, ["email", "email_address"]);
  if (email && typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: email comercial identificado");
  } else {
    missingFields.push("email");
  }

  const address = firstCaptured(prospect, ["address", "formatted_address"]);
  if (address && typeof address === "string" && address.trim()) {
    completenessScore += 10;
    reasons.push("+10: endereço disponível");
  } else {
    missingFields.push("address");
  }

  const rating = first(prospect, ["rating"]);
  if (typeof rating === "number" && rating > 0) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: reputação com nota no Maps");
  } else {
    missingFields.push("rating");
  }

  const reviews = first(prospect, ["reviewsCount", "review_count", "reviewCount"]);
  if (reviews !== null && reviews !== undefined && Number(reviews) > 0) {
    score += 10;
    completenessScore += 10;
    reasons.push("+10: tração de avaliações");
  } else {
    missingFields.push("reviewsCount");
  }

  const images = first(prospect, ["images", "photos"]);
  if (Array.isArray(images) && images.length > 0) {
    score += 5;
    completenessScore += 10;
    reasons.push("+5: acervo de fotos da ficha");
  } else {
    missingFields.push("images");
  }

  const openingHours = first(prospect, ["openingHours", "opening_hours", "horario"]);
  if (openingHours) {
    score += 5;
    completenessScore += 10;
    reasons.push("+5: horários de funcionamento");
  } else {
    missingFields.push("openingHours");
  }

  return {
    score,
    completenessScore,
    reasons,
    missingFields,
  };
}

function requiredEnv(env: Env): string | null {
  if (!env.SUPABASE_URL?.trim()) return "SUPABASE_URL ausente";
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "SUPABASE_SERVICE_ROLE_KEY ausente";
  if (!env.PROSPECTING_WORKER_SECRET?.trim()) return "PROSPECTING_WORKER_SECRET ausente";
  if (!env.BROWSERLESS_TOKEN?.trim()) return "BROWSERLESS_TOKEN ausente";
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
    // Provider acceptance may have happened before a network/process failure. Never blindly resend.
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "whatsapp_delivery_reconciliation_required",
      last_error: "Existe tentativa anterior sem confirmação final; reconciliar com o provedor antes de novo envio para evitar duplicidade.",
      completed_at: new Date().toISOString(),
      result: { outcome: "blocked", reason: "delivery_reconciliation_required", messageId: row.id },
    });
    return "blocked";
  }

  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const requestedTemplateId = typeof payload.templateId === "string" ? payload.templateId : "PROPOSTA_5_MODELOS";
  
  const clientName = first(prospect, ["business_name", "name", "company_name"]);
  const serviceHighlight = first(prospect, ["category", "business_category", "segment"]);
  const demoUrl = typeof payload.demoUrl === "string" ? payload.demoUrl : first(prospect, ["demo_url"]);
  const city = first(prospect, ["city", "locality"]);
  const rating = first(prospect, ["rating"]);
  const reviewsCount = first(prospect, ["reviewsCount", "review_count"]);
  const reputationStr = rating ? `nota ${rating} ⭐ no Maps${reviewsCount ? ` com ${reviewsCount} avaliações` : ''}` : '';

  const validation = validateAndHydrateMessageTemplate(requestedTemplateId, {
    cliente_nome: clientName,
    servico_destaque: serviceHighlight,
    link_proposta: demoUrl,
    reputacao_sufixo: reputationStr,
    cidade: city,
  });

  const queued = await db(env, "prospect_outbound_messages?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      prospect_id: task.prospect_id,
      campaign_id: task.campaign_id,
      channel: "whatsapp",
      provider: "whatsapp_business_platform",
      destination_hash: destinationHash,
      template_name: typeof payload.templateName === "string" && payload.templateName.trim()
        ? payload.templateName.trim() : env.WHATSAPP_TEMPLATE_NAME,
      template_variables: validation.hydratedVariables,
      status: "attempting",
      idempotency_key: messageKey,
      attempts: 1,
    }),
  });
  if (!queued.ok) throw new Error(`whatsapp_message_create_http_${queued.status}`);
  const created = await queued.json() as Array<{ id: string }>;
  if (!created.length) throw new Error("whatsapp_message_idempotency_conflict");

  const components = Array.isArray(payload.templateComponents) && payload.templateComponents.length > 0
    ? payload.templateComponents
    : validation.metaComponents;
  const templateName = typeof payload.templateName === "string" && payload.templateName.trim()
    ? payload.templateName.trim() : env.WHATSAPP_TEMPLATE_NAME;
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
    // We cannot prove whether the provider accepted the request. Preserve the attempting row and block retries.
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
  const featureId = String(first(candidate, ["featureId", "feature_id", "googleFeatureId"]) ?? "").trim();
  const placeId = String(first(candidate, ["placeId", "place_id", "googlePlaceId"]) ?? "").trim();
  const website = normalizeWebsite(first(candidate, ["website", "websiteUrl", "website_url", "url"]));
  const phone = normalizePhone(first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"]), first(candidate, ["countryCode", "country_code"]) ?? "BR");
  const name = normalizeName(String(first(candidate, ["name", "businessName", "business_name", "companyName"]) ?? ""));
  const city = normalizeName(String(first(candidate, ["city", "locality"]) ?? ""));
  const region = normalizeName(String(first(candidate, ["region", "state", "province"]) ?? ""));
  const country = String(first(candidate, ["countryCode", "country_code"]) ?? "BR").toUpperCase();
  let identity = "";
  if (featureId) identity = "google-feature:" + featureId;
  else if (placeId) identity = "google-place:" + placeId;
  else if (website) identity = "website:" + website;
  else if (phone) identity = "phone:" + phone;
  else if (name && city && region) identity = "name-location:" + name + "|city:" + city + "|region:" + region + "|country:" + country;
  else return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return "sha256:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function discoverCampaignTask(env: Env, task: ProspectingTask, workerId: string) {
  const campaign = task.payload && typeof task.payload === "object" ? task.payload : {};
  const limitRaw = Number(campaign.dailyDiscoveryLimit ?? 100);
  const dailyLimit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 10000)) : 100;
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const countResponse = campaign.campaignId
    ? await db(env, `prospecting_candidates?campaign_id=eq.${encodeURIComponent(String(campaign.campaignId))}&created_at=gte.${encodeURIComponent(dayStart)}&select=id&limit=1`, {
        headers: { prefer: "count=exact" },
      })
    : null;
  if (countResponse && !countResponse.ok) throw new Error(`candidate_daily_count_http_${countResponse.status}`);
  const range = countResponse?.headers.get("content-range") ?? "";
  const countMatch = range.match(/\/(\d+|\*)$/);
  const discoveredToday = countMatch && countMatch[1] !== "*" ? Number(countMatch[1]) : 0;
  const limit = campaign.campaignId ? Math.max(0, dailyLimit - discoveredToday) : dailyLimit;
  if (limit === 0) {
    await updateTask(env, task, workerId, {
      status: "succeeded", last_error_code: null, last_error: null,
      completed_at: new Date().toISOString(),
      result: { outcome: "daily_limit_reached", dailyLimit, discoveredToday },
    });
    return "succeeded";
  }

  const segment = String(campaign.segment ?? "barbearia e salão");
  const region = String(campaign.region ?? "São Paulo - SP");
  const countryCode = String(campaign.countryCode ?? "BR");
  const searchQuery = [segment, region].join(" ").trim();
  let lastError: Error | null = null;
  let step = "browserless_function";
  let scrapedResults: Array<Record<string, unknown>> = [];

  try {
    const discovery = await discoverGoogleMapsWithBrowserless({
      token: env.BROWSERLESS_TOKEN,
      baseUrl: env.BROWSERLESS_BASE_URL,
      searchQuery,
      limit: Math.min(limit, 100),
    });
    scrapedResults = discovery.results.map((record) => ({
      ...record,
      city: first(record, ["city", "locality"]) ?? region.split(/\s+-\s+/)[0]?.trim() ?? null,
      region: first(record, ["region", "state", "province"]) ?? region.split(/\s+-\s+/)[1]?.trim() ?? region,
      countryCode,
      provider: "google-maps-browserless",
      searchQuery,
    }));
    step = "browserless_completed";
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  // Se após todas as tentativas ainda houver erro, marcar como bloqueado
  if (lastError) {
    const errorMessage = lastError.message ?? "browser_scraping_failed";
    const isRateLimit = /429|rate limit|over capacity|throttl/i.test(errorMessage);
    const isTransient = isRateLimit || /timeout|timed out|network|ERR_|target page|frame was detached|temporarily|browserless_http_5\d\d/i.test(errorMessage);
    const attemptsRemain = task.attempt_count < task.max_attempts;

    if (isTransient && attemptsRemain) {
      const retryAfterMatch = errorMessage.match(/retry after (\d+)/i);
      const retryAfterSeconds = retryAfterMatch ? Number(retryAfterMatch[1]) : null;
      const exponentialDelay = Math.min(900, (isRateLimit ? 300 : 60) * (2 ** Math.max(0, task.attempt_count - 1)));
      const delaySeconds = Math.max(60, Math.min(900, retryAfterSeconds ?? exponentialDelay));
      const availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      await updateTask(env, task, workerId, {
        status: "retryable",
        available_at: availableAt,
        last_error_code: isRateLimit ? "browser_rate_limited" : "browser_transient_error",
        last_error: `Coleta temporariamente indisponível no passo '${step}'. Nova tentativa após ${delaySeconds}s. ${errorMessage}`.slice(0, 1000),
        completed_at: null,
        result: {
          outcome: "retryable",
          reason: isRateLimit ? "browser_rate_limited" : "browser_transient_error",
          failedStep: step,
          attempt: task.attempt_count,
          maxAttempts: task.max_attempts,
          availableAt,
        },
      });
      return "retryable";
    }

    const terminalStatus = isTransient ? "dead_letter" : "blocked";
    await updateTask(env, task, workerId, {
      status: terminalStatus,
      last_error_code: isTransient ? "browser_retries_exhausted" : "browser_scraping_failed",
      last_error: "Falha na coleta via Browserless no passo '" + step + "': " + errorMessage.slice(0, 1000),
      completed_at: new Date().toISOString(),
      result: {
        outcome: terminalStatus,
        reason: isTransient ? "browserless_retries_exhausted" : "browserless_scraping_failed",
        failedStep: step,
        provider: "browserless",
        attempt: task.attempt_count,
        maxAttempts: task.max_attempts,
      },
    });
    return terminalStatus;
  }

  if (!scrapedResults.length) {
    await updateTask(env, task, workerId, {
      status: "succeeded", last_error_code: null, last_error: null,
      completed_at: new Date().toISOString(),
      result: { outcome: "no_results", searched: searchQuery },
    });
    return "succeeded";
  }

  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;
  let qualified = 0;
  for (const raw of scrapedResults.slice(0, limit)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { rejected++; continue; }
    const candidate = raw as Record<string, unknown>;
    const rawBusinessName = String(first(candidate, ["name", "businessName", "business_name", "companyName"]) ?? "").trim();
    const businessName = (cleanBusinessName(rawBusinessName) || rawBusinessName).slice(0, 240);
    const category = String(first(candidate, ["category", "businessCategory", "segment"]) ?? "").trim().slice(0, 120) || null;
    const website = first(candidate, ["website", "websiteUrl", "website_url", "url"]);
    const phone = first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"]);
    const country = String(first(candidate, ["countryCode", "country_code"]) ?? countryCode).slice(0, 3);
    const websiteNormalized = normalizeWebsite(website);
    const phoneNormalized = normalizePhone(phone, country);
    const sourceUrlValue = first(candidate, ["sourceUrl", "source_url", "sourceLink"]);
    const sourceUrl = typeof sourceUrlValue === "string" && /^https?:\/\//i.test(sourceUrlValue.trim())
      ? sourceUrlValue.trim().slice(0, 2000)
      : null;
    const identityCandidate = {
      ...candidate,
      city: first(candidate, ["city", "locality"]) ?? region.split(/\s+-\s+/)[0],
      region: first(candidate, ["region", "state", "province"]) ?? region.split(/\s+-\s+/)[1] ?? region,
      countryCode: first(candidate, ["countryCode", "country_code"]) ?? countryCode,
    };
    const dedupeKey = await createDedupeKey(identityCandidate);
    if (!businessName || !dedupeKey) { rejected++; continue; }

    // Use shared qualification logic (cadastral + commercial)
    const rating = sanitizeRating(first(candidate, ["rating", "stars"]));
    const reviewCount = sanitizeReviewCount(first(candidate, ["reviewsCount", "reviewCount", "reviews_count", "reviews"]));
    const openingHours = first(candidate, ["openingHours", "opening_hours", "hours"]);
    const operatingStatus = normalizeBusinessStatus(first(candidate, ["operatingStatus", "business_status"]) as string) || null;
    const rawAddress = first(candidate, ["address", "formattedAddress", "formatted_address"]);
    const address = typeof rawAddress === "string" ? normalizeAddress(rawAddress).slice(0, 1000) || null : null;
    const images = sanitizePhotos(first(candidate, ["images", "photos"]));

    const cadastralInput = {
      businessName: businessName,
      category: category || undefined,
      websiteUrl: websiteNormalized,
      phone: phoneNormalized,
      email: first(candidate, ["email", "emailAddress", "email_address"]) as string | null,
      address: address,
      description: first(candidate, ["description", "businessDescription"]) as string | null,
      sourceUrl: sourceUrl,
      countryCode: country,
    };

    const commercialInput: CommercialPotentialInput = {
      ...cadastralInput,
      rating: rating ?? undefined,
      reviewCount: reviewCount ?? undefined,
      operatingStatus: operatingStatus as string | null,
      openingHours: Array.isArray(openingHours) ? openingHours.join(', ') : (openingHours as string | null),
    };

    const cadastralResult = qualifyProspect(cadastralInput);
    const commercialResult = qualifyCommercialOpportunity(commercialInput, cadastralResult);

    // Qualify based on commercial score (opportunity)
    if (commercialResult.commercialScore >= 50) qualified++;

    const providerRecordId = String(first(candidate, ["featureId", "feature_id", "placeId", "place_id", "providerId", "provider_record_id"]) ?? "").slice(0, 250) || null;
    const stored = await db(env, "prospecting_candidates?on_conflict=dedupe_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        campaign_id: campaign.campaignId ?? null,
        provider: "google-maps-browserless",
        provider_record_id: providerRecordId,
        dedupe_key: dedupeKey,
        business_name: businessName,
        category,
        website_url: typeof website === "string" ? website.slice(0, 2000) : null,
        normalized_website: websiteNormalized,
        phone: typeof phone === "string" ? phone.slice(0, 80) : null,
        normalized_phone: phoneNormalized,
        email: typeof first(candidate, ["email", "emailAddress", "email_address"]) === "string" ? String(first(candidate, ["email", "emailAddress", "email_address"])).slice(0, 320) : null,
        address: address,
        city: String(first(candidate, ["city", "locality"]) ?? region.split(/\s+-\s+/)[0] ?? "").slice(0, 160) || null,
        region: String(first(candidate, ["region", "state", "province"]) ?? region.split(/\s+-\s+/)[1] ?? region ?? "").slice(0, 160) || null,
        country_code: country,
        description: typeof first(candidate, ["description", "businessDescription"]) === "string" ? String(first(candidate, ["description", "businessDescription"])).slice(0, 3000) : null,
        source_url: sourceUrl,
        qualification_score: cadastralResult.score, // Cadastral/completeness score
        qualification_reasons: cadastralResult.reasons,
        missing_fields: cadastralResult.missingFields,
        status: commercialResult.commercialScore >= 50 ? "qualified" : "discovered",
        raw_evidence: {
          schemaVersion: 2,
          rating: rating ?? null,
          reviewsCount: reviewCount,
          reviewCount: reviewCount,
          commercial_score: commercialResult.commercialScore,
          commercialScore: commercialResult.commercialScore,
          commercial_level: commercialResult.commercialLevel,
          commercialLevel: commercialResult.commercialLevel,
          commercial_reasons: commercialResult.commercialReasons,
          suggestedTemplate: commercialResult.suggestedTemplate,
          demo_token: `demo-${dedupeKey.slice(7, 23)}`,
          placeId: first(candidate, ["placeId", "place_id"]) ?? null,
          featureId: first(candidate, ["featureId", "feature_id"]) ?? null,
          latitude: first(candidate, ["latitude", "lat"]) ?? null,
          longitude: first(candidate, ["longitude", "lng", "lon"]) ?? null,
          images: images,
          openingHours: Array.isArray(openingHours) ? openingHours.slice(0, 14) : [],
          priceLevel: first(candidate, ["priceLevel", "price_level"]) ?? null,
          operatingStatus: operatingStatus,
          editorialSummary: first(candidate, ["editorialSummary", "editorial_summary"]) ?? null,
          fieldStatus: candidate.fieldStatus && typeof candidate.fieldStatus === "object" ? candidate.fieldStatus : {},
          // Fields expected by frontend (ScrapingConsole.tsx)
          cadastralScore: cadastralResult.score,
          completenessScore: cadastralResult.score,
          cadastralReasons: cadastralResult.reasons,
          cadastralMissingFields: cadastralResult.missingFields,
          commercialScore: commercialResult.commercialScore,
          opportunityScore: commercialResult.commercialScore,
          commercialReasons: commercialResult.commercialReasons,
          commercialLevel: commercialResult.commercialLevel,
          suggestedTemplate: commercialResult.suggestedTemplate,
          providerRecordId,
          providerRequestId: null,
          observedAt: new Date().toISOString(),
          evidence: { scraped: true, searchQuery, sourceUrl: candidate.sourceUrl, listingText: candidate.rawListingText ?? null },
        },
      }),
    });
    if (!stored.ok) throw new Error(`candidate_persist_http_${stored.status}`);
    const storedRows = await stored.json() as Array<{ id?: string; status?: string; prospect_id?: string | null }>;
    let persistedCandidate = storedRows[0] ?? null;

    if (storedRows.length) {
      inserted++;
    } else {
      duplicates++;
      // A duplicate may still be awaiting promotion. Recover it by its stable
      // dedupe key and enqueue capture idempotently; never create a second lead.
      const existingCandidateResponse = await db(env, `prospecting_candidates?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id,status,prospect_id&limit=1`);
      if (!existingCandidateResponse.ok) {
        throw new Error(`candidate_dedupe_lookup_http_${existingCandidateResponse.status}`);
      }
      persistedCandidate = (await existingCandidateResponse.json() as Array<{ id?: string; status?: string; prospect_id?: string | null }>)[0] ?? null;
    }

    if (
      persistedCandidate?.id &&
      !persistedCandidate.prospect_id &&
      !["blocked", "disqualified", "duplicate"].includes(String(persistedCandidate.status ?? ""))
    ) {
      const captureTask = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
        method: "POST",
        headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          campaign_id: campaign.campaignId ?? null,
          task_type: "capture",
          idempotency_key: `candidate:${persistedCandidate.id}:capture:v1`,
          payload: { candidateId: persistedCandidate.id, minimumScore: 50 },
        }),
      });
      if (!captureTask.ok) {
        throw new Error(`candidate_capture_enqueue_http_${captureTask.status}`);
      }
    }


  }
  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "discovered", received: scrapedResults.length, inserted, duplicates, rejected, qualified, provider: "google-maps-browserless", searchQuery },
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

async function generateDemoTask(env: Env, task: ProspectingTask, workerId: string) {
  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const siteProjectId = typeof payload.siteProjectId === "string" ? payload.siteProjectId : "";
  const requestedTemplateVersionId = typeof payload.templateVersionId === "string" ? payload.templateVersionId : "";
  if (!task.prospect_id || (siteProjectId && !/^[0-9a-f-]{36}$/i.test(siteProjectId)) || (requestedTemplateVersionId && !/^[0-9a-f-]{36}$/i.test(requestedTemplateVersionId))) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_context_invalid",
      last_error: "Geração de demonstração exige um prospect_id válido; IDs opcionais, quando informados, devem ser UUIDs.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "demo_context_invalid" },
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

  const templateResponse = await db(env, "site_template_versions?is_published=eq.true&select=id,template_id,site_templates(slug,is_active)&order=created_at.desc&limit=100");
  if (!templateResponse.ok) throw new Error(`demo_templates_read_http_${templateResponse.status}`);
  const templateRows = await templateResponse.json() as Array<{
    id: string;
    site_templates?: { slug?: string; is_active?: boolean } | null;
  }>;
  const requiredSlugs = ["ouro-classico", "preto-esmeralda", "minimal-studio", "safira-executivo", "rubi-lounge"] as const;
  const templatesBySlug = new Map<string, { id: string }>();
  for (const row of templateRows) {
    const slug = row.site_templates?.slug;
    if (slug && requiredSlugs.includes(slug as typeof requiredSlugs[number]) && row.site_templates?.is_active !== false && !templatesBySlug.has(slug)) {
      templatesBySlug.set(slug, { id: row.id });
    }
  }
  const missingSlugs = requiredSlugs.filter((slug) => !templatesBySlug.has(slug));
  if (missingSlugs.length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "five_published_templates_required",
      last_error: `Modelos publicados ausentes: ${missingSlugs.join(", ")}.`,
      completed_at: new Date().toISOString(),
      result: { outcome: "blocked", reason: "five_published_templates_required", missingSlugs },
    });
    return "blocked";
  }

  let defaultSlug = preferredTemplateSlug(prospect);
  if (!requiredSlugs.includes(defaultSlug as typeof requiredSlugs[number])) defaultSlug = "ouro-classico";
  if (requestedTemplateVersionId) {
    const requested = [...templatesBySlug.entries()].find(([, template]) => template.id === requestedTemplateVersionId);
    if (requested) defaultSlug = requested[0];
  }

  let resolvedProjectId = siteProjectId;
  if (!resolvedProjectId) {
    const defaultTemplate = templatesBySlug.get(defaultSlug)!;
    const projectResult = await db(env, "rpc/ensure_prospect_site_project", {
      method: "POST", body: JSON.stringify({ p_prospect_id: task.prospect_id, p_template_version_id: defaultTemplate.id }),
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

  const capturedData = prospect.captured_data && typeof prospect.captured_data === "object" && !Array.isArray(prospect.captured_data)
    ? prospect.captured_data as Record<string, unknown> : {};
  const rawEvidence = capturedData.raw_evidence && typeof capturedData.raw_evidence === "object" && !Array.isArray(capturedData.raw_evidence)
    ? capturedData.raw_evidence as Record<string, unknown> : {};
  const sourceRecord = {
    ...prospect,
    raw_evidence: rawEvidence,
    provider: capturedData.provider,
    social_links: rawEvidence.socialLinks ?? rawEvidence.social_links,
  };

  const generatedBySlug = new Map<string, Record<string, unknown>>();
  for (const slug of requiredSlugs) {
    const template = SITE_TEMPLATES[slug];
    const mapped = mapDataForTemplate(sourceRecord, template);
    generatedBySlug.set(slug, {
      ...mapped,
      businessName: mapped.name,
      phone: mapped.contact.phone,
      address: mapped.contact.address,
      city: mapped.contact.city,
      region: mapped.contact.region,
      note: mapped.rating === null ? "" : String(mapped.rating) + "/5 no Google Maps",
      "quantidade-de-avaliacoes": mapped.reviewCount === null ? "" : String(mapped.reviewCount),
      "faixa-de-preco": mapped.priceRange ?? "",
      horario: mapped.openingHours ?? "",
      generatedAt: new Date().toISOString(),
      generationMode: "scraped-place-normalized",
      sourceCapturedAt: capturedData.source_captured_at ?? prospect.source_captured_at ?? null,
    });
  }

  const existingVersionResponse = await db(env, `site_project_versions?generation_task_id=eq.${task.id}&select=id,version,template_version_id,generated_content,design_overrides&limit=10`);
  if (!existingVersionResponse.ok) throw new Error(`demo_generation_reconcile_http_${existingVersionResponse.status}`);
  const existingVersions = await existingVersionResponse.json() as Array<{
    id: string; version: number; template_version_id: string;
    generated_content: Record<string, unknown>; design_overrides: Record<string, unknown>;
  }>;
  const existingByTemplate = new Map(existingVersions.map((version) => [version.template_version_id, version]));
  const designOverrides = payload.designOverrides && typeof payload.designOverrides === "object"
    ? payload.designOverrides as Record<string, unknown> : {};

  const currentResponse = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(resolvedProjectId)}&select=version,generation_task_id&order=version.desc&limit=100`);
  if (!currentResponse.ok) throw new Error(`demo_version_read_http_${currentResponse.status}`);
  const currentVersions = await currentResponse.json() as Array<{ version: number; generation_task_id?: number | null }>;
  const baseVersion = currentVersions
    .filter((version) => version.generation_task_id !== task.id)
    .reduce((maximum, version) => Math.max(maximum, Number(version.version) || 0), 0);

  // The prospect's recommended model is ranked last so it is the first preview
  // returned by the public endpoint (which sorts versions descending).
  const orderedSlugs = [...requiredSlugs.filter((slug) => slug !== defaultSlug), defaultSlug];
  const rankBySlug = new Map(orderedSlugs.map((slug, index) => [slug, index + 1]));
  const generatedVersions: Array<{ id: string; version: number; templateVersionId: string; slug: string }> = [];

  for (const slug of requiredSlugs) {
    const templateVersion = templatesBySlug.get(slug)!;
    const existing = existingByTemplate.get(templateVersion.id);
    if (existing) {
      generatedVersions.push({ id: existing.id, version: existing.version, templateVersionId: templateVersion.id, slug });
      continue;
    }

    const version = baseVersion + (rankBySlug.get(slug) ?? 1);
    const inserted = await db(env, "site_project_versions", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        site_project_id: resolvedProjectId,
        version,
        generation_task_id: task.id,
        template_version_id: templateVersion.id,
        generated_content: generatedBySlug.get(slug),
        design_overrides: designOverrides,
        selected_by_prospect: false,
        selection_source: "system",
      }),
    });
    if (!inserted.ok) throw new Error(`demo_version_insert_http_${inserted.status}:${await inserted.text().catch(() => "")}`);
    const created = await inserted.json() as Array<{ id: string; version: number }>;
    if (!created.length) throw new Error(`demo_version_insert_no_rows_for_${slug}`);
    generatedVersions.push({ id: created[0].id, version: created[0].version, templateVersionId: templateVersion.id, slug });
  }

  const defaultTemplateVersion = templatesBySlug.get(defaultSlug)!;
  const defaultGeneratedContent = generatedBySlug.get(defaultSlug)!;
  const projectDraft = await db(env, `site_projects?id=eq.${encodeURIComponent(resolvedProjectId)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      template_version_id: defaultTemplateVersion.id,
      generated_content: defaultGeneratedContent,
      design_overrides: designOverrides,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!projectDraft.ok || !(await projectDraft.json() as unknown[]).length) {
    throw new Error("demo_project_draft_persistence_failed");
  }

  const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      prospect_id: task.prospect_id,
      campaign_id: task.campaign_id,
      site_project_id: resolvedProjectId,
      event_type: "demo_generated",
      source_provider: "prospecting-worker",
      idempotency_key: `site-project:${resolvedProjectId}:generation-task:${task.id}:generated`,
      evidence: {
        defaultTemplateSlug: defaultSlug,
        versions: generatedVersions,
      },
    }),
  });
  if (!event.ok) throw new Error("demo_generated_event_persistence_failed");

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
    result: {
      outcome: "demo_generated",
      siteProjectId: resolvedProjectId,
      defaultTemplateSlug: defaultSlug,
      versions: generatedVersions,
    },
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
  const versionsResponse = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(siteProjectId)}&select=id&limit=1`);
  if (!versionsResponse.ok) throw new Error(`publish_versions_read_http_${versionsResponse.status}`);
  if (!(await versionsResponse.json() as unknown[]).length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_version_required",
      last_error: "Gere pelo menos uma versão da demonstração antes de publicar.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
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

  const prospect = prospects[0];

  // Use shared qualification logic (cadastral + commercial)
  const cadastralInput = {
    businessName: first(prospect, ["business_name", "name", "company_name"]) as string | null,
    category: first(prospect, ["category", "business_category", "segment"]) as string | null,
    websiteUrl: first(prospect, ["website_url", "website", "url"]) as string | null,
    phone: first(prospect, ["normalized_phone", "phone", "phone_number", "whatsapp", "mobile"]) as string | null,
    email: first(prospect, ["email", "email_address"]) as string | null,
    address: firstCaptured(prospect, ["address", "formatted_address"]) as string | null,
    description: firstCaptured(prospect, ["description", "business_description"]) as string | null,
    sourceUrl: firstCaptured(prospect, ["source_url", "sourceUrl", "source_link"]) as string | null,
    countryCode: first(prospect, ["country_code", "countryCode"]) as string | null,
  };

  const commercialInput = {
    ...cadastralInput,
    rating: first(prospect, ["rating", "stars"]) as number | null,
    reviewCount: first(prospect, ["review_count", "reviewsCount", "reviewCount", "reviews"]) as number | null,
    operatingStatus: first(prospect, ["operating_status", "business_status"]) as string | null,
    openingHours: firstCaptured(prospect, ["opening_hours", "openingHours", "hours"]) as string | null,
  };

  const cadastralResult = qualifyProspect(cadastralInput);
  const commercialResult = qualifyCommercialOpportunity(commercialInput, cadastralResult);

  const payload = task.payload && typeof task.payload === "object" ? task.payload : {};
  const minimumScoreRaw = Number(payload.minimumScore ?? 50);
  const minimumScore = Number.isFinite(minimumScoreRaw) ? Math.max(0, Math.min(100, Math.floor(minimumScoreRaw))) : 50;
  // Use commercial score for qualification decision
  const passedQualification = commercialResult.commercialScore >= minimumScore;

  const write = await db(env, `prospects?id=eq.${encodeURIComponent(task.prospect_id)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      qualification_score: cadastralResult.score, // Store cadastral score
      qualification_reasons: cadastralResult.reasons,
      normalized_website: cadastralResult.evidence.websiteUrl as string | null,
      normalized_phone: cadastralResult.evidence.phone as string | null,
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
      evidence: {
        cadastralScore: cadastralResult.score,
        commercialScore: commercialResult.commercialScore,
        missing_fields: cadastralResult.missingFields
      },
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
        qualification_score: cadastralResult.score, // Cadastral score
        qualification_reasons: cadastralResult.reasons,
        missing_fields: cadastralResult.missingFields,
        prospect_id: task.prospect_id,
        updated_at: new Date().toISOString(),
        raw_evidence: {
          // Update raw_evidence with both scores
          cadastralScore: cadastralResult.score,
          completenessScore: cadastralResult.score,
          cadastralReasons: cadastralResult.reasons,
          cadastralMissingFields: cadastralResult.missingFields,
          commercialScore: commercialResult.commercialScore,
          opportunityScore: commercialResult.commercialScore,
          commercialReasons: commercialResult.commercialReasons,
          commercialLevel: commercialResult.commercialLevel,
          suggestedTemplate: commercialResult.suggestedTemplate,
        },
      }),
    });
    if (!candidateUpdate.ok || !(await candidateUpdate.json() as unknown[]).length) {
      throw new Error("candidate_qualification_persistence_failed");
    }
  }

  let demoPipeline: Record<string, unknown> = { status: "skipped", reason: "qualification_score_below_threshold", minimumScore };
  if (passedQualification) {
    const templateLookup = await db(env, "site_template_versions?is_published=eq.true&select=id,created_at,site_templates(slug,is_active)&order=created_at.desc");
    if (!templateLookup.ok) throw new Error(`qualified_template_lookup_http_${templateLookup.status}`);
    const templates = await templateLookup.json() as Array<{
      id: string;
      created_at?: string;
      site_templates?: { slug?: string; is_active?: boolean } | null;
    }>;
    const preferredSlug = commercialResult.suggestedTemplate; // Use shared logic
    const activeTemplates = templates.filter((item) => item.site_templates?.is_active !== false);
    const selectedTemplate = activeTemplates.find((item) => item.site_templates?.slug === preferredSlug)
      ?? activeTemplates.find((item) => item.site_templates?.slug === "ouro-classico")
      ?? activeTemplates[0];
    const templateVersionId = selectedTemplate?.id;
    if (!templateVersionId) throw new Error("qualified_published_template_missing");
    const projectResult = await db(env, "rpc/ensure_prospect_site_project", {
      method: "POST", body: JSON.stringify({ p_prospect_id: task.prospect_id, p_template_version_id: templateVersionId }),
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
        payload: { siteProjectId: projectBody.siteProjectId, templateVersionId, expiresInDays: 14 },
      }),
    });
    if (!demoTask.ok) throw new Error(`qualified_demo_enqueue_http_${demoTask.status}`);
    demoPipeline = { status: "queued", siteProjectId: projectBody.siteProjectId, projectCreated: Boolean(projectBody.created) };
  }

  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: {
      outcome: "qualified",
      cadastralScore: cadastralResult.score,
      commercialScore: commercialResult.commercialScore,
      missingFields: cadastralResult.missingFields,
      demoPipeline
    },
  });
  return "succeeded";
}

async function scheduleDueCampaigns(env: Env) {
  const now = new Date();
  const due = await db(env, "prospecting_campaigns?status=eq.active&next_run_at=lte." + encodeURIComponent(now.toISOString()) + "&select=id,name,segment,region,country_code,source_provider,source_config,qualification_rules,schedule,daily_discovery_limit,next_run_at&order=next_run_at.asc&limit=20");
  if (!due.ok) throw new Error("campaign_scan_http_" + due.status);
  const campaigns = await due.json() as Array<Record<string, unknown>>;
  let queued = 0;
  let advanced = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    const campaignId = String(campaign.id ?? "");
    const dueAt = String(campaign.next_run_at ?? "");
    const segment = String(campaign.segment ?? "").trim();
    const region = String(campaign.region ?? "").trim();
    if (!campaignId || !dueAt || !segment || !region) {
      skipped++;
      continue;
    }

    const campaignSchedule = campaign.schedule && typeof campaign.schedule === "object"
      ? campaign.schedule as Record<string, unknown> : {};
    const intervalRaw = Number(campaignSchedule.interval_minutes ?? 1440);
    const interval = Number.isFinite(intervalRaw)
      ? Math.max(5, Math.min(Math.floor(intervalRaw), 10080))
      : 1440;
    const limitRaw = Number(campaign.daily_discovery_limit ?? 100);
    const dailyDiscoveryLimit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(Math.floor(limitRaw), 10000))
      : 100;
    const rules = campaign.qualification_rules && typeof campaign.qualification_rules === "object"
      ? campaign.qualification_rules as Record<string, unknown> : {};
    const minimumScoreRaw = Number(rules.minimum_score ?? rules.minimumScore ?? 50);
    const minimumScore = Number.isFinite(minimumScoreRaw)
      ? Math.max(0, Math.min(100, Math.floor(minimumScoreRaw)))
      : 50;
    const idempotencyKey = "campaign:" + campaignId + ":discover:" + dueAt;

    const enqueued = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        campaign_id: campaignId,
        task_type: "discover",
        status: "pending",
        idempotency_key: idempotencyKey,
        payload: {
          campaignId,
          segment,
          region,
          countryCode: String(campaign.country_code ?? "BR"),
          dailyDiscoveryLimit,
          minimumScore,
          scheduled: true,
          scheduledFor: dueAt,
        },
      }),
    });
    if (!enqueued.ok) throw new Error("campaign_discovery_enqueue_http_" + enqueued.status);
    let taskRows = await enqueued.json() as Array<{ id: number }>;
    if (!taskRows.length) {
      const existing = await db(env, "prospecting_tasks?idempotency_key=eq." + encodeURIComponent(idempotencyKey) + "&select=id&limit=1");
      if (!existing.ok) throw new Error("campaign_discovery_reconcile_http_" + existing.status);
      taskRows = await existing.json() as Array<{ id: number }>;
    }
    if (!taskRows.length) throw new Error("campaign_discovery_enqueue_unconfirmed");
    queued++;

    const nextRun = new Date(Math.max(now.getTime(), new Date(dueAt).getTime()) + interval * 60_000).toISOString();
    const advance = await db(env, "prospecting_campaigns?id=eq." + encodeURIComponent(campaignId) + "&status=eq.active&next_run_at=eq." + encodeURIComponent(dueAt) + "&select=id", {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        last_run_at: now.toISOString(),
        next_run_at: nextRun,
        updated_at: now.toISOString(),
      }),
    });
    if (!advance.ok) throw new Error("campaign_advance_http_" + advance.status);
    const rows = await advance.json() as unknown[];
    if (rows.length) advanced++;
    else skipped++;
  }

  return {
    campaignsScanned: campaigns.length,
    campaignsQueued: queued,
    campaignsAdvanced: advanced,
    campaignsSkipped: skipped,
  };
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
      else if (result === "retryable") counts.retryable++;
      else if (result === "dead_letter") counts.deadLetter++;
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

    // Lê o body da requisição para permitir enfileirar uma nova descoberta manual.
    // Um body vazio ou inválido é tratado como ausência de parâmetros de discovery.
    let body: { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown; executionId?: unknown };
    try {
      body = (await request.json()) as { segment?: unknown; region?: unknown; limit?: unknown; countryCode?: unknown; executionId?: unknown };
    } catch {
      body = {};
    }

    const segment = typeof body.segment === "string" && body.segment.trim() ? body.segment.trim() : null;
    const region = typeof body.region === "string" && body.region.trim() ? body.region.trim() : null;

    // Quando houver parâmetros de discovery, enfileira uma nova task "discover" no Supabase
    // em vez de apenas processar o lote de tarefas já enfileiradas.
    if (segment && region) {
      const limitRaw = Number(body.limit ?? 10);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 100)) : 10;
      const countryCode = typeof body.countryCode === "string" && body.countryCode.trim() ? body.countryCode.trim().toUpperCase() : "BR";
      const executionId = typeof body.executionId === "string" && /^[0-9a-f-]{36}$/i.test(body.executionId) ? body.executionId : crypto.randomUUID();
      const idempotencyKey = `manual-discover:${executionId}`;

      const enqueued = await db(env, "prospecting_tasks?on_conflict=idempotency_key", {
        method: "POST",
        headers: { prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          campaign_id: null,
          task_type: "discover",
          status: "pending",
          idempotency_key: idempotencyKey,
          payload: {
            executionId,
            segment,
            region,
            countryCode,
            dailyDiscoveryLimit: limit,
            minimumScore: 50,
            manual: true,
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!enqueued.ok) {
        return json({ status: "failed", enqueued: false, error: "Não foi possível enfileirar a tarefa de descoberta.", detail: await enqueued.text().catch(() => "") }, 503);
      }

      const rows = await enqueued.json() as Array<{ id: number; status: string }>;
      if (!rows.length) {
        // Repetição da mesma solicitação: recuperar a tarefa criada anteriormente pela chave idempotente.
        const existingResponse = await db(env, `prospecting_tasks?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status&limit=1`);
        if (!existingResponse.ok) {
          return json({ status: "failed", enqueued: false, error: "Não foi possível confirmar a tarefa já enfileirada." }, 503);
        }
        const existing = await existingResponse.json() as Array<{ id: number; status: string }>;
        if (!existing.length) {
          return json({ status: "failed", enqueued: false, error: "A tarefa não foi enfileirada; não houve confirmação de persistência." }, 503);
        }
        return json({
          status: "pending",
          enqueued: true,
          taskId: String(existing[0].id),
          idempotencyKey,
          message: "Descoberta já enfileirada anteriormente (duplicata ignorada pela chave idempotente).",
          payload: { segment, region, countryCode, dailyDiscoveryLimit: limit, minimumScore: 50, manual: true },
        }, 202);
      }

      return json({
        status: "running",
        enqueued: true,
        taskId: String(rows[0].id),
        idempotencyKey,
        message: "Tarefa de descoberta enfileirada com sucesso.",
        payload: { segment, region, countryCode, dailyDiscoveryLimit: limit, minimumScore: 50, manual: true },
      }, 202);
    }

    // Sem parâmetros de discovery: manter comportamento atual de processar o lote existente.
    try {
      const counts = await processBatch(env);
      return json({ status: "ok", enqueued: false, ...counts });
    } catch (error) {
      return json({ status: "blocked", enqueued: false, error: error instanceof Error ? error.message : "worker_failed" }, 503);
    }
  },
};

export { normalizeName, normalizeWebsite, normalizePhone, qualify, createDedupeKey, scheduleDueCampaigns, processBatch };
