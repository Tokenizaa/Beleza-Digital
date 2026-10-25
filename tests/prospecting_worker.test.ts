import { normalizeName, normalizePhone, normalizeWebsite, qualify, createDedupeKey, scheduleDueCampaigns } from "../workers/prospecting-scheduler/src/index";
import { createProspectDedupeKey } from "../src/lib/prospecting";

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.error(`  [FAIL] ${label}`); failed++; }
}

async function run() {
  assert(normalizeName(" Salão & Estética São João ") === "salao e estetica sao joao", "normaliza nome comercial");
  assert(normalizeWebsite("https://WWW.Exemplo.com.br/?utm_source=x#contato") === "exemplo.com.br", "normaliza URL e remove rastreadores");
  assert(normalizeWebsite("javascript:alert(1)") === null, "rejeita esquema não HTTP");
  assert(normalizeWebsite("https://user:pass@example.com") === null, "rejeita credenciais na URL");
  assert(normalizePhone("(51) 99999-1234") === "5551999991234", "normaliza telefone brasileiro");
  assert(normalizePhone("123") === null, "rejeita telefone curto");

  const result = qualify({
    business_name: "Salão Teste",
    category: "Salão de beleza",
    website_url: "https://exemplo.com",
    phone: "(51) 99999-1234",
    source_url: "https://exemplo.com/sobre",
  });
  assert(result.score === 75, "pontua somente evidências presentes");
  assert(result.missingFields.includes("email") && result.reasons.length === 8, "explica campos ausentes");

  // Paridade da chave de deduplicação entre o worker (candidatos) e a lib (prospects).
  const workerKey = await createDedupeKey({ name: "Salão Teste", city: "Porto Alegre", region: "RS" });
  const libKey = await createProspectDedupeKey({ businessName: "Salão Teste", city: "Porto Alegre", region: "RS" });
  assert(Boolean(workerKey) && workerKey === libKey, "dedupe name-location idêntico entre worker e lib");
  assert(
    (await createDedupeKey({ name: "Salão Teste", city: "Porto Alegre", region: "RS" })) === workerKey,
    "dedupe name-location é estável",
  );
  assert(await createDedupeKey({ name: "Sem localização" }) === null, "worker não inventa chave com dados insuficientes");
  const campaignSchedule = await scheduleDueCampaigns({} as never);
  assert(
    campaignSchedule.campaignsQueued === 0 && campaignSchedule.mode === "commercial_campaigns_do_not_trigger_discovery",
    "campanhas comerciais não disparam raspagem nem consomem Browser Run",
  );

  console.log(`RESULTADO WORKER: ${passed} passou / ${failed} falhou`);
  if (failed) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
