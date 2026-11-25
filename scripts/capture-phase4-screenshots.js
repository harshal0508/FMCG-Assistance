const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\fe8f5507-fca0-4de4-881c-f87774f675fa';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('Launching Chrome browser for Phase 4 verification screenshots...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Authenticate Distributor Session
  console.log('Authenticating distributor session...');
  await page.goto(`${BASE_URL}/d/login?lang=en`, { waitUntil: 'networkidle' });
  try {
    const demoBtn = page.locator('button:has-text("Quick 1-Click Demo Unlock")');
    if (await demoBtn.count() > 0) {
      await demoBtn.click();
      await page.waitForURL('**/d/dashboard**', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.log('Login attempt note:', e.message);
  }

  const targets = [
    // 1. Routes Screen
    {
      name: 'routes',
      url: `${BASE_URL}/d/routes`,
      action: async (p) => {
        await p.waitForSelector('text=Weekly Delivery Routes, text=साप्ताहिक डिलीवरी रूट', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1000);
      },
    },
    // 2. Campaign Preview (with Excluded Shops & Remaining Plan Messages)
    {
      name: 'campaign_preview',
      url: `${BASE_URL}/d/campaigns?tab=TRIGGER`,
      action: async (p) => {
        await p.waitForSelector('text=Target Route Group, text=लक्षित रूट समूह', { timeout: 8000 }).catch(() => {});
        // Wait for preview to fetch and render
        await p.waitForSelector('text=Total Target, text=कुल दुकानें', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1500);
      },
    },
    // 3. Campaign Summary
    {
      name: 'campaign_summary',
      url: `${BASE_URL}/d/campaigns?tab=SUMMARY`,
      action: async (p) => {
        await p.waitForTimeout(1000);
      },
    },
    // 4. Outbox
    {
      name: 'outbox',
      url: `${BASE_URL}/d/campaigns?tab=OUTBOX`,
      action: async (p) => {
        await p.waitForTimeout(1000);
      },
    },
    // 5. Substitution (Before Billing)
    {
      name: 'substitution_before_billing',
      url: `${BASE_URL}/d/orders`,
      action: async (p) => {
        await p.waitForSelector('text=ORD-', { timeout: 8000 }).catch(() => {});
        const orderCard = p.locator('div:has-text("ORD-")').first();
        if (await orderCard.count() > 0) {
          await orderCard.click().catch(() => {});
          await p.waitForTimeout(800);
          const propBtn = p.locator('button:has-text("Suggest Alternative"), button:has-text("विकल्प सुझाएं")').first();
          if (await propBtn.count() > 0) {
            await propBtn.click().catch(() => {});
            await p.waitForTimeout(1000);
          }
        }
      },
    },
    // 6. Substitution (After Billing)
    {
      name: 'substitution_after_billing',
      url: `${BASE_URL}/d/bills/BILL-20261125-0001-v2`,
      action: async (p) => {
        await p.waitForSelector('text=BILL-20261125-0001-v2, text=Bill, text=बिल', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1500);
      },
    },
    // 7. Area Analytics
    {
      name: 'area_analytics',
      url: `${BASE_URL}/d/analytics`,
      action: async (p) => {
        await p.waitForSelector('text=Area Sales & Order Analytics, text=क्षेत्रीय बिक्री एवं ऑर्डर विश्लेषण', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1000);
      },
    },
  ];

  for (const t of targets) {
    for (const lang of ['en', 'hi']) {
      for (const vp of [
        { type: 'desktop', width: 1440, height: 900 },
        { type: 'mobile', width: 390, height: 844 },
      ]) {
        const urlWithLang = t.url.includes('?') ? `${t.url}&lang=${lang}` : `${t.url}?lang=${lang}`;
        console.log(`Capturing: ${t.name} | ${lang.toUpperCase()} | ${vp.type} (${vp.width}x${vp.height})...`);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(urlWithLang, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
          await page.waitForTimeout(1500);
        });

        if (t.action) {
          try {
            await t.action(page);
          } catch (e) {
            console.log(`Action note for ${t.name}:`, e.message);
          }
        }

        const outPath = path.join(ARTIFACTS_DIR, `${t.name}_${vp.type}_${lang}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`✓ Saved ${t.name}_${vp.type}_${lang}.png`);
      }
    }
  }

  await browser.close();
  console.log('All Phase 4 screenshots successfully generated!');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
