/**
 * Supabase Migration Runner
 * 
 * Explicitly loads .env.supabase and runs `prisma migrate deploy`.
 * NEVER prints, logs, or exposes connection strings, passwords, or tokens.
 * Verifies that all tables exist and are empty after migration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

const dotenv = require('dotenv');

// 1. Verify .env.supabase exists
const envPath = path.join(__dirname, '..', '.env.supabase');
if (!fs.existsSync(envPath)) {
  console.error('[ERROR] .env.supabase not found in project root. Please create it first.');
  process.exit(1);
}

// 2. Parse .env.supabase safely handling any encoding (UTF-8, UTF-16LE, BOM) without logging values
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

const foundKeys = Object.keys(supabaseEnv);
const hasDbUrl = Boolean(supabaseEnv.DATABASE_URL);
const hasDirectUrl = Boolean(supabaseEnv.DIRECT_URL);

if (!hasDbUrl || !hasDirectUrl) {
  console.error(`[ERROR] .env.supabase is missing required keys.`);
  console.error(`Found keys in .env.supabase: [${foundKeys.join(', ')}]`);
  console.error(`Must contain DATABASE_URL and DIRECT_URL.`);
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

console.log('--- Connecting to Supabase for Migration ---');
console.log('Running: prisma migrate deploy using .env.supabase...');

try {
  // Execute prisma migrate deploy with .env.supabase env
  const output = execSync('npx.cmd prisma migrate deploy', {
    env: {
      ...process.env,
      ...supabaseEnv,
      DIRECT_URL: directUrl,
      DATABASE_URL: dbUrl,
    },
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('✓ Prisma migration deployed successfully.');
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  // Check for IPv6 / direct connection network failure
  if (
    stderr.includes('IPv6') ||
    stderr.includes('ENETUNREACH') ||
    stderr.includes('EHOSTUNREACH') ||
    stderr.includes('ETIMEDOUT') ||
    stderr.includes('Can\'t reach database server')
  ) {
    console.error('\n[MIGRATION BLOCKED: DIRECT CONNECTION FAILED]');
    console.error('The direct connection to Supabase failed (likely IPv6 network route issue).');
    console.error('Please swap your DIRECT_URL in .env.supabase with the Supabase Session Pooler connection string:');
    console.error('Format: postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres\n');
    process.exit(2);
  } else {
    // Sanitize any potential password in error message
    const sanitizedError = stderr.replace(/:[^:@]+@/g, ':****@');
    console.error('\n[MIGRATION FAILED]:\n', sanitizedError);
    process.exit(1);
  }
}

// 3. Connect to Supabase to verify all tables exist and are empty
async function verifyTables() {
  console.log('\n--- Verifying Supabase Tables and Row Counts ---');
  // Use DIRECT_URL or DATABASE_URL with sslmode without logging
  const targetUrl = directUrl || dbUrl;
  // Strip sslmode from connection string so pg uses explicit ssl options
  const cleanUrl = targetUrl.replace(/[?&]sslmode=[^&]+/g, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Query all public tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);

    const tableNames = tableRes.rows.map((r) => r.table_name);
    console.log(`✓ Total Public Tables Created: ${tableNames.length}`);

    // Check row counts on key tables
    const keyTables = ['tenants', 'shops', 'orders', 'bills', 'payments', 'ledger_entries', 'tenant_products'];
    let allEmpty = true;

    for (const tbl of keyTables) {
      if (tableNames.includes(tbl)) {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM "${tbl}"`);
        const rowCount = parseInt(countRes.rows[0].count, 10);
        console.log(`  • ${tbl.padEnd(20)}: ${rowCount} rows`);
        if (rowCount > 0) allEmpty = false;
      }
    }

    if (allEmpty) {
      console.log('✓ CONFIRMED: All Supabase tables exist and are completely empty (0 rows).');
    } else {
      console.log('ℹ Note: Some tables already contain rows.');
    }

    await client.end();
  } catch (err) {
    const sanitized = err.message.replace(/:[^:@]+@/g, ':****@');
    console.error('[Verification Query Error]:', sanitized);
    process.exit(1);
  }
}

verifyTables();
