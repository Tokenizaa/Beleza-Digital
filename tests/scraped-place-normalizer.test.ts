import assert from 'node:assert/strict';
import { normalizeScrapedPlace } from '../src/lib/scraped-place-normalizer';
import { mapDataForTemplate } from '../src/lib/template-data-mapper';
import { SITE_TEMPLATES } from '../src/types/templates';

const place = normalizeScrapedPlace({
  id: 'place-1',
  name: 'Barbearia Exemplo',
  category: 'Barbearia',
  address: 'Rua A, 10',
  phone: '(51) 99999-0000',
  website: 'https://example.com',
  rating: '4,8',
  review_count: '125',
  opening_hours: 'Segunda a sábado, 09h às 19h',
  business_status: 'OPERATIONAL',
  latitude: '-30.03',
  longitude: '-51.22',
  maps_url: 'https://maps.google.com/?cid=123',
  description: 'Descrição capturada da ficha.',
  services_attributes: JSON.stringify(['Corte masculino', 'Barba']),
  photos: 'https://img.example/1.jpg,https://img.example/2.jpg',
  videos: '',
  field_status: JSON.stringify({ name: 'observed', website: 'observed' }),
  collected_at: '2026-10-31T12:00:00.000Z',
});

assert.equal(place.businessName, 'Barbearia Exemplo');
assert.equal(place.rating, 4.8);
assert.equal(place.review_count, 125);
assert.equal(place.photos.length, 2);
assert.equal(place.services_attributes.length, 2);
assert.equal(place.services_attributes[0].name, 'Corte masculino');
assert.equal(place.latitude, -30.03);
assert.equal(place.googleMapsUrl, 'https://maps.google.com/?cid=123');
assert.equal(place.fieldStatus.name, 'observed');

const nested = normalizeScrapedPlace({
  business_name: 'Studio Real',
  raw_evidence: {
    rating: 4.9,
    reviewCount: 87,
    images: ['https://img.example/real.jpg'],
    openingHours: [{ day: 'Segunda', hours: '09:00–18:00' }],
    services: [{ service_name: 'Hidratação', price: '90' }],
  },
});

assert.equal(nested.businessName, 'Studio Real');
assert.equal(nested.rating, 4.9);
assert.equal(nested.review_count, 87);
assert.equal(nested.photos[0], 'https://img.example/real.jpg');
assert.equal(nested.services_attributes[0].name, 'Hidratação');
assert.equal(nested.services_attributes[0].price, 90);
assert.equal(nested.opening_hours, 'Segunda: 09:00–18:00');

const incomplete = normalizeScrapedPlace({ name: 'Ficha incompleta' });
assert.equal(incomplete.businessName, 'Ficha incompleta');
assert.equal(incomplete.phone, null);
assert.equal(incomplete.rating, null);
assert.deepEqual(incomplete.photos, []);
assert.deepEqual(incomplete.services_attributes, []);

for (const template of Object.values(SITE_TEMPLATES)) {
  const generated = mapDataForTemplate({
    name: 'Negócio vindo do Maps',
    category: 'Barbearia',
    phone: '(51) 90000-0000',
    address: 'Rua Real, 123',
    city: 'Porto Alegre',
    state: 'RS',
    website: 'https://negocio.example',
    rating: '4.7',
    review_count: '63',
    opening_hours: 'Segunda a sábado, 09h às 18h',
    photos: 'https://img.example/a.jpg,https://img.example/b.jpg',
    services_attributes: JSON.stringify(['Corte', 'Barba']),
    price_range: '$',
    business_status: 'OPERATIONAL',
    maps_url: 'https://maps.google.com/?cid=456',
    latitude: '-30.03',
    longitude: '-51.22',
    collected_at: '2026-10-31T12:00:00.000Z',
  }, template);
  assert.equal(generated.name, 'Negócio vindo do Maps');
  assert.equal(generated.contact.phone, '(51) 90000-0000');
  assert.equal(generated.contact.address, 'Rua Real, 123');
  assert.equal(generated.rating, 4.7);
  assert.equal(generated.photos.length, 2);
  assert.equal(generated.services?.length, 2);
  assert.equal(generated.openingHours, 'Segunda a sábado, 09h às 18h');
}

console.log('scraped-place-normalizer: 8 assertions + 5 templates aprovados');
