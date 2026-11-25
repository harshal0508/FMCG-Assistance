/**
 * Supabase Seed Runner
 * 
 * Safely loads .env.supabase and seeds the demo dataset into Supabase.
 * NEVER prints, logs, or exposes connection strings, passwords, or tokens.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// 1. Verify .env.supabase exists
const envPath = path.join(__dirname, '..', '.env.supabase');
if (!fs.existsSync(envPath)) {
  console.error('[ERROR] .env.supabase not found in project root.');
  process.exit(1);
}

// 2. Parse .env.supabase safely handling any encoding (UTF-8, UTF-16LE, BOM)
const rawBuffer = fs.readFileSync(envPath);
let envContent = '';
if (rawBuffer.length >= 2 && rawBuffer[0] === 0xff && rawBuffer[1] === 0xfe) {
  envContent = rawBuffer.toString('utf16le');
} else if (rawBuffer.length >= 3 && rawBuffer[0] === 0xef && rawBuffer[1] === 0xbb && rawBuffer[2] === 0xbf) {
  envContent = rawBuffer.slice(3).toString('utf-8');
} else if (rawBuffer.includes(0x00)) {
  envContent = rawBuffer.toString('utf16le');
} else {
  envContent = rawBuffer.toString('utf-8');
}

const supabaseEnv = dotenv.parse(envContent);

if (!supabaseEnv.DATABASE_URL || !supabaseEnv.DIRECT_URL) {
  console.error('[ERROR] .env.supabase is missing DATABASE_URL or DIRECT_URL.');
  process.exit(1);
}

let directUrl = supabaseEnv.DIRECT_URL;
if (directUrl && !directUrl.includes('sslmode=')) {
  directUrl += (directUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}
let dbUrl = supabaseEnv.DATABASE_URL;
if (dbUrl && !dbUrl.includes('sslmode=')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

console.log('--- Connecting to Supabase for Preloaded Data Seed ---');
console.log('Running: prisma/seed.ts on Supabase...');

const childEnv = {
  ...process.env,
  ...supabaseEnv,
  DIRECT_URL: directUrl,
  DATABASE_URL: dbUrl,
  ALLOW_CLOUD_SEED: 'true',
};

try {
  const seedOutput = execSync('npx.cmd tsx prisma/seed.ts', {
    env: childEnv,
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('✓ Main seed completed.');

  console.log('Running: scripts/seed-versioned-substitution-demo.ts on Supabase...');
  execSync('npx.cmd tsx scripts/seed-versioned-substitution-demo.ts', {
    env: childEnv,
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('✓ Versioned substitution demo seed completed.');

  console.log('\n======================================================');
  console.log('  SUPABASE DEMO DATA SEEDED SUCCESSFULLY');
  console.log('  Distributor Owner PIN: 839201');
  console.log('  Retailer Portal Demo : Available on /r/demo & /r/demo-portal');
  console.log('======================================================');
} catch (err) {
  console.error('\n[SEED FAILED]');
  console.error(err.message);
  process.exit(1);
}
