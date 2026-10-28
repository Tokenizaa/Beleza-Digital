import { test, expect } from '@playwright/test';

test('debug select options', async ({ page }) => {
  // Navigate to login
  await page.goto('https://beleza-digital.pages.dev/plataforma/acesso?mode=login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Fill login form
  await page.fill('input[type="email"]', 'olfnetto@gmail.com');
  await page.fill('input[type="password"]', 'Netto@964212$');
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check if redirected to admin
  const url = page.url();
  console.log('Current URL:', url);
  
  // If on login page, wait a bit more
  if (url.includes('mode=login') || url.includes('/acesso')) {
    await page.waitForTimeout(5000);
    const url2 = page.url();
    console.log('URL after wait:', url2);
  }
  
  // Try navigating to admin
  await page.goto('https://beleza-digital.pages.dev/plataforma/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Now click Nova busca
  await page.click('text=Nova busca');
  await page.waitForSelector('text=Encontre quem precisa do que você vende', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Find the select for Estado
  const selects = page.locator('select');
  const selectCount = await selects.count();
  console.log('Number of select elements:', selectCount);
  
  for (let i = 0; i < selectCount; i++) {
    const select = selects.nth(i);
    const id = await select.getAttribute('id');
    const name = await select.getAttribute('name');
    const className = await select.getAttribute('class');
    console.log(`Select ${i}: id="${id}", name="${name}", class="${className}"`);
    
    // Get options
    const options = select.locator('option');
    const optionCount = await options.count();
    console.log(`  Options count: ${optionCount}`);
    for (let j = 0; j < optionCount; j++) {
      const optValue = await options.nth(j).getAttribute('value');
      const optText = await options.nth(j).textContent();
      console.log(`  Option ${j}: value="${optValue}", text="${optText?.trim()}"`);
    }
  }
  
  // Also check inputs with placeholder
  const inputs = page.locator('input[placeholder]');
  const inputCount = await inputs.count();
  console.log('Inputs with placeholder:', inputCount);
  
  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i);
    const ph = await input.getAttribute('placeholder');
    const type = await input.getAttribute('type');
    console.log(`Input ${i}: type="${type}", placeholder="${ph}"`);
  }
});
