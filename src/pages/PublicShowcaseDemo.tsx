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
  const { services, products, media } = useStore();
  const showcasePreview: ShareableSitePreview = { ...preview, services, products, media };
  return (
  <div className="min-h-screen bg-neutral-950">
    <SharedSitePreview preview={showcasePreview} controlMode="sidebar" />
    <button onClick={() => window.open('https://wa.me/5551999999999','_blank','noopener,noreferrer')}
      className="fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-4 font-bold text-neutral-950 shadow-2xl transition hover:bg-amber-400">
      <Calendar className="h-5 w-5"/> Agendar agora
    </button>
  </div>
  );
};