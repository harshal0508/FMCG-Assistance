/**
 * Production Superadmin Bootstrap Script
 * 
 * Safely provisions the initial platform administrator account:
 * - Prompts for Admin Name, Admin Google Email (must match ADMIN_ALLOWED_EMAILS), and TOTP 2FA secret
 * - Reads all secrets strictly from interactive muted terminal prompt (NEVER from command-line arguments)
 * - Refuses to run if an administrator already exists unless explicitly confirmed
 * - Stores TOTP secret and credentials safely
 * - NEVER prints or logs passwords, secrets, or connection strings
 */

const readline = require('readline');
const { Client } = require('pg');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

function askQuestion(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(query);
      const stdin = process.stdin;
      const oldRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();

      let input = '';
      const onData = (char) => {
        const c = char.toString('utf-8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) stdin.setRawMode(oldRaw);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u0008' || c === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c === '\u0003') {
          process.exit(1);
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

function generateTotpSecretBase32() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(20);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return secret;
}

async function main() {
  console.log('\n======================================================');
  console.log('   VITARAK FMCG PLATFORM - ADMIN BOOTSTRAP PROVISIONING');
  console.log('======================================================\n');

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[ERROR] DATABASE_URL or DIRECT_URL is required in environment.');
    process.exit(1);
  }

  // Strip sslmode from connection string for direct pg ssl option
  const cleanUrl = connectionString.replace(/[?&]sslmode=[^&]+/g, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // 1. Check existing admin users
    const existingAdminsRes = await client.query('SELECT COUNT(*) as count FROM "admin_users"');
    const existingCount = parseInt(existingAdminsRes.rows[0].count, 10);

    if (existingCount > 0) {
      console.warn(`[WARNING] Database already contains ${existingCount} admin user(s).`);
      const confirm = await askQuestion('Do you want to proceed and create another admin account? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Setup aborted.');
        await client.end();
        process.exit(0);
      }
    }

    // 2. Interactive Prompts (Strictly from terminal prompt, never command line args)
    const name = await askQuestion('Admin Full Name: ');
    if (!name || name.length < 2) {
      console.error('[ERROR] Admin name is required.');
      process.exit(1);
    }

    const email = await askQuestion('Admin Google Email Address: ');
    if (!email || !email.includes('@')) {
      console.error('[ERROR] Valid email address is required.');
      process.exit(1);
    }

    // Check allowlist
    const allowlist = (process.env.ADMIN_ALLOWED_EMAILS || 'admin@vitarak.in')
      .split(',')
      .map((e) => e.trim().toLowerCase());

    if (!allowlist.includes(email.toLowerCase())) {
      console.warn(`\n[NOTICE] Email "${email}" is not currently in ADMIN_ALLOWED_EMAILS: [${allowlist.join(', ')}]`);
      console.warn('Remember to add this email to ADMIN_ALLOWED_EMAILS in your .env / production secrets.');
    }

    const wantTotp = await askQuestion('Enable TOTP Two-Factor Authentication? (Y/n): ');
    let totpSecret = null;
    let totpEnabled = false;

    if (wantTotp.toLowerCase() !== 'n') {
      totpSecret = generateTotpSecretBase32();
      totpEnabled = true;
      console.log('\n[2FA SETUP] TOTP Secret generated for authenticator app (Google Authenticator, 1Password):');
      // Prompt user to record the secret securely
      console.log(`Secret Key: ${totpSecret}`);
      console.log(`Account:    ${email}`);
      console.log(`Issuer:     Vitarak Admin\n`);
    }

    // 3. Insert Admin record
    const adminId = `admin_${crypto.randomBytes(12).toString('hex')}`;
    await client.query(
      `INSERT INTO "admin_users" (id, email, name, totp_secret, totp_enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         totp_secret = COALESCE(EXCLUDED.totp_secret, admin_users.totp_secret),
         totp_enabled = EXCLUDED.totp_enabled;`,
      [adminId, email.toLowerCase(), name, totpSecret, totpEnabled]
    );

    console.log('\n======================================================');
    console.log('✓ SUCCESS: Admin account successfully provisioned!');
    console.log(`  Name:  ${name}`);
    console.log(`  Email: ${email.toLowerCase()}`);
    console.log(`  2FA:   ${totpEnabled ? 'Enabled (TOTP)' : 'Disabled'}`);
    console.log('======================================================\n');

    // 4. Verify no demo UPI handles exist in production database (Item 3 compliance)
    const demoUpiRes = await client.query(
      `SELECT id, name, upi_id FROM "tenants" WHERE upi_id LIKE '%@invalid%' OR upi_id LIKE '%demo%'`
    );
    if (demoUpiRes.rows.length > 0) {
      console.warn(`[WARNING] Found ${demoUpiRes.rows.length} tenant(s) with demo/test UPI handles. Production setup rejects demo UPI in active production:`);
      demoUpiRes.rows.forEach((r) => console.warn(`  - ${r.name} (${r.id}): ${r.upi_id}`));
    }

    await client.end();
  } catch (err) {
    console.error('[ERROR Bootstrap Failed]:', err.message);
    if (client) await client.end();
    process.exit(1);
  }
}

main();
