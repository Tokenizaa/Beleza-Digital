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

// Types
interface JobCreateBody {
  segment: string;
  location: string;
  limit?: number;
}

interface JobCreateResponse {
  data: {
    jobId: string;
    status: string;
    statusUrl: string;
    resultsUrl: string;
  };
}

interface JobInfoResponse {
  data: {
    id: string;
    status: string;
    isRunning: boolean;
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

  // POST /api/prospecting/jobs - Iniciar nova coleta
  if (method === 'POST' && req.path === '/api/prospecting/jobs') {
    return doCreateJob(req, res);
  }

  // GET /api/prospecting/jobs/{id} ou /api/prospecting/jobs/{id}?results=true
  if (method === 'GET') {
    const pathParts = req.path.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required.' });
    }

    // Verificar se inclui results=true
    const searchParams = new URL(req.url || '', `${mapscrapeApiBaseUrl}/`).searchParams;
    const includeResults = searchParams.get('results') === 'true';

    if (includeResults) {
      return doGetJobResults(req, res);
    }

    return doGetJob(req, res);
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}

async function doCreateJob(req: VercelRequest, res: VercelResponse) {
  try {
    let body: JobCreateBody = { segment: '', location: '', limit: 20 };

    try {
      body = await req.json();
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const { segment, location, limit = 20 } = body;

    if (!segment || !location) {
      return res.status(400).json({ error: 'Segment and location are required.' });
    }

    const lim = Math.max(1, Math.min(Number(limit) || 20, 100));

    const url = `${mapscrapeApiBaseUrl}/api/v1/jobs`;
    const mapRes = await fetch(url, {
      method: 'POST',
      headers: mapscrapeHeaders(),
      body: JSON.stringify({ segment, location, limit: lim }),
    });

    const data = await mapRes.json();

    if (!mapRes.ok) {
      const status = mapRes.status;
      return res.status(status).json({
        error: data.error || 'Job creation failed',
        message: data.message || 'Falha ao criar coleta',
      });
    }

    return res.status(202).json({
      data: {
        jobId: data.data?.jobId || '',
        status: data.data?.status || 'pending',
        statusUrl: data.data?.statusUrl || `/api/prospecting/jobs/${data.data?.jobId || ''}`,
        resultsUrl: data.data?.resultsUrl || `/api/prospecting/jobs/${data.data?.jobId || ''}/results?results=true`,
      },
    });
  } catch (err: any) {
    console.error('❌ Erro no create job proxy:', err);
    return res.status(500).json({ error: 'Internal error creating job', message: err.message });
  }
}

async function doGetJob(req: VercelRequest, res: VercelResponse) {
  try {
    const pathParts = req.path.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required.' });
    }

    const url = `${mapscrapeApiBaseUrl}/api/v1/jobs/${jobId}`;
    const mapRes = await fetch(url, {
      headers: mapscrapeHeaders(),
    });

    const data = await mapRes.json();

    if (!mapRes.ok) {
      const status = mapRes.status;
      if (status === 404) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      return res.status(status).json({
        error: data.error || 'Job fetch failed',
        message: data.message || 'Falha ao buscar job',
      });
    }

    const normalized: JobInfoResponse = {
      data: {
        id: data.data?.id || jobId,
        status: data.data?.status || 'failed',
        isRunning: data.data?.isRunning ?? false,
      },
    };

    return res.status(200).json(normalized);
  } catch (err: any) {
    console.error('❌ Erro no get job proxy:', err);
    return res.status(500).json({ error: 'Internal error fetching job', message: err.message });
  }
}

async function doGetJobResults(req: VercelRequest, res: VercelResponse) {
  try {
    const pathParts = req.path.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required.' });
    }

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
  } catch (err: any) {
    console.error('❌ Erro no job results proxy:', err);
    return res.status(500).json({ error: 'Internal error fetching job results', message: err.message });
  }
}