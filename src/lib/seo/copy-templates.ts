/**
 * Copy Templates para os 18 campos do provedor de dados
 * 
 * Cada campo tem:
 * - template: função que formata o valor quando disponível
 * - fallback: texto quando o campo está vazio/indisponível
 * - useForMap/gallery: flags para campos que não são copy textual
 */

export type CopyFallback = 'fallback' | 'empty' | 'none';

export interface CopyTemplate {
  template: (value: string | number | null | undefined) => string;
  fallback: string;
  useForMap?: boolean;
  useForGallery?: boolean;
}

/**
 * Templates completos para todos os 18 campos
 * Ordem: Nome, Categoria, Endereço, Telefone, Site, Nota, Quantidade avaliações,
 * Faixa de preço, Horários, Status operacional, Latitude, Longitude, Link do Maps,
 * Descrição, Serviços/atributos, Fotos (URLs), Vídeos (URLs), Logo/Foto de perfil
 */

export const copyTemplates: Record<string, CopyTemplate> = {
  // Campos principais (100% disponibilidade)
  nome: {
    template: (name: string | null | undefined) =>
      name && name.trim() ? name.trim() : 'Nome do estabelecimento',
    fallback: 'Nome do estabelecimento',
  },

  categoria: {
    template: (cat: string | null | undefined) =>
      cat && cat.trim() ? cat.trim() : 'Categoria não informada',
    fallback: 'Categoria não informada',
  },

  endereco: {
    template: (addr: string | null | undefined) =>
      addr && addr.trim() ? addr.trim() : 'Endereço não informado',
    fallback: 'Endereço não informado',
  },

  telefone: {
    template: (phone: string | null | undefined) =>
      phone && phone.trim()
        ? `(${phone.replace(/\D/g, '')})`
        : 'Contato não informado',
    fallback: 'Contato não informado',
  },

  // Site/Link do Maps (combinados na análise)
  site: {
    template: (url: string | null | undefined) =>
      url && url.trim() ? `Visite: ${url.trim()}` : 'Sem site informado',
    fallback: 'Sem site informado',
  },

  'link-do-maps': {
    template: (url: string | null | undefined) =>
      url && url.trim()
        ? `Ver no Google Maps: ${url.trim()}`
        : 'Sem link do mapa',
    fallback: 'Sem link do mapa',
  },

  // Campos de média disponibilidade (90-98%)
  descricao: {
    template: (desc: string | null | undefined) =>
      desc && desc.trim() ? desc.trim() : 'Descrição não disponível',
    fallback: 'Descrição não disponível',
  },

  // Campos de baixa disponibilidade (0-2%) - agora tratados com fallback adequado
  'quantidade-de-avaliacoes': {
    template: (count: string | number | null | undefined) => {
      const numberCount = typeof count === 'number' ? count : 
        (count && !isNaN(Number(count)) ? Number(count) : 0);
      return numberCount > 0 
        ? `${numberCount} ${numberCount === 1 ? 'avaliação' : 'avaliações'}`
        : 'Sem avaliações';
    },
    fallback: 'Sem avaliações',
  },

  'faixa-de-preco': {
    template: (range: string | null | undefined) =>
      range && range.trim() ? range.trim() : 'Consultar faixa de preço',
    fallback: 'Consultar faixa de preço',
  },

  horario: {
    template: (hours: string | null | undefined) =>
      hours && hours.trim() ? hours.trim() : 'Horário não informado',
    fallback: 'Horário não informado',
  },

  // Campos novos que estão sendo adicionados
  status: {
    template: (status: string | null | undefined) => {
      const s = status && status.trim() ? status.trim() : '';
      const statusMap: Record<string, string> = {
        active: 'Funcionando normalmente',
        inactive: 'Temporariamente fechado',
        suspended: 'Fechado por supervisão',
      };
      return statusMap[s] || s || 'Status não informado';
    },
    fallback: 'Status não informado',
  },

  nota: {
    template: (note: string | null | undefined) =>
      note && note.trim() ? note.trim() : 'Avaliação não disponível',
    fallback: 'Avaliação não disponível',
  },

  // Campos de localização (mapa - não geram copy textual)
  latitude: {
    useForMap: true,
    fallback: null,
    template: () => '',
  },

  longitude: {
    useForMap: true,
    fallback: null,
    template: () => '',
  },

  // Mídia
  'fotos-urls': {
    useForGallery: true,
    fallback: null,
    template: () => '',
  },

  'videos-urls': {
    useForGallery: true,
    fallback: null,
    template: () => '',
  },

  'logo-foto-perfil': {
    useForBranding: true,
    fallback: null,
    template: () => '',
  },

  // Serviços e atributos
  'servicos-atributos': {
    template: (services: string | null | undefined) => {
      const svc = services && services.trim() ? services.trim() : '';
      return svc 
        ? `${svc} serviços disponíveis` 
        : 'Serviços não informados';
    },
    fallback: 'Serviços não informados',
  },
};

/**
 * Helper: Obtém o texto formatado para um campo específico
 */
export function getFieldCopy(
  fieldName: keyof typeof copyTemplates,
  value: string | number | null | undefined
): string {
  const template = copyTemplates[fieldName];
  if (!template) return copyTemplates.nome.fallback;
  
  if (template.useForMap || template.useForGallery) {
    return template.useForMap ? '' : template.fallback;
  }
  
  return template.template(value) || template.fallback;
}

/**
 * Helper: Verifica se um campo deve ser usado para mapa
 */
export function isMapField(fieldName: keyof typeof copyTemplates): boolean {
  const template = copyTemplates[fieldName];
  return !!template?.useForMap;
}

/**
 * Helper: Verifica se um campo deve ser usado para gallery
 */
export function isGalleryField(fieldName: keyof typeof copyTemplates): boolean {
  const template = copyTemplates[fieldName];
  return !!template?.useForGallery;
}

/**
 * Lista de campos que são copy textual (não são map/gallery)
 */
export const textualFields = [
  'nome',
  'categoria', 
  'endereco',
  'telefone',
  'site',
  'link-do-maps',
  'descricao',
  'quantidade-de-avaliacoes',
  'faixa-de-preco',
  'horario',
  'status',
  'nota',
  'servicos-atributos',
] as const;

/**
 * Lista de campos que são uso especial (mapa/gallery)
 */
export const specialUseFields = [
  'latitude',
  'longitude',
  'fotos-urls',
  'videos-urls',
  'logo-foto-perfil',
] as const;