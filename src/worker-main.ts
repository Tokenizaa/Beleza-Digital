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
 * 3. All other requests (client-side routes) get SPA fallback via index.html
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

    // 2. SPA fallback for client-side routing
    // The platform does NOT find a matching file in ./dist for client routes
    // (e.g., /, /plataforma, /establishment/xyz, etc.)
    // The Worker runs and serves index.html so React Router can handle routing
    // Importantly: we do NOT use a 302 redirect, which would change the URL in
    // the browser address bar. Instead, we fetch index.html from the platform's
    // root directory and return its response, preserving the original URL that
    // the user typed or linked to.
    //
    // The platform automatically serves actual assets (css, js, images) from ./dist
    // when the request path maps to a file there. For client-side routes, the Worker
    // runs and returns index.html, and React Router handles the routing client-side,
    // using the original URL as the base.
    //
    // Key: we fetch /index.html from the root (using request.url.origin) so that
    // the platform serves ./dist/index.html automatically. The fetch runs in the
    // Worker context but does NOT change the browser's address bar, so the original
    // URL is preserved when React Router takes over client-side routing.
    
    // Fetch index.html from the platform-served root assets.
    // Using request.url.origin ensures we always get the root /index.html,
    // regardless of the current path. The platform serves ./dist/index.html
    // automatically, and the browser keeps the original URL since fetch()
    // does not change the address bar.
    const indexHtmlResponse = await fetch(new URL('/index.html', request.url.origin), {
      headers: request.headers,
    });
    
    return indexHtmlResponse;
  }
};