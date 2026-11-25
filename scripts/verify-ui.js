const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  
  // 1. Visit login
  await page.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  
  // If demo sign-in button is present (unregistered device), click it to bind device
  const demoBtn = await page.$('button:has-text("Development Demo Sign-In")');
  if (demoBtn) {
    await demoBtn.click();
    await page.waitForURL('**/d/dashboard');
    // Now log out to see the bound device PIN screen!
    await page.goto('http://localhost:3000/d/settings', { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'new_settings_jain_enterprise.png'),
      fullPage: true,
    });
    
    // Call lock endpoint or clear unlock so PIN is requested
    await page.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  }

  // Capture bound device light login screen
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'new_login_light_bound_desktop.png'),
    fullPage: true,
  });

  // Mobile version
  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await ctx.storageState(),
  });
  const pageM = await ctxM.newPage();
  await pageM.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  await pageM.screenshot({
    path: path.join(ARTIFACTS_DIR, 'new_login_light_bound_mobile.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('UI verification complete!');
}

run().catch(console.error);
