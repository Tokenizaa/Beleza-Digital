import React from 'react';
import { Calendar } from 'lucide-react';
import { SharedSitePreview, type ShareableSitePreview } from './SharedSitePreview';
import { useStore } from '../data/store';

const preview: ShareableSitePreview = {
  version: 1, businessName: 'Studio Modelo', category: 'Beleza & Estética',
  tagline: 'Uma experiência digital que valoriza seu negócio',
  description: 'Esta demonstração usa o modelo completo do projeto, com todas as seções originais disponíveis.',
  phone: '(51) 99999-9999', whatsapp: '5551999999999', email: 'contato@exemplo.com',
  address: 'Porto Alegre - RS', city: 'Porto Alegre', state: 'RS', websiteUrl: '',
  templateId: 'ouro-classico', templateName: 'Ouro & Âmbar Clássico',
  projectVersion: 1, generatedAt: new Date().toISOString(), status: 'OPERATIONAL'
};

export const PublicShowcaseDemo: React.FC = () => {
  const { establishment, services, products, media } = useStore();
  const showcasePreview: ShareableSitePreview = {
    ...preview,
    businessName: establishment.name || preview.businessName,
    category: establishment.tagline || preview.category,
    description: establishment.description || preview.description,
    phone: establishment.phone || preview.phone,
    whatsapp: establishment.whatsappClean || preview.whatsapp,
    address: establishment.address || preview.address,
    city: establishment.city || preview.city,
    state: establishment.state || preview.state,
    logoUrl: establishment.logoUrl || undefined,
    coverUrl: establishment.coverUrl || undefined,
    instagramHandle: establishment.instagramHandle || undefined,
    instagramUrl: establishment.instagramUrl || undefined,
    googleMapsUrl: establishment.googleMapsUrl || undefined,
    horario: establishment.openingHoursNote || undefined,
    services, products, media,
  };
  const showcaseWhatsapp = (establishment.whatsappClean || preview.whatsapp || '').replace(/\\D/g, '');
  return (
  <div className="min-h-screen bg-neutral-950">
    <SharedSitePreview preview={showcasePreview} controlMode="sidebar" />
    <button onClick={() => window.open('https://wa.me/' + showcaseWhatsapp,'_blank','noopener,noreferrer')}
      className="fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-4 font-bold text-neutral-950 shadow-2xl transition hover:bg-amber-400">
      <Calendar className="h-5 w-5"/> Agendar agora
    </button>
  </div>
  );
};