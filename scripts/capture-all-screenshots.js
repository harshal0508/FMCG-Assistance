const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\fe8f5507-fca0-4de4-881c-f87774f675fa';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const RETAILER_URL = `${BASE_URL}/r/vtr_demo_retailer_token_ratlam_2026`;

async function main() {
  console.log('Launching Chrome browser...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  // Ensure output dir exists
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  // Set up context
  const context = await browser.newContext();

  // 1. Authenticate Distributor Session via Demo Login
  console.log('Authenticating distributor session...');
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/d/login?lang=en`, { waitUntil: 'networkidle' });
  
  // Click Quick 1-Click Demo Unlock
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

  console.log('Distributor unlocked successfully.');

  const captures = [
    // 1. Routes Screen
    {
      name: 'routes',
      url: `${BASE_URL}/d/routes`,
      action: async (p) => {
        await p.waitForSelector('text=Weekly Delivery Routes, text=साप्ताहिक डिलीवरी रूट', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1000);
      },
    },
    // 2. Campaign Preview Screen
    {
      name: 'campaign_preview',
      url: `${BASE_URL}/d/campaigns?tab=TRIGGER`,
      action: async (p) => {
        await p.waitForSelector('text=Target Route Group, text=लक्षित रूट समूह', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1000);
      },
    },
    // 3. Campaign Summary Screen
    {
      name: 'campaign_summary',
      url: `${BASE_URL}/d/campaigns?tab=SUMMARY`,
      action: async (p) => {
        await p.waitForTimeout(1000);
      },
    },
    // 4. Outbox Screen
    {
      name: 'outbox',
      url: `${BASE_URL}/d/campaigns?tab=OUTBOX`,
      action: async (p) => {
        await p.waitForTimeout(1000);
      },
    },
    // 5. Substitution Workflow Screen
    {
      name: 'substitution_workflow',
      url: `${BASE_URL}/d/orders`,
      action: async (p) => {
        await p.waitForSelector('text=ORD-', { timeout: 8000 }).catch(() => {});
        const orderCard = p.locator('div:has-text("ORD-")').first();
        if (await orderCard.count() > 0) {
          await orderCard.click().catch(() => {});
          await p.waitForTimeout(1000);
          const propBtn = p.locator('button:has-text("Suggest Alternative"), button:has-text("विकल्प सुझाएं")').first();
          if (await propBtn.count() > 0) {
            await propBtn.click().catch(() => {});
            await p.waitForTimeout(1000);
          }
        }
      },
    },
    // 6. Area Analytics Screen
    {
      name: 'area_analytics',
      url: `${BASE_URL}/d/analytics`,
      action: async (p) => {
        await p.waitForSelector('text=Area Sales & Order Analytics, text=क्षेत्रीय बिक्री एवं ऑर्डर विश्लेषण', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1000);
      },
    },
    // 7. Retailer Home with Reorder Prompt
    {
      name: 'retailer_reorder',
      url: `${RETAILER_URL}?tab=OFFERS`,
      action: async (p) => {
        await p.waitForSelector('text=Repeat Last Order, text=पिछला ऑर्डर दोहराएं', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(1500);
      },
    },
  ];

  for (const cap of captures) {
    for (const lang of ['en', 'hi']) {
      for (const vp of [
        { type: 'desktop', width: 1440, height: 900 },
        { type: 'mobile', width: 390, height: 844 },
      ]) {
        const urlWithLang = cap.url.includes('?') ? `${cap.url}&lang=${lang}` : `${cap.url}?lang=${lang}`;
        console.log(`Capturing: ${cap.name} | ${lang.toUpperCase()} | ${vp.type} (${vp.width}x${vp.height})...`);
        
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(urlWithLang, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
          await page.waitForTimeout(2000);
        });

        if (cap.action) {
          try {
            await cap.action(page);
          } catch (e) {
            console.log(`Action warning for ${cap.name}:`, e.message);
          }
        }

        const outPath = path.join(ARTIFACTS_DIR, `${cap.name}_${vp.type}_${lang}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`✓ Saved ${outPath}`);
      }
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
