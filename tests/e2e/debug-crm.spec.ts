import { test, expect } from '@playwright/test';

test('debug CRM page', async ({ page }) => {
  // Navigate to login
  await page.goto('https://beleza-digital.pages.dev/plataforma/acesso?mode=login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Fill login
  await page.fill('input[type="email"]', 'olfnetto@gmail.com');
  await page.fill('input[type="password"]', 'Netto@964212$');
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  await page.waitForURL('**/plataforma/admin', { timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Go to prospection
  await page.click('text=Nova busca');
  await page.waitForSelector('text=Encontre quem precisa do que você vende', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Fill form
  await page.fill('input[placeholder*="Barbearia"]', 'Barbearia');
  await page.selectOption('select', 'SP');
  await page.fill('input[placeholder*="Digite a cidade"]', 'São Paulo');
  
  // Click search
  await page.click('button:has-text("Buscar 5 empresas")');
  await page.waitForLoadState('networkidle');
  
  // Wait for API response
  const apiResponse = await page.waitForResponse(async (response) => {
    return response.url().includes('/api/prospecting/run') && response.request().method() === 'POST';
  });
  console.log('API Response status:', apiResponse.status());
  const body = await apiResponse.json();
  console.log('API Response keys:', Object.keys(body));
  const bodyStr = JSON.stringify(body);
  console.log('API Response body (first 500):', bodyStr.substring(0, 500));
  
  // Now go to CRM
  await page.click('text=CRM');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  
  const url = page.url();
  console.log('CRM URL:', url);
  
  // Check page content
  const bodyEL = page.locator('body');
  const innerHTML = await bodyEL.innerHTML();
  console.log('CRM innerHTML length:', innerHTML.length);
  console.log('Has "Evidencias Técnicas":', innerHTML.includes('Evidencias Técnicas'));
  console.log('Has "evidencias" (lower):', innerHTML.toLowerCase().includes('evidencias'));
  console.log('Has "technical" (lower):', innerHTML.toLowerCase().includes('technical'));
  console.log('First 500 chars:', innerHTML.substring(0, 500));
  
  // Check for any text content
  const textContent = await page.textContent('body');
  console.log('Body text length:', textContent?.length);
  if (textContent) {
    console.log('Has "campanha":', textContent.includes('campanha') || textContent.includes('Campanha'));
    console.log('Has "lead":', textContent.includes('lead') || textContent.includes('Lead'));
    console.log('Has "empresa":', textContent.includes('empresa') || textContent.includes('Empresa'));
  }
});
