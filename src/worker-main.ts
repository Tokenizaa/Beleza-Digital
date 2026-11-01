/**
 * Main Cloudflare Worker entry point for Beleza-Digital.
 * 
 * Responsibilities:
 * 1. Serve frontend Static Assets from ./dist (configured in wrangler.jsonc)
 * 2. Handle API routes formerly in functions/api/
 * 3. SPA fallback is handled by Cloudflare Static Assets configuration
 * 4. Preserve Supabase integration via env bindings
 */

// Import database configuration (supabase client setup)

// Import API route handlers from src/api/
// These are adapted to work with Cloudflare Worker fetch handler signature.
// The adapter passes { request, env } which works for both:
// - onRequestPost({ request }: { request: Request }) - ignores extra env
// - onRequest({ request, env }: Context) - uses both request and env
import { onRequestPost as capturePost } from './api/capture';
import { onRequestPost as scraperPost } from './api/test-runner';
import { onRequest as webhookPost } from './api/whatsapp';
import { onRequest as demoRequest } from '../functions/api/demos/[token]';
import { onRequestPost as startContractPost } from '../functions/api/onboarding/start-contract';

// Adapt Pages Functions handlers to work with Cloudflare Worker fetch signature.
// Pages Functions: onRequestPost({ request })
// Worker fetch: fetch(request: Request, env: any, ctx: any): Response
function adaptHandler(handler: any): any {
  return async (request: Request, env: any, ctx: any): Promise<Response> => {
    // The handler was defined with ({ request }: { request: Request }) or
    // ({ request, env }: Context). Pass both request and env; handlers that
    // only destructure { request } will ignore the extra env property.
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

  // Public demo: token is resolved only against its hashed public link.
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

  return new Response(JSON.stringify({ error: 'api_route_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
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
  // /api/prospecting/run - Execute prospecting search
  if (subPath === '/run' || subPath === '/') {
    return new Response(
      JSON.stringify({
        status: 'redirect',
        message: 'Prospecting operations should use the dedicated worker',
        redirect: '/api/prospecting',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // /api/prospecting/dashboard - Dashboard data
  if (subPath === '/dashboard') {
    return new Response(
      JSON.stringify({ status: 'ok', data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // /api/prospecting/overview - Overview data
  if (subPath === '/overview') {
    return new Response(
      JSON.stringify({ status: 'ok', data: {} }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Default for prospecting routes
  return new Response(
    JSON.stringify({ status: 'not_found', path: subPath }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Cloudflare Worker fetch handler.
 * 
 * This is the main entry point called by Cloudflare for every request.
 * 
 * Behavior:
 * 1. Static Assets from ./dist are served automatically by the platform
 *    thanks to the "assets" configuration in wrangler.jsonc
 *    - The edge checks if the request path maps to a file in ./dist
 *    - If yes, it serves the file and the Worker never runs
 *    - If no, the Worker runs
 * 2. API routes (/api/) are handled by this script
 * 3. Client-side routes are served by the configured SPA asset fallback.
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle API routes
    // Cloudflare runs the Worker first for /api/* via assets.run_worker_first.
    if (path.startsWith('/api/')) {
      return routeToApi(request, env, ctx, url);
    }

    // Static files and client-side routes are served by Cloudflare Static Assets.
    // The Worker is configured to run first only for /api/*.
    return env.ASSETS.fetch(request);
  }
};
