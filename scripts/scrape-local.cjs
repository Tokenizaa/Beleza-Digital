#!/usr/bin/env node
'use strict';

/**
 * Coleta local de negócios do Google Maps para a Beleza Digital.
 *
 * Inspirado nos padrões de separação, identidade estável, paginação conservadora
 * e saída estruturada de gosom/google-maps-scraper. Mantém a stack Node/Playwright
 * já usada neste repositório e não adiciona serviço ou banco paralelo.
 *
 * Uso:
 *   SCRAPE_QUERY="barbearia em Porto Alegre RS Brasil" SCRAPE_LIMIT=20 node scripts/scrape-local.cjs
 *
 * Obrigatório: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local seguro.
 * Nunca coloque credenciais em argumentos, logs, frontend ou arquivos versionados.
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const DEFAULT_QUERY = 'Barbearia em Porto Alegre RS Brasil';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const NAVIGATION_TIMEOUT_MS = 45000;
const DETAIL_TIMEOUT_MS = 25000;
const SCROLL_DELAY_MS = 1200;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBusinessName(value) {
  return normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeWebsite(value) {
  if (!value || !String(value).trim()) return null;
  try {
    const raw = String(value).trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.hostname + (url.pathname === '/' ? '' : url.pathname);
  } catch {
    return null;
  }
}

function safeWebsiteUrl(value) {
  if (!value || !String(value).trim()) return null;
  try {
    const raw = String(value).trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizePhone(value, countryCode) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if ((countryCode || 'BR').toUpperCase() === 'BR' && (digits.length === 10 || digits.length === 11)) {
    return '55' + digits;
  }
  return digits;
}

function parseRatingAndReviewCount(value) {
  const text = normalizeText(value);
  const ratingMatch = text.match(/(?:^|\s)([0-5](?:[.,]\d+)?)\s*(?:estrelas?|stars?)?/i);
  const reviewsMatch = text.match(/([\d.,]+)\s*(?:avaliações|avaliação|reviews|review|comentários)/i) || text.match(/\(([\d.,]+)\)/);
  const rating = ratingMatch ? Number(ratingMatch[1].replace(',', '.')) : null;
  const reviewCount = reviewsMatch ? Number(reviewsMatch[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) : null;
  return {
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
    reviewCount: Number.isSafeInteger(reviewCount) && reviewCount >= 0 ? reviewCount : null,
  };
}

function stableDedupeKey(place) {
  const featureId = normalizeText(place.featureId);
  const placeId = normalizeText(place.placeId);
  const phone = normalizePhone(place.phone, place.countryCode || 'BR');
  const website = normalizeWebsite(place.websiteUrl);
  const name = normalizeBusinessName(place.businessName);
  const city = normalizeBusinessName(place.city);
  const region = normalizeBusinessName(place.region);

  let identity;
  if (featureId) identity = 'google-feature:' + featureId;
  else if (placeId) identity = 'google-place:' + placeId;
  else if (website) identity = 'website:' + website;
  else if (phone) identity = 'phone:' + phone;
  else if (name && city && region) identity = 'name-location:' + name + '|' + city + '|' + region;
  else return null;

  return 'sha256:' + crypto.createHash('sha256').update(identity).digest('hex');
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function scoreCompleteness(place) {
  const fields = [
    Boolean(normalizeText(place.businessName)),
    Boolean(normalizeText(place.category)),
    Boolean(normalizeText(place.address)),
    Boolean(normalizePhone(place.phone, place.countryCode || 'BR')),
    Boolean(normalizeWebsite(place.websiteUrl)),
    Number.isFinite(place.rating),
    Number.isSafeInteger(place.reviewCount) && place.reviewCount >= 0,
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    Boolean(normalizeText(place.mapsUrl)),
    Array.isArray(place.images) && place.images.length > 0,
  ];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

function scoreOpportunity(place) {
  // Potencial comercial não é completude. Não ter site é uma oportunidade possível,
  // nunca prova de que o negócio não possui site. A ausência só adiciona sinal quando
  // os demais dados identificam um negócio real.
  let score = 0;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push('+' + points + ': ' + reason); };

  if (normalizeText(place.businessName)) add(15, 'nome comercial identificado');
  if (normalizeText(place.category)) add(5, 'categoria identificada');
  if (normalizeText(place.address)) add(10, 'endereço público disponível');
  if (normalizePhone(place.phone, place.countryCode || 'BR')) add(20, 'telefone público disponível');
  if (Number.isFinite(place.rating)) {
    const ratingPoints = place.rating >= 4.7 ? 15 : place.rating >= 4.3 ? 12 : place.rating >= 3.8 ? 8 : 3;
    add(ratingPoints, 'reputação pública de ' + place.rating.toFixed(1) + '/5');
  }
  if (Number.isSafeInteger(place.reviewCount) && place.reviewCount >= 100) add(10, 'volume relevante de avaliações');
  else if (Number.isSafeInteger(place.reviewCount) && place.reviewCount >= 10) add(6, 'avaliações públicas disponíveis');
  if (Array.isArray(place.images) && place.images.length > 0) add(5, 'fotos públicas identificadas');
  if (!normalizeWebsite(place.websiteUrl) && (normalizePhone(place.phone, place.countryCode || 'BR') || normalizeText(place.address))) {
    add(10, 'site não identificado na coleta; oportunidade a confirmar');
  } else if (normalizeWebsite(place.websiteUrl)) {
    add(5, 'site público identificado para avaliar qualidade');
  }

  return { score: Math.min(100, score), reasons };
}

function buildCandidate(place, query, collectedAt) {
  const normalized = {
    businessName: normalizeText(place.businessName) || null,
    category: normalizeText(place.category) || null,
    address: normalizeText(place.address) || null,
    phone: normalizeText(place.phone) || null,
    websiteUrl: safeWebsiteUrl(place.websiteUrl),
    city: normalizeText(place.city) || null,
    region: normalizeText(place.region) || null,
    countryCode: normalizeText(place.countryCode || 'BR').toUpperCase(),
    rating: Number.isFinite(place.rating) ? place.rating : null,
    reviewCount: Number.isSafeInteger(place.reviewCount) && place.reviewCount >= 0 ? place.reviewCount : null,
    latitude: Number.isFinite(place.latitude) ? place.latitude : null,
    longitude: Number.isFinite(place.longitude) ? place.longitude : null,
    mapsUrl: normalizeText(place.mapsUrl) || null,
    placeId: normalizeText(place.placeId) || null,
    featureId: normalizeText(place.featureId) || null,
    images: Array.isArray(place.images) ? place.images.filter((item) => typeof item === 'string' && /^https?:\/\//i.test(item)).slice(0, 20) : [],
    openingHours: Array.isArray(place.openingHours) ? place.openingHours : [],
    priceLevel: normalizeText(place.priceLevel) || null,
    editorialSummary: normalizeText(place.editorialSummary) || null,
    attributes: place.attributes && typeof place.attributes === 'object' ? place.attributes : {},
    rawCardText: normalizeText(place.rawCardText) || null,
    fieldStatus: place.fieldStatus && typeof place.fieldStatus === 'object' ? place.fieldStatus : {},
  };

  const completenessScore = scoreCompleteness(normalized);
  const opportunity = scoreOpportunity(normalized);
  const sourceUrl = normalized.mapsUrl || 'https://www.google.com/maps/search/' + encodeURIComponent(query);

  const rawEvidence = {
    schemaVersion: 2,
    provider: 'google-maps-playwright',
    query,
    collectedAt,
    featureId: normalized.featureId,
    placeId: normalized.placeId,
    mapsUrl: normalized.mapsUrl,
    rating: normalized.rating,
    reviewsCount: normalized.reviewCount,
    reviewCount: normalized.reviewCount,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    images: normalized.images,
    openingHours: normalized.openingHours,
    priceLevel: normalized.priceLevel,
    editorialSummary: normalized.editorialSummary,
    attributes: normalized.attributes,
    rawCardText: normalized.rawCardText,
    fieldStatus: normalized.fieldStatus,
    completenessScore,
    opportunityScore: opportunity.score,
    opportunityReasons: opportunity.reasons,
  };

  const candidate = {
    business_name: normalized.businessName,
    category: normalized.category,
    website_url: normalized.websiteUrl,
    normalized_website: normalizeWebsite(normalized.websiteUrl),
    phone: normalized.phone,
    normalized_phone: normalizePhone(normalized.phone, normalized.countryCode),
    address: normalized.address,
    city: normalized.city,
    region: normalized.region,
    country_code: normalized.countryCode,
    provider: 'google-maps-playwright',
    source_url: sourceUrl,
    raw_evidence: rawEvidence,
    qualification_score: opportunity.score,
    dedupe_key: stableDedupeKey({
      businessName: normalized.businessName,
      websiteUrl: normalized.websiteUrl,
      phone: normalized.phone,
      city: normalized.city,
      region: normalized.region,
      countryCode: normalized.countryCode,
      featureId: normalized.featureId,
      placeId: normalized.placeId,
    }),
  };

  return candidate;
}

async function safeText(locator) {
  try {
    const value = await locator.first().innerText({ timeout: 2500 });
    return normalizeText(value) || null;
  } catch {
    return null;
  }
}

async function extractDetail(browser, listing, query, locationDefaults) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const result = {
    businessName: listing.name || null,
    category: null,
    address: null,
    phone: null,
    websiteUrl: null,
    city: locationDefaults.city || null,
    region: locationDefaults.region || null,
    countryCode: locationDefaults.countryCode || 'BR',
    rating: null,
    reviewCount: null,
    latitude: null,
    longitude: null,
    mapsUrl: listing.url || null,
    placeId: null,
    featureId: null,
    images: [],
    openingHours: [],
    priceLevel: null,
    editorialSummary: null,
    attributes: {},
    rawCardText: listing.cardText || null,
    fieldStatus: {},
  };

  try {
    await page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(1800);

    const name = await safeText(page.locator('h1.DUwDvf, h1'));
    if (name) result.businessName = name;

    result.category = await safeText(page.locator('button.DkEaL, button[jsaction*="category"], [class*="fontBodyMedium"] button'));
    result.address = await safeText(page.locator('[data-item-id="address"]'));
    const phoneLocator = page.locator('[data-item-id^="phone:tel"], a[href^="tel:"]');
    result.phone = await safeText(phoneLocator);
    const phoneHref = await phoneLocator.first().getAttribute('href').catch(() => null);
    if (phoneHref && phoneHref.startsWith('tel:')) result.phone = phoneHref.slice(4);

    const websiteLocator = page.locator('a[data-item-id="authority"], a[aria-label*="Website"], a[aria-label*="website"]');
    const websiteHref = await websiteLocator.first().getAttribute('href').catch(() => null);
    if (websiteHref && /^https?:\/\//i.test(websiteHref)) result.websiteUrl = websiteHref;

    const ratingLabel = await page.locator('div.F7nice, [aria-label*="stars"], [aria-label*="estrelas"]').first().getAttribute('aria-label').catch(() => null);
    const ratingText = await safeText(page.locator('div.F7nice'));
    const reviewText = await page.locator('button[aria-label*="reviews"], button[aria-label*="avaliações"], [aria-label*="reviews"], [aria-label*="avaliações"]').first().getAttribute('aria-label').catch(() => null);
    const parsed = parseRatingAndReviewCount([ratingLabel, ratingText, reviewText].filter(Boolean).join(' '));
    result.rating = parsed.rating;
    result.reviewCount = parsed.reviewCount;

    const hoursRows = await page.locator('table.eK4R0e tr, table[aria-label*="hours"] tr').evaluateAll((rows) =>
      rows.map((row) => (row.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    ).catch(() => []);
    result.openingHours = hoursRows.slice(0, 14);

    const images = await page.locator('img').evaluateAll((nodes) =>
      nodes.map((img) => img.currentSrc || img.src || '').filter((src) => /^https?:\/\//i.test(src) && /googleusercontent|gstatic/i.test(src))
    ).catch(() => []);
    result.images = Array.from(new Set(images)).slice(0, 20);

    const summary = await safeText(page.locator('[class*="PYvSYb"], [class*="WeS02d"]'));
    result.editorialSummary = summary;

    const href = page.url();
    result.mapsUrl = href;
    const placeMatch = href.match(/!1s([^!/?]+)/);
    if (placeMatch) result.featureId = decodeURIComponent(placeMatch[1]);
    const placeIdMatch = href.match(/place_id[=:]([^&]+)/i);
    if (placeIdMatch) result.placeId = decodeURIComponent(placeIdMatch[1]);

    const coordinatesMatch = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (coordinatesMatch) {
      result.latitude = Number(coordinatesMatch[1]);
      result.longitude = Number(coordinatesMatch[2]);
    }

    const pageText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    if (!result.featureId) {
      const featureMatch = pageText.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
      if (featureMatch) result.featureId = featureMatch[0];
    }

    result.fieldStatus = {
      name: result.businessName ? 'found' : 'not_found_in_capture',
      category: result.category ? 'found' : 'not_found_in_capture',
      address: result.address ? 'found' : 'not_found_in_capture',
      phone: result.phone ? 'found' : 'not_found_in_capture',
      website: result.websiteUrl ? 'found' : 'not_found_in_capture',
      rating: result.rating !== null ? 'found' : 'not_found_in_capture',
      reviewCount: result.reviewCount !== null ? 'found' : 'not_found_in_capture',
      images: result.images.length ? 'found' : 'not_found_in_capture',
      openingHours: result.openingHours.length ? 'found' : 'not_found_in_capture',
    };
  } catch (error) {
    result.fieldStatus = Object.assign({}, result.fieldStatus, {
      detailPage: 'failed',
      error: String(error && error.message ? error.message : error).slice(0, 300),
    });
  } finally {
    await page.close().catch(() => {});
  }

  return buildCandidate(result, query, new Date().toISOString());
}

async function collectListings(page, limit) {
  const found = new Map();
  let stagnantRounds = 0;
  let lastCount = 0;

  for (let round = 0; round < 40 && found.size < limit; round += 1) {
    const cards = await page.locator('div.Nv2PK, div[role="article"]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const link = node.querySelector('a.hfpxzc, a[href*="/maps/place/"]');
        const nameNode = node.querySelector('.qBF1Pd, .fontHeadlineSmall, [aria-label]');
        const name = (nameNode && (nameNode.getAttribute('aria-label') || nameNode.innerText)) || (link && link.getAttribute('aria-label')) || '';
        return {
          url: link ? link.href : '',
          name: name.replace(/\s+/g, ' ').trim(),
          cardText: (node.innerText || '').replace(/\s+/g, ' ').trim(),
        };
      })
    ).catch(() => []);

    for (const card of cards) {
      if (!card.url || !card.url.includes('/maps/place/')) continue;
      const cleanUrl = card.url.split('&')[0];
      if (!found.has(cleanUrl)) found.set(cleanUrl, { url: cleanUrl, name: card.name || null, cardText: card.cardText || null });
      if (found.size >= limit) break;
    }

    if (found.size === lastCount) stagnantRounds += 1;
    else stagnantRounds = 0;
    lastCount = found.size;
    if (stagnantRounds >= 4) break;

    const feed = page.locator('div[role="feed"]').first();
    if (await feed.count()) {
      await feed.evaluate((element) => { element.scrollTop = element.scrollHeight; }).catch(() => {});
    } else {
      await page.mouse.wheel(0, 1800).catch(() => {});
    }
    await page.waitForTimeout(SCROLL_DELAY_MS);
  }

  return Array.from(found.values()).slice(0, limit);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local seguro.');
  }

  const query = normalizeText(process.env.SCRAPE_QUERY || DEFAULT_QUERY);
  const limit = boundedInteger(process.env.SCRAPE_LIMIT, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const city = normalizeText(process.env.SCRAPE_CITY || '') || null;
  const region = normalizeText(process.env.SCRAPE_REGION || '') || null;
  const countryCode = normalizeText(process.env.SCRAPE_COUNTRY_CODE || 'BR').toUpperCase();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
    const searchUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(query);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(3500);

    const listings = await collectListings(page, limit);
    console.log('Query: ' + query);
    console.log('Resultados únicos capturados da busca: ' + listings.length);

    const candidates = [];
    for (let i = 0; i < listings.length; i += 1) {
      const listing = listings[i];
      console.log('[' + (i + 1) + '/' + listings.length + '] Detalhes: ' + (listing.name || listing.url));
      const candidate = await extractDetail(browser, listing, query, { city: city, region: region, countryCode: countryCode });
      if (!candidate.business_name) {
        console.warn('Ignorado: ficha sem nome identificável (' + listing.url + ')');
        continue;
      }
      if (!candidate.dedupe_key) {
        console.warn('Ignorado: não foi possível criar identidade estável para ' + candidate.business_name);
        continue;
      }
      candidates.push(candidate);
    }

    await page.close().catch(() => {});

    let insertedOrUpdated = 0;
    let failed = 0;
    const batchSize = 25;
    for (let offset = 0; offset < candidates.length; offset += batchSize) {
      const batch = candidates.slice(offset, offset + batchSize);
      const { error } = await supabase.from('prospecting_candidates').upsert(batch, { onConflict: 'dedupe_key' });
      if (error) {
        failed += batch.length;
        console.error('Falha ao persistir lote: ' + error.message);
      } else {
        insertedOrUpdated += batch.length;
      }
    }

    console.log(JSON.stringify({
      provider: 'google-maps-playwright',
      query: query,
      requestedLimit: limit,
      listingCount: listings.length,
      extractedCount: candidates.length,
      insertedOrUpdated: insertedOrUpdated,
      failed: failed,
      completedAt: new Date().toISOString(),
      note: 'Campos ausentes indicam não encontrados nesta captura, não inexistência confirmada.',
    }, null, 2));

    if (failed > 0) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Scraper falhou: ' + (error && error.message ? error.message : error));
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeText,
  normalizeBusinessName,
  normalizeWebsite,
  safeWebsiteUrl,
  normalizePhone,
  parseRatingAndReviewCount,
  stableDedupeKey,
  scoreCompleteness,
  scoreOpportunity,
  buildCandidate,
  boundedInteger,
};
