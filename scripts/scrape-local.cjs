/**
 * Scrape local — Google Maps establishments search using Playwright.
 * Simplified version for initial testing.
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeBusinessName(value) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeWebsite(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return null;
  }
}

function normalizePhone(value) {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function createDedupeKey(businessName, city, region, countryCode, phone, websiteUrl) {
  const website = normalizeWebsite(websiteUrl);
  const phoneNorm = normalizePhone(phone, countryCode);
  const name = normalizeBusinessName(businessName);
  const cityNorm = normalizeBusinessName(city);
  const regionNorm = normalizeBusinessName(region);
  let identity = '';

  if (website) identity = `website:${website}`;
  else if (phoneNorm) identity = `phone:${phoneNorm}`;
  else if (name && cityNorm && regionNorm) {
    identity = `name-location:${name}|city:${cityNorm}|region:${regionNorm}|country:${(countryCode ?? 'BR').toUpperCase()}`;
  } else {
    return null;
  }

  // Node.js: use createHash instead of crypto.subtle.digestSync
  const hash = crypto.createHash('sha256').update(identity).digest('hex');
  return `sha256:${hash}`;
}

async function main() {
  console.log('Starting local scrape...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Navigate to Google Maps search for Barbearia in Sao Paulo
  await page.goto('https://www.google.com/maps/search/Barbearia%20Sao%20Paulo', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  // Try to find some establishment elements
  const elements = await page.locator('.THOPZb').all();
  console.log(`Found ${elements.length} elements`);

  let results = [];
  for (let i = 0; i < Math.min(elements.length, 3); i++) {
    const el = elements[i];
    // Get text content directly - avoid waiting for child elements
    const fullText = await el.textContent();
    if (!fullText || fullText.trim().length < 3) continue;

    // Try to extract name - it's usually the first substantial line
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const name = lines[0] || null;
    if (!name) continue;

    results.push({
      business_name: name,
      category: 'Barbearia',
      website_url: null,
      normalized_website: null,
      phone: null,
      normalized_phone: null,
      address: null,
      city: 'Sao Paulo',
      region: 'SP',
      country_code: 'BR',
      provider: 'google-maps-local',  // Provider required column
      source_url: 'https://www.google.com/maps/search/Barbearia%20Sao%20Paulo',
      dedupe_key: createDedupeKey(name, 'Sao Paulo', 'SP', 'BR', null, null),
    });
    console.log(`  #${i + 1}: ${name}`);
  }

  await browser.close();

  // Persist to Supabase
  if (results.length > 0) {
    console.log(`\nPersisting ${results.length} candidates...`);
    const { data, error } = await supabase
      .from('prospecting_candidates')
      .upsert(results, { onConflict: 'dedupe_key' });

    if (error) {
      console.error('Error persisting:', error);
    } else {
      console.log('Persisted successfully!');
      console.log('Inserted/updated:', data ? data.length : 0);
      // Verify count
      const { count } = await supabase
        .from('prospecting_candidates')
        .select('*', { count: 'exact', head: true })
        .eq('city', 'Sao Paulo')
        .eq('region', 'SP');
      console.log('Total records for Sao Paulo/SP:', count);
    }
  } else {
    console.log('No results to persist.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});