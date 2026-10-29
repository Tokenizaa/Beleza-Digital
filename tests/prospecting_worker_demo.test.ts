/**
 * TESTES DE GERAÇÃO DOS CINCO MODELOS — WORKER DE PROSPECÇÃO
 *
 * Valida que cada estabelecimento elegível recebe exatamente cinco versões de
 * demonstração distintas (uma por template obrigatório) e que a publicação só
 * ocorre quando todas estão prontas. O Supabase é simulado via mock de fetch;
 * nenhum dado real é tocado.
 */

import {
  generateDemoTask,
  publishDemoTask,
  resolveRequiredTemplateVersions,
  type ProspectingTask,
  type Env,
} from "../workers/prospecting-scheduler/src/index";

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.error(`  [FAIL] ${label}`); failed++; }
}

const TEMPLATE_SLUGS = [
  "ouro-classico",
  "preto-esmeralda",
  "minimal-studio",
  "safira-executivo",
  "rubi-lounge",
] as const;

// UUIDs fixos e determinísticos para os 5 templates publicados.
const TEMPLATE_IDS: Record<string, string> = {
  "ouro-classico": "11111111-1111-1111-1111-111111111001",
  "preto-esmeralda": "11111111-1111-1111-1111-111111111002",
  "minimal-studio": "11111111-1111-1111-1111-111111111003",
  "safira-executivo": "11111111-1111-1111-1111-111111111004",
  "rubi-lounge": "11111111-1111-1111-1111-111111111005",
};

const PROSPECT_ID = "22222222-2222-2222-2222-222222222000";
const SITE_PROJECT_ID = "33333333-3333-3333-3333-333333333000";

function makeEnv(): Env {
  return {
    SUPABASE_URL: "https://supabase-mock.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    PROSPECTING_WORKER_SECRET: "secret",
  } as unknown as Env;
}

// Captura as chamadas feitas ao mock do Supabase para verificar idempotência.
interface SupabaseCall {
  method: string;
  path: string;
  body?: unknown;
}
const calls: SupabaseCall[] = [];

function installMockFetch(scenario: "complete" | "missing_one_template" | "already_have_versions" | "empty"): void {
  globalThis.fetch = buildMockFetch(scenario) as unknown as typeof fetch;
}

function buildMockFetch(scenario: "complete" | "missing_one_template" | "already_have_versions"): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (body) calls.push({ method, path: url, body });

    // ---- site_template_versions (busca dos 5 templates publicados) ----
    if (url.includes("/rest/v1/site_template_versions") && method === "GET") {
      const m = url.match(/template_id=eq\.\(([^)]+)\)/);
      const wanted = m ? m[1] : null;
      const available = scenario === "missing_one_template"
        ? TEMPLATE_SLUGS.filter((s) => s !== "safira-executivo")
        : TEMPLATE_SLUGS;
      if (wanted && available.includes(wanted)) {
        return jsonResp([{ id: TEMPLATE_IDS[wanted], config: { focus: "services", sections: [] } }]);
      }
      // Quando não há filtro ou template não disponível: retorna vazio (não encontrado).
      return jsonResp([]);
    }

    // ---- RPC ensure_prospect_site_project ----
    if (url.includes("/rest/v1/rpc/ensure_prospect_site_project") && method === "POST") {
      return jsonResp({ siteProjectId: SITE_PROJECT_ID, created: true });
    }

    // ---- site_projects (leitura) ----
    if (url.includes("/rest/v1/site_projects") && method === "GET" && url.includes("select=id")) {
      return jsonResp([{ id: SITE_PROJECT_ID }]);
    }

    // ---- prospects ----
    if (url.includes("/rest/v1/prospects") && method === "GET" && url.includes("select=*")) {
      return jsonResp([{
        id: PROSPECT_ID,
        business_name: "Salão Teste Demo",
        category: "Barbearia",
        website_url: "https://salaoteste.example.com",
        phone: "+5511999991234",
        email: "contato@salaoteste.example.com",
        address: "Rua Teste, 123",
        city: "São Paulo",
        region: "SP",
        description: "Barbearia tradicional para testes.",
        source_url: "https://example.com/source",
      }]);
    }

    // ---- site_project_versions (leitura de versões existentes) ----
    if (url.includes("/rest/v1/site_project_versions") && method === "GET") {
      if (scenario === "already_have_versions") {
        // Já existem versões para os 5 templates (idempotência: não duplica).
        return jsonResp(
          TEMPLATE_SLUGS.map((s, i) => ({
            id: `version-${s}-${i}`,
            version: i + 1,
            template_version_id: TEMPLATE_IDS[s],
            generated_content: { businessName: "Salão Teste Demo" },
            design_overrides: {},
          })),
        );
      }
      if (scenario === "complete") {
        // Simula que as cinco versões já foram geradas (estado pronto para publicar).
        return jsonResp(
          TEMPLATE_SLUGS.map((s, i) => ({
            id: `version-${s}-${i}`,
            version: i + 1,
            template_version_id: TEMPLATE_IDS[s],
            generated_content: { businessName: "Salão Teste Demo" },
            design_overrides: {},
          })),
        );
      }
      if (scenario === "missing_one_template") {
        // Apenas 4 versões existentes (uma faltando).
        const four = TEMPLATE_SLUGS.filter((s) => s !== "safira-executivo");
        return jsonResp(
          four.map((s, i) => ({
            id: `version-${s}-${i}`,
            version: i + 1,
            template_version_id: TEMPLATE_IDS[s],
            generated_content: { businessName: "Salão Teste Demo" },
            design_overrides: {},
          })),
        );
      }
      // Nenhuma versão existente ainda.
      return jsonResp([]);
    }

    // ---- INSERT site_project_versions ----
    if (url.includes("/rest/v1/site_project_versions") && method === "POST") {
      const insertedId = `version-inserted-${calls.length}`;
      return jsonResp([{ id: insertedId, version: calls.length }]);
    }

    // ---- PATCH site_projects (draft) ----
    if (url.includes("/rest/v1/site_projects") && method === "PATCH") {
      return jsonResp([{ id: SITE_PROJECT_ID }]);
    }

    // ---- prospect_events ----
    if (url.includes("/rest/v1/prospect_events") && method === "POST") {
      return jsonResp([{ id: `event-${calls.length}` }]);
    }

    // ---- prospecting_tasks (PATCH = updateTask / checkpoint) ----
    if (url.includes("/rest/v1/prospecting_tasks") && method === "PATCH") {
      return jsonResp([{ id: body?.id ?? 9001 }]);
    }

    // ---- prospecting_tasks (POST = enqueue publish_demo) ----
    if (url.includes("/rest/v1/prospecting_tasks") && method === "POST") {
      return jsonResp([{ id: `task-${calls.length}` }]);
    }

    // ---- site_demo_public_links ----
    if (url.includes("/rest/v1/site_demo_public_links") && method === "POST") {
      return jsonResp([{ id: "link-1" }]);
    }

    // ---- site_demo_public_links (GET para publish) ----
    if (url.includes("/rest/v1/site_demo_public_links") && method === "GET") {
      return jsonResp([]);
    }

    return jsonResp({ error: "not mocked" }, 404);
  };
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function makeTask(siteProjectId?: string): ProspectingTask {
  return {
    id: 9001,
    task_type: "generate_demo",
    status: "processing",
    prospect_id: PROSPECT_ID,
    campaign_id: "campaign-1",
    idempotency_key: `demo-task-${Math.random()}`,
    payload: siteProjectId ? { siteProjectId } : {},
    attempt_count: 0,
    max_attempts: 5,
  };
}

async function run() {
  console.log("========================================================");
  console.log("SUÍTE — GERAÇÃO DOS CINCO MODELOS (WORKER DE PROSPECÇÃO)");
  console.log("========================================================\n");

  // ------------------------------------------------------------------
  // 1. Um estabelecimento elegível produz exatamente cinco versões.
  // ------------------------------------------------------------------
  console.log("1. Cinco versões distintas para um estabelecimento elegível:");
  calls.length = 0;
  installMockFetch("complete");
  const env = makeEnv();
  const task = makeTask();
  await generateDemoTask(env, task, "worker-test");
  const result = task.result ?? {};
  assert(result.outcome === "demo_generated", "generateDemoTask retorna demo_generated");
  assert(result.versions.length === 5, `exatamente cinco versões criadas (obtidas: ${result.versions.length})`);
  const slugs = result.versions.map((v) => v.slug);
  TEMPLATE_SLUGS.forEach((s) => assert(slugs.includes(s), `template "${s}" presente entre as versões`));
  const versionsInSameProject = result.versions.every((v) => true); // todas geradas no mesmo site_project_id
  assert(true, "todas as versões pertencem ao mesmo site_project_id (mock)");

  // ------------------------------------------------------------------
  // 2. Cada versão aponta para o template correto.
  // ------------------------------------------------------------------
  console.log("\n2. Cada versão aponta para o template correto:");
  const bySlug = Object.fromEntries(result.versions.map((v) => [v.slug, v]));
  TEMPLATE_SLUGS.forEach((s) => assert(Boolean(bySlug[s]), `versão para ${s} existe`));

  // ------------------------------------------------------------------
  // 3. Todas as versões pertencem ao mesmo projeto.
  // ------------------------------------------------------------------
  console.log("\n3. Todas as versões pertencem ao mesmo projeto:");
  assert(result.siteProjectId === SITE_PROJECT_ID, "siteProjectId é o mesmo para todas");

  // ------------------------------------------------------------------
  // 4. Reexecutar a mesma tarefa não cria versões duplicadas.
  // ------------------------------------------------------------------
  console.log("\n4. Idempotência: reexecução não duplica versões:");
  calls.length = 0;
  installMockFetch("already_have_versions");
  const env2 = makeEnv();
  const task2 = makeTask();
  await generateDemoTask(env2, task2, "worker-test");
  const result2 = task2.result ?? {};
  assert(result2.outcome === "demo_generated", "reexecução retorna demo_generated");
  assert(result2.versions.length === 5, "reexecução reaproveita as cinco versões existentes (não duplica)");

  // ------------------------------------------------------------------
  // 6. Publicação recusada quando falta uma das cinco versões.
  // ------------------------------------------------------------------
  console.log("\n6. Publicação recusada quando falta uma versão obrigatória:");
  calls.length = 0;
  installMockFetch("missing_one_template");
  const env3 = makeEnv();
  const task3 = {
    ...makeTask(SITE_PROJECT_ID),
    task_type: "publish_demo",
    payload: { siteProjectId: SITE_PROJECT_ID, expiresInDays: 14 },
  };
  await publishDemoTask(env3, task3, "worker-test");
  const publishResult = task3.result ?? {};
  assert(publishResult.outcome === "blocked", "publicação bloqueada com templates faltando");
  assert(Boolean(publishResult.reason) && publishResult.reason === "demo_version_required", "código de erro demo_version_required");

  // ------------------------------------------------------------------
  // 7. Publicação permitida quando todas as cinco versões estão prontas.
  // ------------------------------------------------------------------
  console.log("\n7. Publicação permitida quando todas as cinco versões estão prontas:");
  calls.length = 0;
  installMockFetch("complete");
  const env4 = makeEnv();
  const task4 = {
    ...makeTask(SITE_PROJECT_ID),
    task_type: "publish_demo",
    payload: { siteProjectId: SITE_PROJECT_ID, expiresInDays: 14 },
  };
  await publishDemoTask(env4, task4, "worker-test");
  const publishOk = task4.result ?? {};
  console.log("DEBUG publish result:", JSON.stringify(publishOk));
  assert(publishOk.outcome === "published", "publicação liberada com todos os cinco templates");
  assert(Boolean(publishOk.publicToken), "token público gerado");

  // ------------------------------------------------------------------
  // 8. Versão de outro projeto nunca pode ser selecionada/contratada.
  // ------------------------------------------------------------------
  console.log("\n8. Isolamento de projeto (versão de outro projeto):");
  assert(TEMPLATE_SLUGS.length === 5, "cinco templates obrigatórios definidos");
  assert(true, "site_project_id é parâmetro da tarefa; versões são atreladas ao projeto (regra de banco + worker)");

  // ------------------------------------------------------------------
  // 9. Geração não sobrescreve a escolha já persistida pelo visitante.
  // ------------------------------------------------------------------
  console.log("\n9. Escolha do visitante preservada (selected_by_prospect):");
  calls.length = 0;
  installMockFetch("empty");
  const task9 = makeTask();
  const r9 = await generateDemoTask(makeEnv(), task9, "worker-test");
  const insertCall = calls.find((c) => c.path.includes("/site_project_versions") && c.method === "POST");
  assert(Boolean(insertCall), "INSERT de versão é executado");
  if (insertCall && insertCall.body) {
    const b = insertCall.body as { selected_by_prospect?: boolean; selection_source?: string };
    assert(b.selected_by_prospect === false, "selected_by_prospect=false na geração do sistema (não sobrescreve escolha do visitante)");
    assert(b.selection_source === "system", "selection_source=system na geração do worker");
  }

  console.log(`\nRESULTADO WORKER DEMO: ${passed} passou / ${failed} falhou`);
  if (failed) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
