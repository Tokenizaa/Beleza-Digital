import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  normalizeAddress,
  normalizePhone,
  normalizeWebsite,
  normalizeRating,
  normalizeReviewCount,
  parseAddressComponents,
  extractCoordinates,
  extractSourcePlaceId,
} from "../workers/prospecting-scheduler/src/native-scraper/normalizer";
import { SELECTORS } from "../workers/prospecting-scheduler/src/native-scraper/selectors";

test("normaliza dados básicos sem inventar valores", () => {
  assert.equal(normalizeAddress("Endereço: Rua A, 123"), "Rua A, 123");
  assert.equal(normalizePhone("Telefone: +55 11 99999-0000"), "+55 11 99999-0000");
  assert.equal(normalizeWebsite("Website: https://example.com"), "https://example.com");
  assert.equal(normalizeRating("4,8 estrelas"), "4,8");
  assert.equal(normalizeReviewCount("(1.234 avaliações)"), "1.234");
});

test("extrai apenas componentes geográficos explícitos na ficha/URL", () => {
  assert.deepEqual(extractCoordinates("https://maps.google.com/@-23.5505,-46.6333,15z"), {
    latitude: "-23.5505",
    longitude: "-46.6333",
  });
  assert.equal(extractSourcePlaceId("https://maps.google.com/?q=!1s0x123:0x456"), "0x123:0x456");
  assert.deepEqual(parseAddressComponents("Rua A, São Paulo - SP, 01000-000, Brasil"), {
    postal_code: "01000-000",
    country: "Brasil",
    city: "São Paulo",
    state: "SP",
  });
});

test("mantém seletores para os blocos de dados completos do Google Maps", () => {
  for (const key of ["title", "category", "rating", "reviews", "priceRange", "address", "website", "phone", "businessStatus", "hours", "description", "services", "photos", "videos", "logo"] as const) {
    assert.ok(Array.isArray(SELECTORS.place[key]) && SELECTORS.place[key].length > 0, `selector group missing: ${key}`);
  }
});

test("contrato do extrator cobre campos ricos do MapScrape sem serviço remoto", () => {
  const source = readFileSync(new URL("../workers/prospecting-scheduler/src/native-scraper/extractor.ts", import.meta.url), "utf8");
  for (const field of [
    "reviews", "review_topics", "additional_attributes", "media_items", "plus_code",
    "popular_times", "rating_distribution", "review_highlights", "social_links",
    "booking_url", "accessibility_attributes", "next_opening_text", "visible_photos_count",
    "postal_code", "source_place_id", "field_status",
  ]) {
    assert.ok(source.includes(field), `field contract missing: ${field}`);
  }
  assert.ok(!source.includes("mapscrape-v2.vercel.app"), "scraper must not call the MapScrape service");
});

test("worker usa o binding Browser configurado e não cria leads sintéticos", () => {
  const worker = readFileSync(new URL("../workers/prospecting-scheduler/src/index.ts", import.meta.url), "utf8");
  const wrangler = readFileSync(new URL("../workers/prospecting-scheduler/wrangler.toml", import.meta.url), "utf8");
  assert.match(worker, /BROWSER:\s*any/);
  assert.match(worker, /env\.BROWSER/);
  assert.match(wrangler, /binding\s*=\s*"BROWSER"/);
  assert.ok(!worker.includes("manual-prospecting"), "busca manual não pode gerar estabelecimento fictício");
  assert.ok(!worker.includes("Busca pontual manual:"), "não deve persistir segmento/região como se fosse empresa");
});

test("persistência mantém payload completo e rastreabilidade da fonte", () => {
  const worker = readFileSync(new URL("../workers/prospecting-scheduler/src/index.ts", import.meta.url), "utf8");
  assert.ok(worker.includes("mapsScrapeFields: candidate"), "payload original deve ser preservado");
  assert.ok(worker.includes("sourcePlaceId: candidate.source_place_id"), "identificador de origem deve ser preservado");
  assert.ok(worker.includes("fieldStatus: candidate.fieldStatus"), "estado de captura por campo deve ser preservado");
});

test("console de scraping usa endpoints protegidos e permite inspecionar evidência", () => {
  const ui = readFileSync(new URL("../src/pages/ScrapingConsole.tsx", import.meta.url), "utf8");
  const endpoint = readFileSync(new URL("../functions/api/prospecting/dashboard.ts", import.meta.url), "utf8");
  assert.ok(ui.includes("/api/prospecting/run"), "console deve iniciar busca pelo endpoint de prospecção");
  assert.ok(ui.includes("/api/prospecting/dashboard"), "console deve consultar execuções e resultados");
  assert.ok(ui.includes("Evidência bruta completa (JSON)"), "console deve expor uma seção de inspeção da evidência");
  assert.ok(ui.includes("JSON.stringify(evidence, null, 2)"), "evidência bruta deve ser exibida em JSON legível");
  assert.ok(endpoint.includes("platform_admins"), "API deve validar permissão de Admin Geral");
  assert.ok(endpoint.includes("raw_evidence"), "API deve retornar evidências de coleta");
});
