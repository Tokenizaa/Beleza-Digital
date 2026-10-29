import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Extrair query params da URL do request
  const url = new URL(req.url || '', `${mapscrapeApiBaseUrl}/`);
  const params: {
    query?: string;
    jobId?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
    offset?: number;
  } = {
    query: url.searchParams.get('query') || undefined,
    jobId: url.searchParams.get('jobId') || undefined,
    sortBy: url.searchParams.get('sortBy') || undefined,
    sortOrder: url.searchParams.get('sortOrder') || undefined,
    limit: url.searchParams.get('limit') ? Math.max(1, Math.min(Number(url.searchParams.get('limit')), 100)) : undefined,
    offset: url.searchParams.get('offset') ? Math.max(0, Number(url.searchParams.get('offset'))) : undefined,
  };

  // Construir a URL da API MapScrape com query params
  const mapUrl = new URL(`/api/v1/leads`, mapscrapeApiBaseUrl);
  if (params.query) mapUrl.searchParams.set('query', params.query);
  if (params.jobId) mapUrl.searchParams.set('jobId', params.jobId);
  if (params.sortBy) mapUrl.searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) mapUrl.searchParams.set('sortOrder', params.sortOrder);
  if (params.limit) mapUrl.searchParams.set('limit', String(params.limit));
  if (params.offset) mapUrl.searchParams.set('offset', String(params.offset));

  fetch(mapUrl.toString(), {
    headers: mapscrapeHeaders(),
    method: 'GET',
  })
    .then((mapRes) => {
      if (!mapRes.ok) {
        return mapRes.json().then((data) => {
          const status = mapRes.status;
          return res.status(status).json({
            error: data.error || 'Leads fetch failed',
            message: data.message || 'Falha ao buscar leads',
          });
        });
      }
      return mapRes.json();
    })
    .then((data) => {
      // Normalizar resposta para o formato esperado pelo frontend
      const leadsData = data.data || [];
      const pagination = data.pagination || {
        total: leadsData.length,
        limit: params.limit || 50,
        offset: params.offset || 0,
        hasMore: false,
      };

      return res.status(200).json({
        data: leadsData,
        pagination: {
          total: pagination.total ?? leadsData.length,
          limit: (pagination.limit ?? params.limit) || 50,
          offset: (pagination.offset ?? params.offset) || 0,
          hasMore: pagination.hasMore ?? false,
        },
      });
    })
    .catch((err) => {
      console.error('❌ Erro no leads proxy:', err);
      return res.status(500).json({ error: 'Internal error fetching leads', message: err.message });
    });
}