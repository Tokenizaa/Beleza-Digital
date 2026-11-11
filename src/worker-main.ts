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
import { onRequestPost as prospectingRunPost } from '../functions/api/prospecting/run';
import { onRequestGet as prospectingDashboardGet } from '../functions/api/prospecting/dashboard';

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
const handlerProspectingRunPost = adaptHandler(prospectingRunPost);
const handlerProspectingDashboardGet = adaptHandler(prospectingDashboardGet);

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

  // Prospecting routes are backed by the authenticated API handlers and Supabase queue.
  if (path === '/api/prospecting/run' && request.method === 'POST') {
    return handlerProspectingRunPost(request, env, ctx);
  }
  if (path === '/api/prospecting/dashboard' && request.method === 'GET') {
    return handlerProspectingDashboardGet(request, env, ctx);
  }
  if (path === '/api/prospecting/status' && request.method === 'GET') {
    return handleProspectingStatus(env);
  }

  return new Response(JSON.stringify({ error: 'api_route_not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function handleProspectingStatus(env: any): Promise<Response> {
  const workerUrl = typeof env.PROSPECTING_WORKER_URL === 'string' ? env.PROSPECTING_WORKER_URL.trim() : '';
  if (!workerUrl) {
    return new Response(JSON.stringify({
      status: 'not_configured',
      provider: 'browserless',
      message: 'O Worker de prospecção ainda não está conectado a este ambiente.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const healthUrl = new URL('/health', workerUrl);
    const response = await fetch(healthUrl.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => ({ status: 'invalid_health_response' }));
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unreachable',
      provider: 'browserless',
      message: error instanceof Error ? error.message : 'Não foi possível consultar o Worker de prospecção.',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API routes - worker is only invoked for /api/* via rules configuration
    if (path.startsWith('/api/')) {
      return routeToApi(request, env, ctx, url);
    }

    // This should not be reached with the current rules configuration
    // (worker only runs for /api/*), but included as a safety fallback
    return new Response('Not Found', { status: 404 });
  }
};