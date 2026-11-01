import { test, expect } from '@playwright/test';

const templates = [
  'Ouro Clássico',
  'Preto Esmeralda',
  'Minimal Studio',
  'Safira Executivo',
  'Rubi Lounge',
];

test('demonstração pública percorre os cinco modelos e mantém recursos comerciais', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Studio Aurora' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entrar no painel da plataforma' })).toHaveAttribute('href', '/plataforma/acesso?mode=login');
  await expect(page.getByText(/DEMONSTRAÇÃO ILUSTRATIVA — empresa/i)).toHaveCount(0);
  await expect(page.getByText(/Algumas áreas usam conteúdo ilustrativo/i)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Demonstração Oficial ao Vivo');

  for (const template of templates) {
    const tab = page.getByRole('tab', { name: template });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#contato')).toBeVisible();
    await expect(page.locator('#galeria')).toBeVisible();
  }

  const map = page.locator('iframe[title^="Mapa de localização"]');
  await expect(map).toHaveCount(1);
  await expect(map).toHaveAttribute('src', /maps\.google\.com\/maps\?q=/);

  const galleryItem = page.locator('#galeria button').first();
  await expect(galleryItem).toBeVisible();
  await galleryItem.click();
  await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();

  await expect(page.getByRole('link', { name: /WhatsApp/i }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});

test('preview personalizado incompleto não inventa endereço, horário ou mapa', async ({ page }) => {
  const payload = {
    version: 1,
    businessName: 'Preview incompleto',
    category: 'Serviços',
    description: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    websiteUrl: '',
    templateId: 'ouro-classico',
    templateName: 'Ouro Clássico',
    projectVersion: 1,
    generatedAt: '2026-11-01T00:00:00.000Z',
    services: [],
    products: [],
    media: [],
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  await page.goto('/?site-preview=' + encoded);

  await expect(page.getByRole('heading', { name: 'Preview incompleto' })).toBeVisible();
  await expect(page.locator('iframe[title^="Mapa de localização"]')).toHaveCount(0);
  await expect(page.getByText('Endereço não informado')).toHaveCount(0);
  await expect(page.getByText('Horário não informado')).toHaveCount(0);
  await expect(page.getByText('Telefone não informado')).toHaveCount(0);
});

test('layout mobile não cria rolagem horizontal na demonstração', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Studio Aurora' })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});
