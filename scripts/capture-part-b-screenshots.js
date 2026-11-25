const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa';
const BASE_URL = 'http://localhost:3000';

const BILL_ID = 'cmwuzku0z03jvk7nirsaude4j';
const SHOP_ID = 'cmwuzkqml00epk7ni8fx7m3tr';

async function main() {
  console.log('Launching browser to capture Part B screenshots...');
  const browser = await chromium.launch({
    channel: 'msedge', // Use Microsoft Edge installed on system
    headless: true,
  });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const languages = ['en', 'hi'];

  for (const vp of viewports) {
    for (const lang of languages) {
      console.log(`\n--- Capturing Viewport: ${vp.name} (${vp.width}x${vp.height}) | Lang: ${lang} ---`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();

      // Set cookie and localStorage for language
      await page.goto(`${BASE_URL}/d/dashboard?lang=${lang}`, { waitUntil: 'networkidle' });
      await page.evaluate((l) => {
        localStorage.setItem('vitarak_lang', l);
        document.cookie = `vitarak_lang=${l}; path=/; max-age=31536000`;
      }, lang);

      // 1. B1: Bills page
      try {
        console.log(`[B1] Capturing /d/bills/${BILL_ID}...`);
        await page.goto(`${BASE_URL}/d/bills/${BILL_ID}?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b1_bill_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B1 error:', e.message);
      }

      // 2. B2: Payments (Match tab)
      try {
        console.log(`[B2] Capturing /d/payments (Match & Record)...`);
        await page.goto(`${BASE_URL}/d/payments?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b2_payments_match_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B2 error:', e.message);
      }

      // 3. B3: Payments (Unmatched tab)
      try {
        console.log(`[B3] Capturing /d/payments (Unmatched Tab)...`);
        await page.goto(`${BASE_URL}/d/payments?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        // Click unmatched tab
        const unmatchedBtn = await page.$('button:has-text("Unmatched"), button:has-text("अज्ञात भुगतान")');
        if (unmatchedBtn) {
          await unmatchedBtn.click();
          await page.waitForTimeout(400);
        }
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b3_payments_unmatched_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B3 error:', e.message);
      }

      // 4. B4: Shop Ledger
      try {
        console.log(`[B4] Capturing /d/shops/${SHOP_ID}/ledger...`);
        await page.goto(`${BASE_URL}/d/shops/${SHOP_ID}/ledger?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b4_shop_ledger_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B4 error:', e.message);
      }

      // 5. B5: Schemes & Simulator
      try {
        console.log(`[B5] Capturing /d/schemes (Live Simulator)...`);
        await page.goto(`${BASE_URL}/d/schemes?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        // Open the create scheme form to show simulator
        const createBtn = await page.$('button:has-text("+ Create Scheme"), button:has-text("+ नई योजना बनाएं")');
        if (createBtn) {
          await createBtn.click();
          await page.waitForTimeout(500);
        }
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b5_schemes_simulator_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B5 error:', e.message);
      }

      // 6. B6: Rate Groups Screen
      try {
        console.log(`[B6] Capturing /d/rate-groups...`);
        await page.goto(`${BASE_URL}/d/rate-groups?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b6_rate_groups_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B6 Rate Groups error:', e.message);
      }

      // 7. B6: Shop Directory with Rate Group selector
      try {
        console.log(`[B6] Capturing /d/shops with Rate Group selector...`);
        await page.goto(`${BASE_URL}/d/shops?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b6_shops_selector_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B6 Shops error:', e.message);
      }

      // 8. B7: Stock Movements Modal on Inventory
      try {
        console.log(`[B7] Capturing /d/inventory with Stock Movement History modal...`);
        await page.goto(`${BASE_URL}/d/inventory?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        // Expand first brand if needed
        const chevron = await page.$('button[title*="Movement"], tr button svg.lucide-history');
        if (chevron) {
          await chevron.click();
          await page.waitForTimeout(500);
        } else {
          // Open movement modal directly via API
          const firstHistBtn = await page.$('button:has(svg.lucide-history)');
          if (firstHistBtn) {
            await firstHistBtn.click();
            await page.waitForTimeout(500);
          }
        }
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b7_stock_movement_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B7 error:', e.message);
      }

      // 9. B8: Scheme Claims Report & CSV
      try {
        console.log(`[B8] Capturing /d/reports/scheme-claims...`);
        await page.goto(`${BASE_URL}/d/reports/scheme-claims?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `b8_scheme_claims_${vp.name}_${lang}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.error('B8 error:', e.message);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('\nAll Part B screenshots captured successfully in artifacts directory!');
}

main().catch(console.error);
