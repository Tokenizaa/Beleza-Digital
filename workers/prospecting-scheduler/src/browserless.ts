type BrowserlessDiscoveryInput = {
  token: string;
  baseUrl?: string;
  searchQuery: string;
  limit: number;
};

type BrowserlessDiscoveryResult = {
  results: Array<Record<string, unknown>>;
  searchQuery: string;
  provider: "browserless";
};

const MAPS_DISCOVERY_FUNCTION = "export default async ({ page, context }) => {\n  const searchQuery = String(context.searchQuery || \"\");\n  const targetLimit = Math.max(1, Math.min(100, Number(context.limit) || 10));\n  const searchUrl = \"https://www.google.com/maps/search/\" + encodeURIComponent(searchQuery);\n  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));\n\n  await page.setViewport({ width: 1440, height: 1000 });\n  await page.goto(searchUrl, { waitUntil: \"domcontentloaded\", timeout: 30000 });\n  await page.evaluate(() => {\n    const consentButton = Array.from(document.querySelectorAll(\"button\")).find((button) =>\n      /accept all|aceitar tudo|i agree|concordo/i.test(String(button.innerText || button.getAttribute(\"aria-label\") || \"\").trim())\n    );\n    if (consentButton) consentButton.click();\n  }).catch(() => {});\n  await sleep(700);\n\n  const feedReady = await page.waitForSelector('[role=\"feed\"]', { timeout: 20000 })\n    .then(() => true)\n    .catch(() => false);\n  if (!feedReady) {\n    const pageState = await page.evaluate(() => ({\n      title: document.title,\n      text: (document.body && document.body.innerText || \"\").slice(0, 1200),\n    }));\n    throw new Error(\"google_maps_feed_not_found: \" + JSON.stringify(pageState));\n  }\n\n  const listings = new Map();\n  let stagnantRounds = 0;\n  let previousCount = 0;\n\n  for (let round = 0; round < 35 && listings.size < targetLimit; round++) {\n    const visible = await page.evaluate(() => {\n      const output = [];\n      const seen = new Set();\n      document.querySelectorAll('a[href*=\"/maps/place/\"]').forEach((node) => {\n        const anchor = node;\n        const href = String(anchor.href || \"\").split(\"&\")[0];\n        if (!href || seen.has(href)) return;\n        seen.add(href);\n        const container = anchor.closest('[role=\"article\"]') ||\n          anchor.closest(\".Nv2PK\") ||\n          anchor.parentElement?.parentElement ||\n          anchor.parentElement ||\n          anchor;\n        const cardText = String((container && container.innerText) || anchor.innerText || \"\")\n          .replace(/\\s+/g, \" \").trim();\n        const name = String(\n          anchor.getAttribute(\"aria-label\") ||\n          anchor.querySelector(\".qBF1Pd, .fontHeadlineSmall\")?.textContent ||\n          anchor.textContent ||\n          \"\"\n        ).replace(/\\s+/g, \" \").trim();\n        if (!name || !href) return;\n        output.push({ name: name.slice(0, 240), url: href, cardText: cardText.slice(0, 2500) });\n      });\n      return output;\n    });\n\n    for (const listing of visible) {\n      if (!listings.has(listing.url)) listings.set(listing.url, listing);\n      if (listings.size >= targetLimit) break;\n    }\n\n    const endOfList = await page.evaluate(() => {\n      const text = document.body?.innerText || \"\";\n      return /você chegou ao final da lista|you've reached the end of the list|não há mais resultados/i.test(text);\n    });\n    if (endOfList && listings.size > 0) break;\n\n    if (listings.size === previousCount) stagnantRounds++;\n    else stagnantRounds = 0;\n    previousCount = listings.size;\n    if (stagnantRounds >= 5) break;\n\n    await page.evaluate(() => {\n      const feed = document.querySelector('[role=\"feed\"]') ||\n        document.querySelector(\"div.m6QErb[aria-label]\");\n      if (feed) feed.scrollTop += 1000;\n    }).catch(() => {});\n    await page.mouse.wheel({ deltaY: 1400 }).catch(() => {});\n    await sleep(stagnantRounds > 0 ? 1000 : 700);\n  }\n\n  const results = [];\n  const selected = Array.from(listings.values()).slice(0, targetLimit);\n\n  for (let index = 0; index < selected.length; index++) {\n    const listing = selected[index];\n    try {\n      await page.goto(listing.url, { waitUntil: \"domcontentloaded\", timeout: 25000 });\n      await sleep(650);\n      const detail = await page.evaluate((sourceUrl) => {\n        const textOf = (selector) => {\n          const element = document.querySelector(selector);\n          const value = (element && element.innerText) ||\n            (element && element.getAttribute(\"aria-label\")) || \"\";\n          return String(value).replace(/\\s+/g, \" \").trim() || null;\n        };\n        const hrefOf = (selector) => {\n          const element = document.querySelector(selector);\n          const value = element && element.href;\n          return value && /^https?:\\/\\//i.test(value) ? value : null;\n        };\n        const bodyText = document.body?.innerText || \"\";\n        const ratingLabel = document.querySelector('div.F7nice, [aria-label*=\"stars\"], [aria-label*=\"estrelas\"]')?.getAttribute(\"aria-label\") || \"\";\n        const ratingText = textOf(\"div.F7nice\") || \"\";\n        const reviewLabel = document.querySelector('button[aria-label*=\"reviews\"], button[aria-label*=\"avaliações\"], [aria-label*=\"reviews\"], [aria-label*=\"avaliações\"]')?.getAttribute(\"aria-label\") || \"\";\n        const ratingSource = [ratingLabel, ratingText, reviewLabel, bodyText.slice(0, 8000)].join(\" \");\n        const ratingMatch = ratingSource.match(/(?:^|\\s)([0-5](?:[.,]\\d+)?)\\s*(?:estrelas?|stars?)?/i) || bodyText.match(/([0-5][.,]\\d)\\s*\\(/);\n        const reviewMatch = ratingSource.match(/([\\d.,]+)\\s*(?:avaliações|avaliação|reviews|review|comentários)/i) || bodyText.match(/\\(([0-9][0-9.,]*)\\)/);\n        const parseCount = (value) => {\n          if (!value) return null;\n          const digits = String(value).replace(/[.,](?=\\d{3}\\b)/g, \"\").replace(/\\D/g, \"\");\n          const parsed = Number(digits);\n          return Number.isSafeInteger(parsed) ? parsed : null;\n        };\n        const rating = ratingMatch ? Number(ratingMatch[1].replace(\",\", \".\")) : null;\n        const reviewCount = parseCount(reviewMatch ? reviewMatch[1] : \"\") ||\n          parseCount(bodyText.match(/\\(([0-9][0-9.,]*)\\)/)?.[1]);\n        const openingHours = Array.from(document.querySelectorAll(\"table.eK4R0e tr, table[aria-label*='hours'] tr\"))\n          .map((row) => String(row.innerText || \"\").replace(/\\s+/g, \" \").trim())\n          .filter(Boolean).slice(0, 14);\n        const images = Array.from(document.querySelectorAll(\"img\"))\n          .map((image) => image.currentSrc || image.src || \"\")\n          .filter((url) => /^https?:\\/\\//i.test(url) && /googleusercontent|gstatic/i.test(url));\n        const uniqueImages = Array.from(new Set(images)).slice(0, 20);\n        const category = textOf(\"button.DkEaL\") || textOf('button[jsaction*=\"category\"]');\n        const address = textOf('[data-item-id=\"address\"]');\n        const phoneElement = document.querySelector('[data-item-id^=\"phone:tel\"], a[href^=\"tel:\"]');\n        const phoneHref = phoneElement && phoneElement.getAttribute(\"href\");\n        const phone = phoneHref && phoneHref.startsWith(\"tel:\")\n          ? phoneHref.slice(4)\n          : (phoneElement && phoneElement.innerText ? phoneElement.innerText.trim() : null);\n        const website = hrefOf('a[data-item-id=\"authority\"]') ||\n          hrefOf('a[aria-label*=\"Website\"]') ||\n          hrefOf('a[aria-label*=\"website\"]');\n        const coordinates = sourceUrl.match(/@(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?)/);\n        const feature = sourceUrl.match(/!1s([^!/?]+)/);\n        const placeIdMatch = sourceUrl.match(/[?&]place_id=([^&]+)/i);\n        const price = bodyText.match(/(?:Preço|Price)\\s*[:·]?\\s*([$]{1,4}|R[$]{1,4})/i);\n        const operatingStatusMatch = bodyText.match(/(Aberto(?:\\s*[·•-]\\s*fecha\\s*às?\\s*[\\d: h.]+)?|Fechado temporariamente|Fechado permanentemente|Open(?:\\s*[·•-]\\s*Closes?\\s*at\\s*[\\d: h.]+)?|Temporarily closed|Permanently closed)/i);\n        const editorialSummary = textOf('[class*=\"PYvSYb\"], [class*=\"WeS02d\"]');\n        const name = textOf(\"h1.DUwDvf\") || document.querySelector(\"h1\")?.textContent?.trim() || null;\n        return {\n          name,\n          category: category || null,\n          address: address || null,\n          phone: phone || null,\n          website: website || null,\n          rating: Number.isFinite(rating) ? rating : null,\n          reviewCount: reviewCount,\n          sourceUrl: sourceUrl,\n          placeId: placeIdMatch ? decodeURIComponent(placeIdMatch[1]) : null,\n          featureId: feature ? decodeURIComponent(feature[1]) : null,\n          latitude: coordinates ? Number(coordinates[1]) : null,\n          longitude: coordinates ? Number(coordinates[2]) : null,\n          images: uniqueImages,\n          openingHours,\n          priceLevel: price?.[1] || null,\n          operatingStatus: operatingStatusMatch?.[1]?.trim() || null,\n          editorialSummary: editorialSummary || null,\n          rawListingText: bodyText.slice(0, 8000),\n          fieldStatus: {\n            name: name ? \"found\" : \"not_found_in_capture\",\n            category: category ? \"found\" : \"not_found_in_capture\",\n            address: address ? \"found\" : \"not_found_in_capture\",\n            phone: phone ? \"found\" : \"not_found_in_capture\",\n            website: website ? \"found\" : \"not_found_in_capture\",\n            rating: Number.isFinite(rating) ? \"found\" : \"not_found_in_capture\",\n            reviewCount: reviewCount !== null ? \"found\" : \"not_found_in_capture\",\n            images: uniqueImages.length ? \"found\" : \"not_found_in_capture\",\n            openingHours: openingHours.length ? \"found\" : \"not_found_in_capture\"\n          }\n        };\n      }, page.url());\n\n      results.push({\n        ...listing,\n        ...detail,\n        name: detail.name || listing.name,\n        sourceUrl: detail.sourceUrl || listing.url\n      });\n    } catch (error) {\n      results.push({\n        ...listing,\n        sourceUrl: listing.url,\n        fieldStatus: {\n          detailPage: \"failed\",\n          error: String(error && error.message ? error.message : error).slice(0, 250)\n        }\n      });\n    }\n  }\n\n  return {\n    data: { results, searchQuery, provider: \"browserless\" },\n    type: \"application/json\"\n  };\n};"

export async function discoverGoogleMapsWithBrowserless(
  input: BrowserlessDiscoveryInput,
): Promise<BrowserlessDiscoveryResult> {
  const token = input.token?.trim();
  if (!token) throw new Error("browserless_token_missing");

  const baseUrl = (input.baseUrl?.trim() || "https://production-sfo.browserless.io").replace(/\/+$/, "");
  const parsedBase = new URL(baseUrl);
  if (parsedBase.protocol !== "https:") throw new Error("browserless_endpoint_must_use_https");

  const timeoutMs = 120_000;
  const endpoint = new URL("/function", parsedBase);
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("timeout", String(timeoutMs));

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      code: MAPS_DISCOVERY_FUNCTION,
      context: {
        searchQuery: input.searchQuery,
        limit: Math.max(1, Math.min(100, Math.floor(input.limit))),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs + 10_000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`browserless_http_${response.status}:${responseText.slice(0, 500)}`);
  }

  let payload: unknown;
  try { payload = JSON.parse(responseText); }
  catch { throw new Error(`browserless_invalid_json:${responseText.slice(0, 250)}`); }

  const envelope = payload as { data?: unknown; results?: unknown };
  const data = (envelope.data && typeof envelope.data === "object"
    ? envelope.data
    : envelope) as { results?: unknown };
  if (!Array.isArray(data.results)) throw new Error("browserless_response_missing_results");

  return {
    results: data.results.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
    ),
    searchQuery: input.searchQuery,
    provider: "browserless",
  };
}
