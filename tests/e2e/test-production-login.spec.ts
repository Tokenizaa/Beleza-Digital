import { test, expect } from '@playwright/test';

test('production login test', async ({ page }) => {
  // Navigate to production login
  await page.goto('https://beleza-digital.pages.dev/plataforma/acesso?mode=login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  
  // Check body
  const body = page.locator('body');
  const innerHTML = await body.innerHTML();
  console.log('InnerHTML length:', innerHTML.length);
  console.log('Has "E-mail":', innerHTML.includes('E-mail'));
  console.log('Has "email":', innerHTML.includes('email'));
  console.log('Has "Senha":', innerHTML.includes('Senha'));
  console.log('Has "password":', innerHTML.includes('password'));
  console.log('Has "Entrar":', innerHTML.includes('Entrar'));
  console.log('Has "root":', innerHTML.includes('id="root"'));
  
  // Try finding inputs any way
  const allInputs = page.locator('input');
  console.log('Input count:', await allInputs.count());
  
  // Try pressing tab to focus elements
  await page.waitForTimeout(2000);
  
  // Check if we can find anything with text
  const textContent = await page.textContent('body');
  console.log('Body text length:', textContent?.length);
  if (textContent) {
    console.log('Has "Buscar":', textContent.includes('Buscar'));
    console.log('Has "Nicho":', textContent.includes('Nicho') || textContent.includes('nicho'));
  }
});
