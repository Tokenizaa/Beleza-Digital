'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const scraper = require('./scrape-local.cjs');

test('normaliza nome sem destruir o valor original da ficha', () => {
  assert.equal(scraper.normalizeBusinessName('Barbearia Calixto®'), 'barbearia calixto');
});

test('normaliza apenas URLs HTTP(S) públicas', () => {
  assert.equal(scraper.normalizeWebsite('HTTPS://WWW.Example.com/'), 'example.com');
  assert.equal(scraper.safeWebsiteUrl('HTTPS://WWW.Example.com/'), 'https://www.example.com/');
  assert.equal(scraper.normalizeWebsite('javascript:alert(1)'), null);
  assert.equal(scraper.normalizeWebsite('https://user:pass@example.com'), null);
});

test('normaliza telefone brasileiro sem aceitar comprimentos improváveis', () => {
  assert.equal(scraper.normalizePhone('(11) 93759-4342', 'BR'), '5511937594342');
  assert.equal(scraper.normalizePhone('123', 'BR'), null);
});

test('extrai nota e volume de avaliações em português e inglês', () => {
  assert.deepEqual(scraper.parseRatingAndReviewCount('4,9 estrelas · 1.792 avaliações'), {
    rating: 4.9,
    reviewCount: 1792,
  });
  assert.deepEqual(scraper.parseRatingAndReviewCount('4.7 stars 213 reviews'), {
    rating: 4.7,
    reviewCount: 213,
  });
  assert.deepEqual(scraper.parseRatingAndReviewCount('4,9 (1.792)'), {
    rating: 4.9,
    reviewCount: 1792,
  });
});

test('usa identidade estável do Google antes de telefone e nome', () => {
  const first = scraper.stableDedupeKey({
    featureId: '0xabc:0xdef',
    businessName: 'São Paulo Barbearia',
    city: 'São Paulo',
    region: 'SP',
  });
  const second = scraper.stableDedupeKey({
    featureId: '0xabc:0xdef',
    businessName: 'Outro nome de exibição',
    city: 'Porto Alegre',
    region: 'RS',
  });
  assert.equal(first, second);
  assert.match(first, /^sha256:/);
});

test('separa completude cadastral de oportunidade comercial', () => {
  const place = {
    businessName: 'Barbearia São Paulo',
    category: 'Barbearia',
    address: 'Rua Rodesia, 230, São Paulo',
    phone: '(11) 93759-4342',
    websiteUrl: null,
    rating: 4.7,
    reviewCount: 213,
    latitude: -23.55,
    longitude: -46.69,
    mapsUrl: 'https://www.google.com/maps/place/example',
    images: ['https://lh3.googleusercontent.com/example'],
    countryCode: 'BR',
  };
  assert.equal(scraper.scoreCompleteness(place), 90);
  const opportunity = scraper.scoreOpportunity(place);
  assert.ok(opportunity.score >= 80);
  assert.ok(opportunity.reasons.some((reason) => reason.includes('oportunidade a confirmar')));
});

test('conserva dados adicionais em raw_evidence e marca ausência como não encontrada na captura', () => {
  const candidate = scraper.buildCandidate({
    businessName: 'Barbearia Exemplo',
    category: 'Barbearia',
    city: 'Porto Alegre',
    region: 'RS',
    countryCode: 'BR',
    featureId: '0xabc:0xdef',
    rating: 4.8,
    reviewCount: 152,
    images: ['https://lh3.googleusercontent.com/photo'],
    mapsUrl: 'https://www.google.com/maps/place/example',
    fieldStatus: { website: 'not_found_in_capture' },
  }, 'barbearia Porto Alegre RS Brasil', '2026-10-25T12:00:00.000Z');

  assert.equal(candidate.raw_evidence.rating, 4.8);
  assert.equal(candidate.raw_evidence.reviewsCount, 152);
  assert.equal(candidate.raw_evidence.images.length, 1);
  assert.equal(candidate.raw_evidence.fieldStatus.website, 'not_found_in_capture');
  assert.equal(candidate.provider, 'google-maps-playwright');
  assert.ok(candidate.dedupe_key);
});

test('limita a quantidade configurada de resultados', () => {
  assert.equal(scraper.boundedInteger('1000', 20, 1, 100), 100);
  assert.equal(scraper.boundedInteger('0', 20, 1, 100), 1);
  assert.equal(scraper.boundedInteger('invalid', 20, 1, 100), 20);
});

test('aceita os parâmetros CLI usados pela rota local existente', () => {
  assert.deepEqual(scraper.parseCliArgs(['--segment', 'Barbearia', '--city', 'Porto Alegre', '--region', 'RS', '--limit', '12', '--countryCode', 'BR']), {
    segment: 'Barbearia',
    city: 'Porto Alegre',
    region: 'RS',
    limit: '12',
    countryCode: 'BR',
  });
});
