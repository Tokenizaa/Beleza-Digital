export interface ProspectIdentity {
  businessName?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}

export interface ProspectQualificationInput extends ProspectIdentity {
  category?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
}

export interface ProspectQualification {
  score: number;
  reasons: string[];
  missingFields: string[];
}

export interface OutreachEligibilityInput {
  eligibility?: string | null;
  whatsappOptInAt?: string | null;
  optInEvidenceUrl?: string | null;
  optedOutAt?: string | null;
}

/** Normalize business names for matching only; preserve the original value separately. */
export function normalizeBusinessName(value?: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalize only ordinary public website URLs; never accept credentials or non-HTTP schemes. */
export function normalizeWebsite(value?: string | null): string | null {
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

/** Normalize a phone to digits. Only add Brazil's country code for 10/11-digit local numbers. */
export function normalizePhone(value?: string | null, countryCode = 'BR'): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (countryCode.toUpperCase() === 'BR' && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }
  return digits;
}

/** Stable identity key; prefer website, then phone, then normalized name + location. */
export async function createProspectDedupeKey(input: ProspectIdentity): Promise<string | null> {
  const website = normalizeWebsite(input.websiteUrl);
  const phone = normalizePhone(input.phone, input.countryCode ?? 'BR');
  const name = normalizeBusinessName(input.businessName);
  const city = normalizeBusinessName(input.city);
  const region = normalizeBusinessName(input.region);
  let identity = '';

  if (website) identity = `website:${website}`;
  else if (phone) identity = `phone:${phone}`;
  else if (name && city && region) {
    identity = `name-location:${name}|city:${city}|region:${region}|country:${(input.countryCode ?? 'BR').toUpperCase()}`;
  } else return null;

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

/** Deterministic and explainable score. A high score never grants outreach permission by itself. */
export function qualifyProspect(input: ProspectQualificationInput): ProspectQualificationInput & { score: number; reasons: string[]; missingFields: string[]; evidence: Record<string, unknown>; inspectionState: 'no_website' | 'website_identified' | 'website_accessible' | 'website_with_issues' | 'inconclusive'; nextAction: string; collectedAt: string } {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  let score = 0;

  // Collect evidence
  const evidence: Record<string, unknown> = {
    businessName: input.businessName,
    category: input.category,
    websiteUrl: input.websiteUrl,
    phone: input.phone,
    email: input.email,
    address: input.address,
    description: input.description,
    sourceUrl: input.sourceUrl,
    countryCode: input.countryCode,
  };

  const add = (field: string, points: number, present: boolean, reason: string) => {
    if (present) {
      score += points;
      reasons.push(`+${points}: ${reason}`);
    } else {
      missingFields.push(field);
      reasons.push(`0: ${field} ausente; ${reason}`);
    }
  };

  add('businessName', 20, Boolean(normalizeBusinessName(input.businessName)), 'nome comercial identificado');
  add('category', 10, Boolean(input.category?.trim()), 'categoria identificada');
  add('websiteUrl', 20, Boolean(normalizeWebsite(input.websiteUrl)), 'site público identificável');
  add('phone', 20, Boolean(normalizePhone(input.phone, input.countryCode ?? 'BR')), 'telefone em formato válido');
  add('email', 10, Boolean(input.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())), 'e-mail em formato válido');
  add('address', 10, Boolean(input.address?.trim()), 'endereço disponível');
  add('description', 5, Boolean(input.description?.trim()), 'descrição pública disponível');
  add('sourceUrl', 5, Boolean(normalizeWebsite(input.sourceUrl)), 'origem pública registrada');

  // Determine inspection state based on website availability
  let inspectionState: 'no_website' | 'website_identified' | 'website_accessible' | 'website_with_issues' | 'inconclusive';
  if (!input.websiteUrl) {
    inspectionState = 'no_website';
  } else if (!/^https?:\/\//i.test(input.websiteUrl)) {
    inspectionState = 'inconclusive';
  } else {
    inspectionState = 'website_identified';
  }

  // Determine next action based on score and fields present
  let nextAction: string;
  if (score >= 80) {
    nextAction = 'solicitar demonstração';
  } else if (score >= 50) {
    nextAction = 'completar dados e solicitar demonstração';
  } else if (score > 0) {
    nextAction = 'qualificar dados e reavaliar';
  } else {
    nextAction = 'coletar dados mínimos antes de qualificar';
  }

  const collectedAt = new Date().toISOString();

  return {
    score,
    reasons,
    missingFields,
    evidence,
    inspectionState,
    nextAction,
    collectedAt,
  };
}

/** Fail closed: a public phone number alone is not consent to receive WhatsApp marketing. */
export function isEligibleForAutomatedWhatsApp(input: OutreachEligibilityInput): boolean {
  if (input.optedOutAt?.trim()) return false;
  if (input.eligibility !== 'eligible') return false;
  if (!input.whatsappOptInAt?.trim()) return false;
  return Boolean(normalizeWebsite(input.optInEvidenceUrl));
}
