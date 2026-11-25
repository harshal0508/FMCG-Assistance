/**
 * Supabase Migration Status Check
 * 
 * Safely loads .env.supabase and runs `prisma migrate status`.
 * Confirms whether Supabase schema is up to date and has no schema drift.
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

console.log('--- Checking Supabase Migration Status ---');
try {
  const output = execSync('npx.cmd prisma migrate status', {
    env: {
      ...process.env,
      ...supabaseEnv,
      DIRECT_URL: directUrl,
      DATABASE_URL: dbUrl,
    },
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Filter out any connection string hints
  const sanitizedOutput = output.replace(/:[^:@]+@/g, ':****@');
  console.log(sanitizedOutput);
  console.log('✓ Migration status verified cleanly against Supabase.');
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  const stdout = err.stdout ? err.stdout.toString() : '';
  const sanitized = (stdout + '\n' + stderr).replace(/:[^:@]+@/g, ':****@');
  console.log(sanitized);
}
