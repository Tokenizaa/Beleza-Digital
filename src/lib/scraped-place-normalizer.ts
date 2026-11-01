/**
 * Normaliza registros reais do scraper (PlaceRecord/Supabase) para o contrato
 * consumido pelos cinco templates. Não cria conteúdo comercial nem inventa
 * campos ausentes: valores não encontrados permanecem null/vazios.
 */
type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStructured(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function stringList(value: unknown): string[] {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry) => {
      if (typeof entry === 'string') return entry.trim() ? [entry.trim()] : [];
      const item = record(entry);
      const url = stringValue(firstValue(item.url, item.image_url, item.imageUrl, item.src));
      return url ? [url] : [];
    });
  }
  if (typeof parsed === 'string') {
    return parsed.split(/[\n,|]/).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function normalizeServices(value: unknown): UnknownRecord[] {
  const parsed = parseStructured(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      const name = entry.trim();
      return name ? [{ id: `scraped-service-${index}`, name, description: '' }] : [];
    }
    const item = record(entry);
    const name = stringValue(firstValue(item.name, item.service_name, item.title));
    if (!name) return [];
    return [{
      id: stringValue(item.id) || `scraped-service-${index}`,
      name,
      description: stringValue(firstValue(item.description, item.desc)) || '',
      price: numberValue(item.price),
      duration: numberValue(firstValue(item.duration, item.durationMinutes, item.duration_minutes)),
      category: stringValue(item.category),
    }];
  });
}

function normalizeMedia(value: unknown): UnknownRecord[] {
  const parsed = parseStructured(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    const item = record(entry);
    const url = stringValue(firstValue(item.url, item.image_url, item.imageUrl, item.video_url, item.videoUrl, item.src));
    if (!url) return [];
    return [{
      ...item,
      url,
      type: item.type === 'video' || item.video_url || item.videoUrl ? 'video' : 'image',
      title: stringValue(firstValue(item.title, item.name, item.alt)),
      thumbnailUrl: stringValue(firstValue(item.thumbnail_url, item.thumbnailUrl, item.image_url, item.imageUrl)),
    }];
  });
}

function normalizeHours(value: unknown): string | null {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) {
    const lines = parsed.map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const item = record(entry);
      const day = stringValue(firstValue(item.day, item.name, item.weekday));
      const hours = stringValue(firstValue(item.hours, item.time, item.value));
      return [day, hours].filter(Boolean).join(': ');
    }).filter(Boolean);
    return lines.length ? lines.join(' · ') : null;
  }
  return stringValue(parsed);
}

export interface NormalizedScrapedPlace {
  businessName: string;
  category: string;
  description: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  sourceUrl: string | null;
  photos: string[];
  videos: string[];
  rating: number | null;
  review_count: number | null;
  opening_hours: string | null;
  services_attributes: UnknownRecord[];
  media_items: UnknownRecord[];
  bookingUrl: string | null;
  instagramUrl: string | null;
  instagramHandle: string | null;
  logoUrl: string | null;
  googleMapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  priceRange: string | null;
  status: string | null;
  collectedAt: string | null;
  provider: string | null;
  fieldStatus: UnknownRecord;
  rawEvidence: UnknownRecord;
}

export function normalizeScrapedPlace(input: unknown): NormalizedScrapedPlace {
  const source = record(input);
  const evidence = record(parseStructured(source.raw_evidence));
  const fieldStatus = record(parseStructured(firstValue(source.field_status, evidence.field_status, evidence.fieldStatus)));
  const photos = stringList(firstValue(source.photos, source.images, evidence.images, evidence.photos));
  const videos = stringList(firstValue(source.videos, evidence.videos));
  const media = normalizeMedia(firstValue(source.media_items, source.media, evidence.media_items, evidence.media));
  const services = normalizeServices(firstValue(source.services_attributes, evidence.services_attributes, evidence.services));
  const rating = numberValue(firstValue(source.rating, evidence.rating, evidence.stars));
  const reviewCount = numberValue(firstValue(source.review_count, source.reviewCount, source.reviews_count, source.reviewsCount, evidence.review_count, evidence.reviewCount, evidence.reviews_count, evidence.reviewsCount, evidence.reviews));
  const latitude = numberValue(firstValue(source.latitude, evidence.latitude));
  const longitude = numberValue(firstValue(source.longitude, evidence.longitude));
  const mapsUrl = stringValue(firstValue(source.maps_url, source.source_url, source.sourceUrl, evidence.maps_url, evidence.source_url));
  const website = stringValue(firstValue(source.website_url, source.website, evidence.website_url));
  const socialLinks = parseStructured(firstValue(source.social_links, source.socialLinks, evidence.social_links, evidence.socialLinks));
  const socialEntries = Array.isArray(socialLinks) ? socialLinks : typeof socialLinks === 'string' ? socialLinks.split(/[|,\n]/) : [];
  if (website && /instagram\.com\//i.test(website)) socialEntries.push(website);
  const instagramUrl = socialEntries.map((entry) => typeof entry === 'string' ? entry.trim() : stringValue(firstValue(record(entry).url, record(entry).href)) || '').find((url) => /instagram\.com\//i.test(url)) || null;
  const instagramHandle = instagramUrl ? instagramUrl.match(/instagram\.com\/([^/?#]+)/i)?.[1] || null : null;
  const openingHours = normalizeHours(firstValue(source.opening_hours, source.openingHours, source.hours, evidence.opening_hours, evidence.openingHours, evidence.hours));

  return {
    businessName: stringValue(firstValue(source.business_name, source.name, source.businessName, evidence.business_name)) || '',
    category: stringValue(firstValue(source.category, evidence.category)) || '',
    description: stringValue(firstValue(source.description, evidence.editorialSummary, evidence.description)) || '',
    website,
    phone: stringValue(firstValue(source.phone, evidence.phone)),
    email: stringValue(firstValue(source.email, evidence.email)),
    address: stringValue(firstValue(source.address, evidence.address)),
    city: stringValue(firstValue(source.city, evidence.city)),
    region: stringValue(firstValue(source.region, source.state, evidence.region, evidence.state)),
    sourceUrl: mapsUrl,
    photos,
    videos,
    rating,
    review_count: reviewCount,
    opening_hours: openingHours,
    services_attributes: services,
    media_items: media,
    bookingUrl: stringValue(firstValue(source.booking_url, source.bookingUrl, source.appointment_url, evidence.booking_url, evidence.bookingUrl, evidence.appointment_url)),
    instagramUrl,
    instagramHandle,
    logoUrl: stringValue(firstValue(source.logo_url, source.logoUrl, evidence.logo_url)),
    googleMapsUrl: mapsUrl,
    latitude,
    longitude,
    priceRange: stringValue(firstValue(source.price_range, source.priceRange, source.price_level, source.priceLevel, evidence.price_range, evidence.priceRange, evidence.price_level, evidence.priceLevel)),
    status: stringValue(firstValue(source.business_status, source.operating_status, source.operatingStatus, source.status, evidence.operating_status, evidence.operatingStatus, evidence.business_status, evidence.status)),
    collectedAt: stringValue(firstValue(source.collected_at, source.source_captured_at, source.created_at, evidence.collected_at, evidence.observedAt)),
    provider: stringValue(firstValue(source.provider, evidence.provider)),
    fieldStatus,
    rawEvidence: evidence,
  };
}
