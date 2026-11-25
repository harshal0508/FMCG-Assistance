/**
 * Safe CSV Importer for Products, Rates, Units, Shops & Opening Balances
 * 
 * Usage:
 *   node scripts/csv-import.js --type=products --file=path/to/products.csv [--dry-run] [--apply] [--tenant=<tenantId>]
 *   node scripts/csv-import.js --type=shops --file=path/to/shops.csv [--dry-run] [--apply] [--tenant=<tenantId>]
 * 
 * Features:
 * - Comprehensive Dry-Run & Validation Report (structure, column headers, valid units, positive integer paise).
 * - Generates shop tokens and initializes opening balances in LedgerEntry if provided.
 * - Auto-creates missing categories/areas if needed.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Parse CLI flags
const args = process.argv.slice(2);
const typeArg = args.find((a) => a.startsWith('--type='))?.split('=')[1];
const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
const tenantArg = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] || 'tenant_shree_shyam_alwar';
const isApply = args.includes('--apply');
const isDryRun = !isApply || args.includes('--dry-run');

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quotes
    const rawLine = lines[i];
    const parts = [];
    let cur = '';
    let inQuotes = false;

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    parts.push(cur.trim());

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = parts[idx] !== undefined ? parts[idx] : '';
    });
    rows.push({ lineNum: i + 1, data: rowObj });
  }

  return { headers, rows };
}

async function run() {
  if (!typeArg || !['products', 'shops'].includes(typeArg.toLowerCase())) {
    console.error('Usage: node scripts/csv-import.js --type=products|shops --file=<filepath> [--dry-run] [--apply]');
    process.exit(1);
  }

  if (!fileArg || !fs.existsSync(fileArg)) {
    console.error(`[ERROR] File not found: ${fileArg}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(fileArg, 'utf-8');
  const { headers, rows } = parseCsv(fileContent);

  console.log('================================================================');
  console.log(`   VITARAK CSV IMPORT ENGINE - TYPE: ${typeArg.toUpperCase()}`);
  console.log(`   Mode: ${isApply ? 'APPLY (DATABASE WRITE)' : 'DRY-RUN (VALIDATION ONLY)'}`);
  console.log(`   Target Tenant: ${tenantArg}`);
  console.log(`   Total Rows Found: ${rows.length}`);
  console.log('================================================================\n');

  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const validRows = [];
  const errors = [];
  const warnings = [];

  if (typeArg.toLowerCase() === 'products') {
    // Validate Products CSV: name, category, mrp, ptr, base_unit, default_order_unit, stock
    const allowedUnits = ['piece', 'packet', 'bundle', 'box', 'carton', 'g', 'kg', 'ml', 'litre'];

    for (const r of rows) {
      const name = r.data.name || r.data.productname;
      const category = r.data.category || r.data.categoryname || 'General';
      const mrpRupees = parseFloat(r.data.mrp || '0');
      const ptrRupees = parseFloat(r.data.ptr || r.data.rate || '0');
      const baseUnit = (r.data.baseunit || 'piece').toLowerCase();
      const defaultOrderUnit = (r.data.defaultorderunit || r.data.orderunit || baseUnit).toLowerCase();
      const stock = parseInt(r.data.stock || r.data.quantity || '0', 10);

      if (!name) {
        errors.push(`Row #${r.lineNum}: Missing product name.`);
        continue;
      }
      if (isNaN(mrpRupees) || mrpRupees <= 0) {
        errors.push(`Row #${r.lineNum} ("${name}"): Invalid MRP (${r.data.mrp}). Must be positive number.`);
        continue;
      }
      if (isNaN(ptrRupees) || ptrRupees <= 0) {
        errors.push(`Row #${r.lineNum} ("${name}"): Invalid PTR (${r.data.ptr}). Must be positive number.`);
        continue;
      }
      if (ptrRupees > mrpRupees) {
        warnings.push(`Row #${r.lineNum} ("${name}"): Warning: PTR (₹${ptrRupees}) is higher than MRP (₹${mrpRupees}).`);
      }
      if (!allowedUnits.includes(baseUnit)) {
        warnings.push(`Row #${r.lineNum} ("${name}"): Non-standard base unit "${baseUnit}".`);
      }

      validRows.push({
        name,
        category,
        mrpPaise: Math.round(mrpRupees * 100),
        ptrPaise: Math.round(ptrRupees * 100),
        baseUnit,
        defaultOrderUnit,
        stock: Math.max(0, isNaN(stock) ? 0 : stock),
      });
    }

    console.log('--- PRODUCTS VALIDATION REPORT ---');
    console.log(`✓ Total Valid Rows: ${validRows.length}`);
    console.log(`✗ Errors (Blocked) : ${errors.length}`);
    console.log(`⚠️ Warnings        : ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\nValidation Errors:');
      errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
      if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more errors.`);
    }

    if (warnings.length > 0) {
      console.log('\nValidation Warnings:');
      warnings.slice(0, 5).forEach((w) => console.log(`  - ${w}`));
    }

    if (isApply && validRows.length > 0 && errors.length === 0) {
      console.log('\nApplying product inserts to database...');
      await client.query('BEGIN');
      try {
        for (const item of validRows) {
          // Find or create Category
          const catRes = await client.query(
            `INSERT INTO categories (id, tenant_id, name, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
             RETURNING id;`,
            [`cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, tenantArg, item.category]
          );
          const categoryId = catRes.rows[0].id;

          // Create MasterProduct
          const masterId = `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO master_products (id, category_id, name, mrp_paise, image_url, base_unit, default_order_unit, unit_chain_json, created_at)
             VALUES ($1, $2, $3, $4, '', $5, $6, '[]', NOW());`,
            [masterId, categoryId, item.name, item.mrpPaise, item.baseUnit, item.defaultOrderUnit]
          );

          // Create TenantProduct
          const tpId = `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO tenant_products (id, tenant_id, master_product_id, rate_paise, stock_qty, in_stock_flag, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW());`,
            [tpId, tenantArg, masterId, item.ptrPaise, item.stock]
          );
        }
        await client.query('COMMIT');
        console.log(`\n✓ SUCCESS: ${validRows.length} products successfully imported and committed!`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[IMPORT ERROR - ROLLED BACK]:', err.message);
      }
    }
  } else if (typeArg.toLowerCase() === 'shops') {
    // Validate Shops CSV: name, owner_name, phone, area, credit_limit, opening_balance
    for (const r of rows) {
      const name = r.data.name || r.data.shopname;
      const ownerName = r.data.ownername || r.data.owner || name;
      const phone = (r.data.phone || r.data.mobile || '').replace(/[^0-9]/g, '');
      const area = r.data.area || r.data.areaname || 'Alwar Main Market';
      const creditLimitRupees = parseFloat(r.data.creditlimit || '5000');
      const openingBalanceRupees = parseFloat(r.data.openingbalance || r.data.dues || '0');

      if (!name) {
        errors.push(`Row #${r.lineNum}: Missing shop name.`);
        continue;
      }
      if (!phone || phone.length < 10) {
        errors.push(`Row #${r.lineNum} ("${name}"): Invalid phone number "${r.data.phone}". Must be at least 10 digits.`);
        continue;
      }

      validRows.push({
        name,
        ownerName,
        phone,
        area,
        creditLimitPaise: Math.round(creditLimitRupees * 100),
        openingBalancePaise: Math.round(openingBalanceRupees * 100),
      });
    }

    console.log('--- SHOPS VALIDATION REPORT ---');
    console.log(`✓ Total Valid Rows: ${validRows.length}`);
    console.log(`✗ Errors (Blocked) : ${errors.length}`);
    console.log(`⚠️ Warnings        : ${warnings.length}`);

    if (isApply && validRows.length > 0 && errors.length === 0) {
      console.log('\nApplying shop inserts to database...');
      await client.query('BEGIN');
      try {
        for (let i = 0; i < validRows.length; i++) {
          const item = validRows[i];

          // Area
          const areaRes = await client.query(
            `INSERT INTO areas (id, tenant_id, name, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id;`,
            [`area_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, tenantArg, item.area]
          );
          const areaId = areaRes.rows[0].id;

          const shopId = `shp_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
          const shopNum = `SHP-${String(i + 1).padStart(4, '0')}`;

          await client.query(
            `INSERT INTO shops (id, tenant_id, area_id, shop_number, name, owner_name, phone, address, credit_limit_paise, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
            [shopId, tenantArg, areaId, shopNum, item.name, item.ownerName, item.phone, `${item.name}, ${item.area}`, item.creditLimitPaise]
          );

          // Token
          const rawToken = `vtr_${crypto.randomBytes(32).toString('base64url')}`;
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          await client.query(
            `INSERT INTO shop_tokens (id, tenant_id, shop_id, token_hash, expires_at, created_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '365 days', NOW());`,
            [`stk_${Date.now().toString(36)}_${i}`, tenantArg, shopId, tokenHash]
          );

          // Opening Balance Ledger Entry if positive
          if (item.openingBalancePaise > 0) {
            await client.query(
              `INSERT INTO ledger_entries (id, tenant_id, shop_id, entry_type, amount_paise, balance_after_paise, notes, created_at)
               VALUES ($1, $2, $3, 'DEBIT', $4, $4, 'Opening migrated balance', NOW());`,
              [`ldg_${Date.now().toString(36)}_${i}`, tenantArg, shopId, item.openingBalancePaise]
            );
          }
        }
        await client.query('COMMIT');
        console.log(`\n✓ SUCCESS: ${validRows.length} shops successfully imported and committed!`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[IMPORT ERROR - ROLLED BACK]:', err.message);
      }
    }
  }

  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETE] To write these validated rows to your database, run with:');
    console.log(`npm run csv:import -- --type=${typeArg} --file="${fileArg}" --apply\n`);
  }

  await client.end();
}

run().catch((err) => {
  console.error('[CSV IMPORT FAILED]:', err);
  process.exit(1);
});
