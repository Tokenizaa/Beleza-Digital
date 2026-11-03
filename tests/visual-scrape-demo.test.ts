/**
 * === TESTE VISUAL E2E HEADLESS=false ===
 * 
 * Demonstrates Playwright test running with browser visibly open.
 * Useful for: demos, debugging, visual regression, onboarding new team members.
 * 
 * Rodar com: HEADLESS=false npx playwright test tests/visual-scrape-demo.test.ts
 * 
 * Características:
 * - Browser Chromium aberto visível durante toda a execução
 * - Screenshots de evidência em test-results/
 * - Logs console mostrando passos executados visualmente
 * - Pode ser interrompido a qualquer momento (Ctrl+C)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3002';

test('👁️ E2E HEADLESS=false: browser aberto visível', async ({ page }) => {
  const steps = [];

  // --- ETAPA 1: Acessar aplicação ---
  await test.step('Step 1: Acessar página inicial', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Plataforma/);
    steps.push('✅ Página inicial carregada');
    console.log('🔍 [VISUAL] Browser: página inicial aberta e visível');
    
    // Screenshot evidência do browser aberto
    await page.screenshot({ path: 'test-results/evidence-step1.png', fullPage: true });
    console.log('📸 [EVÍDENCIA] Screenshot step 1 capturado');
  });

  // --- ETAPA 2: Explorar rotas ---
  await test.step('Step 2: Explorar rotas da aplicação', async () => {
    // Tentar navegar para rota de onboarding
    try {
      await page.goto(`${BASE}/plataforma/acesso`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      steps.push('✅ Rota /plataforma/acesso acessada');
      console.log('🔍 [VISUAL] Browser: navegou para tela de onboarding');
    } catch (e) {
      steps.push('⚠️ Rota /plataforma/acesso não disponível (routing differ)');
      console.log('🔍 [VISUAL] Browser: permanecendo na página inicial - routing diferente');
    }
    
    // Capturar screenshot após navegação
    await page.screenshot({ path: 'test-results/evidence-step2.png', fullPage: true });
    console.log('📸 [EVÍDENCIA] Screenshot step 2 capturado');
  });

  // --- ETAPA 3: Coletar informações da página ---
  await test.step('Step 3: Coletar dados da página', async () => {
    const url = page.url();
    const title = await page.title();
    const viewport = await page.viewportSize();
    
    steps.push(`✅ URL: ${url}`);
    steps.push(`✅ Título: ${title}`);
    steps.push(`✅ Viewport: ${viewport?.width}x${viewport?.height}`);
    
    console.log('🔍 [VISUAL] Dados coletados:');
    console.log(`   - URL completa: ${url}`);
    console.log(`   - Título da página: ${title}`);
    console.log(`   - Dimensões do viewport: ${viewport?.width}x${viewport?.height}`);
    
    // Screenshot com informações overlay
    await page.screenshot({ path: 'test-results/evidence-step3.png', fullPage: true });
    console.log('📸 [EVÍDENCIA] Screenshot step 3 com dados da página');
  });

  // --- ETAPA 4: Interagir (opcional) ---
  await test.step('Step 4: Interação opcional com página', async () => {
    // Contar elementos visíveis na página
    const bodyText = await page.locator('body').textContent();
    const elementCount = await page.locator('*').count();
    
    steps.push(`✅ Elementos totais no DOM: ${elementCount}`);
    steps.push(`✅ Text do body: ${bodyText?.substring(0, 100)}...`);
    
    console.log('🔍 [VISUAL] Informações do DOM:');
    console.log(`   - Total de elementos HTML: ${elementCount}`);
    console.log(`   - Texto do body (primeiros 100 chars): ${bodyText?.substring(0, 100)}...`);
    
    await page.waitForTimeout(1500); // Pausa visual para observação
    await page.screenshot({ path: 'test-results/evidence-step4.png', fullPage: true });
    console.log('📸 [EVÍDENCIA] Screenshot step 4 capturado');
  });

  // --- RODAPA ---
  await test.step('🏁 Finalização: evidência completa', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 RESUMO EXECUÇÃO HEADLESS=false');
    console.log('='.repeat(60));
    steps.forEach(step => console.log(`   ${step}`));
    console.log('\n📋 Arquivos de evidência gerados:');
    console.log('   - test-results/evidence-step1.png');
    console.log('   - test-results/evidence-step2.png');
    console.log('   - test-results/evidence-step3.png');
    console.log('   - test-results/evidence-step4.png');
    console.log('\n💡 Dica: Para modo headless (CI), remova HEADLESS=false');
    console.log('='.repeat(60) + '\n');
  });
});