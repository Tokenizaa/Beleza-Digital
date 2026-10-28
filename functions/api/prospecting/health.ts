import type { VercelRequest, VercelResponse } from '@vercel/node';

// Variáveis de ambiente server-side — contêm a chave individual do consumidor.
// Nunca serão embutidas no frontend nem disponibilizadas em import.meta.env.
const mapscrapeApiBaseUrl = process.env.MAPSCRAPE_API_BASE_URL || 'https://mapscrape-v2.vercel.app';
const mapscrapeApiKey = process.env.MAPSCRAPE_API_KEY || '';

function mapscrapeHeaders(init?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${mapscrapeApiKey}`,
    'Accept': 'application/json',
    ...init,
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  // Health check — endpoint público do MapScrape (sem bearer se chave não configurada)
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const url = `${mapscrapeApiBaseUrl}/api/v1/health`;

  fetch(url, {
    headers: mapscrapeHeaders(),
    method: 'GET',
  })
    .then((mapRes) => mapRes.json())
    .then((data) => {
      if (!mapRes.ok) {
        const status = mapRes.status;
        return res.status(status).json({
          error: data.error || 'Health check failed',
          message: data.message || 'Serviço MapScrape indisponível',
        });
      }
      return res.status(200).json({
        status: data.status || 'ok',
        service: data.service || 'mapscrape',
        apiVersion: data.apiVersion || 'v1',
        database: data.database || 'unknown',
        totalLeads: data.totalLeads ?? 0,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    })
    .catch((err) => {
      console.error('❌ Erro no health proxy:', err);
      return res.status(503).json({
        error: 'service_unavailable',
        message: err.message || 'MapScrape service unavailable',
      });
    });
}