const { chromium } = require('playwright');

(async () => {
  console.log('=== PHASE A: Deep inspect auth flow ===');
  console.log('===============================================\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Open the app
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Navigate to login gate
  await page.goto('http://localhost:3000/plataforma/acesso?mode=login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('1. Login gate loaded:', await page.title());
  
  // Wait a bit and check if anything changes
  await page.waitForTimeout(3000);
  
  // Get the page HTML and look for changes
  const html = await page.content();
  const lower = html.toLowerCase();
  
  // Look for any input, button, or form elements
  const inputCount = (html.match(/<input/gi) || []).length;
  const buttonCount = (html.match(/<button/gi) || []).length;
  const formCount = (html.match(/<form/gi) || []).length;
  
  console.log('HTML elements - inputs:', inputCount, 'buttons:', buttonCount, 'forms:', formCount);
  
  // Look for any div with role dialog, modal, or auth-related classes
  const authClasses = ['modal', 'dialog', 'popup', 'overlay', 'modal', 'auth', 'login', 'modal-backdrop'];
  for (const cls of authClasses) {
    const regex = new RegExp(`[^>]*${cls}[^>]*`, 'gi');
    const matches = html.match(regex);
    if (matches) {
      console.log(`Found "${cls}" class matches: ${matches.length}`);
    }
  }
  
  // Look for any script that initializes auth
  const scriptContent = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptContent) {
    console.log('\nScript tags found:', scriptContent.length);
    // Check first script for auth references
    const firstScript = scriptContent[0] || '';
    const authRefs = (firstScript.toLowerCase().match(/supabase|auth|signin|session|login/gi) || []);
    console.log('First script auth refs:', authRefs.length);
  }
  
  // Check for any css variables or styles related to auth
  const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
  const styles = html.match(styleRegex);
  if (styles) {
    console.log('\nStyle tags found:', styles.length);
    const combinedStyles = styles.join(' ');
    const authStyleRefs = (combinedStyles.toLowerCase().match(/auth|login|modal|dialog|overlay/gi) || []);
    console.log('Style auth refs:', authStyleRefs.length);
  }
  
  // Check for any comment or meta tags
  const comments = html.match(/<!--[\s\S]*?-->/gi);
  if (comments) {
    console.log('\nComments:', comments.length);
    comments.forEach((c, i) => {
      const trimmed = c.trim().substring(0, 100);
      if (trimmed.toLowerCase().includes('auth') || trimmed.toLowerCase().includes('login')) {
        console.log(`  Comment ${i}: "${trimmed}"`);
      }
    });
  }
  
  // Look for any data attributes
  const dataAttrs = html.match(/data-[a-zA-Z]/gi);
  if (dataAttrs) {
    console.log('\nData attributes sample:', dataAttrs.slice(0, 10));
  }
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/screenshot-auth-deep.png' });
  console.log('\nScreenshot saved.');
  
  // Evaluate the page to find any globally defined variables
  const globals = await page.evaluate(() => {
    const result = {};
    // Check common global names
    const globalNames = ['supabase', 'supa', 'auth', 'sessionStorage', 'localStorage', 'window'];
    for (const name of globalNames) {
      result[name] = typeof window[name] !== 'undefined' ? 'function' : (typeof window[name] !== 'undefined' ? 'object' : 'undefined');
    }
    // Check for React root
    const root = document.getElementById('root');
    result.rootExists = root !== null;
    if (root) {
      result.rootChildren = root.children ? root.children.length : 0;
    }
    return result;
  });
  
  console.log('\nGlobal variables:', globals);
  
  await browser.close();
  console.log('\n=== PHASE A COMPLETE ===');
})();
