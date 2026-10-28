import type { VercelRequest, VercelResponse } from '@vercel/node';

const mapscrapeApiBaseUrl = process.env.MAPSCRAPE_API_BASE_URL || 'https://mapscrape-v2.vercel.app';
const mapscrapeApiKey = process.env.MAPSCRAPE_API_KEY || '';

function mapscrapeHeaders(init?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${mapscrapeApiKey}`,
    'Content-Type': 'application/json',
    ...init,
  };
}

interface JobResultsResponse {
  data: any[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // GET /api/prospecting/jobs/{id}/results
  // Extrair ID da rota: /api/prospecting/jobs/{id}/results
  const pathParts = req.path.split('/');
  const jobId = pathParts[pathParts.length - 2];

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required.' });
  }

  // Extrair query params de paginação
  const searchParams = new URL(req.url || '', `${mapscrapeApiBaseUrl}/`).searchParams;
  const limit = searchParams.get('limit') ? Math.max(1, Math.min(Number(searchParams.get('limit')), 100)) : 50;
  const offset = searchParams.get('offset') ? Math.max(0, Number(searchParams.get('offset'))) : 0;

  const url = `${mapscrapeApiBaseUrl}/api/v1/jobs/${jobId}/results?limit=${limit}&offset=${offset}`;
  const mapRes = await fetch(url, {
    headers: mapscrapeHeaders(),
  });

  const data = await mapRes.json();

  if (!mapRes.ok) {
    const status = mapRes.status;
    if (status === 404) {
      return res.status(404).json({ error: 'Job results not found.' });
    }
    return res.status(status).json({
      error: data.error || 'Job results fetch failed',
      message: data.message || 'Falha ao buscar resultados',
    });
  }

  const normalized: JobResultsResponse = {
    data: data.data || [],
    pagination: {
      total: data.pagination?.total ?? (data.data?.length ?? 0),
      limit: data.pagination?.limit ?? limit,
      offset: data.pagination?.offset ?? offset,
      hasMore: data.pagination?.hasMore ?? false,
    },
  };

  return res.status(200).json(normalized);
}