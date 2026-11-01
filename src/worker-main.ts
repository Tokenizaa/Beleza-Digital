/**
 * Main Cloudflare Worker entry point for Beleza-Digital.
 * 
 * Responsibilities:
 * 1. Serve frontend Static Assets from ./dist (configured in wrangler.jsonc)
 * 2. Handle API routes formerly in functions/api/
 * 3. SPA fallback for React Router client-side routing
 * 4. Preserve Supabase integration via env bindings
 */

// Import database configuration (supabase client setup)
import { configureDatabaseEnv } from './server/db';

// Import API route handlers from src/api/
// These are adapted to work with Cloudflare Worker fetch handler signature.
// The adapter passes { request, env } which works for both:
// - onRequestPost({ request }: { request: Request }) - ignores extra env
// - onRequest({ request, env }: Context) - uses both request and env
import { onRequestPost as capturePost } from './api/capture';
import { onRequestPost as scraperPost } from './api/test-runner';
import { onRequest as webhookPost } from './api/whatsapp';

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

  // Default: should not reach here (SPA fallback handles it)
  return new Response('Not found', { status: 404 });
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
 * 3. Client-side routes (including /demo) are handled via 302 redirect
 *    to /index.html, which the platform serves from ./dist automatically.
 *    React Router handles client-side routing using the original URL as base.
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle API routes
    // The platform does NOT map /api/* to files in ./dist, so the Worker always runs for these
    if (path.startsWith('/api/')) {
      return routeToApi(request, env, ctx, url);
    }

    // 2. Handle client-side routes via 302 redirect to /index.html
    // The platform automatically serves ./dist/index.html for routes that
    // don't match specific files. The 302 redirect causes the browser to
    // request /index.html, which the platform serves. React Router then
    // handles client-side routing, preserving the original URL as the base.
    //
    // We handle /demo specifically to enable the demo page flow. The demo
    // page uses React Router with hardcoded demo tokens from the frontend
    // (api-interceptor.ts: demo-poa-yeshua, demo-poa-mestre, etc.).
    // Without this redirect, accessing /demo returns Error 1101.
    if (path === '/demo' || path.startsWith('/demo/')) {
      // 302 redirect to /index.html - platform serves ./dist/index.html
      // React Router handles client-side routing from there
      return Response.redirect(new URL('/index.html', request.url), 302);
    }

    // 3. SPA fallback for all other client-side routes
    // The platform does NOT find a matching file in ./dist for client routes
    // (e.g., /, /plataforma, /establishment/xyz, etc.)
    // The Worker runs and returns a 302 redirect to /index.html
    // React Router handles client-side routing from there
    return Response.redirect(new URL('/index.html', request.url), 302);
  }
};
