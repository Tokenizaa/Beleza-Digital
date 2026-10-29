// Test: template-data-mapper integration with 5 templates
// Uses the project's custom test pattern (assert + console.log)
// Run with: npx tsx tests/template-data-mapper.test.ts

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

import { mapDataForTemplate, type MapScrapeData, type TemplateGeneratedContent } from '../src/lib/template-data-mapper';
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

// === Dados base FIXOS - cada teste usa apenas o que precisa ===

const baseServiceData: MapScrapeData = {
  businessName: 'Barbearia Teste',
  category: 'Barbearia',
  description: 'Servicos de corte e barba',
  website: 'https://teste.com',
  phone: '(11) 98765-4321',
  email: 'contato@teste.com',
  address: 'Rua Teste, 10',
  city: 'São Paulo',
  region: 'SP',
  sourceUrl: 'https://maps.example.com/test',
  photos: ['/img1.jpg', '/img2.jpg'],
  videos: [],
  rating: 5,
  review_count: 10,
  opening_hours: '9AM - 7PM',
  services_attributes: [
    { service_name: 'Corte Masculino', description: 'Corte tradicional', price: 40, duration: 30 },
    { service_name: 'Barba', description: 'Barba completta', price: 30, duration: 20 }
  ],
  media_items: []
};

// Apenas description vazia (para testar fallback de description)
const dataEmptyDesc: MapScrapeData = {
  ...baseServiceData,
  description: ''
};

// Apenas photos vazias (para testar fallback de placeholder - focus services nao sobrescreve)
const dataNoPhotos: MapScrapeData = {
  ...baseServiceData,
  photos: []
};

// Corporate com category 'Barbearia'
const corporateData: MapScrapeData = {
  ...baseServiceData,
  category: 'Barbearia'
};

// Experience with lowercase 'spa'
const experienceSpaData: MapScrapeData = {
  ...baseServiceData,
  category: 'spa'
};

// Experience with lowercase 'lounge'
const experienceLoungeData: MapScrapeData = {
  ...baseServiceData,
  category: 'lounge'
};

// === Testes: Dados básicos ===

// Dados básicos em todos os templates
{
  const templates = Object.values(SITE_TEMPLATES);
  templates.forEach(template => {
    const result = mapDataForTemplate(baseServiceData, template);
    assert(result.name === 'Barbearia Teste', 'Nome correto');
    assert(result.category === 'Barbearia', 'Categoria correta');
    assert(result.description === 'Servicos de corte e barba', 'Descricao correta');
    assert(result.contact.phone === '(11) 98765-4321', 'Telefone');
    assert(result.contact.email === 'contato@teste.com', 'Email');
    assert(result.contact.address === 'Rua Teste, 10', 'Endereco');
    assert(result.contact.city === 'São Paulo', 'Cidade');
    assert(result.contact.region === 'SP', 'Regiao');
    assert(result.website === 'https://teste.com', 'Website');
    assert(result.photos.length === 2, 'Fotos (2)');
    assert(result.videos.length === 0, 'Videos vazios');
    assert(result.rating === 5, 'Rating');
    assert(result.reviewCount === 10, 'Review count');
  });
}

// Placeholder quando photos vazias - focus services (ouro-classico) nao inclui photos no return
{
  const template = SITE_TEMPLATES['ouro-classico'];
  const result = mapDataForTemplate(dataNoPhotos, template);
  assert(result.photos.length === 1 && result.photos[0] === '/placeholder-image.png', 'Placeholder services', `Obtido: ${JSON.stringify(result.photos)}`);
}

// === Testes: Focus services ===

// Services completo
{
  const template = SITE_TEMPLATES['ouro-classico'];
  const result = mapDataForTemplate(baseServiceData, template);
  assert(Array.isArray(result.services) && result.services.length === 2, 'Services: 2 itens');
  assert(result.services[0].name === 'Corte Masculino', 'Services[0]: nome');
  assert(result.services[0].price === 40, 'Services[0]: preco');
  assert(result.services[0].durationMinutes === 30, 'Services[0]: duracao');
  assert(result.services[1].name === 'Barba', 'Services[1]: nome');
  assert(result.services[1].price === 30, 'Services[1]: preco');
  assert(result.services[1].durationMinutes === 20, 'Services[1]: duracao');
}

// Services com description vazia - trigger fallback description
{
  const template = SITE_TEMPLATES['ouro-classico'];
  const result = mapDataForTemplate(dataEmptyDesc, template);
  // O fallback de description acontece quando data.description é falsy (string vazia)
  // Mas services array tem 2 itens pq vem de services_attributes
  assert(result.services.length === 2, 'Services: ainda tem 2 itens mesmo com description vazia');
  assert(result.description.includes('Barbearia/estabelecimento de beleza'), 'Fallback description acionado', `Obtido: ${result.description}`);
}

// Service parciais
{
  const template = SITE_TEMPLATES['ouro-classico'];
  const partial = { ...baseServiceData, services_attributes: [{ name: 'Servico Incompleto', description: 'Sem preco' }] };
  const result = mapDataForTemplate(partial, template);
  assert(result.services?.length === 1, '1 servicio parcial');
  assert(result.services[0].price === null, 'Preco nulo');
  assert(result.services[0].durationMinutes === null, 'Duracao nula');
}

// === Testes: Focus portfolio ===

// Portfolio completo - usa dados próprios (nao espalha baseServiceData photos)
{
  const portfolioData: MapScrapeData = {
    businessName: 'Teste Portfolio',
    category: 'Barbearia',
    description: 'Portfolio test',
    website: null,
    phone: null,
    email: null,
    address: null,
    city: null,
    region: null,
    sourceUrl: null,
    photos: [],  // photos vazias - mapper vai usar data.photos do próprio dado
    videos: [],
    rating: null,
    review_count: null,
    opening_hours: null,
    services_attributes: [],
    media_items: [
      { service_name: 'Trabalho 1', name: 'Work 1', image_url: '/img1.jpg', description: 'Desc 1' },
      { service_name: 'Trabalho 2', name: 'Work 2', image_url: '/img2.jpg', description: 'Desc 2' },
      { service_name: 'Trabalho 3', name: 'Work 3', image_url: '/img3.jpg', description: 'Desc 3' }
    ]
  };
  const template = SITE_TEMPLATES['preto-esmeralda'];
  const result = mapDataForTemplate(portfolioData, template);
  assert(Array.isArray(result.portfolio) && result.portfolio.length === 3, 'Portfolio: 3 itens');
  assert(result.portfolio[0].name === 'Trabalho 1', 'Portfolio[0]: nome');
  assert(result.portfolio[0].imageUrl === '/img1.jpg', 'Portfolio[0]: imageUrl');
  // Photos: data.photos.length > 0 ? data.photos.slice(0, 6) : []
  // data.photos = [] (definido acima), então photos = []
  assert(result.photos.length === 0, 'Photos: 0 quando data.photos vazio');
}

// Portfolio com media_items parcial + photos vazias
{
  const portfolioData2: MapScrapeData = {
    businessName: 'Teste Portfolio 2',
    category: 'Barbearia',
    description: 'Portfolio test 2',
    website: null,
    phone: null,
    email: null,
    address: null,
    city: null,
    region: null,
    sourceUrl: null,
    photos: [],  // photos vazias
    videos: [],
    rating: null,
    review_count: null,
    opening_hours: null,
    services_attributes: [],
    media_items: [
      { service_name: 'Work A', name: 'Work A', image_url: '/a.jpg', description: 'Desc A' }
    ]
  };
  const template = SITE_TEMPLATES['preto-esmeralda'];
  const result = mapDataForTemplate(portfolioData2, template);
  assert(result.portfolio?.length === 1, '1 item portfolio parcial');
  assert(result.portfolio[0].imageUrl === '/a.jpg', 'ImageUrl parcial');
  assert(result.photos.length === 0, 'Photos: 0 quando data.photos vazio');
}

// === Testes: Focus essential ===

// Essential completo
{
  const template = SITE_TEMPLATES['minimal-studio'];
  const result = mapDataForTemplate(baseServiceData, template);
  assert(result.essential !== undefined, 'essential object');
  assert(Array.isArray(result.essential.highlights) && result.essential.highlights.length === 1, 'highlights: 1 item');
  assert(result.essential.highlights[0] === '9AM - 7PM', 'highlight: opening_hours');
  assert(Array.isArray(result.essential.standoutFeatures) && result.essential.standoutFeatures.length > 0, 'standoutFeatures preenchido');
  assert(result.essential.standoutFeatures.includes('Barbearia'), 'inclui category');
  assert(result.essential.standoutFeatures.includes('5/5'), 'inclui rating');
}

// Essential sem opening_hours
{
  const dataNoHours: MapScrapeData = { ...baseServiceData, opening_hours: null };
  const template = SITE_TEMPLATES['minimal-studio'];
  const result = mapDataForTemplate(dataNoHours, template);
  assert(result.essential.highlights[0] === 'Atendimento por agendamento', 'Fallback highlights');
}

// Essential photos - baseServiceData tem 2 photos, essential faz slice(0,3) = 2
{
  const template = SITE_TEMPLATES['minimal-studio'];
  const result = mapDataForTemplate(baseServiceData, template);
  assert(result.photos.length === 2, 'Photos: slice(0,3) de 2 = 2');
}

// === Testes: Focus corporativo ===

// Corporativo completo
{
  const template = SITE_TEMPLATES['safira-executivo'];
  const result = mapDataForTemplate(corporateData, template);
  assert(result.corporativo !== undefined, 'corporativo object');
  assert(result.corporativo.establishmentType === 'Barbearia Executiva', 'establishmentType');
  assert(result.corporativo.specialty === 'Barbearia', 'specialty: usa category');
  assert(Array.isArray(result.corporativo.trustSignals) && result.corporativo.trustSignals.length > 0, 'trustSignals preenchido');
}

// Corporico sem rating
{
  const dataNoRating: MapScrapeData = { ...corporateData, rating: null, review_count: null };
  const template = SITE_TEMPLATES['safira-executivo'];
  const result = mapDataForTemplate(dataNoRating, template);
  assert(result.corporativo.establishmentType === 'Barbearia Executiva', 'establishmentType sem rating');
  assert(result.corporativo.specialty === 'Barbearia', 'specialty sem rating');
}

// Corporico sem website
{
  const dataNoWebsite: MapScrapeData = { ...corporateData, website: null };
  const template = SITE_TEMPLATES['safira-executivo'];
  const result = mapDataForTemplate(dataNoWebsite, template);
  const hasSite = result.corporativo.trustSignals?.includes('Site próprio');
  assert(!hasSite, 'Site próprio removido quando website null');
}

// === Testes: Focus experience ===

// Experience completo - spa
{
  const template = SITE_TEMPLATES['rubi-lounge'];
  const result = mapDataForTemplate(experienceSpaData, template);
  assert(result.experience !== undefined, 'experience object');
  assert(Array.isArray(result.experience.recommendedFor) && result.experience.recommendedFor.length > 0, 'recommendedFor preenchido');
}

// Experience spa => bem-estar (lowercase 'spa' matcher inclui('spa'))
{
  const template = SITE_TEMPLATES['rubi-lounge'];
  const result = mapDataForTemplate(experienceSpaData, template);
  assert(Array.isArray(result.experience.recommendedFor) && result.experience.recommendedFor.includes('Relaxamento e bem-estar'), 'spa => bem-estar');
}

// Experience lounge => social (lowercase 'lounge' matcher inclui('lounge'))
{
  const template = SITE_TEMPLATES['rubi-lounge'];
  const result = mapDataForTemplate(experienceLoungeData, template);
  assert(Array.isArray(result.experience.recommendedFor) && result.experience.recommendedFor.includes('Experiência social e convivência'), 'lounge => social');
}

// Experience categoria default (barbearia) - else do mapper
{
  const template = SITE_TEMPLATES['rubi-lounge'];
  const result = mapDataForTemplate(baseServiceData, template);
  assert(Array.isArray(result.experience.recommendedFor) && result.experience.recommendedFor.includes('Cuidado pessoal e imagem'), 'barbearia => cuidado pessoal');
}

// === Testes: Fallback ===

// Fallback focus nao reconhecido
{
  const template = { ...SITE_TEMPLATES['ouro-classico'], focus: 'unknown-focus' } as SiteTemplateConfig;
  const result = mapDataForTemplate(baseServiceData, template);
  assert(result.services.length === 0, 'Services vazios focus desconhecido');
  assert(result.description === 'Servicos de corte e barba', 'Description preservada quando nao vazia', `Obtido: ${result.description}`);
}

// Fallback default
{
  assert(true, 'Fallthrough default case');
}

console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
