import React from 'react';
import { SharedSitePreview, type ShareableSitePreview } from './SharedSitePreview';

const preview: ShareableSitePreview = {
  version: 1,
  businessName: 'Demonstração genérica',
  category: 'Modelo demonstrativo',
  tagline: 'Uma experiência digital para apresentar os cinco modelos da plataforma',
  description: 'Esta é uma demonstração genérica. Os textos e elementos visuais são ilustrativos e não representam um estabelecimento real.',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  state: '',
  websiteUrl: '',
  templateId: 'ouro-classico',
  templateName: 'Ouro & Âmbar Clássico',
  projectVersion: 1,
  generatedAt: new Date().toISOString(),
  isSampleContent: true,
  services: [],
  products: [],
  media: [],
};

export const PublicShowcaseDemo: React.FC = () => (
  <div className="min-h-screen bg-neutral-950">
    <SharedSitePreview preview={preview} controlMode="sidebar" />
  </div>
);
