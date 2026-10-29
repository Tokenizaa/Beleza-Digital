import { test, expect, type Page } from '@playwright/test';

const BASE_URL = (process.env.E2E_BASE_URL || 'https://beleza-digital.pages.dev').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

async function loginAsPlatformAdmin(page: Page) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Secrets de E2E admin ausentes no job.');
  await page.goto(`${BASE_URL}/plataforma/acesso?mode=login`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await page.waitForURL(url => url.pathname === '/plataforma/admin', { timeout: 25_000 });
  await expect(page.getByText('Prospecção & Raspagem', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
}

test.describe('Produção — autenticação e páginas de prospecção', () => {
  test('rotas protegidas bloqueiam visitantes sem sessão', async ({ browser }) => {
    const protectedRoutes = ['/plataforma/admin', '/plataforma/prospeccao', '/plataforma/crm', '/plataforma/leads', '/prospeccao', '/admin'];
    for (const route of protectedRoutes) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(url => url.pathname === '/plataforma/acesso', { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get('mode')).toBe('login');
      await context.close();
    }
  });

  test('login real e inspeção de Nova Busca, CRM e Console de Scraping', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !/favicon|third-party cookie|net::ERR_BLOCKED_BY_CLIENT/i.test(message.text())) consoleErrors.push(message.text());
    });
    await loginAsPlatformAdmin(page);

    await page.getByRole('button', { name: 'Nova Busca & Raspagem' }).click();
    await expect(page.getByRole('heading', { name: 'Encontre quem precisa do que você vende.' })).toBeVisible();
    await expect(page.getByPlaceholder(/Barbearia, Salão de Beleza, Clínica Estética/i)).toBeVisible();

    await page.getByRole('button', { name: 'Pipeline CRM & Empresas' }).click();
    await expect(page.getByPlaceholder('Buscar empresa...')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Supabase não está configurado|Não foi possível carregar empresas persistidas|A tabela de estado do CRM não está acessível/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Console de Scraping' }).click();
    await expect(page.getByRole('heading', { name: 'Central de prospecção' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Histórico de execuções' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar scraping' })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('executa uma busca real controlada e verifica o backend', async ({ page }) => {
    test.setTimeout(150_000);
    await loginAsPlatformAdmin(page);
    await page.getByRole('button', { name: 'Console de Scraping' }).click();
    await expect(page.getByRole('heading', { name: 'Central de prospecção' })).toBeVisible();
    await page.getByPlaceholder('Nome do projeto de prospecção').fill(`E2E produção ${new Date().toISOString().slice(0, 10)}`);
    await page.getByPlaceholder('Ex.: salão de beleza').fill('Barbearia');
    await page.getByPlaceholder(/salões de beleza, manicures, clínicas de estética/i).fill('barbearias');
    await page.getByLabel(/Estado \(UF\)/).selectOption('RS');
    await page.getByPlaceholder('Digite a cidade').fill('Porto Alegre');
    await page.getByLabel(/6\. Limite de resultados/).selectOption('10');

    const tasks = page.locator('p').filter({ hasText: /^#\d+ ·/ });
    const before = await tasks.count();
    const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/prospecting/run', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Iniciar scraping' }).click();
    const response = await responsePromise;
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    expect([200, 202]).toContain(response.status());
    expect(body.error).toBeUndefined();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect.poll(() => tasks.count(), { timeout: 30_000 }).toBeGreaterThan(before);
  });
});
