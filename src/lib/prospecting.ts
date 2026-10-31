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

  // Determine next action based on unified thresholds (>=70 Alta, 40-69 Média, <40 Baixa)
  let nextAction: string;
  if (score >= 70) {
    nextAction = 'solicitar demonstração';
  } else if (score >= 40) {
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

/** Alias semântico para qualificação de completude cadastral */
export const qualifyCadastralData = qualifyProspect;
export const qualifyCadastralCompleteness = qualifyProspect;

export interface CommercialPotentialInput extends ProspectQualificationInput {
  rating?: number | null;
  reviewCount?: number | null;
  operatingStatus?: string | null;
  openingHours?: string | null;
}

export interface CommercialPotentialResult {
  score: number;
  level: 'alta' | 'media' | 'baixa';
  reasons: string[];
  recommendation: string;
}

export interface CommercialOpportunityQualification {
  cadastralScore: number;
  cadastralMissingFields: string[];
  cadastralReasons: string[];
  cadastralInspectionState: string;
  commercialScore: number;
  commercialLevel: 'alta' | 'media' | 'baixa';
  commercialReasons: string[];
  // Aliases for compatibility
  score: number;
  level: 'alta' | 'media' | 'baixa';
  reasons: string[];
  primaryPainPoint: string;
  recommendedAction: string;
  suggestedTemplate: 'ouro-classico' | 'preto-esmeralda' | 'minimal-studio' | 'safira-executivo' | 'rubi-lounge';
  explanation: string;
  evaluatedAt: string;
}

/**
 * Utilitário oficial de Qualificação Comercial do BelezaDigital.
 * Utiliza o resultado da 'qualifyProspect' (completude cadastral) como base de evidências,
 * mas aplica regras comerciais exclusivas para avaliar o potencial de negócio e contratação,
 * separando categoricamente o score de "completude de dados (0-100)" do score de "oportunidade comercial (0-100)".
 */
export function qualifyCommercialOpportunity(
  input: CommercialPotentialInput,
  precalculatedCadastral?: ReturnType<typeof qualifyProspect>
): CommercialOpportunityQualification {
  // 1. Obter ou reutilizar os dados da qualificação cadastral
  const cadastral = precalculatedCadastral ?? qualifyProspect(input);

  let commercialScore = 0;
  const commercialReasons: string[] = [];
  let primaryPainPoint = 'Ausência de site moderno com agendamento online';

  const categoryLower = (input.category || '').toLowerCase();
  const nameLower = (input.businessName || '').toLowerCase();
  const addressLower = (input.address || '').toLowerCase();

  // Critério 1: Dor Digital (Peso: até 35 pontos)
  // Negócios sem website ou com link exclusivo para redes sociais têm a maior necessidade do BelezaDigital
  const isWebsiteMissing = cadastral.missingFields.includes('websiteUrl') || cadastral.inspectionState === 'no_website';
  const rawUrl = (input.websiteUrl || '').toLowerCase();
  const isSocialOnly = Boolean(rawUrl && (rawUrl.includes('instagram.com') || rawUrl.includes('facebook.com') || rawUrl.includes('linktr.ee') || rawUrl.includes('bio.site') || rawUrl.includes('wa.me')));

  if (isWebsiteMissing) {
    commercialScore += 35;
    commercialReasons.push('+35: Estabelecimento sem site próprio identificado no Google Maps (alta dor de presença digital)');
    primaryPainPoint = 'Inexistência de website próprio para conversão e agendamento';
  } else if (isSocialOnly) {
    commercialScore += 25;
    commercialReasons.push('+25: Presença digital restrita a rede social / agregador de links (alta receptividade para site profissional com agenda)');
    primaryPainPoint = 'Dependência exclusiva de mensagens diretas em redes sociais para marcar horários';
  } else {
    commercialScore += 10;
    commercialReasons.push('+10: Website existente identificado; oportunidade focada em modernização, agendamento 24h e experiência mobile');
    primaryPainPoint = 'Possível site legado ou sem agendamento direto automatizado';
  }

  // Critério 2: Contatabilidade Direta via WhatsApp/Telefone (Peso: 25 pontos)
  // Sem telefone válido, o prospect não pode ser abordado comercialmente de forma ágil
  const hasValidPhone = !cadastral.missingFields.includes('phone') && Boolean(normalizePhone(input.phone, input.countryCode ?? 'BR'));
  if (hasValidPhone) {
    commercialScore += 25;
    commercialReasons.push('+25: Telefone/WhatsApp válido e acessível para envio direto de demonstração e contato comercial');
  } else {
    commercialReasons.push('0: Telefone direto ausente; inviabiliza abordagem imediata sem enriquecimento prévio');
  }

  // Critério 3: Tração Comercial & Validação de Demanda (Peso: até 20 pontos)
  // Avaliações públicas no Maps comprovam clientela ativa, reputação e capacidade de pagamento
  const reviewCount = input.reviewCount ?? null;
  const rating = input.rating ?? null;

  if (reviewCount !== null && reviewCount >= 30) {
    commercialScore += 20;
    commercialReasons.push(`+20: Forte tração de clientes comprovada (${reviewCount} avaliações no Google Maps)`);
  } else if (reviewCount !== null && reviewCount >= 5) {
    commercialScore += 15;
    commercialReasons.push(`+15: Tração de mercado estabelecida (${reviewCount} avaliações públicas)`);
  } else if (rating !== null && rating >= 4.0) {
    commercialScore += 10;
    commercialReasons.push(`+10: Reputação positiva com nota ${rating.toFixed(1)}/5`);
  }

  // Critério 4: Ponto Comercial Físico Confirmado (Peso: 10 pontos)
  const hasPhysicalAddress = !cadastral.missingFields.includes('address') && Boolean(input.address && input.address.trim().length > 8);
  if (hasPhysicalAddress) {
    commercialScore += 10;
    commercialReasons.push('+10: Ponto comercial fixo confirmado em endereço público');
  }

  // Critério 5: Funcionamento Ativo & Horários Operacionais (Peso: 10 pontos)
  const isOperating = input.operatingStatus === 'OPERATIONAL' || Boolean(input.openingHours);
  if (isOperating) {
    commercialScore += 10;
    commercialReasons.push('+10: Operação regular ativa com horário de atendimento identificado');
  }

  // Limitar score comercial em 0-100
  commercialScore = Math.min(100, Math.max(0, commercialScore));

  // Faixas comerciais unificadas do produto:
  // >= 70: Alta oportunidade
  // 40-69: Média oportunidade
  // < 40: Baixa oportunidade
  let commercialLevel: 'alta' | 'media' | 'baixa';
  let recommendedAction: string;

  if (commercialScore >= 70) {
    commercialLevel = 'alta';
    recommendedAction = 'Priorizar envio imediato de demonstração personalizada com os 5 modelos e contato via WhatsApp.';
  } else if (commercialScore >= 40) {
    commercialLevel = 'media';
    recommendedAction = 'Enriquecer canais de contato e apresentar proposta de modernização digital.';
  } else {
    commercialLevel = 'baixa';
    recommendedAction = 'Reavaliar atividade do negócio ou aguardar enriquecimento de dados cadastrais.';
  }

  // Sugestão determinística do modelo visual mais adequado
  let suggestedTemplate: 'ouro-classico' | 'preto-esmeralda' | 'minimal-studio' | 'safira-executivo' | 'rubi-lounge' = 'ouro-classico';
  if (categoryLower.includes('barbearia') || nameLower.includes('barber') || nameLower.includes('barbearia')) {
    if (nameLower.includes('street') || nameLower.includes('fade') || nameLower.includes('urbano') || nameLower.includes('concept')) {
      suggestedTemplate = 'preto-esmeralda';
    } else {
      suggestedTemplate = 'ouro-classico';
    }
  } else if (categoryLower.includes('spa') || categoryLower.includes('estética') || nameLower.includes('lounge') || nameLower.includes('velvet')) {
    suggestedTemplate = 'rubi-lounge';
  } else if (addressLower.includes('carlos gomes') || addressLower.includes('paulista') || addressLower.includes('centro') || nameLower.includes('executivo') || nameLower.includes('vip')) {
    suggestedTemplate = 'safira-executivo';
  } else if (categoryLower.includes('boutique') || categoryLower.includes('visagismo') || nameLower.includes('studio') || nameLower.includes('atelie')) {
    suggestedTemplate = 'minimal-studio';
  }

  const explanation = `O estabelecimento possui Qualidade Cadastral de ${cadastral.score}/100 (completude de dados) e Potencial Comercial de ${commercialScore}/100 (${commercialLevel.toUpperCase()}). Principal oportunidade: ${primaryPainPoint}.`;

  return {
    cadastralScore: cadastral.score,
    cadastralMissingFields: cadastral.missingFields,
    cadastralReasons: cadastral.reasons,
    cadastralInspectionState: cadastral.inspectionState,
    commercialScore,
    commercialLevel,
    commercialReasons,
    score: commercialScore,
    level: commercialLevel,
    reasons: commercialReasons,
    primaryPainPoint,
    recommendedAction,
    suggestedTemplate,
    explanation,
    evaluatedAt: new Date().toISOString(),
  };
}

/** Alias para avaliação do potencial comercial */
export const qualifyCommercialPotential = qualifyCommercialOpportunity;

/** Avaliação dupla integrada: retorna tanto a completude cadastral quanto o potencial comercial */
export const evaluateDualProspectQualification = qualifyCommercialOpportunity;

/** Fail closed: a public phone number alone is not consent to receive WhatsApp marketing. */
export function isEligibleForAutomatedWhatsApp(input: OutreachEligibilityInput): boolean {
  if (input.optedOutAt?.trim()) return false;
  if (input.eligibility !== 'eligible') return false;
  if (!input.whatsappOptInAt?.trim()) return false;
  return Boolean(normalizeWebsite(input.optInEvidenceUrl));
}

