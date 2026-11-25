#!/usr/bin/env node

/**
 * Retailer Portal JavaScript Budget Enforcer (F6 Compliance)
 * 
 * Strict budget: First-load JavaScript for retailer portal (/r/[token]) MUST NOT exceed 150 kB (gzipped transfer).
 * Fails the build with exit code 1 if budget is exceeded.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUDGET_KB = 150.0;
const appManifestPath = path.join(process.cwd(), '.next', 'app-build-manifest.json');

if (!fs.existsSync(appManifestPath)) {
  console.error('[BUDGET CHECK ERROR] .next/app-build-manifest.json not found. Run "next build" first.');
  process.exit(1);
}

const appManifest = JSON.parse(fs.readFileSync(appManifestPath, 'utf8'));
const targetRoute = '/(retailer)/r/[token]/page';
const chunks = appManifest.pages[targetRoute];

if (!chunks || chunks.length === 0) {
  console.error(`[BUDGET CHECK ERROR] Route "${targetRoute}" not found in app-build-manifest.json.`);
  process.exit(1);
}

let totalRawBytes = 0;
let totalGzipBytes = 0;

for (const chunk of chunks) {
  const fullPath = path.join(process.cwd(), '.next', chunk);
  if (fs.existsSync(fullPath)) {
    const buffer = fs.readFileSync(fullPath);
    totalRawBytes += buffer.length;
    totalGzipBytes += zlib.gzipSync(buffer).length;
  }
}

const gzipKb = (totalGzipBytes / 1024).toFixed(2);
const rawKb = (totalRawBytes / 1024).toFixed(2);

console.log('====================================================');
console.log('  RETAILER JS PERFORMANCE BUDGET VERIFICATION');
console.log('====================================================');
console.log(`Route:                 /r/[token]`);
console.log(`Gzipped Transfer Size: ${gzipKb} kB`);
console.log(`Uncompressed Size:     ${rawKb} kB`);
console.log(`Budget Limit:          ${BUDGET_KB} kB`);

if (parseFloat(gzipKb) > BUDGET_KB) {
  console.error(`\n[BUDGET CI FAILURE] Retailer First-Load JS (${gzipKb} kB) exceeds the strict 150 kB budget!`);
  process.exit(1);
}

console.log(`\n✓ PASSED: Retailer First-Load JS (${gzipKb} kB) is comfortably within the ${BUDGET_KB} kB budget.`);
console.log('====================================================');
process.exit(0);
