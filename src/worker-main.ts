/**
 * Main Cloudflare Worker entry point for Beleza-Digital.
 *
 * Responsibilities:
 * 1. Handle API routes (/api/*) - static assets are served by Cloudflare Static Assets
 * 2. SPA fallback is handled by Cloudflare Static Assets configuration (not_found_handling: "single-page-application")
 * 3. All non-API routes (/, /demo, /demo/*, etc.) are served by Static Assets with SPA fallback
 */

// Import API route handlers
import { onRequestPost as capturePost } from './api/capture';
import { onRequestPost as scraperPost } from './api/test-runner';
import { onRequest as webhookPost } from './api/whatsapp';
import { onRequest as demoRequest } from '../functions/api/demos/[token]';
import { onRequestPost as startContractPost } from '../functions/api/onboarding/start-contract';

// Adapt Pages Functions handlers to work with Cloudflare Worker fetch signature
function adaptHandler(handler: any): any {
  return async (request: Request, env: any, ctx: any): Promise<Response> => {
    try {
      const result: Response = await handler({ request, env });
      return result;
    } catch (e) {
      console.error('Handler adaptation error:', e);
      return new Response(JSON.stringify({ error: 'Handler error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

// Adapt the handlers
const handlerCapturePost = adaptHandler(capturePost);
const handlerScraperPost = adaptHandler(scraperPost);
const handlerWebhookPost = adaptHandler(webhookPost);

/**
 * Route to the appropriate API handler based on the URL path.
 * This migrates the functions/api/ routes to the main Worker.
 */
function routeToApi(request: Request, env: any, ctx: any, url: URL): Response | Promise<Response> {
  const path = url.pathname;

  // Public demo: token is resolved only against its hashed public link
  const demoMatch = path.match(/^\/api\/demos\/([^/]+)$/);
  if (demoMatch) {
    let token: string;
    try { token = decodeURIComponent(demoMatch[1]); }
    catch { return new Response(JSON.stringify({ error: 'demo_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }); }
    return demoRequest({ request, env, params: { token } });
  }

  if (path === '/api/onboarding/start-contract') {
    return adaptHandler(startContractPost)(request, env, ctx);
  }

  // /api/capture - URL metadata extraction
  if (path === '/api/capture') {
    return handlerCapturePost(request, env, ctx);
  }

  // /api/scraper/test-runner - Scraper test
  if (path === '/api/scraper/test-runner') {
    return handlerScraperPost(request, env, ctx);
  }

  // /api/webhooks/whatsapp - WhatsApp webhook
  if (path === '/api/webhooks/whatsapp') {
    return handlerWebhookPost(request, env, ctx);
  }

  // /api/prospecting - Prospecting routes
  if (path.startsWith('/api/prospecting')) {
    const subPath = path.replace('/api/prospecting', '') || '/';
    return handleProspectingApi(request, env, ctx, subPath);
  }

  return new Response(JSON.stringify({ error: 'api_route_not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/**
 * Handle prospecting API sub-paths.
 * These are the routes under /api/prospecting/
 */
async function handleProspectingApi(
  request: Request,
  env: any,
  ctx: any,
  subPath: string
): Promise<Response> {
  // GET /api/prospecting/status - Check prospecting worker status
  if (subPath === '/status' && request.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'active',
      message: 'Prospecting API is running',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // GET /api/prospecting/results - Get prospecting results
  if (subPath === '/results' && request.method === 'GET') {
    return new Response(JSON.stringify({
      results: [],
      message: 'No results available yet'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // POST /api/prospecting/search - Trigger new search
  if (subPath === '/search' && request.method === 'POST') {
    return new Response(JSON.stringify({
      status: 'accepted',
      message: 'Search queued'
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // GET /api/prospecting/demo-links - Get demo links for scraping demo
  if (subPath === '/demo-links' && request.method === 'GET') {
    // Return demo links for scraping - in production this would come from database
    return new Response(JSON.stringify({
      links: [
        { id: 'demo-1', name: 'Barbearia Porto Alegre', url: 'https://www.google.com/maps/search/barbearia+porto+alegre', city: 'Porto Alegre', state: 'RS', niche: 'Barbearia' },
        { id: 'demo-2', name: 'Salão São Paulo', url: 'https://www.google.com/maps/search/sal%C3%A3o+de+beleza+s%C3%A3o+paulo', city: 'São Paulo', state: 'SP', niche: 'Salão de Beleza' },
        { id: 'demo-3', name: 'Barbearia Rio', url: 'https://www.google.com/maps/search/barbearia+rio+de+janeiro', city: 'Rio de Janeiro', state: 'RJ', niche: 'Barbearia' },
        { id: 'demo-4', name: 'Clínica Estética BH', url: 'https://www.google.com/maps/search/clinica+estetica+belo+horizonte', city: 'Belo Horizonte', state: 'MG', niche: 'Clínica Estética' },
        { id: 'demo-5', name: 'Barbearia Curitiba', url: 'https://www.google.com/maps/search/barbearia+curitiba', city: 'Curitiba', state: 'PR', niche: 'Barbearia' }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // POST /api/prospecting/run - Execute prospecting scraping
  if (subPath === '/run' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { links, niche, city, state, quantity } = body;

      // In production, this would trigger the Cloudflare Browser/Playwright worker
      // For now, return a mock response
      return new Response(JSON.stringify({
        status: 'started',
        message: 'Prospecção iniciada com sucesso',
        taskId: `prospecting-${Date.now()}`,
        estimatedTime: '2-5 minutos',
        linksCount: links?.length || 0
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Erro ao iniciar prospecção',
        error: e instanceof Error ? e.message : 'Erro desconhecido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'prospecting_route_not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API routes - worker is only invoked for /api/* via rules configuration
    if (path.startsWith('/api/')) {
      return routeToApi(request, env, ctx, url);
    }

    // Non-API routes: serve the SPA so client-side routing
    // (/plataforma/admin, /plataforma/admin/prospeccao, etc.) works on direct access.
    try {
      return await env.ASSETS.fetch(request);
    } catch {
      // Fall back to index.html so React Router can handle the route.
      try {
        return await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, { headers: request.headers }));
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }
  }
};