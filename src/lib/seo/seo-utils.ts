/**
 * SEO Utilities - Funções para geração de metadata, títulos e dados estruturados
 * 
 * Integração com os 18 campos do provedor e o ShareableSitePreview
 */

import type { ShareableSitePreview } from '@/pages/SharedSitePreview';
import { getFieldCopy, isMapField, isGalleryField } from './copy-templates';

/**
 * Gera o título da página para SEO
 * Formato: "Nome do Estabelecimento | Categoria | Template Name"
 */
export function generateTitle(
  preview: ShareableSitePreview,
  templateName?: string
): string {
  const businessName = getFieldCopy('nome', preview.businessName);
  const category = getFieldCopy('categoria', preview.category);
  const template = templateName || 'Modelo Padrão';
  
  return `${businessName} | ${category} | ${template}`;
}

/**
 * Gera a meta description para SEO
 * Limite recomendado: 150-160 caracteres
 */
export function generateDescription(preview: ShareableSitePreview): string {
  const businessName = getFieldCopy('nome', preview.businessName);
  const description = getFieldCopy('descricao', preview.description);
  const category = getFieldCopy('categoria', preview.category);
  
  // Constrói description a partir dos dados reais ou usa template genérico
  let baseDesc: string;
  
  if (description && description !== 'Descrição não disponível') {
    baseDesc = description;
  } else if (businessName && category) {
    baseDesc = `${businessName} é um estabelecimento de ${category} que oferece serviços de beleza e bem-estar.`;
  } else {
    baseDesc = 'Estabelecimento de beleza e bem-estar';
  }
  
  // Limita a 160 caracteres para SEO ótimo
  return baseDesc.slice(0, 160);
}

/**
 * Gera dados Open Graph (og:) para Facebook, LinkedIn, etc.
 */
export function generateOgData(
  preview: ShareableSitePreview,
  templateName: string,
  logoUrl?: string
) {
  const businessName = getFieldCopy('nome', preview.businessName);
  const category = getFieldCopy('categoria', preview.category);
  const websiteUrl = preview.googleMapsUrl || '/';
  
  return {
    // Título da página
    title: `${businessName} | ${category} | ${templateName}`,
    
    // Descrição para og:
    description: generateDescription(preview),
    
    // Imagem - prioriza logo, senão usa placeholder
    images: [
      logoUrl || 
      `https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80`,
    ],
    
    // URL canônica da página
    url: websiteUrl,
    
    // Nome do site
    siteName: category,
    
    // Tipo de conteúdo
    type: 'website' as const,
    
    // Locale
    locale: 'pt_BR' as const,
  };
}

/**
 * Gera dados Twitter Cards
 */
export function generateTwitterCard(preview: ShareableSitePreview) {
  const businessName = getFieldCopy('nome', preview.businessName);
  
  return {
    card: 'summary_large_image' as const,
    title: generateTitle(preview, ''),
    description: generateDescription(preview),
    images: [
      preview.logoUrl || 
      `https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80`,
    ],
    creator: '@yeshua_digital', // Handle da marca - ajustar conforme necessário
  };
}

/**
 * Gera JSON-LD structured data para Google/ Bing
 * Usa schema.org LocalBusiness
 */
export function generateJsonLd(preview: ShareableSitePreview): Record<string, unknown> {
  const businessName = getFieldCopy('nome', preview.businessName);
  const category = getFieldCopy('categoria', preview.category);
  const address = getFieldCopy('endereco', preview.address);
  const phone = getFieldCopy('telefone', preview.phone);
  const location = getFieldCopy('cidade', preview.city) || '';
  
  // Tenta pegar lat/lon se existirem
  const latitude = typeof preview.latitude === 'number' && Number.isFinite(preview.latitude)
    ? preview.latitude 
    : null;
  const longitude = typeof preview.longitude === 'number' && Number.isFinite(preview.longitude)
    ? preview.longitude 
    : null;
  
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org' as string,
    '@type': 'LocalBusiness' as string,
    'name': businessName,
    'description': preview.description || '',
    'address': {
      '@type': 'PostalAddress' as string,
      'addressLocality': location,
      'addressCountry': 'BR' as string,
    },
    'telephone': phone,
  };
  
  // Adiciona geo coordinates se disponíveis
  if (latitude !== null && longitude !== null) {
    ld['geo'] = {
      '@type': 'GeoCoordinates' as string,
      'latitude': latitude,
      'longitude': longitude,
    };
  }
  
  // Adiciona imagem (logo) se existir
  if (preview.logoUrl) {
    ld['image'] = preview.logoUrl;
  }
  
  // Adiciona categoria se for diferente do default
  if (category && category !== 'Categoria não informada') {
    ld['category'] = category;
  }
  
  return ld;
}

/**
 * Gera todos os metadados de uma vez (title, description, og, twitter, json-ld)
 */
export function generateAllMetadata(
  preview: ShareableSitePreview,
  templateName: string,
  logoUrl?: string
) {
  return {
    title: generateTitle(preview, templateName),
    description: generateDescription(preview),
    og: generateOgData(preview, templateName, logoUrl),
    twitter: generateTwitterCard(preview),
    jsonLd: generateJsonLd(preview),
  };
}

/**
 * Extrai e formata campos específicos para display na UI
 * Útil para renderizar ficha do estabelecimento
 */
export function formatFieldsForDisplay(preview: ShareableSitePreview) {
  return {
    nome: getFieldCopy('nome', preview.businessName),
    categoria: getFieldCopy('categoria', preview.category),
    endereco: getFieldCopy('endereco', preview.address),
    telefone: getFieldCopy('telefone', preview.phone),
    'link-do-maps': preview.googleMapsUrl || 'Sem link',
    descricao: getFieldCopy('descricao', preview.description),
    'quantidade-de-avaliacoes': getFieldCopy('quantidade-de-avaliacoes', 
      preview.qualification?.score?.toString() || undefined),
    'faixa-de-preco': getFieldCopy('faixa-de-preco', undefined),
    horario: getFieldCopy('horario', undefined),
    status: getFieldCopy('status', preview.status),
    nota: getFieldCopy('nota', undefined),
  };
}