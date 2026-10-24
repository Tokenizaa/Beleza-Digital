import { test, expect } from '@playwright/test';

// Testes publicados (ambiente Cloudflare ao vivo).
// Validação sem credenciais de usuário: não há login autorizado/logout/sidebar
// porque exigem uma sessão Supabase real (credenciais não disponíveis a este
// executor — não são inventadas nem criadas usuários de produção).
const BASE = 'https://f0b783cf.beleza-digital.pages.dev';

test.describe('Fase 0 — Dashboard administrativo (publicado)', () => {
  test('site público carrega sem erros críticos de console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Salão Modelo' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('página de acesso renderiza formulário de login (comportamento de login)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE}/plataforma/acesso`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Entrar na plataforma|Criar conta/ })).toBeVisible();
    await expect(page.getByLabel(/E-mail/)).toBeVisible();
    await expect(page.getByLabel(/Senha/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rotas administrativas bloqueiam acesso sem sessão (redirecionam para login)', async ({ page }) => {
    for (const rota of ['/plataforma/admin', '/admin', '/plataforma/prospeccao']) {
      await page.goto(`${BASE}${rota}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/.*plataforma\/acesso/);
    }
  });
});
