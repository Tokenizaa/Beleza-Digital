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
  assert(result.score === 45, "score de oportunidade considera nome, categoria, telefone e site identificado");
  assert(result.missingFields.includes("email") && result.completenessScore < 50, "completude é separada da oportunidade");
  assert(result.reasons.some((reason) => reason.includes("site público identificado")), "explica os sinais comerciais usados");

  const enriched = qualify({
    business_name: "São Paulo Barbearia", category: "Barbearia", address: "Rua Rodesia, 230",
    phone: "(11) 93759-4342", source_url: "https://www.google.com/maps/place/example",
    rating: 4.7, reviewsCount: "213", images: ["https://lh3.googleusercontent.com/photo"],
    openingHours: ["Segunda 09:00-18:00"], latitude: -23.55, longitude: -46.69,
  });
  assert(enriched.score > result.score, "reputação, avaliações, fotos e localização aumentam o score de oportunidade");
  assert(enriched.completenessScore > result.completenessScore, "dados adicionais aumentam a completude");

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
  assert(campaignSchedule.campaignsQueued === 0, "sem campanhas configuradas: nenhuma descoberta disparada");
  assert(campaignSchedule.campaignsScanned === 0, "nenhuma campanha varrida sem endpoint de provedor");

  console.log(`RESULTADO WORKER: ${passed} passou / ${failed} falhou`);
  if (failed) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
