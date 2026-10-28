import { test, expect } from '@playwright/test';

test('check window object for supabase', async ({ page }) => {
  await page.goto('http://localhost:3000/plataforma/acesso?mode=login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check window object keys
  const windowKeys = await page.evaluate(() => {
    const keys = Object.keys(window).filter(k => 
      k.toLowerCase().includes('supabase') || 
      k.toLowerCase().includes('auth') || 
      k.toLowerCase().includes('sdk')
    );
    return keys;
  });
  
  console.log('=== Window keys related to supabase/auth:', windowKeys);
  
  // Check if supabase is attached to window
  const supabaseOnWindow = window.supabase;
  console.log('=== window.supabase:', supabaseOnWindow);
  
  // Check for _react or other indicators
  const reactOnWindow = window.React;
  console.log('=== window.React:', reactOnWindow ? 'exists' : 'null');
  
  // Check for initialized supabase
  const supabaseCheck = await page.evaluate(() => {
    // The supabase client might be stored differently
    const ns = window.__SUPABASE_CLIENT__;
    const cs = window.__INITIAL_STATE__;
    return { hasNs: !!ns, hasCs: !!cs, nsKeys: ns ? Object.keys(ns) : [], csKeys: cs ? Object.keys(cs) : [] };
  });
  
  console.log('=== Initial state:', JSON.stringify(supabaseCheck));
  
  // Try to find any auth-related data in localStorage
  const lsKeys = await page.evaluate(() => {
    return Object.keys(localStorage).filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('auth'));
  });
  console.log('=== localStorage keys related to supabase/auth:', lsKeys);
  
  // Check sessionStorage too (if accessible)
  try {
    const ssKeys = await page.evaluate(() => {
      return Object.keys(sessionStorage).filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('auth'));
    });
    console.log('=== sessionStorage keys:', ssKeys);
  } catch (e) {
    console.log('=== sessionStorage access denied:', e.message);
  }
});
