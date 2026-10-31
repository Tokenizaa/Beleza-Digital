import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { extractPlaceDetails } from "./extractor.js";
import { SELECTORS } from "./selectors.js";
import { getBrowserWSEndpoint } from "./browserless-endpoint.js";
import type { PlaceRecord, ScrapeInput, ScrapeProgress, ScrapeResult } from "./types.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SEARCH_STAGNANT_ROUNDS = 4;
const NAVIGATION_TIMEOUT_MS = 30_000;
const DETAIL_TIMEOUT_MS = 25_000;

function progress(input: ScrapeInput, value: ScrapeProgress) {
  return Promise.resolve(input.onProgress?.(value));
}

function getBrowserEndpoint(input: ScrapeInput): string {
  const explicitEndpoint = String(input.browserWSEndpoint ?? "").trim();
  return explicitEndpoint || getBrowserWSEndpoint();
}

function normalizePlaceUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

async function collectPlaceUrls(page: Page, limit: number, input: ScrapeInput): Promise<string[]> {
  const urls = new Set<string>();
  let previousCount = 0;
  let stagnantRounds = 0;

  while (urls.size < limit && stagnantRounds < SEARCH_STAGNANT_ROUNDS) {
    if (input.signal?.aborted) break;

    const links = await page.$$eval(SELECTORS.feed.placeLinks.join(", "), (anchors) =>
      anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .filter((href): href is string => Boolean(href) && href.includes("/maps/place/"))
    );

    for (const link of links) {
      if (urls.size >= limit) break;
      urls.add(normalizePlaceUrl(link));
    }

    await progress(input, {
      stage: "searching",
      totalFound: urls.size,
      totalCollected: 0,
      totalErrors: 0,
    });

    if (urls.size >= limit || input.signal?.aborted) break;

    const container = await page.$(SELECTORS.feed.container[0]);
    if (container) {
      await container.evaluate((element) => {
        (element as HTMLElement).scrollTop = (element as HTMLElement).scrollHeight;
      });
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    if (urls.size === previousCount) stagnantRounds += 1;
    else {
      previousCount = urls.size;
      stagnantRounds = 0;
    }
  }

  return [...urls].slice(0, limit);
}

/**
 * Independent capture engine: Google Maps search -> public place sheet -> PlaceRecord[].
 * It deliberately has no database, queue, tenant, CRM, qualification or HTTP dependencies.
 */
export async function scrapeGoogleMaps(input: ScrapeInput): Promise<ScrapeResult> {
  const query = input.query.trim();
  const location = input.location.trim();
  if (!query) throw new Error("Informe o segmento ou termo de busca.");
  if (!location) throw new Error("Informe a cidade ou região.");

  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(input.limit ?? DEFAULT_LIMIT)));
  const executionId = input.executionId?.trim() || `capture_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const results: PlaceRecord[] = [];
  const errors: ScrapeResult["errors"] = [];
  let browser: Browser | null = null;
  let totalFound = 0;

  try {
    await progress(input, { stage: "connecting", totalFound: 0, totalCollected: 0, totalErrors: 0 });
    browser = await puppeteer.connect({
      browserWSEndpoint: getBrowserEndpoint(input),
      protocolTimeout: 30_000,
    });

    const searchPage = await browser.newPage();
    await searchPage.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });
    await searchPage.goto(
      "https://www.google.com/maps/search/" + encodeURIComponent(`${query} ${location}`),
      { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }
    );
    await searchPage.waitForSelector(SELECTORS.feed.container[0], { timeout: 15_000 }).catch(() => undefined);

    const placeUrls = await collectPlaceUrls(searchPage, limit, input);
    totalFound = placeUrls.length;
    await searchPage.close().catch(() => undefined);

    for (const url of placeUrls) {
      if (input.signal?.aborted) break;
      let detailPage: Page | null = null;
      try {
        detailPage = await browser.newPage();
        await detailPage.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });
        await detailPage.goto(url, { waitUntil: "domcontentloaded", timeout: DETAIL_TIMEOUT_MS });
        await new Promise((resolve) => setTimeout(resolve, 700));
        const record = await extractPlaceDetails(detailPage, executionId, url);
        results.push(record);
      } catch (error) {
        errors.push({ url, message: error instanceof Error ? error.message : String(error) });
      } finally {
        await detailPage?.close().catch(() => undefined);
      }
      await progress(input, {
        stage: "collecting",
        totalFound,
        totalCollected: results.length,
        totalErrors: errors.length,
        currentUrl: url,
      });
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const completedAt = new Date().toISOString();
  await progress(input, {
    stage: "completed",
    totalFound,
    totalCollected: results.length,
    totalErrors: errors.length,
  });

  return {
    executionId,
    query,
    location,
    totalFound,
    totalCollected: results.length,
    totalErrors: errors.length,
    results,
    errors,
    startedAt,
    completedAt,
  };
}

export type { PlaceRecord, ScrapeInput, ScrapeProgress, ScrapeResult } from "./types.js";
