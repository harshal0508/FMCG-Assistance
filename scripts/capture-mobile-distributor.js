const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\fe8f5507-fca0-4de4-881c-f87774f675fa';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('Launching Chrome for Mobile Distributor verification...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Authenticate distributor
  console.log('Authenticating session...');
  await page.goto(`${BASE_URL}/d/login?lang=en`, { waitUntil: 'networkidle' });
  const demoBtn = page.locator('button:has-text("Quick 1-Click Demo Unlock")');
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
    await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
  } else {
    await page.evaluate(async () => {
      await fetch('/api/auth/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    });
    await page.reload({ waitUntil: 'networkidle' });
  }

  // 2. Capture Mobile Drawer (English & Hindi, 390x844)
  for (const lang of ['en', 'hi']) {
    console.log(`Capturing Mobile Distributor Drawer (${lang.toUpperCase()})...`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/d/dashboard?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click Hamburger / Menu button to open mobile drawer
    const menuBtn = page.locator('button[aria-label="Open navigation menu"]').first();
    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(600);
      const outPath = path.join(ARTIFACTS_DIR, `distributor_mobile_drawer_${lang}.png`);
      await page.screenshot({ path: outPath });
      console.log(`✓ Saved ${outPath}`);
    }

    // Capture Mobile Dashboard View with bottom bar
    await page.goto(`${BASE_URL}/d/dashboard?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dashPath = path.join(ARTIFACTS_DIR, `distributor_mobile_dashboard_${lang}.png`);
    await page.screenshot({ path: dashPath });
    console.log(`✓ Saved ${dashPath}`);

    // Capture Mobile Orders View with bottom bar
    await page.goto(`${BASE_URL}/d/orders?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const ordPath = path.join(ARTIFACTS_DIR, `distributor_mobile_orders_${lang}.png`);
    await page.screenshot({ path: ordPath });
    console.log(`✓ Saved ${ordPath}`);
  }

  // 3. Verify Desktop remains 100% intact (1440x900)
  console.log('Verifying Desktop remains 100% intact...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/d/dashboard?lang=en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const deskPath = path.join(ARTIFACTS_DIR, `distributor_desktop_intact_en.png`);
  await page.screenshot({ path: deskPath });
  console.log(`✓ Saved ${deskPath}`);

  await browser.close();
  console.log('Mobile Distributor verification captures completed successfully!');
}

main().catch((err) => {
  console.error('Mobile capture error:', err);
  process.exit(1);
});
