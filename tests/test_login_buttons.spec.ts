import { test, expect } from '@playwright/test';

test('test login buttons in navbar and mobile', async ({ page }) => {
  await page.goto('https://f0b783cf.beleza-digital.pages.dev', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Desktop
  const maisButton = page.locator('button[aria-label="Abrir opções adicionais"]');
  if (await maisButton.count() > 0 && await maisButton.isVisible()) {
    await maisButton.click();
    await page.waitForTimeout(1000);
    
    const adminBtn = page.locator('button:has-text("Área administrativa")');
    console.log('Desktop admin:', await adminBtn.count(), await adminBtn.isVisible());
    
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await page.waitForTimeout(2000);
      const toast = page.locator('text=Faça login');
      console.log('Desktop toast:', await toast.count(), await toast.isVisible());
    }
  }
  
  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('https://f0b783cf.beleza-digital.pages.dev', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const moreBtn = page.locator('nav button:has-text("Mais")').last();
  if (await moreBtn.count() > 0 && await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.waitForTimeout(1000);
    
    const adminBtnMobile = page.locator('button:has-text("Área Administrativa")');
    console.log('Mobile admin:', await adminBtnMobile.count(), await adminBtnMobile.isVisible());
    
    if (await adminBtnMobile.isVisible()) {
      await adminBtnMobile.click();
      await page.waitForTimeout(2000);
      const toast = page.locator('text=Faça login');
      console.log('Mobile toast:', await toast.count(), await toast.isVisible());
    }
  }
});
