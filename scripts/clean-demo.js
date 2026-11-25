const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env'));
const client = new Client({ connectionString: env.DATABASE_URL });

async function cleanDemoData() {
  await client.connect();
  const tenantId = 'tenant_shree_shyam_alwar';
  console.log(`Cleaning demo data for ${tenantId}...`);

  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM order_events WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM order_lines WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM orders WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM payment_allocations WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM payments WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM unmatched_payments WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM bill_events WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM bills WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM ledger_entries WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM stock_movements WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM scheme_applications WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM scheme_products WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM schemes WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM rate_overrides WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM rate_groups WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM shop_tokens WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM shop_payer_names WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM shops WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM route_schedules WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM route_group_areas WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM route_groups WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM areas WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenant_products WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenant_sequences WHERE tenant_id = $1', [tenantId]);
    await client.query('COMMIT');
    console.log('✓ Successfully wiped demo data for Shree Shyam FMCG.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', err);
    throw err;
  } finally {
    await client.end();
  }
}

cleanDemoData().catch(console.error);
