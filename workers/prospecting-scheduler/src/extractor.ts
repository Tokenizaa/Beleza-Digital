/**
 * Playwright-based Google Maps Place Extractor for Beleza-Digital Worker.
 *
 * Migrates the rich extraction logic from mais-clientes-v2 (Puppeteer) to
 * Cloudflare Worker Playwright binding. Almost all extraction runs inside
 * `page.evaluate()` using standard DOM APIs, making migration transparent.
 *
 * Field priority for deduplication (createDedupeKey in worker index):
 * 1. google-feature:<featureId>  2. google-place:<placeId>
 * 3. website:<normalizedWebsite>  4. phone:<normalizedPhone>
 * 5. name-location:<name>|city:...|region:...|country:...
 */

// Note: this file is imported/referenced from worker index.ts
// All DOM queries use standard document.querySelector / querySelectorAll
// inside page.evaluate() - compatible with both Puppeteer and Playwright

export interface ExtractedPlace {
  name: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  sourceUrl: string;
  placeId: string | null;
  featureId: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[];
  openingHours: string[];
  priceLevel: string | null;
  operatingStatus: string | null;
  editorialSummary: string | null;
  rawListingText: string | null;
  fieldStatus: ExtractedFieldStatus;
}

export interface ExtractedFieldStatus {
  name: 'found' | 'not_found_in_capture';
  category: 'found' | 'not_found_in_capture';
  address: 'found' | 'not_found_in_capture';
  phone: 'found' | 'not_found_in_capture';
  website: 'found' | 'not_found_in_capture';
  rating: 'found' | 'not_found_in_capture';
  reviewCount: 'found' | 'not_found_in_capture';
  images: 'found' | 'not_found_in_capture';
  openingHours: 'found' | 'not_found_in_capture';
}

export function extractPlaceDetails(page: any): ExtractedPlace {
  // Helper to safely extract text from a selector
  const textOf = (selector: string): string | null => {
    const element = document.querySelector(selector);
    const value = (element as HTMLElement | null)?.innerText || element?.getAttribute('aria-label') || '';
    return value.replace(/\s+/g, ' ').trim() || null;
  };

  // Helper to safely extract href from a selector
  const hrefOf = (selector: string): string | null => {
    const element = document.querySelector(selector) as HTMLAnchorElement | null;
    const value = element?.href || null;
    return value && /^https?:\/\//i.test(value) ? value : null;
  };

  const bodyText = document.body?.innerText || '';
  const ratingLabel = document.querySelector('div.F7nice, [aria-label*="stars"], [aria-label*="estrelas"]')?.getAttribute('aria-label') || '';
  const ratingText = textOf('div.F7nice') || '';
  const reviewLabel = document.querySelector('button[aria-label*="reviews"], button[aria-label*="avaliações"], [aria-label*="reviews"], [aria-label*="avaliações"]')?.getAttribute('aria-label') || '';
  const ratingSource = [ratingLabel, ratingText, reviewLabel, bodyText.slice(0, 8000)].join(' ');
  const ratingMatch = ratingSource.match(/(?:^|\s)([0-5](?:[.,]\d+)?)\s*(?:estrelas?|stars?)?/i) || bodyText.match(/([0-5][.,]\d)\s*\(/);
  const reviewMatch = ratingSource.match(/([\d.,]+)\s*(?:avaliações|avaliação|reviews|review|comentários)/i) || bodyText.match(/\(([0-9][0-9.,]*)\)/);

  const parseCount = (value: string | null): number | null => {
    if (!value) return null;
    const digits = value.replace(/[.,](?=\d{3}\b)/g, '').replace(/\D/g, '');
    const parsed = Number(digits);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };

  const ratingValue = ratingMatch ? Number(ratingMatch[1].replace(',', '.')) : null;
  const reviewCountValue = parseCount(reviewMatch ? reviewMatch[1] : '') || parseCount(bodyText.match(/\(([0-9][0-9.,]*)\)/)?.[1]);

  // Hours
  const hours = Array.from(document.querySelectorAll('table.eK4R0e tr, table[aria-label*="hours"] tr'))
    .map((row) => ((row as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean).slice(0, 14);

  // Images - images with googleusercontent or gstatic
  const images = Array.from(document.querySelectorAll('img'))
    .map((image) => image.currentSrc || image.src || '')
    .filter((url) => /^https?:\/\//i.test(url) && /googleusercontent|gstatic/i.test(url));
  const uniqueImages = Array.from(new Set(images)).slice(0, 20);

  // Category
  const category = textOf('button.DkEaL') || textOf('button[jsaction*="category"]');

  // Address
  const address = textOf('[data-item-id="address"]');

  // Phone - from data-item-id or tel: link
  const phoneElement = document.querySelector('[data-item-id^="phone:tel"], a[href^="tel:"]') as HTMLAnchorElement | null;
  const phone = phoneElement?.getAttribute('href')?.startsWith('tel:')
    ? phoneElement.getAttribute('href')?.slice(4) || null
    : (phoneElement as HTMLElement | null)?.innerText?.trim() || null;

  // Website - authority link or aria-label*Website
  const website = hrefOf('a[data-item-id="authority"]') || hrefOf('a[aria-label*="Website"]') || hrefOf('a[aria-label*="website"]');

  // Coordinates from URL
  const coordinates = page.url().match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const feature = page.url().match(/!1s([^!/?]+)/);
  const placeIdMatch = page.url().match(/[?&]place_id=([^&]+)/i);

  const latitude = coordinates ? Number(coordinates[1]) : null;
  const longitude = coordinates ? Number(coordinates[2]) : null;
  const featureId = feature ? decodeURIComponent(feature[1]) : null;
  const placeId = placeIdMatch ? decodeURIComponent(placeIdMatch[1]) : null;

  // Price level
  const price = bodyText.match(/(?:Preço|Price)\s*[:·]?\s*(\${1,4}|R\${1,4})/i);
  const priceLevel = price?.[1] || null;
  const operatingStatusMatch = bodyText.match(/(Aberto(?:\s*[·•-]\s*fecha\s*às?\s*[\d: h.]+)?|Fechado temporariamente|Fechado permanentemente|Open(?:\s*[·•-]\s*Closes?\s*at\s*[\d: h.]+)?|Temporarily closed|Permanently closed)/i);
  const operatingStatus = operatingStatusMatch?.[1]?.trim() || null;

  // Editorial summary
  const editorialSummary = textOf('[class*="PYvSYb"], [class*="WeS02d"]');

  return {
    name: textOf('h1.DUwDvf') || document.querySelector('h1')?.textContent?.trim() || null,
    category: category || null,
    address: address || null,
    phone: phone || null,
    website: website || null,
    rating: ratingValue,
    reviewCount: reviewCountValue,
    sourceUrl: page.url(),
    placeId: placeId || null,
    featureId: featureId || null,
    latitude: latitude || null,
    longitude: longitude || null,
    images: uniqueImages,
    openingHours: hours,
    priceLevel: priceLevel || null,
    operatingStatus,
    editorialSummary: editorialSummary || null,
    rawListingText: bodyText.slice(0, 8000),
    fieldStatus: {
      name: textOf('h1.DUwDvf') || document.querySelector('h1') ? 'found' : 'not_found_in_capture',
      category: category ? 'found' : 'not_found_in_capture',
      address: address ? 'found' : 'not_found_in_capture',
      phone: phone ? 'found' : 'not_found_in_capture',
      website: website ? 'found' : 'not_found_in_capture',
      rating: ratingValue !== null ? 'found' : 'not_found_in_capture',
      reviewCount: reviewCountValue !== null ? 'found' : 'not_found_in_capture',
      images: uniqueImages.length ? 'found' : 'not_found_in_capture',
      openingHours: hours.length ? 'found' : 'not_found_in_capture',
    },
  };
}