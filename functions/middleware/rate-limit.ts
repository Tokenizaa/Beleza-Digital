interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  RATE_LIMIT_KV?: RateLimitKV;
}

type Context = { request: Request; env: Env; next: () => Promise<Response> };

const AUTH_PATHS = ['/plataforma/acesso', '/plataforma/cadastro', '/plataforma/login'];
const MAX_REQUESTS = 10; // per window
const WINDOW_SECONDS = 900; // 15 minutes

export async function onRequest({ request, env, next }: Context) {
  const url = new URL(request.url);
  const isAuthPath = AUTH_PATHS.some(path => url.pathname.startsWith(path));

  if (!isAuthPath || request.method !== 'POST') {
    return next();
  }

  if (!env.RATE_LIMIT_KV) {
    console.warn('RATE_LIMIT_KV binding not configured, skipping rate limit');
    return next();
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const key = `ratelimit:auth:${ip}`;
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;

  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    let requests: number[] = raw ? JSON.parse(raw) : [];

    // Filter out old requests outside the window
    requests = requests.filter(ts => ts > windowStart);

    if (requests.length >= MAX_REQUESTS) {
      const retryAfter = Math.ceil((requests[0] + WINDOW_SECONDS * 1000 - now) / 1000);
      return new Response(JSON.stringify({
        error: 'Muitas tentativas. Tente novamente em alguns minutos.',
        retryAfter
      }), {
        status: 429,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((requests[0] + WINDOW_SECONDS * 1000) / 1000))
        }
      });
    }

    // Add current request
    requests.push(now);
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(requests), { expirationTtl: WINDOW_SECONDS + 60 });

    const response = await next();

    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(MAX_REQUESTS));
    headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - requests.length)));
    headers.set('X-RateLimit-Reset', String(Math.ceil((now + WINDOW_SECONDS * 1000) / 1000)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (err) {
    console.error('Rate limit error:', err);
    // Fail open - don't block on rate limit errors
    return next();
  }
}