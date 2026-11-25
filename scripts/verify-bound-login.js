const { chromium } = require('playwright');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createServerSession } = require('../lib/services/session');

const prisma = new PrismaClient();
const ARTIFACTS_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/fe8f5507-fca0-4de4-881c-f87774f675fa';

async function run() {
  // Find owner user and device
  const user = await prisma.user.findFirst({ where: { memberships: { some: { role: 'OWNER' } } } });
  const device = await prisma.device.findFirst({ where: { user_id: user.id } });
  
  // Create a locked session for this device
  const { rawToken } = await createServerSession(user.id, device.id, '127.0.0.1', 'Playwright');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Set session cookie
  await ctx.addCookies([
    {
      name: 'vitarak_staff_session',
      value: rawToken,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await ctx.newPage();
  
  // 1. Visit /d/login with locked session -> Should show light PIN screen!
  await page.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'light_login_pin_desktop.png'),
    fullPage: true,
  });

  // Mobile version of light PIN screen
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxM.addCookies([
    {
      name: 'vitarak_staff_session',
      value: rawToken,
      domain: 'localhost',
      path: '/',
    },
  ]);
  const pageM = await ctxM.newPage();
  await pageM.goto('http://localhost:3000/d/login', { waitUntil: 'networkidle' });
  await pageM.waitForTimeout(500);
  await pageM.screenshot({
    path: path.join(ARTIFACTS_DIR, 'light_login_pin_mobile.png'),
    fullPage: true,
  });

  // 2. Unlock with PIN 839201
  await page.fill('input[type="password"]', '839201');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/d/dashboard');
  await page.waitForTimeout(600);

  // Capture Dashboard showing Demo Traders
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'dashboard_demo_traders.png'),
    fullPage: true,
  });

  // Capture Settings showing Demo Traders
  await page.goto('http://localhost:3000/d/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'settings_demo_traders.png'),
    fullPage: true,
  });

  await browser.close();
  await prisma.$disconnect();
  console.log('Successfully captured light PIN screens, dashboard, and settings!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
