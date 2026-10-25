export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PROSPECTING_WORKER_SECRET: string;
  PROSPECTING_BATCH_SIZE?: string;
  PROSPECTING_BROWSER: any;
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

  // Completude mede quanto do cadastro foi preenchido; não mede valor comercial.
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

  // Oportunidade é uma métrica separada. A ausência de site é apenas uma hipótese comercial
  // quando há evidência de um negócio real; nunca é registrada como inexistência confirmada.
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

function preferredTemplateSlug(prospect: Prospect): string {
  const signal = normalizeName([
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

function requiredEnv(env: Env): string | null {
  if (!env.SUPABASE_URL?.trim()) return "SUPABASE_URL ausente";
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "SUPABASE_SERVICE_ROLE_KEY ausente";
  if (!env.PROSPECTING_WORKER_SECRET?.trim()) return "PROSPECTING_WORKER_SECRET ausente";
  if (!env.PROSPECTING_BROWSER) return "PROSPECTING_BROWSER ausente";
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

  // Add retry with exponential backoff and jitter to handle 429 rate limit errors.
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2_000; // 2s base delay
  const MAX_DELAY_MS = 60_000; // 60s max delay
  let lastError: Error | null = null;

  for (let retryAttempt = 0; retryAttempt <= MAX_RETRIES; retryAttempt++) {
  // Build search query for Google Maps / local business directories
  const segment = String(campaign.segment ?? "barbearia e salão");
  const region = String(campaign.region ?? "São Paulo - SP");
  const countryCode = String(campaign.countryCode ?? "BR");
  const searchQuery = `${segment} ${region}`.trim();

  // Run Playwright directly in the Cloudflare Worker using the Browser Run binding.
  // No Docker, container, VPS, or external Python service is required.
  let scrapedResults: Array<Record<string, unknown>> = [];
  let browser: any;
  let step = "init";
  let bindingType = "unknown";
  let bindingIsString = false;
  let bindingLength = 0;
  try {
    const browserBindingValue = env.PROSPECTING_BROWSER;
    bindingType = typeof browserBindingValue;
    bindingIsString = typeof browserBindingValue === "string";
    bindingLength = bindingIsString ? browserBindingValue.length : 0;
    step = "browser_connect";
    if (!browserBindingValue) throw new Error("prospecting_browser_binding_missing");

    const { launch } = await import("@cloudflare/playwright");
    browser = await launch(browserBindingValue);
    step = "browser_launched";
    const page = await browser.newPage();

    step = "nav_google_maps";
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[role="feed"]', { timeout: 15000 });

    // Coleta links únicos e rola a lista até alcançar o limite ou ficar sem novos resultados.
    const listingMap = new Map<string, Record<string, unknown>>();
    let stagnantRounds = 0;
    let previousCount = 0;
    for (let round = 0; round < 35 && listingMap.size < Math.min(limit, 100); round++) {
      const visibleListings = await page.evaluate(() => {
        const output: Array<Record<string, unknown>> = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/maps/place/"]').forEach((node) => {
          const anchor = node as HTMLAnchorElement;
          const href = anchor.href.split("&")[0];
          if (!href || seen.has(href)) return;
          seen.add(href);
          const container = anchor.closest('[role="article"]') || anchor.closest('.Nv2PK') || anchor.parentElement?.parentElement || anchor.parentElement || anchor;
          const cardText = ((container as HTMLElement | null)?.innerText || anchor.innerText || "").replace(/\s+/g, " ").trim();
          const name = (anchor.getAttribute("aria-label") || anchor.querySelector('.qBF1Pd, .fontHeadlineSmall')?.textContent || anchor.textContent || "").replace(/\s+/g, " ").trim();
          if (!name || !href) return;
          output.push({ name: name.slice(0, 240), url: href, cardText: cardText.slice(0, 2500) });
        });
        return output;
      });
      for (const listing of visibleListings) {
        const href = String(listing.url || "");
        if (href && !listingMap.has(href)) listingMap.set(href, listing);
        if (listingMap.size >= Math.min(limit, 100)) break;
      }
      if (listingMap.size === previousCount) stagnantRounds++;
      else stagnantRounds = 0;
      previousCount = listingMap.size;
      if (stagnantRounds >= 3) break;
      await page.locator('[role="feed"]').evaluate((feed) => { feed.scrollTop = feed.scrollHeight; }).catch(() => {});
      await page.waitForTimeout(900);
    }

    const listings = Array.from(listingMap.values()).slice(0, Math.min(limit, 100));
    scrapedResults = [];
    for (let index = 0; index < listings.length; index++) {
      const listing = listings[index];
      const listingUrl = String(listing.url || "");
      if (!listingUrl) continue;
      step = "detail_" + (index + 1);
      try {
        await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(700);
        const detail = await page.evaluate(() => {
          const textOf = (selector: string): string | null => {
            const element = document.querySelector(selector);
            const value = (element as HTMLElement | null)?.innerText || element?.getAttribute("aria-label") || "";
            return value.replace(/\s+/g, " ").trim() || null;
          };
          const hrefOf = (selector: string): string | null => {
            const element = document.querySelector(selector) as HTMLAnchorElement | null;
            const value = element?.href || null;
            return value && /^https?:\/\//i.test(value) ? value : null;
          };
          const bodyText = document.body?.innerText || "";
          const ratingLabel = document.querySelector('div.F7nice, [aria-label*="stars"], [aria-label*="estrelas"]')?.getAttribute("aria-label") || "";
          const ratingText = textOf("div.F7nice") || "";
          const reviewLabel = document.querySelector('button[aria-label*="reviews"], button[aria-label*="avaliações"], [aria-label*="reviews"], [aria-label*="avaliações"]')?.getAttribute("aria-label") || "";
          const ratingSource = [ratingLabel, ratingText, reviewLabel, bodyText.slice(0, 8000)].join(" ");
          const ratingMatch = ratingSource.match(/(?:^|\s)([0-5](?:[.,]\d+)?)\s*(?:estrelas?|stars?)?/i) || bodyText.match(/([0-5][.,]\d)\s*\(/);
          const reviewMatch = ratingSource.match(/([\d.,]+)\s*(?:avaliações|avaliação|reviews|review|comentários)/i) || bodyText.match(/\(([0-9][0-9.,]*)\)/);
          const parseCount = (value: string | null): number | null => {
            if (!value) return null;
            const digits = value.replace(/[.,](?=\d{3}\b)/g, "").replace(/\D/g, "");
            const parsed = Number(digits);
            return Number.isSafeInteger(parsed) ? parsed : null;
          };
          const hours = Array.from(document.querySelectorAll('table.eK4R0e tr, table[aria-label*="hours"] tr'))
            .map((row) => ((row as HTMLElement).innerText || "").replace(/\s+/g, " ").trim())
            .filter(Boolean).slice(0, 14);
          const images = Array.from(document.querySelectorAll("img"))
            .map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src || "")
            .filter((url) => /^https?:\/\//i.test(url) && /googleusercontent|gstatic/i.test(url));
          const category = textOf("button.DkEaL") || textOf('button[jsaction*="category"]');
          const address = textOf('[data-item-id="address"]');
          const phoneElement = document.querySelector('[data-item-id^="phone:tel"], a[href^="tel:"]') as HTMLAnchorElement | null;
          const phone = phoneElement?.getAttribute("href")?.startsWith("tel:")
            ? phoneElement.getAttribute("href")?.slice(4) || null
            : (phoneElement as HTMLElement | null)?.innerText?.trim() || null;
          const website = hrefOf('a[data-item-id="authority"]') || hrefOf('a[aria-label*="Website"]') || hrefOf('a[aria-label*="website"]');
          const coordinates = location.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
          const feature = location.href.match(/!1s([^!/?]+)/);
          const placeId = location.href.match(/[?&]place_id=([^&]+)/i);
          const price = bodyText.match(/(?:Preço|Price)\s*[:·]?\s*(\${1,4}|R\${1,4})/i);
          return {
            name: textOf("h1.DUwDvf") || document.querySelector("h1")?.textContent?.trim() || null,
            category,
            address,
            phone,
            website,
            rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null,
            reviewsCount: reviewMatch ? parseCount(reviewMatch[1]) : null,
            sourceUrl: location.href,
            placeId: placeId ? decodeURIComponent(placeId[1]) : null,
            featureId: feature ? decodeURIComponent(feature[1]) : null,
            latitude: coordinates ? Number(coordinates[1]) : null,
            longitude: coordinates ? Number(coordinates[2]) : null,
            images: Array.from(new Set(images)).slice(0, 20),
            openingHours: hours,
            priceLevel: price?.[1] || null,
            editorialSummary: textOf('[class*="PYvSYb"], [class*="WeS02d"]'),
            rawListingText: bodyText.slice(0, 8000),
            fieldStatus: {
              name: "name",
              category: category ? "found" : "not_found_in_capture",
              address: address ? "found" : "not_found_in_capture",
              phone: phone ? "found" : "not_found_in_capture",
              website: website ? "found" : "not_found_in_capture",
              rating: ratingMatch ? "found" : "not_found_in_capture",
              reviewsCount: reviewMatch ? "found" : "not_found_in_capture",
              images: images.length ? "found" : "not_found_in_capture",
              openingHours: hours.length ? "found" : "not_found_in_capture",
            },
          };
        });
        scrapedResults.push({
          ...listing,
          ...detail,
          name: detail.name || listing.name,
          sourceUrl: detail.sourceUrl || listingUrl,
          city: region.split(/\s+-\s+/)[0]?.trim() || null,
          region: region.split(/\s+-\s+/)[1]?.trim() || region,
          countryCode,
          provider: "google-maps-cloudflare-playwright",
          searchQuery,
        });
      } catch (detailError) {
        // Mantém a listagem como evidência parcial; não inventa dados ausentes.
        scrapedResults.push({
          ...listing,
          sourceUrl: listingUrl,
          city: region.split(/\s+-\s+/)[0]?.trim() || null,
          region: region.split(/\s+-\s+/)[1]?.trim() || region,
          countryCode,
          provider: "google-maps-cloudflare-playwright",
          searchQuery,
          fieldStatus: { detailPage: "failed", error: String(detailError instanceof Error ? detailError.message : detailError).slice(0, 250) },
        });
      }
    }
  } catch (error) {
      await browser?.close().catch(() => {});
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message ?? "";

      // Verificar se é um erro de taxa limite (429) que merece retry
      const isRateLimit = errorMessage.includes('429') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('over capacity') ||
                          errorMessage.includes('PROSPECTING_BROWSER') ||
                          errorMessage.includes('browser_run') ||
                          errorMessage.includes('throttl');

      if (!isRateLimit || retryAttempt === MAX_RETRIES) {
        // Interrompe o retry; o estado será persistido como bloqueado abaixo.
        break;
      }

      // Extrair Retry-After do erro se disponível
      let retryAfterSeconds: number | null = null;
      const retryAfterMatch = errorMessage.match(/retry after (\d+)/i);
      if (retryAfterMatch) {
        retryAfterSeconds = Number(retryAfterMatch[1]);
      }

      // Calcular delay com backoff exponencial e jitter
      const baseDelay = Math.min(BASE_DELAY_MS * (2 ** retryAttempt), MAX_DELAY_MS);
      const delay = retryAfterSeconds
        ? Math.min(retryAfterSeconds * 1000, BASE_DELAY_MS * (2 ** retryAttempt))
        : baseDelay;
      const jitter = Math.random() * 1000; // até 1s de jitter
      const sleepDelay = delay + jitter;

      // Log e aguardar antes da próxima tentativa
      console.info(`[discoverCampaignTask] Rate limit detected, retry attempt ${retryAttempt + 1}/${MAX_RETRIES}. Waiting ${sleepDelay}ms before retry. Error: ${errorMessage.slice(0, 200)}`);

      await new Promise(resolve => setTimeout(resolve, sleepDelay));
    }
    await browser?.close().catch(() => {});
  }

  // Se após todas as tentativas ainda houver erro, marcar como bloqueado
  if (lastError) {
    const errorMessage = lastError.message ?? "browser_scraping_failed";
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "browser_scraping_failed",
      last_error: `Falha na coleta via Cloudflare Browser Run após ${MAX_RETRIES + 1} tentativas no passo '${step}' (binding type=${bindingType}, isString=${bindingIsString}, length=${bindingLength}): ${errorMessage}`,
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "browser_scraping_failed", failedStep: step, bindingType, bindingIsString, bindingLength, retryAttempts: MAX_RETRIES + 1 },
    });
    return "blocked";
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
    const businessName = String(first(candidate, ["name", "businessName", "business_name", "companyName"]) ?? "").trim().slice(0, 240);
    const category = String(first(candidate, ["category", "businessCategory", "segment"]) ?? "").trim().slice(0, 120) || null;
    const website = first(candidate, ["website", "websiteUrl", "website_url", "url"]);
    const phone = first(candidate, ["phone", "phoneNumber", "phone_number", "whatsapp"]);
    const country = String(first(candidate, ["countryCode", "country_code"]) ?? countryCode).slice(0, 3);
    const websiteNormalized = normalizeWebsite(website);
    const phoneNormalized = normalizePhone(phone, country);
    const sourceUrl = normalizeWebsite(first(candidate, ["sourceUrl", "source_url", "sourceLink"]));
    const identityCandidate = {
      ...candidate,
      city: first(candidate, ["city", "locality"]) ?? region.split(/\s+-\s+/)[0],
      region: first(candidate, ["region", "state", "province"]) ?? region.split(/\s+-\s+/)[1] ?? region,
      countryCode: first(candidate, ["countryCode", "country_code"]) ?? countryCode,
    };
    const dedupeKey = await createDedupeKey(identityCandidate);
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
    if (result.score >= 50) qualified++;
    const providerRecordId = String(first(candidate, ["featureId", "feature_id", "placeId", "place_id", "providerId", "provider_record_id"]) ?? "").slice(0, 250) || null;
    const stored = await db(env, "prospecting_candidates?on_conflict=dedupe_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        campaign_id: campaign.campaignId ?? null,
        provider: "google-maps-cloudflare-playwright",
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
        city: String(first(candidate, ["city", "locality"]) ?? region.split(/\s+-\s+/)[0] ?? "").slice(0, 160) || null,
        region: String(first(candidate, ["region", "state", "province"]) ?? region.split(/\s+-\s+/)[1] ?? region ?? "").slice(0, 160) || null,
        country_code: country,
        description: typeof first(candidate, ["description", "businessDescription"]) === "string" ? String(first(candidate, ["description", "businessDescription"])).slice(0, 3000) : null,
        source_url: sourceUrl,
        qualification_score: result.score,
        qualification_reasons: result.reasons,
        missing_fields: result.missingFields,
        status: result.score >= 50 ? "qualified" : "discovered",
        raw_evidence: {
          schemaVersion: 2,
          rating: typeof first(candidate, ["rating", "stars"]) === "number" ? first(candidate, ["rating", "stars"]) : null,
          reviewsCount: parseCount(first(candidate, ["reviewsCount", "reviewCount", "reviews_count", "reviews"])),
          reviewCount: parseCount(first(candidate, ["reviewsCount", "reviewCount", "reviews_count", "reviews"])),
          placeId: first(candidate, ["placeId", "place_id"]) ?? null,
          featureId: first(candidate, ["featureId", "feature_id"]) ?? null,
          latitude: first(candidate, ["latitude", "lat"]) ?? null,
          longitude: first(candidate, ["longitude", "lng", "lon"]) ?? null,
          images: Array.isArray(candidate.images) ? candidate.images.slice(0, 20) : [],
          openingHours: Array.isArray(candidate.openingHours) ? candidate.openingHours.slice(0, 14) : [],
          priceLevel: first(candidate, ["priceLevel", "price_level"]) ?? null,
          editorialSummary: first(candidate, ["editorialSummary", "editorial_summary"]) ?? null,
          fieldStatus: candidate.fieldStatus && typeof candidate.fieldStatus === "object" ? candidate.fieldStatus : {},
          completenessScore: result.completenessScore,
          opportunityScore: result.opportunityScore,
          opportunityReasons: result.reasons,
          providerRecordId,
          providerRequestId: null,
          observedAt: new Date().toISOString(),
          evidence: { scraped: true, searchQuery, sourceUrl: candidate.sourceUrl, listingText: candidate.rawListingText ?? null },
        },
      }),
    });
    if (!stored.ok) throw new Error(`candidate_persist_http_${stored.status}`);
    const storedRows = await stored.json() as unknown[];
    if (storedRows.length) inserted++;
    else duplicates++;


  }
  await updateTask(env, task, workerId, {
    status: "succeeded", last_error_code: null, last_error: null,
    completed_at: new Date().toISOString(),
    result: { outcome: "discovered", received: scrapedResults.length, inserted, duplicates, rejected, qualified, provider: "google-maps-playwright", searchQuery },
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
  const templateVersionId = typeof payload.templateVersionId === "string" ? payload.templateVersionId : "";
  if (!task.prospect_id || (siteProjectId && !/^[0-9a-f-]{36}$/i.test(siteProjectId)) || (templateVersionId && !/^[0-9a-f-]{36}$/i.test(templateVersionId))) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "demo_context_invalid",
      last_error: "Geração de demonstração exige um prospect_id válido; IDs opcionais, quando informados, devem ser UUIDs.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "demo_context_invalid" },
    });
    return "blocked";
  }

  let resolvedTemplateVersionId = templateVersionId;
  if (!resolvedTemplateVersionId) {
    const templateLookup = await db(env, "site_template_versions?is_published=eq.true&select=id&order=created_at.desc&limit=1");
    if (!templateLookup.ok) throw new Error(`demo_template_lookup_http_${templateLookup.status}`);
    const templates = await templateLookup.json() as Array<{ id: string }>;
    resolvedTemplateVersionId = templates[0]?.id ?? "";
  }
  if (!resolvedTemplateVersionId || !/^[0-9a-f-]{36}$/i.test(resolvedTemplateVersionId)) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "template_version_required",
      last_error: "Não existe versão publicada de modelo disponível para gerar a demonstração.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "template_version_required" },
    });
    return "blocked";
  }

  let resolvedProjectId = siteProjectId;
  if (!resolvedProjectId) {
    const projectResult = await db(env, "rpc/ensure_prospect_site_project", {
      method: "POST", body: JSON.stringify({ p_prospect_id: task.prospect_id, p_template_version_id: resolvedTemplateVersionId }),
    });
    if (!projectResult.ok) throw new Error(`demo_project_create_http_${projectResult.status}`);
    const projectBody = await projectResult.json() as { siteProjectId?: string };
    if (!projectBody.siteProjectId || !/^[0-9a-f-]{36}$/i.test(projectBody.siteProjectId)) {
      throw new Error("demo_project_create_missing_id");
    }
    resolvedProjectId = projectBody.siteProjectId;
  }
  if (!resolvedTemplateVersionId || !/^[0-9a-f-]{36}$/i.test(resolvedTemplateVersionId)) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "template_version_required",
      last_error: "O projeto foi preparado, mas não existe versão de modelo disponível para gerar a demonstração.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked", reason: "template_version_required", siteProjectId: resolvedProjectId },
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
  const templateResponse = await db(env, `site_template_versions?id=eq.${encodeURIComponent(resolvedTemplateVersionId)}&select=id&limit=1`);
  if (!templateResponse.ok) throw new Error(`demo_template_read_http_${templateResponse.status}`);
  if (!(await templateResponse.json() as unknown[]).length) {
    await updateTask(env, task, workerId, {
      status: "blocked", last_error_code: "template_version_not_found",
      last_error: "A versão do modelo selecionada não existe.",
      completed_at: new Date().toISOString(), result: { outcome: "blocked" },
    });
    return "blocked";
  }

  const existingVersionResponse = await db(env, `site_project_versions?generation_task_id=eq.${task.id}&select=id,version,template_version_id,generated_content,design_overrides&limit=1`);
  if (!existingVersionResponse.ok) throw new Error(`demo_generation_reconcile_http_${existingVersionResponse.status}`);
  const existingVersions = await existingVersionResponse.json() as Array<{
    id: string; version: number; template_version_id: string;
    generated_content: Record<string, unknown>; design_overrides: Record<string, unknown>;
  }>;
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
  const requestedDesignOverrides = payload.designOverrides && typeof payload.designOverrides === "object"
    ? payload.designOverrides as Record<string, unknown> : {};
  let generatedContent: Record<string, unknown> = defaultGeneratedContent;
  let designOverrides: Record<string, unknown> = requestedDesignOverrides;
  let created: Array<{ id: string; version: number }>;
  if (existingVersions.length) {
    // Reuse the committed version after a partial failure; never mint a second version for the same task.
    const existing = existingVersions[0];
    resolvedTemplateVersionId = existing.template_version_id;
    generatedContent = existing.generated_content ?? defaultGeneratedContent;
    designOverrides = existing.design_overrides ?? requestedDesignOverrides;
    created = [{ id: existing.id, version: existing.version }];
  } else {
    const current = await db(env, `site_project_versions?site_project_id=eq.${encodeURIComponent(resolvedProjectId)}&select=version&order=version.desc&limit=1`);
    if (!current.ok) throw new Error(`demo_version_read_http_${current.status}`);
    const versions = await current.json() as Array<{ version: number }>;
    const version = (versions[0]?.version ?? 0) + 1;
    const inserted = await db(env, "site_project_versions", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        site_project_id: resolvedProjectId,
        version,
        generation_task_id: task.id,
        template_version_id: resolvedTemplateVersionId,
        generated_content: generatedContent,
        design_overrides: designOverrides,
        selected_by_prospect: false,
        selection_source: "system",
      }),
    });
    if (!inserted.ok) throw new Error(`demo_version_insert_http_${inserted.status}`);
    created = await inserted.json() as Array<{ id: string; version: number }>;
    if (!created.length) throw new Error("demo_version_insert_no_rows");
  }

  const projectDraft = await db(env, `site_projects?id=eq.${encodeURIComponent(resolvedProjectId)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      template_version_id: resolvedTemplateVersionId,
      generated_content: generatedContent,
      design_overrides: designOverrides,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!projectDraft.ok || !(await projectDraft.json() as unknown[]).length) {
    throw new Error("demo_project_draft_persistence_failed");
  }

  if (task.prospect_id) {
    const event = await db(env, "prospect_events?on_conflict=idempotency_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        prospect_id: task.prospect_id,
        campaign_id: task.campaign_id,
        site_project_id: resolvedProjectId,
        event_type: "demo_generated",
        source_provider: "prospecting-worker",
        idempotency_key: `site-project:${resolvedProjectId}:version:${created[0].version}:generated`,
        evidence: { versionId: created[0].id, version: created[0].version, templateVersionId: resolvedTemplateVersionId },
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
    result: { outcome: "demo_generated", siteProjectId: resolvedProjectId, versionId: created[0].id, version: created[0].version },
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
    const templateLookup = await db(env, "site_template_versions?is_published=eq.true&select=id,created_at,site_templates(slug,is_active)&order=created_at.desc");
    if (!templateLookup.ok) throw new Error(`qualified_template_lookup_http_${templateLookup.status}`);
    const templates = await templateLookup.json() as Array<{
      id: string;
      created_at?: string;
      site_templates?: { slug?: string; is_active?: boolean } | null;
    }>;
    const preferredSlug = preferredTemplateSlug(prospects[0]);
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
    result: { outcome: "qualified", score: result.score, missingFields: result.missingFields, demoPipeline },
  });
  return "succeeded";
}

async function scheduleDueCampaigns(env: Env) {
  // Commercial campaigns classify and prioritize records already collected.
  // They must never initiate scraping: "Raspar agora" owns discovery independently.
  // The scheduler only advances the due_at timestamp - it does NOT enqueue discover tasks.
  // Manual discovery is acionada via API /api/prospecting/run?createCampaign=false.
  const now = new Date();
  const due = await db(env, `prospecting_campaigns?status=eq.active&next_run_at=lte.${encodeURIComponent(now.toISOString())}&select=id,name,segment,region,country_code,source_provider,source_config,qualification_rules,schedule,daily_discovery_limit,next_run_at&order=next_run_at.asc&limit=20`);
  if (!due.ok) throw new Error(`campaign_scan_http_${due.status}`);
  const campaigns = await due.json() as Array<Record<string, unknown>>;
  let advanced = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    const campaignId = String(campaign.id ?? "");
    const dueAt = String(campaign.next_run_at ?? "");
    if (!campaignId || !dueAt) { skipped++; continue; }

    // Apenas avançar o cronômetro da campanha - NÃO enfileirar tasks de descoberta.
    // A descoberta manual é acionada via API /api/prospecting/run?createCampaign=false.
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
    if (rows.length) advanced++;
    else skipped++;
  }
  return { campaignsScanned: campaigns.length, campaignsAdvanced: advanced, campaignsSkipped: skipped };
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

export { normalizeName, normalizeWebsite, normalizePhone, qualify, createDedupeKey, scheduleDueCampaigns, processBatch };
