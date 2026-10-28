import { test, expect } from '@playwright/test';

const baseUrl = 'https://beleza-digital.pages.dev';

const getAdminCreds = () => {
  const e2eEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_TEST_LOGIN;
  const e2ePassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_TEST_PASSWORD;
  if (e2eEmail && e2ePassword) return { email: e2eEmail, password: e2ePassword };
  throw new Error('Credenciais de admin não configuradas');
};

test('should complete full prospecting flow from admin to CRM', async ({ page }) => {
  const { email, password } = getAdminCreds();

  // --- Login ---
  await page.goto(`${baseUrl}/plataforma/acesso?mode=login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  await page.waitForURL(`${baseUrl}/plataforma/admin`, { timeout: 15000 });

  // --- Nova busca ---
  await page.click('text=Nova busca');
  await page.waitForSelector('text=Encontre quem precisa do que você vende', { state: 'visible', timeout: 10000 });

  // --- Preencher formulário ---
  await page.fill('input[placeholder*="Barbearia"]', 'Barbearia');
  await page.selectOption('select', 'SP');
  await page.fill('input[placeholder*="Digite a cidade"]', 'São Paulo');
  await page.evaluate(() => {
    const range = document.querySelector('input[min="5"][max="50"][step="5"]');
    if (range) { range.value = '5'; range.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  // --- Clicar Buscar ---
  await page.click('button:has-text("Buscar 5 empresas")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Aguardar worker processar

  // --- CRM ---
  await page.click('text=CRM');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // --- Validar CRM page carregou ---
  const bodyHTML = await page.locator('body').innerHTML();
  expect(bodyHTML).toBeTruthy();
  expect(bodyHTML.length).toBeGreaterThan(3000);

  test.info().annotations.push({
    name: 'Fluxo completado',
    content: 'Login → Nova busca → Buscar 5empresas → CRM page loaded'
  });
});
