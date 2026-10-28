const { chromium } = require('/home/lg/workspace/projects/Barbearia-Estetica-Yehua/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('=== NAVIGATING TO http://localhost:3000 ===');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  console.log('=== PAGE TITLE ===');
  console.log(await page.title());
  
  console.log('=== NAVBAR ===');
  const navbar = page.locator('nav');
  if (await navbar.count() > 0) {
    console.log('Navbar found, text:', await navbar.textContent());
  }
  
  console.log('=== BUTTONS ===');
  const buttons = page.locator('button');
  const buttonCount = await buttons.count();
  console.log('Total buttons:', buttonCount);
  for (let i = 0; i < Math.min(buttonCount, 20); i++) {
    const btn = buttons.nth(i);
    const text = await btn.textContent();
    const className = await btn.getAttribute('class');
    console.log(`Button ${i}: text="${text}", class="${className}"`);
  }
  
  console.log('=== INPUTS ===');
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log('Total inputs:', inputCount);
  for (let i = 0; i < Math.min(inputCount, 20); i++) {
    const inp = inputs.nth(i);
    const type = await inp.getAttribute('type');
    const placeholder = await inp.getAttribute('placeholder');
    console.log(`Input ${i}: type="${type}", placeholder="${placeholder}"`);
  }
  
  console.log('=== SELECT ELEMENTS ===');
  const selects = page.locator('select');
  const selectCount = await selects.count();
  console.log('Total selects:', selectCount);
  for (let i = 0; i < Math.min(selectCount, 10); i++) {
    const sel = selects.nth(i);
    const className = await sel.getAttribute('class');
    console.log(`Select ${i}: class="${className}"`);
  }
  
  console.log('=== Looking for establishment name "Salão Modelo" ===');
  const yeshua = page.locator('text=Salão Modelo');
  console.log('Salão Modelo found:', await yeshua.count());
  
  console.log('=== Looking for template variations ===');
  const variationLabels = ['ouro-classico', 'preto-esmeralda', 'minimal-studio', 'safira-executivo', 'rubi-lounge'];
  const pageContent = await page.textContent('body');
  const lowerContent = pageContent.toLowerCase();
  for (const v of variationLabels) {
    const found = lowerContent.includes(v.toLowerCase());
    console.log(`Variation "${v}": ${found}`);
  }
  
  console.log('=== Looking for "Cadastrar Novo" ===');
  const cadastrar = page.locator(':has-text("Cadastrar Novo")');
  console.log('Cadastrar Novo found:', await cadastrar.count());
  
  if (await cadastrar.count() > 0) {
    await cadastrar.click();
    await page.waitForLoadState('networkidle');
    console.log('=== After clicking Cadastrar Novo ===');
    console.log('Page title:', await page.title());
  }
  
  console.log('=== Looking for "Super Admin" ===');
  const superAdmin = page.locator(':has-text("Super Administrador")');
  console.log('Super Admin found:', await superAdmin.count());
  
  console.log('=== Looking for "Entrar como" ===');
  const entrar = page.locator(':has-text("Entrar como")');
  console.log('Entrar como found:', await entrar.count());
  
  await browser.close();
})();
