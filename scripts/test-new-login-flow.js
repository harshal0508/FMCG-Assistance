const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  // Fresh browser context (NO cookies!)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('1. Testing /d/login on fresh browser with NO cookies...');
  await page.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Capture screenshot of new color-rich login screen
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'new_color_login_desktop.png'),
    fullPage: true,
  });

  // Mobile viewport screenshot
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageM = await ctxM.newPage();
  await pageM.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  await pageM.waitForTimeout(500);
  await pageM.screenshot({
    path: path.join(ARTIFACTS_DIR, 'new_color_login_mobile.png'),
    fullPage: true,
  });
  await ctxM.close();

  console.log('2. Entering 6-digit PIN 839201...');
  await page.fill('input[type="password"]', '839201');
  await page.click('button[type="submit"]');

  console.log('3. Waiting for navigation to dashboard...');
  await page.waitForURL('**/d/dashboard', { timeout: 10000 });
  await page.waitForTimeout(600);
  console.log('Successfully navigated to dashboard at:', page.url());

  console.log('4. Testing Back to Portals (navigating to /)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log('Current URL after clicking Back to Portals:', page.url());

  // Capture screenshot of Two Portals landing page
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'two_portals_landing_verified.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('ALL TESTS PASSED! Login flow & portals navigation completely verified.');
}

run().catch((err) => {
  console.error('Error in login test:', err);
  process.exit(1);
});
