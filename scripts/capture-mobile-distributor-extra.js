const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\fe8f5507-fca0-4de4-881c-f87774f675fa';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Demo login
  await page.goto(`${BASE_URL}/d/login?lang=en`, { waitUntil: 'networkidle' });
  const demoBtn = page.locator('button:has-text("Quick 1-Click Demo Unlock")');
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
    await page.waitForURL('**/d/dashboard**', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  await page.setViewportSize({ width: 390, height: 844 });

  const routes = [
    { url: '/d/routes', name: 'routes' },
    { url: '/d/campaigns', name: 'campaigns' },
    { url: '/d/analytics', name: 'analytics' },
  ];

  for (const r of routes) {
    for (const lang of ['en', 'hi']) {
      await page.goto(`${BASE_URL}${r.url}?lang=${lang}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const outPath = path.join(ARTIFACTS_DIR, `distributor_mobile_${r.name}_${lang}.png`);
      await page.screenshot({ path: outPath });
      console.log(`✓ Saved ${outPath}`);
    }
  }

  await browser.close();
  console.log('Extra mobile captures complete!');
}

main().catch(console.error);
