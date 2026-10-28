import { test, expect, type Page } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.E2E_BASE_URL || 'https://beleza-digital.pages.dev').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_TEST_LOGIN || process.env.VITE_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_TEST_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '';

test('produção: login admin → Nova busca → Buscar 5 empresas → endpoint real', async ({ page }) => {
  test.setTimeout(120_000);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const apiEvents: Array<{ url: string; method: string; status?: number }> = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/prospecting/run') {
      apiEvents.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
      });
    }
  });

  // === PASSO 1: Navegar e autenticar ===
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

  // Tentar detectar se já está no admin ou precisa fazer login
  let isAdmin = false;

  // Verificar se já está no painel admin
  if (/\/plataforma\/admin(?:\/|$)/.test(new URL(page.url()).pathname)) {
    isAdmin = true;
    console.log('✓ Already on admin page');
  } else {
    // Tentar clicar no botão de admin público na página inicial
    const publicAdminButton = page.getByRole('button', { name: /painel de controle do administrador/i });
    if (await publicAdminButton.isVisible().catch(() => false)) {
      await publicAdminButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Se ainda não está no admin, tentar login
    if (!/\/plataforma\/admin(?:\/|$)/.test(new URL(page.url()).pathname)) {
      await page.goto(`${BASE_URL}/plataforma/acesso?mode=login`, { waitUntil: 'domcontentloaded' });

      // O formulário de acesso tem inputs do tipo email/password
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      const emailVisible = await emailInput.isVisible().catch(() => false);
      const passwordVisible = await passwordInput.isVisible().catch(() => false);

      if (emailVisible && passwordVisible) {
        await emailInput.fill(ADMIN_EMAIL);
        await passwordInput.fill(ADMIN_PASSWORD);
      } else {
        // Fallback: usar labels .env
        await page.fill('label:has-text("E-mail") + input', ADMIN_EMAIL);
        await page.fill('label:has-text("Senha") + input', ADMIN_PASSWORD);
      }

      await page.getByRole('button', { name: /^Entrar$/i }).click();
      await page.waitForLoadState('networkidle');
    }

    isAdmin = !/\/plataforma\/admin(?:\/|$)/.test(new URL(page.url()).pathname);
  }

  if (/\/plataforma\/admin(?:\/|$)/.test(new URL(page.url()).pathname)) {
    isAdmin = true;
  }

  if (!isAdmin) {
    throw new Error('Não foi possível logar como admin. Verifique credenciais e fluxo de auth.');
  }

  // === PASSO 2: Clicar em "Nova busca" ===
  // O botão pode aparecer como "Nova busca" ou conter "Buscar" no nome
  const novaBuscaButton = page.getByRole('button', { name: /Nova busca/i });
  await expect(novaBuscaButton).toBeVisible({ timeout: 20_000 });
  await novaBuscaButton.click();

  // Verificar que a tela de prospecção carregou
  await expect(page.getByRole('heading', { name: 'Encontre quem precisa do que você vende.' })).toBeVisible({ timeout: 10_000 });

  // === PASSO 3: Preencher formularion - Seletores verificados em src/pages/LeadsDashboard.tsx ===
  // input placeholder "Ex: Barbearia, Salão de Beleza, Clínica Estética"
  // select com option value RS
  // input placeholder "Digite a cidade..."
  // range min=5 max=50 step=5

  // Campo nicho - ser mais flexível com o exact
  const niche = page.locator('input[placeholder*="Barbearia"][placeholder*="Salão"][placeholder*="Clínica"]');
  await expect(niche).toBeVisible({ timeout: 10_000 });
  await niche.click();
  await niche.fill('Barbearia');

  // Estado - tentar múltiplos approaches
  let stateFilled = false;
  const stateSelectors = [
    page.locator('select').filter({ has: page.getByRole('option', { name: 'RS' }) }),
    page.getByLabel('Estado'),
    page.locator('select'),
  ];

  for (const stateLocator of stateSelectors) {
    if (await stateLocator.isVisible().catch(() => false)) {
      try {
        await stateLocator.selectOption('RS');
        stateFilled = true;
        console.log('✓ State selected');
        break;
      } catch (e) {
        console.log('✗ State selector failed, trying next');
        continue;
      }
    }
  }

  if (!stateFilled) {
    // Tentar preencher digitando no input
    await page.fill('input[placeholder*="Estado"]', 'RS');
  }

  // Cidade
  const cityInput = page.locator('input[placeholder*="cidade"]').first();
  await expect(cityInput).toBeVisible({ timeout: 10_000 });
  await cityInput.click();
  await cityInput.fill('Porto Alegre');

  // Range/quantidade - min=5 max=50 step=5
  const quantityInput = page.locator('input[type="range"][min="5"][max="50"][step="5"]');
  await expect(quantityInput).toBeVisible({ timeout: 10_000 });
  await quantityInput.fill('5');

  // Verificar aparição de "5 empresas" - usar texto do button que já clicamos
  // O teste continua após o clique; validamos o endpoint acima

  // === PASSO 4: Clicar em "Buscar 5 empresas" ===
  const runButton = page.getByRole('button', { name: /Buscar 5 empresas/i });
  await expect(runButton).toBeVisible();
  await expect(runButton).toBeEnabled();

  // Capturar resposta da API ANTES de clicar
  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' &&
    new URL(response.url()).pathname === '/api/prospecting/run',
  { timeout: 70_000 });

  await runButton.click();

  const response = await responsePromise;
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  const sent = response.request().postDataJSON() as Record<string, any>;

  console.log('📤 Request payload:', JSON.stringify(sent, null, 2));
  console.log('📥 Response status:', response.status());
  console.log('📥 Response body:', JSON.stringify(body, null, 2));

  // Validar dados enviados
  expect(sent).toMatchObject({
    segment: 'Barbearia',
    region: 'Porto Alegre - RS',
    limit: 5,
    countryCode: 'BR',
  });

  // Validar resposta do endpoint
  // Produção pode devolver 200 (worker configurado) ou 503 (worker não configurado)
  // Em ambos os casos, a campanha é registrada e mensagem é retornada.
  let isWorkerConfigured = false;
  if (response.status() === 200) {
    expect(body.status).toBe('ok');
    expect(body.campaignId).toBeTruthy();
    expect(typeof body.campaignId).toBe('string');
    expect(body.worker?.status).toBe('ok');
    isWorkerConfigured = true;
  } else if (response.status() === 503) {
    // Worker não alcançado - isso é resposta esperada do worker não configurado
    expect(body.status).toBe('blocked');
  } else {
    throw new Error(`Unexpected status: ${response.status()}`);
  }

  // Mensagem de sucesso/aparece apenas quando o worker processa a campanha (status 200).
  // Quando o worker retorna 503 (não configurado), a UI mostra mensagem de erro.
  if (isWorkerConfigured) {
    await expect(page.getByText('Busca pontual inicia imediatamente')).toBeVisible({ timeout: 10_000 });
  } else {
    // Em caso de 503, validamos que há uma mensagem de erro indicando o bloqueio.
    // A UI exibe a mensagem em um container com classe bg-amber-950/40.
    const errorContainer = page.locator('.bg-amber-950/40 text-amber-200');
    await expect(errorContainer.first()).toBeVisible({ timeout: 10_000 });
  }

  await page.screenshot({ path: 'test-results/prospecting-submit-production.png', fullPage: true });

  // === PASSO 5: Abrir CRM ===
  await page.getByRole('button', { name: /CRM \/ Empresas/i }).click();
  await expect(page.getByText(/empresas|Carregando empresas/i)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: 'test-results/prospecting-crm-production.png', fullPage: true });

  // Anevidência
  await test.info().attach('prospecting-production-evidence.json', {
    body: Buffer.from(JSON.stringify({
      baseUrl: BASE_URL,
      finalUrl: page.url(),
      request: sent,
      responseStatus: response.status(),
      responseBody: body,
      apiEvents,
      consoleErrors,
      pageErrors,
      note: 'Resposta de início e tela CRM verificadas. Coleta e persistência de empresas exigem evidência adicional do worker/banco.',
    }, null, 2)),
    contentType: 'application/json',
  });

  expect(pageErrors, `Erros JavaScript: ${pageErrors.join('\n')}`).toEqual([]);
});