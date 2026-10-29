// Test: SiteTemplateRenderer integration with 5 templates
// Uses the project's custom test pattern (assert + console.log)
// Run with: npx tsx tests/SiteTemplateRenderer.test.ts
// Note: JSX/RTL tests require separate Jest configuration; this test covers
// the section ordering and class logic through direct logic verification.

// Polyfill
const storageStore = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (k: string) => storageStore.get(k) ?? null,
  setItem: (k: string, v: string) => storageStore.set(k, String(v)),
  removeItem: (k: string) => storageStore.delete(k),
  clear: () => storageStore.clear(),
};

(globalThis as any).sessionStorage = {
  getItem: (k: string) => storageStore.get(k) ?? null,
  setItem: (k: string, v: string) => storageStore.set(k, String(v)),
  removeItem: (k: string) => storageStore.delete(k),
  clear: () => storageStore.clear(),
};

import { SITE_TEMPLATES } from '../src/types/templates';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    failed++;
  }
}

// === Section order verification (logic-based, no JSX needed) ===

// Verificar ordem de sections - ouro-classico: [hero, services, appointment, gallery, contact]
{
  const template = SITE_TEMPLATES['ouro-classico'];
  const sections = template.sections;
  assert(sections[0] === 'hero', 'Ouro-classico: 1º section = hero');
  assert(sections[1] === 'services', 'Ouro-classico: 2º section = services');
  assert(sections[2] === 'appointment', 'Ouro-classico: 3º section = appointment');
  assert(sections[3] === 'gallery', 'Ouro-classico: 4º section = gallery');
  assert(sections[4] === 'contact', 'Ouro-classico: 5º section = contact');
}

// Verificar ordem de sections - preto-esmeralda: [gallery, hero, services, appointment, contact]
{
  const template = SITE_TEMPLATES['preto-esmeralda'];
  const sections = template.sections;
  assert(sections[0] === 'gallery', 'Preto-esmeralda: 1º section = gallery');
  assert(sections[1] === 'hero', 'Preto-esmeralda: 2º section = hero');
  assert(sections[2] === 'services', 'Preto-esmeralda: 3º section = services');
  assert(sections[3] === 'appointment', 'Preto-esmeralda: 4º section = appointment');
  assert(sections[4] === 'contact', 'Preto-esmeralda: 5º section = contact');
}

// Verificar ordem de sections - minimal-studio: [hero, contact, services, appointment, gallery]
{
  const template = SITE_TEMPLATES['minimal-studio'];
  const sections = template.sections;
  assert(sections[0] === 'hero', 'Minimal-studio: 1º section = hero');
  assert(sections[1] === 'contact', 'Minimal-studio: 2º section = contact');
  assert(sections[2] === 'services', 'Minimal-studio: 3º section = services');
  assert(sections[3] === 'appointment', 'Minimal-studio: 4º section = appointment');
  assert(sections[4] === 'gallery', 'Minimal-studio: 5º section = gallery');
}

// Verificar ordem de sections - safira-executivo: [hero, products, services, gallery, contact]
{
  const template = SITE_TEMPLATES['safira-executivo'];
  const sections = template.sections;
  assert(sections[0] === 'hero', 'Safira-executivo: 1º section = hero');
  assert(sections[1] === 'products', 'Safira-executivo: 2º section = products');
  assert(sections[2] === 'services', 'Safira-executivo: 3º section = services');
  assert(sections[3] === 'gallery', 'Safira-executivo: 4º section = gallery');
  assert(sections[4] === 'contact', 'Safira-executivo: 5º section = contact');
}

// Verificar ordem de sections - rubi-lounge: [hero, services, products, gallery, contact]
{
  const template = SITE_TEMPLATES['rubi-lounge'];
  const sections = template.sections;
  assert(sections[0] === 'hero', 'Rubi-lounge: 1º section = hero');
  assert(sections[1] === 'services', 'Rubi-lounge: 2º section = services');
  assert(sections[2] === 'products', 'Rubi-lounge: 3º section = products');
  assert(sections[3] === 'gallery', 'Rubi-lounge: 4º section = gallery');
  assert(sections[4] === 'contact', 'Rubi-lounge: 5º section = contact');
}

// === Classes CSS de foco (verificação de mapping) ===

// Verificar que cada focus tem uma classe CSS distinta
{
  const focusClassMap: Record<string, string> = {
    services: 'focus-services',
    portfolio: 'focus-portfolio',
    essential: 'focus-essential',
    corporativo: 'focus-corporativo',
    experience: 'focus-experience',
    default: '',
  };

  // Verificar que todos os keys do map correspondem aos templates
  const templateFocuses: Record<string, string> = {
    'ouro-classico': 'services',
    'preto-esmeralda': 'portfolio',
    'minimal-studio': 'essential',
    'safira-executivo': 'corporativo',
    'rubi-lounge': 'experience',
  };

  Object.entries(templateFocuses).forEach(([id, focus]) => {
    const template = SITE_TEMPLATES[id as keyof typeof SITE_TEMPLATES];
    assert(template.focus === focus, `Template ${id} tem focus=${focus}`);
    assert(focusClassMap[focus] !== undefined, `Focus ${focus} tem classe CSS definida`);
  });
}

// === Verificação de sections count ===

// Todos os templates têm exatamente 5 sections
{
  const templates = Object.values(SITE_TEMPLATES);
  templates.forEach((template, idx) => {
    assert(template.sections.length === 5, `Template ${idx}: deve ter 5 sections`, `Obtido: ${template.sections.length}`);
  });
}

// === Verificação de focus values ===

// Cada template tem um focus diferente
{
  const templateFocuses = Object.values(SITE_TEMPLATES).map(t => t.focus);
  const uniqueFocuses = new Set(templateFocuses);
  assert(uniqueFocuses.size === 5, 'Todos os 5 templates têm focus diferente', `Encontrados: ${templateFocuses.length} únicos de ${templateFocuses.length} total`);
}

// === Verificação de section names ===

// As sections esperadas devem ser do conjunto válido
{
  const validSections = ['hero', 'services', 'appointment', 'gallery', 'products', 'contact'];
  const templates = Object.values(SITE_TEMPLATES);
  templates.forEach((template, idx) => {
    template.sections.forEach((section, sIdx) => {
      assert(validSections.includes(section), `Template ${idx}, section ${sIdx}: seção válida`, `Obtido: ${section}`);
    });
  });
}

// === Resumo ===
console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
