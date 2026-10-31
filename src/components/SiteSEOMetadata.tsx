/**
 * SiteSEOMetadata - Componente React que injeta todos os metadados SEO
 * no <head> da página.
 * 
 * Usa os dados do ShareableSitePreview e gera:
 * - <title>
 * - <meta name="description">
 * - Open Graph (og:title, og:description, og:image, etc.)
 * - Twitter Cards
 * - JSON-LD structured data (schema.org LocalBusiness)
 */
import React, { useEffect } from 'react';
import { generateAllMetadata, formatFieldsForDisplay } from '../lib/seo/seo-utils';
import type { ShareableSitePreview } from '../pages/SharedSitePreview';

interface SiteSEOMetadataProps {
  preview: ShareableSitePreview | null;
  templateName?: string;
  logoUrl?: string;
  // Permitir passar URL canônica customizada
  canonicalUrl?: string;
}

export const SiteSEOMetadata: React.FC<SiteSEOMetadataProps> = ({
  preview,
  templateName,
  logoUrl,
  canonicalUrl,
}) => {
  useEffect(() => {
    if (!preview) return;
    
    const template = templateName || 'Modelo Padrão';
    const metadata = generateAllMetadata(preview, template, logoUrl);
    const canonical = canonicalUrl || window.location.origin + window.location.pathname;
    
    // 1. Definir <title>
    const titleElement = document.querySelector('title');
    if (titleElement) {
      titleElement.textContent = metadata.title;
    }
    
    // 2. Meta description
    let descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.name = 'description';
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.content = metadata.description;
    
    // 3. Open Graph tags
    const ogProps = [
      { property: 'og:title', content: metadata.og.title },
      { property: 'og:description', content: metadata.og.description },
      { property: 'og:type', content: metadata.og.type },
      { property: 'og:url', content: metadata.og.url },
      { property: 'og:site_name', content: metadata.og.siteName },
      { property: 'og:locale', content: metadata.og.locale },
      { property: 'og:image', content: metadata.og.images[0] },
    ];
    
    ogProps.forEach(({ property, content }) => {
      let ogMeta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!ogMeta) {
        ogMeta = document.createElement('meta');
        ogMeta.setAttribute('property', property);
        document.head.appendChild(ogMeta);
      }
      ogMeta.content = content;
    });
    
    // 4. Twitter Cards tags
    const twitterProps = [
      { name: 'twitter:card', content: metadata.twitter.card },
      { name: 'twitter:title', content: metadata.twitter.title },
      { name: 'twitter:description', content: metadata.twitter.description },
      { name: 'twitter:image', content: metadata.twitter.images[0] },
      { name: 'twitter:creator', content: metadata.twitter.creator },
    ];
    
    twitterProps.forEach(({ name, content }) => {
      let twitterMeta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!twitterMeta) {
        twitterMeta = document.createElement('meta');
        twitterMeta.name = name;
        document.head.appendChild(twitterMeta);
      }
      twitterMeta.content = content;
    });
    
    // 5. JSON-LD structured data
    const existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    if (existingJsonLd && existingJsonLd.parentNode) {
      existingJsonLd.parentNode.removeChild(existingJsonLd);
    }
    
    const jsonLdScript = document.createElement('script');
    jsonLdScript.type = 'application/ld+json';
    jsonLdScript.textContent = JSON.stringify(metadata.jsonLd, null, 2);
    document.head.appendChild(jsonLdScript);
    
    // 6. Link canonical
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
    
  }, [preview, templateName, logoUrl, canonicalUrl]);
  
  // Retornar null - este componente só injeta metas no head, não renderiza UI visível
  return null;
};

/**
 * Helper: Componente de alto nível que combina SEO + UI
 * Use este quando precisar de ambos: metadados E renderização visual
 */
export const SiteSEOAndPreview: React.FC<{
  preview: ShareableSitePreview | null;
  templateName?: string;
  logoUrl?: string;
  canonicalUrl?: string;
}> = ({
  preview,
  templateName,
  logoUrl,
  canonicalUrl,
}) => {
  // Injeta metadados
  SiteSEOMetadata({ preview, templateName, logoUrl, canonicalUrl });
  
  // Renderização já é feita pelo pai (SharedSitePreview ou página pública)
  // Este componente existe apenas para injetar o SEO
  return null;
};