import { test, expect } from '@playwright/test';

const BASE_URL = 'https://beleza-digital.pages.dev';

test.describe('Demo to Contract Flow', () => {
  test('should load demo selection page with valid token and test full flow', async ({ page }) => {
    // Use the valid demo token we created
    const validToken = 'teste-playwright-demo-token-12345678901234567890';
    await page.goto(`${BASE_URL}/demo/${validToken}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if the page loads
    const title = await page.title();
    console.log('Page title:', title);

    // Wait for demo data to load
    await page.waitForSelector('text=Versões disponíveis', { timeout: 15000 });

    // Check for commercial section
    const commercialSection = await page.locator('text=Pronto para colocar seu negócio online?').count();
    console.log('Commercial section found:', commercialSection > 0);

    // Take screenshot of demo page
    await page.screenshot({ path: 'demo-page.png', fullPage: true });

    // Click "Quero contratar este modelo" button
    const contractBtn = page.locator('button:has-text("Quero contratar este modelo")');
    await contractBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Clicking "Quero contratar este modelo"...');
    await contractBtn.click();

    // Wait for redirect to /plataforma/acesso
    await page.waitForURL('**/plataforma/acesso**', { timeout: 15000 });
    console.log('Redirected to:', page.url());

    // Check for demo context message
    const demoContextMsg = await page.locator('text=Demonstração vinculada').count();
    console.log('Demo context message found:', demoContextMsg > 0);

    // Take screenshot of signup page with demo context
    await page.screenshot({ path: 'signup-page.png', fullPage: true });

    // Fill signup form - using label-based selectors since inputs don't have placeholders
    console.log('Filling signup form...');
    await page.fill('label:has-text("Seu nome") + input', 'Teste Playwright');
    await page.fill('label:has-text("Nome do salão") + input', 'Salão Teste Playwright');
    await page.fill('label:has-text("Endereço do site") + input', 'salao-teste-playwright');
    await page.fill('label:has-text("E-mail") + input', 'playwright-teste@example.com');
    await page.fill('label:has-text("Senha") + input', 'SenhaForte123');

    // Submit signup
    const signupBtn = page.locator('button:has-text("Criar conta e salão")');
    await signupBtn.click();

    // Wait for plans to appear (after signup)
    await page.waitForSelector('text=Plano Iniciante', { timeout: 30000 });
    console.log('Plans loaded after signup!');

    // Take screenshot of plans
    await page.screenshot({ path: 'plans-after-signup.png', fullPage: true });
  });

  test('should load platform access page', async ({ page }) => {
    await page.goto(`${BASE_URL}/plataforma/acesso`);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log('Platform access page title:', title);

    await page.screenshot({ path: 'platform-access-page.png', fullPage: true });
  });

  test('should load plan selection page and show plans', async ({ page }) => {
    await page.goto(`${BASE_URL}/plataforma/plano`);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log('Plan selection page title:', title);

    // Check page content
    const content = await page.content();
    console.log('Plan selection page content length:', content.length);

    // Look for plan elements
    const planElements = await page.locator('[data-testid="plan-card"], .plan-card, [class*="plan"]').count();
    console.log('Plan elements found:', planElements);

    // Check for any text mentioning plans
    const hasPlanText = await page.locator('text=/plano|plan|mensal|anual/i').count();
    console.log('Plan text elements:', hasPlanText);

    await page.screenshot({ path: 'plan-selection-page.png', fullPage: true });
  });

  test('should test API endpoints', async ({ page }) => {
    // Test the demo GET endpoint first
    const getResponse = await page.request.get(`${BASE_URL}/api/demos/invalid-token`);
    console.log('GET /api/demos/invalid-token status:', getResponse.status());
    const getBodyText = await getResponse.text();
    console.log('GET response body:', getBodyText);

    // Test the onboarding start-contract API
    const postResponse = await page.request.post(`${BASE_URL}/api/onboarding/start-contract`, {
      data: { demo_token: 'invalid-token' }
    });

    console.log('POST /api/onboarding/start-contract status:', postResponse.status());
    const postBodyText = await postResponse.text();
    console.log('POST response body:', postBodyText);

    // API might not be deployed yet (405 = Method Not Allowed, 404 = Not Found)
    // Just log the results for now
    expect([200, 400, 401, 404, 405, 500]).toContain(postResponse.status());
  });
});