const MAX_HTML_BYTES = 1_000_000;
const USER_AGENT = "YeshuaLeadResearch/1.0 (+public-business-metadata; contact: admin)";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").trim();
  if (!host) return true;

  // Local and non-routable domain suffixes
  const blockedSuffixes = [
    ".localhost",
    ".local",
    ".localdomain",
    ".internal",
    ".test",
    ".example",
    ".invalid",
    ".onion",
    ".nip.io",
    ".sslip.io",
  ];
  if (host === "localhost" || blockedSuffixes.some((suffix) => host.endsWith(suffix))) {
    return true;
  }

  // Pure integer / numeric IP notation (e.g. http://2130706433/ = 127.0.0.1)
  if (/^\d+$/.test(host)) {
    return true;
  }

  // Shorthand numeric IP (e.g. 127.1 or 10.1 or 0177.0.0.1)
  if (/^[\d.]+$/.test(host)) {
    const numParts = host.split(".");
    if (numParts.length !== 4) {
      return true;
    }
  }

  // Hex or octal notation
  if (/^0x/i.test(host) || /^0\d+/.test(host)) {
    return true;
  }

  // IPv6 checks (loopback, link-local, site-local, unique local fc00::/7, mapped IPv4)
  if (host.includes(":")) {
    const cleanIpv6 = host.replace(/^::ffff:/i, "");
    if (
      host === "::1" ||
      host === "::" ||
      host === "0:0:0:0:0:0:0:0" ||
      host === "0:0:0:0:0:0:0:1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fec0:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("::ffff:")
    ) {
      return true;
    }
    // If it was mapped IPv4 e.g. ::ffff:127.0.0.1
    if (cleanIpv6 !== host && isBlockedHost(cleanIpv6)) {
      return true;
    }
  }

  // IPv4 dotted-decimal validation
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const octets = parts.map(Number);
    if (octets.some((part) => part < 0 || part > 255)) return true;
    const [a, b] = octets;

    // 0.0.0.0/8 (current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 100.64.0.0/10 (shared carrier CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata service 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF protocol assignments)
    // 192.168.0.0/16 (private)
    if (a === 192 && (b === 0 || b === 168)) return true;
    // 198.18.0.0/15 (benchmark testing) or 198.51.100.0/24
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
    // 203.0.113.0/24 (documentation)
    if (a === 203 && b === 0) return true;
    // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)
    if (a >= 224) return true;
  }

  return false;
}

export function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (isBlockedHost(url.hostname)) return null;

    // Only allow standard HTTP/HTTPS web ports
    if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) {
      return null;
    }

    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Math.min(parseInt(code, 16), 0x10ffff)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMeta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return "";
}

export function findJsonLd(html: string): unknown[] {
  const result: unknown[] = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && result.length < 20) {
    try {
      const parsed = JSON.parse(match[1]);
      result.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Ignore malformed structured data and continue
    }
  }
  return result;
}

export function flattenJsonLd(items: unknown[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || result.length >= 100) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    result.push(record);
    if (record["@graph"]) visit(record["@graph"]);
    if (record.mainEntity) visit(record.mainEntity);
  };
  items.forEach(visit);
  return result;
}

export function textValue(value: unknown): string {
  if (typeof value === "string") return decodeEntities(value).slice(0, 300);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return [item.streetAddress, item.addressLocality, item.addressRegion, item.postalCode]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .join(", ")
      .slice(0, 300);
  }
  return "";
}

export function extractHtmlMetadata(html: string, targetUrl: URL, requestedUrl: string) {
  // Check for common bot protection / Cloudflare challenge pages
  const lowerHtml = html.toLowerCase();
  if (
    lowerHtml.includes("<title>just a moment...</title>") ||
    lowerHtml.includes("attention required! | cloudflare") ||
    lowerHtml.includes("cf-browser-verification") ||
    lowerHtml.includes("ddos-guard")
  ) {
    throw new Error("O site está protegido por verificação contra robôs (CAPTCHA/Cloudflare). Insira os dados manualmente.");
  }

  const structured = flattenJsonLd(findJsonLd(html));
  const business =
    structured.find((item) => {
      const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
      return types.some(
        (type) =>
          typeof type === "string" &&
          /localbusiness|organization|professionalservice|store|healthandbeautybusiness|beautysalon|barbershop|hair salon|restaurant|foodestablishment/i.test(
            type
          )
      );
    }) ?? structured.find((item) => item.name);

  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1];
  const phones = html.match(/(?:href=["']tel:([^"'?]+)|(?:telephone|phone|telefone|whatsapp)["']?\s*[:=]\s*["']?([^"'<>\s]{7,24}))/i);
  const waMatch = html.match(/(?:href=["']https?:\/\/(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/))(\+?\d{10,15})/i);
  const emails = html.match(/(?:href=["']mailto:([^"'?]+)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const addressTag = decodeEntities(html.match(/<address\b[^>]*>([\s\S]*?)<\/address>/i)?.[1] ?? "");

  const typeValue = business?.["@type"];
  const category =
    typeof typeValue === "string"
      ? typeValue
      : Array.isArray(typeValue)
      ? (typeValue.find((item) => typeof item === "string") as string ?? "")
      : "";

  const address =
    textValue(business?.address) ||
    getMeta(html, "og:street-address") ||
    getMeta(html, "business:contact_data:street_address") ||
    addressTag;

  let logoUrl = "";
  if (typeof business?.logo === "string") {
    try { logoUrl = new URL(business.logo, targetUrl).toString(); } catch {}
  } else if (business?.logo && typeof (business.logo as any).url === "string") {
    try { logoUrl = new URL((business.logo as any).url, targetUrl).toString(); } catch {}
  } else {
    const metaImg = getMeta(html, "og:image") || getMeta(html, "twitter:image");
    if (metaImg) {
      try { logoUrl = new URL(metaImg, targetUrl).toString(); } catch { logoUrl = metaImg; }
    }
  }

  const businessName =
    textValue(business?.name) ||
    getMeta(html, "og:site_name") ||
    getMeta(html, "og:title") ||
    getMeta(html, "twitter:title") ||
    title;

  const description =
    textValue(business?.description) ||
    getMeta(html, "description") ||
    getMeta(html, "og:description") ||
    getMeta(html, "twitter:description");

  const phone = textValue(business?.telephone) || decodeEntities(phones?.[1] ?? phones?.[2] ?? "") || (waMatch?.[1] ?? "");
  const email = textValue(business?.email) || decodeEntities(emails?.[1] ?? emails?.[0] ?? "");

  return {
    requestedUrl,
    finalUrl: targetUrl.toString(),
    sourceUrl: canonical ? new URL(canonical, targetUrl).toString() : targetUrl.toString(),
    capturedAt: new Date().toISOString(),
    businessName,
    category: category || getMeta(html, "article:section"),
    description,
    phone,
    email,
    address,
    logoUrl,
    evidence: {
      name: Boolean(businessName),
      description: Boolean(description),
      phone: Boolean(phone),
      email: Boolean(email),
      address: Boolean(address),
    },
    notice: "Metadados públicos extraídos automaticamente. Revise os campos antes de marcar como verificados.",
  };
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("O HTML excede o limite de 1 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export const onRequestPost = async ({ request }: { request: Request }) => {
  // Origin verification: protect against cross-origin abuse (CSRF / unauthorized embedding)
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  let requestOrigin = "";
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {}

  if (origin && origin !== requestOrigin) {
    return json({ error: "Origem da requisição não permitida." }, 403);
  }
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== requestOrigin) {
        return json({ error: "Origem da requisição não permitida." }, 403);
      }
    } catch {
      return json({ error: "Origem da requisição não permitida." }, 403);
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4096) {
    return json({ error: "Corpo da requisição excede o limite permitido (4 KB)." }, 413);
  }

  let payload: { url?: unknown };
  try {
    payload = (await request.json()) as { url?: unknown };
  } catch {
    return json({ error: "Envie um JSON válido com o campo url." }, 400);
  }

  if (typeof payload.url !== "string" || payload.url.length > 2048) {
    return json({ error: "Informe uma URL pública válida (até 2048 caracteres)." }, 400);
  }

  let target = safeUrl(payload.url);
  if (!target) {
    return json(
      { error: "URL bloqueada. Use um endereço público HTTP ou HTTPS, sem credenciais ou portas restritas." },
      400
    );
  }

  let response: Response | undefined;
  try {
    for (let hop = 0; hop <= 3; hop++) {
      response = await fetch(target.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === 3) {
          return json({ error: "Redirecionamento excessivo ou sem destino." }, 422);
        }
        const redirected = safeUrl(new URL(location, target).toString());
        if (!redirected) {
          return json({ error: "O site redirecionou para um endereço bloqueado ou privado." }, 422);
        }
        target = redirected;
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      return json(
        { error: `O site respondeu com erro HTTP ${response?.status ?? "sem resposta"}.` },
        422
      );
    }

    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      return json({ error: "O endereço informado não retornou uma página HTML." }, 422);
    }

    const html = await readLimited(response);
    const result = extractHtmlMetadata(html, target, payload.url);

    if (!result.businessName) {
      // Check if it was an empty SPA container
      if (html.includes("<div id=\"root\"></div>") || html.includes("<div id=\"app\"></div>")) {
        return json(
          { error: "A página depende de execução de JavaScript no cliente e não expôs metadados públicos. Insira os dados manualmente." },
          422
        );
      }
      return json(
        { error: "A página abriu, mas não foi possível identificar o nome do negócio. Cadastre manualmente ou use outra URL." },
        422
      );
    }

    return json(result);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return json(
      {
        error: isTimeout
          ? "O site demorou mais de 8 segundos para responder."
          : error instanceof Error
          ? error.message
          : "Falha ao capturar metadados públicos.",
      },
      502
    );
  } finally {
    try {
      await response?.body?.cancel();
    } catch {
      // Body may already be read
    }
  }
};
