/**
 * Utilitários criptográficos e de normalização de telefone para identificação
 * e deduplicação de clientes por estabelecimento.
 *
 * Utiliza SHA-256 real (Web Cryptography API e Node.js crypto),
 * garantindo resistência a colisões e integridade estrita.
 */

// Import condicional seguro do crypto do Node quando disponível
let nodeCrypto: typeof import('crypto') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nodeCrypto = typeof window === 'undefined' ? require('crypto') : null;
} catch {
  nodeCrypto = null;
}

/**
 * Normaliza telefone para o padrão internacional com DDI (55 para Brasil).
 * Lida com formatos com e sem código de país (+55 / 55), pontuações, parênteses e traços.
 */
export function normalizePhone(value?: string | null, countryCode = 'BR'): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const cc = (countryCode || 'BR').toUpperCase();

  if (cc === 'BR') {
    // Caso 1: Já possui DDI 55
    if (digits.startsWith('55')) {
      const national = digits.slice(2);
      // Fixo: DDD (2) + 8 dígitos = 10 dígitos nacionais
      // Celular: DDD (2) + 9 dígitos = 11 dígitos nacionais
      if (national.length === 10 || national.length === 11) {
        return digits;
      }
      return null;
    }

    // Caso 2: Número nacional com DDD (10 ou 11 dígitos)
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }

    // Comprimentos inválidos para números brasileiros
    return null;
  }

  // Padrão E.164 genérico para outros países (8 a 15 dígitos)
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Calcula o hash SHA-256 criptográfico real de um telefone normalizado.
 * Retorna string hexadecimal de 64 caracteres ou null se o telefone for inválido.
 */
export async function hashPhone(phone?: string | null, countryCode = 'BR'): Promise<string | null> {
  const normalized = normalizePhone(phone, countryCode);
  if (!normalized) return null;

  const payload = `phone:${normalized}`;

  // 1. Tenta Web Cryptography API (disponível em browsers modernos e Node 18+)
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 2. Fallback para Node.js crypto
  if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
    return nodeCrypto.createHash('sha256').update(payload).digest('hex');
  }

  // 3. Fallback SHA-256 síncrono puro caso nem subtle nem nodeCrypto estejam ativos
  return sha256PureSync(payload);
}

/**
 * Versão síncrona do hash SHA-256 para uso imediato em contextos não-assíncronos.
 */
export function hashPhoneSync(phone?: string | null, countryCode = 'BR'): string | null {
  const normalized = normalizePhone(phone, countryCode);
  if (!normalized) return null;

  const payload = `phone:${normalized}`;

  if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
    return nodeCrypto.createHash('sha256').update(payload).digest('hex');
  }

  return sha256PureSync(payload);
}

/**
 * Implementação pura de SHA-256 conforme FIPS 180-4.
 * Garante resultado idêntico ao WebCrypto e Node.js em qualquer runtime.
 */
function sha256PureSync(message: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = message[lengthProperty] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (candidate: number) => {
    for (let factor = 2, max = Math.sqrt(candidate); factor <= max; factor++) {
      if (candidate % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < message[lengthProperty]; i++) {
    j = i >> 2;
    words[j] = (words[j] || 0) | ((message.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8));
  }

  const w: number[] = new Array(64);

  for (let block = 0; block < words[lengthProperty]; block += 16) {
    const a = hash[0];
    const b = hash[1];
    const c = hash[2];
    const d = hash[3];
    const e = hash[4];
    const f = hash[5];
    const g = hash[6];
    const h = hash[7];

    let currentA = a;
    let currentB = b;
    let currentC = c;
    let currentD = d;
    let currentE = e;
    let currentF = f;
    let currentG = g;
    let currentH = h;

    for (i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[block + i] | 0;
      } else {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const s1 = rightRotate(currentE, 6) ^ rightRotate(currentE, 11) ^ rightRotate(currentE, 25);
      const ch = (currentE & currentF) ^ (~currentE & currentG);
      const temp1 = (currentH + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(currentA, 2) ^ rightRotate(currentA, 13) ^ rightRotate(currentA, 22);
      const maj = (currentA & currentB) ^ (currentA & currentC) ^ (currentB & currentC);
      const temp2 = (s0 + maj) | 0;

      currentH = currentG;
      currentG = currentF;
      currentF = currentE;
      currentE = (currentD + temp1) | 0;
      currentD = currentC;
      currentC = currentB;
      currentB = currentA;
      currentA = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + currentA) | 0;
    hash[1] = (hash[1] + currentB) | 0;
    hash[2] = (hash[2] + currentC) | 0;
    hash[3] = (hash[3] + currentD) | 0;
    hash[4] = (hash[4] + currentE) | 0;
    hash[5] = (hash[5] + currentF) | 0;
    hash[6] = (hash[6] + currentG) | 0;
    hash[7] = (hash[7] + currentH) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (let byte = 3; byte >= 0; byte--) {
      const b = (hash[i] >> (byte * 8)) & 0xff;
      result += b.toString(16).padStart(2, '0');
    }
  }

  return result;
}
