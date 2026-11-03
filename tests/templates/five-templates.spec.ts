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


test('captura as seções do Ouro Clássico, página completa e GIF vertical para a landing', async ({ page }) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Studio Aurora' })).toBeVisible();

  const firstTemplate = page.getByRole('tab', { name: 'Ouro Clássico' });
  await firstTemplate.click();
  await expect(firstTemplate).toHaveAttribute('aria-selected', 'true');
  // Capture the site itself, not the showcase navigation or admin shortcut.
  await page.addStyleTag({
    content: '[data-testid="template-switcher"], [data-testid="showcase-admin-link"] { display: none !important; }',
  });

  const outputDir = path.resolve(process.cwd(), 'public/assets/landing/showcase');
  const sectionsDir = path.join(outputDir, 'sections');
  const framesDir = path.resolve(process.cwd(), 'test-results/landing-capture/frames');
  fs.mkdirSync(sectionsDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const sections = page.locator('section');
  const sectionCount = await sections.count();
  let captured = 0;
  let heroCaptured = false;

  for (let index = 0; index < sectionCount; index++) {
    const section = sections.nth(index);
    if (!(await section.isVisible())) continue;

    const meta = await section.evaluate((element) => ({
      id: element.id || '',
      hasH1: Boolean(element.querySelector('h1')),
      heading: element.querySelector('h1,h2,h3')?.textContent?.trim() || '',
    }));
    let key = meta.id || (meta.hasH1 ? 'hero' : '');
    if (!key && index === 0) key = 'hero';
    if (!key) key = `section-${String(index + 1).padStart(2, '0')}`;
    key = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

    await section.screenshot({
      path: path.join(sectionsDir, `${key}.png`),
      animations: 'disabled',
    });
    captured++;
    if (key === 'hero') heroCaptured = true;
  }

  expect(captured).toBeGreaterThanOrEqual(4);
  expect(heroCaptured).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(outputDir, 'ouro-classico-full.png'),
    fullPage: true,
    animations: 'disabled',
  });

  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = page.viewportSize()?.height ?? 900;
  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  const step = Math.max(420, Math.floor(viewportHeight * 0.72));
  let frame = 0;
  for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(framesDir, `frame-${String(frame).padStart(3, '0')}.png`),
      animations: 'disabled',
    });
    frame++;
  }
  if (frame === 0) {
    await page.screenshot({ path: path.join(framesDir, 'frame-000.png'), animations: 'disabled' });
    frame = 1;
  }

  execFileSync('ffmpeg', [
    '-y',
    '-framerate', '2',
    '-i', path.join(framesDir, 'frame-%03d.png'),
    '-filter_complex', '[0:v]fps=2,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer',
    '-loop', '0',
    path.join(outputDir, 'ouro-classico-scroll.gif'),
  ], { stdio: 'pipe' });

  expect(fs.existsSync(path.join(outputDir, 'ouro-classico-full.png'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'ouro-classico-scroll.gif'))).toBe(true);

  // Confirm the seven-fold landing consumes the generated, real Playwright assets.
  await page.goto('/');
  await expect(page.locator('[data-landing-section]')).toHaveCount(7);
  for (const asset of [
    '/assets/landing/showcase/sections/hero.png',
    '/assets/landing/showcase/sections/servicos.png',
    '/assets/landing/showcase/sections/agendamento.png',
    '/assets/landing/showcase/sections/contato.png',
    '/assets/landing/showcase/sections/galeria.png',
    '/assets/landing/showcase/ouro-classico-full.png',
    '/assets/landing/showcase/ouro-classico-scroll.gif',
  ]) {
    const response = await page.request.get(asset);
    expect(response.ok(), `Landing asset must be served: ${asset}`).toBe(true);
  }
});
