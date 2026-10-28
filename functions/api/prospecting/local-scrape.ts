/**
 * Endpoint legado aposentado.
 *
 * A descoberta de estabelecimentos é executada exclusivamente pelo MapScrape v2
 * através da fila autenticada /api/prospecting/run -> prospecting-scheduler.
 * Este endpoint retorna 410 para impedir que clientes antigos reativem o scraper local.
 */
export async function onRequestPost() {
  return new Response(JSON.stringify({
    error: "scraper_retired",
    message: "O scraping local foi descontinuado. Atualize o cliente para usar /api/prospecting/run.",
  }), {
    status: 410,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: "scraper_retired" }), {
    status: 410,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
