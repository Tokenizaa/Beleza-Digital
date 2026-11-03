/**
 * === TESTE REAL DE ACESSO PRODUÇÃO COM ADMIN ===
 * 
 * Demonstra acesso real à produção usando:
 * - URL: https://beleza-digital.olfnetto.workers.dev
 * - Browser HEADLESS=false (visível)
 * 
 * Rodar com: HEADLESS=false npx playwright test tests/production-scrape-demo.test.ts
 */

import { test, expect } from '@playwright/test';

const PROD_URL = 'https://beleza-digital.olfnetto.workers.dev';

test('🔍 Acesso produção - browser visível', async ({ page }) => {
  // === ETAPA 1: Acessar produção ===
  await test.step('Acessar URL de produção', async () => {
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    // A página carrega com título da plataforma
    await expect(page).toHaveTitle(/Plataforma/);
    console.log('✅ Produção acessada com sucesso:', PROD_URL);
    
    // Capturar screenshot da página inicial
    await page.screenshot({ path: 'test-results/production-step1-inicial.png', fullPage: true });
    console.log('📸 Screenshot Step 1 - página inicial capturado');
  });

  // === ETAPA 2: Explorar página inicial ===
  await test.step('Explorar elementos da página inicial', async () => {
    // Verificar título da página
    const pageTitle = await page.title();
    console.log('📄 Título da página:', pageTitle);
    
    // Contar links e botões visibles
    const links = await page.locator('a').count();
    const buttons = await page.locator('button').count();
    console.log('🔗 Links encontrados:', links);
    console.log('🔘 Botões encontrados:', buttons);
    
    // Capturar screenshot
    await page.screenshot({ path: 'test-results/production-step2-elementos.png', fullPage: true });
    console.log('📸 Screenshot Step 2 - elementos capturado');
  });

  // === ETAPA 3: Tentar login admin (try/catch) ===
  await test.step('Tentar acesso administrativo', async () => {
    // Navegar para rota de login/onboarding
    await page.goto(`${PROD_URL}/plataforma/acesso`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Tentar encontrar campos de login (tentativas múltiplas)
    const fieldTypes = [
      'input[type="email"]',
      'input[name="email"]', 
      'input[placeholder*="email" i]',
      'input[placeholder*="E-mail" i]',
      'input[type="text"]'
    ];
    
    let emailField = null;
    for (const selector of fieldTypes) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        emailField = page.locator(selector).first();
        console.log('📝 Campo email encontrado com seletor:', selector);
        break;
      }
    }
    
    let passwordField = null;
    const passTypes = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="senha" i]',
      'input[placeholder*="Senha" i]'
    ];
    
    for (const selector of passTypes) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        passwordField = page.locator(selector).first();
        console.log('🔒 Campo senha encontrado com seletor:', selector);
        break;
      }
    }
    
    // Preencher se encontrou os campos
    if (emailField && passwordField) {
      await emailField.fill('olfnetto@gmail.com');
      await passwordField.fill('Netto@964212$');
      console.log('✅ Credenciais preenchidas');
      
      // Tentar submeter
      const buttonTypes = [
        'button:has-text("Entrar")',
        'button:has-text("Login")',
        'button[type="submit"]',
        '[data-testid="login-btn"]'
      ];
      
      let clicked = false;
      for (const btnSelector of buttonTypes) {
        const btnCount = await page.locator(btnSelector).count();
        if (btnCount > 0) {
          await page.locator(btnSelector).first().click();
          clicked = true;
          console.log('🔘 Botão clicado:', btnSelector);
          break;
        }
      }
      
      if (clicked) {
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/production-step3-login-submitted.png', fullPage: true });
        console.log('✅ Login submetido - aguardando redirecionamento');
      }
    } else {
      console.log('⚠️ Campos de login não encontrados (pode ser layout diferente)');
      await page.screenshot({ path: 'test-results/production-step3-nao-encontrados.png', fullPage: true });
    }
    
    // Verificar URL atual após tentativas
    const currentUrl = page.url();
    console.log('📍 URL final:', currentUrl);
  });

  // === RODAPA ===
  await test.step('Finalizar teste de produção', async () => {
    console.log('='.repeat(60));
    console.log('🏁 TESTE PRODUÇÃO CONCLUÍDO');
    console.log('='.repeat(60));
    console.log('🌐 URL testada:', PROD_URL);
    console.log('👁️ Modo: Browser HEADLESS=false (visível)');
    console.log('📸 Evidências em test-results/');
    console.log('='.repeat(60));
  });
});