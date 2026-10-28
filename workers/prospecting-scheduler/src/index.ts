
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
  "capture" | "qualify" | "generate_demo" | "publish_demo" | "send_whatsapp" | "sync_delivery";
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
      design_overrides: design_overrides,
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
<|file_sep|>[Error: Max line count (2000) exceeded. The output has been truncated and only the first 2000 lines are shown. The rest is lost.]export { normalizeName, normalizeWebsite, normalizePhone, qualify, scheduleDueCampaigns, processBatch };
async function executeTask(env: Env, task: ProspectingTask, workerId: string) {
  if (task.task_type === "send_whatsapp") return sendWhatsAppTask(env, task, workerId);
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
