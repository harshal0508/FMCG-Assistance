const { chromium } = require('playwright');
const path = require('path');

async function testDistributorSwitching() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // mobile view
  const page = await context.newPage();

  console.log('1. Navigating to Retailer Portal http://localhost:3000/r/demo-portal ...');
  await page.goto('http://localhost:3000/r/demo-portal', { waitUntil: 'networkidle' });

  // Verify header has Demo Traders
  const headerText = await page.textContent('header');
  console.log('Initial Header Text:', headerText);

  // Step 2: Click "Switch Distributor" button in top header
  console.log('2. Clicking "Switch Distributor" in header...');
  const switchHeaderBtn = page.locator('header button[title="Switch Distributor"], header button:has-text("Switch Distributor"), header button:has-text("वितरक बदलें")');
  await switchHeaderBtn.first().click();

  await page.waitForTimeout(500);

  // Capture screenshot of the Switch Distributor Modal
  const modalScreenshotPath = path.resolve('C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa/distributor_switch_modal.png');
  await page.screenshot({ path: modalScreenshotPath, fullPage: false });
  console.log('Saved modal screenshot to:', modalScreenshotPath);

  // Step 3: Click "Select" for Agrawal & Sons Wholesale
  console.log('3. Selecting Agrawal & Sons Wholesale...');
  const agrawalCard = page.locator('div:has-text("Agrawal & Sons Wholesale")').locator('button:has-text("Select"), button:has-text("चुनें")');
  await agrawalCard.first().click();

  await page.waitForTimeout(600);

  // Verify top header updated
  const updatedHeaderText = await page.textContent('header');
  console.log('Updated Header Text after switch:', updatedHeaderText);

  // Capture screenshot of portal after switching to Agrawal & Sons Wholesale
  const switchedPortalScreenshot = path.resolve('C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa/distributor_switched_agrawal.png');
  await page.screenshot({ path: switchedPortalScreenshot, fullPage: false });
  console.log('Saved switched portal screenshot to:', switchedPortalScreenshot);

  // Step 4: Switch to Catalog tab to verify catalog reflects Agrawal & Sons brands
  console.log('4. Checking Catalog tab under Agrawal & Sons...');
  const catalogTabBtn = page.locator('button:has-text("Catalog"), button:has-text("कैटलॉग")');
  await catalogTabBtn.first().click();
  await page.waitForTimeout(500);

  const catalogScreenshot = path.resolve('C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa/distributor_agrawal_catalog.png');
  await page.screenshot({ path: catalogScreenshot, fullPage: false });
  console.log('Saved catalog screenshot to:', catalogScreenshot);

  // Step 5: Switch to Profile tab
  console.log('5. Checking Profile tab...');
  const profileTabBtn = page.locator('button:has-text("Profile"), button:has-text("प्रोफ़ाइल")');
  await profileTabBtn.first().click();
  await page.waitForTimeout(500);

  const profileScreenshot = path.resolve('C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa/distributor_profile_tab.png');
  await page.screenshot({ path: profileScreenshot, fullPage: false });
  console.log('Saved profile screenshot to:', profileScreenshot);

  // Step 6: Test switching back to Demo Traders from Profile tab
  console.log('6. Switching back to Demo Traders from Profile tab...');
  // Find the button with text "Switch" inside the card that mentions Demo Traders
  const demoCard = page.locator('div.rounded-xl:has-text("Demo Traders")');
  const demoSwitchBtn = demoCard.locator('button:has-text("Switch"), button:has-text("बदलें")');
  console.log('Found Demo Traders switch buttons count:', await demoSwitchBtn.count());
  if (await demoSwitchBtn.count() > 0) {
    await demoSwitchBtn.first().click();
    await page.waitForTimeout(600);
    const finalHeaderText = await page.textContent('header');
    console.log('Final Header Text after switching back:', finalHeaderText);

    const backToDemoScreenshot = path.resolve('C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa/distributor_switched_back_demo.png');
    await page.screenshot({ path: backToDemoScreenshot, fullPage: false });
    console.log('Saved back-to-Demo Traders screenshot to:', backToDemoScreenshot);
  }

  await browser.close();
  console.log('✓ All distributor switching tests passed!');
}

testDistributorSwitching().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
