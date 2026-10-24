import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Fase 0 — Dashboard administrativo (regressão)', () => {

  test('página de acesso renderiza com opções de login', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`${BASE}/plataforma/acesso`, { waitUntil: 'domcontentloaded' });
    // O PlatformAccessPage renderiza "Entrar na plataforma" (modo login padrão) ou "Criar conta"
    await expect(page.getByRole('heading', { name: /Entrar na plataforma|Criar conta/ })).toBeVisible();
    await expect(page.getByLabel(/E-mail/)).toBeVisible();
    await expect(page.getByLabel(/Senha/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rota /plataforma/admin redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto(`${BASE}/plataforma/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // O wrapper verifica a sessão Supabase; sem sessão, redireciona para /plataforma/acesso
    await expect(page).toHaveURL(/.*plataforma\/acesso/);
  });

  test('rota /admin redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*plataforma\/acesso/);
  });

  test('rota /plataforma/prospeccao redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto(`${BASE}/plataforma/prospeccao`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*plataforma\/acesso/);
  });

  test('responsividade: página de acesso acessível em mobile', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/plataforma/acesso`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Entrar na plataforma|Criar conta/ })).toBeVisible();
    await expect(page.getByLabel(/E-mail/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('site público carrega sem erros críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main')).toBeVisible();
    expect(errors).toEqual([]);
  });

});
