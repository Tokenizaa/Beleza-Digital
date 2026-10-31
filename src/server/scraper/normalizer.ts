/**
 * normalizer.ts — Normalização de endereços, localizações e coordenadas
 * para o motor de captura.
 *
 * Implementa as funções testadas por `normalizer.test.ts`:
 * - parseAddressComponents
 * - parseSearchLocationFallback
 * - extractCoordinates
 * - extractSourcePlaceId
 *
 * Todas são determinísticas e não fazem chamadas de rede.
 */

/**
 * Extrai coordenadas de uma URL do Google Maps no formato:
 * https://www.google.com/maps/place/Nome/@latitude,longitude,zoomz
 */
export function extractCoordinates(mapsUrl: string): {
  latitude: string;
  longitude: string;
} {
  if (!mapsUrl) return { latitude: '', longitude: '' };

  // Padrão @latitude,longitude,zoom
  const match = mapsUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (!match) return { latitude: '', longitude: '' };

  const lat = match[1];
  const lng = match[2];

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return { latitude: '', longitude: '' };
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Extrai o identificador estável da ficha (source place ID) de uma URL
 * do Google Maps quando presente no parâmetro data=!3m1!4b1!4m2!3m1!1sID.
 */
export function extractSourcePlaceId(mapsUrl: string): string {
  if (!mapsUrl) return '';

  const match = mapsUrl.match(/!1s([0-9a-fA-Fx:]+)/);
  if (!match) return '';

  return match[1];
}

/**
 * Extrai componentes de endereço brasileiro a partir de uma string de
 * endereço exibida no Google Maps.
 *
 * Suporta formatos como:
 *  - "Rua A, 100, Centro, São Paulo - SP, 01234-567"
 *  - "Alameda X, 123 - Jardim Paulista, São Paulo - SP, 01403-002"
 *  - "123 Main Street, Toronto, Canada"
 */
export function parseAddressComponents(address: string): {
  postal_code: string;
  country: string;
  city: string;
  state: string;
  neighborhood: string;
} {
  const result = {
    postal_code: '',
    country: '',
    city: '',
    state: '',
    neighborhood: '',
  };

  if (!address || !address.trim()) return result;

  const trimmed = address.trim();

  // CEP brasileiro: 5 dígitos, hífen, 3 dígitos
  const cepMatch = trimmed.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) {
    result.postal_code = cepMatch[1].includes('-')
      ? cepMatch[1]
      : cepMatch[1].slice(0, 5) + '-' + cepMatch[1].slice(5);
  }

  // Remove o CEP para facilitar o parsing do restante
  let rest = trimmed.replace(/\b\d{5}-?\d{3}\b/g, '').trim();

  // País: detecta após última vírgula se for um nome de país conhecido
  const countryMatch = rest.match(/,\s*([A-Za-zÀ-ÿ\s]+?)\s*$/);
  if (countryMatch) {
    const possibleCountry = countryMatch[1].trim();
    const knownCountries = [
      'brasil', 'brazil', 'canada', 'canadá', 'estados unidos', 'usa',
      'portugal', 'españa', 'spain', 'frança', 'france',
    ];
    if (knownCountries.includes(possibleCountry.toLowerCase())) {
      result.country = possibleCountry;
      rest = rest.replace(countryMatch[0], '').trim();
    }
  }

  // Estado brasileiro: UF de 2 letras maiúsculas antes do CEP ou no final
  const ufMatch = rest.match(/\b([A-Z]{2})\b/);
  if (ufMatch) {
    result.state = ufMatch[1];
    rest = rest.replace(ufMatch[0], '').trim();
  }

  // Cidade: geralmente antes do estado ou separada por vírgula/traço
  // Tenta capturar a parte antes do estado/UF
  const cityMatch = rest.match(/([^,;\-–—]+?)\s*[\-–—]?\s*[A-Z]{2}?\s*$/);
  if (cityMatch) {
    const possibleCity = cityMatch[1].trim().replace(/[,;\-–—]\s*$/, '');
    if (possibleCity && possibleCity.length > 1) {
      result.city = possibleCity;
    }
  }

  // Bairro: segmento entre vírgulas, antes da cidade
  const parts = rest.split(/[,;\-–—]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // O penúltimo segmento não-vazio antes da cidade/estado costuma ser o bairro
    const candidateNeighborhood = parts[parts.length - 2];
    if (
      candidateNeighborhood &&
      candidateNeighborhood !== result.city &&
      candidateNeighborhood !== result.state
    ) {
      result.neighborhood = candidateNeighborhood;
    }
  }

  return result;
}

/**
 * Extrai cidade e estado a partir de uma string de localização de busca.
 * Formatos suportados:
 *  - "Pinheiros, São Paulo, SP"
 *  - "Porto Alegre, RS"
 *  - "São Paulo, SP, Brasil"
 */
export function parseSearchLocationFallback(location: string): {
  city: string;
  state: string;
} {
  const result = { city: '', state: '' };

  if (!location || !location.trim()) return result;

  const trimmed = location.trim();
  const parts = trimmed
    .split(/[,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return result;

  // Se houver 2+ partes: a última pode ser país, a penúltima estado, a antepenúltima cidade
  const last = parts[parts.length - 1].toLowerCase();
  const knownCountries = ['brasil', 'brazil', 'canada', 'canadá', 'usa', 'estados unidos'];

  let countryIndex = -1;
  if (knownCountries.includes(last)) {
    countryIndex = parts.length - 1;
  }

  let stateIndex = -1;
  let cityIndex = -1;

  // Procura UF (2 letras maiúsculas) entre as partes
  for (let i = parts.length - 2; i >= 0; i--) {
    if (/^[A-Z]{2}$/.test(parts[i]) && i !== countryIndex) {
      stateIndex = i;
      break;
    }
  }

  // Cidade: a parte antes do estado (ou a primeira parte se não houver estado)
  if (stateIndex >= 0 && stateIndex > 0) {
    result.state = parts[stateIndex];
    // Cidade é a parte imediatamente antes do estado, se não for um bairro genérico
    const beforeState = parts[stateIndex - 1];
    if (beforeState && beforeState.length > 2) {
      result.city = beforeState;
    } else if (stateIndex - 2 >= 0) {
      result.city = parts[stateIndex - 2];
    }
  } else if (parts.length === 2 && !stateIndex) {
    // "Porto Alegre, RS" sem UF match? parts[0] = cidade, parts[1] = estado
    // Se parts[1] tem 2 letras maiúsculas, é estado
    if (/^[A-Z]{2}$/.test(parts[1])) {
      result.state = parts[1];
      result.city = parts[0];
    } else {
      result.city = parts[0];
    }
  } else if (parts.length === 1) {
    // Token único não se promove a cidade
    result.city = '';
    result.state = '';
  }

  return result;
}
