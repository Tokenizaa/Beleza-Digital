import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('produção: raspagem → qualificação → cinco templates → mensagem preparada', async ({ page, browser }, testInfo) => {
  test.skip(process.env.E2E_RUN_PRODUCTION_FLOW !== '1', 'Execução real em produção exige E2E_RUN_PRODUCTION_FLOW=1.');

  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD;
  const niche = process.env.E2E_SEARCH_NICHE?.trim();
  const city = process.env.E2E_SEARCH_CITY?.trim();
  const state = process.env.E2E_SEARCH_STATE?.trim() || 'RS';
  if (!email || !password || !niche || !city) {
    throw new Error('Defina E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_SEARCH_NICHE e E2E_SEARCH_CITY no ambiente local. Nenhuma credencial deve ser gravada no repositório.');
  }

  test.setTimeout(8 * 60 * 1000);
  const startedAt = Date.now();

  // Login real pela interface; nenhuma sessão ou dado é pré-semeado.
  await page.goto('/plataforma/acesso?mode=login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/plataforma\/admin/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Nova busca', exact: true })).toBeVisible();

  // A busca é iniciada pelo mesmo formulário utilizado pelo operador.
  await page.getByRole('button', { name: 'Nova busca', exact: true }).click();
  await page.locator('input[placeholder^="Ex: Barbearia"]').fill(niche);
  await page.locator('select').first().selectOption(state);
  await page.locator('input[placeholder="Digite a cidade..."]').fill(city);
  const runSearch = page.getByTestId('run-prospecting-search');
  await expect(runSearch).toBeEnabled();
  await runSearch.click();

  await expect(page.getByText(/Coleta concluída\./)).toBeVisible({ timeout: 180_000 });
  const inserted = Number((await page.getByTestId('search-inserted-count').textContent())?.trim() || 0);
  expect(inserted, 'A busca precisa produzir pelo menos um candidato novo; escolha um nicho/região ainda não coletado se todos forem duplicados.').toBeGreaterThan(0);

  // A qualificação, a geração e a publicação são tarefas duráveis no Worker.
  // Recarregamos a interface para confirmar a recuperação dos dados do Supabase.
  let targetName = '';
  let demoUrl = '';
  let selectedCard: ReturnType<typeof page.getByTestId> | null = null;

  for (let attempt = 0; attempt < 24 && !demoUrl; attempt++) {
    if (attempt > 0) await page.reload();
    await expect(page.getByRole('button', { name: 'CRM / Empresas', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'CRM / Empresas', exact: true }).click();

    const cards = page.getByTestId('lead-card');
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index);
      const createdAt = Date.parse((await card.getAttribute('data-lead-created-at')) || '');
      const phone = ((await card.getAttribute('data-phone')) || '').replace(/\D/g, '');
      if (!Number.isFinite(createdAt) || createdAt < startedAt - 60_000 || phone.length < 10 || phone.length > 15) continue;

      const publishedUrl = (await card.getAttribute('data-demo-url'))?.trim() || '';
      if (publishedUrl) {
        targetName = (await card.getAttribute('data-lead-name')) || '';
        demoUrl = publishedUrl;
        selectedCard = card;
        break;
      }
    }

    if (!demoUrl && attempt < 23) await page.waitForTimeout(15_000);
  }

  expect(demoUrl, 'O Worker não concluiu captura, qualificação, geração e publicação em até seis minutos.').toMatch(/^https:\/\//);
  expect(targetName).toBeTruthy();
  expect(selectedCard).not.toBeNull();

  // Abrir a ficha do lead e validar a mensagem pré-preenchida sem enviá-la.
  await selectedCard!.locator('h4').click();
  const preparedMessage = page.getByTestId('prepare-whatsapp-message').last();
  await expect(preparedMessage).toBeVisible();
  const whatsappUrl = await preparedMessage.getAttribute('href');
  expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\//);
  const whatsapp = new URL(whatsappUrl!);
  const messageText = whatsapp.searchParams.get('text') || '';
  expect(messageText).toContain(targetName);
  expect(messageText).toContain(demoUrl);
  expect(messageText).not.toMatch(/\{\{[^}]+\}\}/);
  // Não navegar para wa.me: o envio permanece sob ação humana.

  // Validar a demonstração em contexto de navegador limpo, sem sessão/localStorage do admin.
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const demoPage = await publicContext.newPage();
  try {
    await demoPage.goto(demoUrl);
    const templateNames = ['Ouro Clássico', 'Preto Esmeralda', 'Minimal Studio', 'Safira Executivo', 'Rubi Lounge'];
    for (const templateName of templateNames) {
      await expect(demoPage.getByRole('tab', { name: templateName })).toBeVisible({ timeout: 30_000 });
    }
    const firstTemplate = demoPage.getByRole('tab', { name: 'Ouro Clássico' });
    await firstTemplate.click();
    await expect(firstTemplate).toHaveAttribute('aria-selected', 'true');

    const outputDir = testInfo.outputPath('production-demo-captures');
    const sectionsDir = path.join(outputDir, 'sections');
    const framesDir = path.join(outputDir, 'frames');
    fs.mkdirSync(sectionsDir, { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const sections = demoPage.locator('section');
    let capturedSections = 0;
    for (let index = 0; index < await sections.count(); index++) {
      const section = sections.nth(index);
      if (!(await section.isVisible())) continue;
      const meta = await section.evaluate((element) => ({
        id: element.id || '',
        hasH1: Boolean(element.querySelector('h1')),
        heading: element.querySelector('h1,h2,h3')?.textContent?.trim() || '',
      }));
      let key = meta.id || (meta.hasH1 ? 'hero' : `section-${String(index + 1).padStart(2, '0')}`);
      key = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      await section.screenshot({ path: path.join(sectionsDir, `${key}.png`), animations: 'disabled' });
      capturedSections++;
    }
    expect(capturedSections).toBeGreaterThanOrEqual(4);

    await demoPage.evaluate(() => window.scrollTo(0, 0));
    await demoPage.screenshot({ path: path.join(outputDir, 'ouro-classico-full.png'), fullPage: true, animations: 'disabled' });

    const height = await demoPage.evaluate(() => document.documentElement.scrollHeight);
    const viewport = demoPage.viewportSize()?.height ?? 900;
    const maxScroll = Math.max(0, height - viewport);
    const step = Math.max(420, Math.floor(viewport * 0.72));
    let frame = 0;
    for (let y = 0; y <= maxScroll; y += step) {
      await demoPage.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await demoPage.waitForTimeout(180);
      await demoPage.screenshot({ path: path.join(framesDir, `frame-${String(frame).padStart(3, '0')}.png`), animations: 'disabled' });
      frame++;
    }
    execFileSync('ffmpeg', [
      '-y', '-framerate', '2', '-i', path.join(framesDir, 'frame-%03d.png'),
      '-filter_complex', '[0:v]fps=2,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer',
      '-loop', '0', path.join(outputDir, 'ouro-classico-scroll.gif'),
    ], { stdio: 'pipe' });
  } finally {
    await publicContext.close();
  }
});
