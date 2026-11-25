const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('1. Loading landing page http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  console.log('2. Clicking "Open Retailer Storefront" button...');
  const retailerBtn = await page.$('a:has-text("Open Retailer Storefront")');
  if (!retailerBtn) {
    throw new Error('Retailer button not found on landing page!');
  }
  await retailerBtn.click();

  console.log('3. Waiting for retailer portal to load...');
  await page.waitForURL('**/r/**', { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log('Landed on URL:', page.url());
  if (page.url().includes('/d/login')) {
    throw new Error('FAILED: Still redirecting to /d/login!');
  }

  // Capture screenshot of retailer portal
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'retailer_portal_opened_verified.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('SUCCESS! Retailer portal opens cleanly without redirecting to distributor login!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
