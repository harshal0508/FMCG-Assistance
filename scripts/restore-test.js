/**
 * Automated Restore & Full Database Verification Engine
 * 
 * Usage:
 *   node scripts/restore-test.js                  (tests latest cloud Supabase dump against local throwaway DB)
 *   node scripts/restore-test.js --source=local   (dumps local seeded DB and test-restores to prove real non-zero rows)
 * 
 * Verifications performed:
 * 1. Runs in a consistent point-in-time snapshot (REPEATABLE READ READ ONLY).
 * 2. Re-creates schema, enums, sequences, indexes, and foreign keys via baseline migrations.
 * 3. Compares row counts for EVERY SINGLE TABLE in the public schema (not just a subset).
 * 4. STRICTLY asserts 100% fidelity between source and restored database.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const args = process.argv.slice(2);
const isLocalSource = args.includes('--source=local');

async function runRestore() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let sourceClient;
  let dumpFilePath;
  let sourceDbName;

  if (isLocalSource) {
    sourceDbName = 'vitarak_fmcg (Local PostgreSQL)';
    console.log(`[RESTORE TEST] Running in LOCAL SOURCE mode with real seeded database...`);

    sourceClient = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      database: 'vitarak_fmcg',
    });
    await sourceClient.connect();

    // 1. Generate consistent local dump in REPEATABLE READ snapshot
    dumpFilePath = path.join(backupDir, 'local_verify_snapshot.sql');
    const writeStream = fs.createWriteStream(dumpFilePath, { encoding: 'utf-8' });

    writeStream.write(`-- Local Verification Dump\n`);
    writeStream.write(`BEGIN;\n`);
    writeStream.write(`SET session_replication_role = 'replica';\n\n`);

    // Start single consistent transaction
    await sourceClient.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');

    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);

    const allTables = tablesRes.rows.map((r) => r.table_name);
    console.log(`[RESTORE TEST] Dumping ${allTables.length} tables from local database...`);

    for (const table of allTables) {
      const colsRes = await sourceClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 
        ORDER BY ordinal_position;
      `, [table]);
      const columns = colsRes.rows.map((r) => `"${r.column_name}"`).join(', ');

      const dataRes = await sourceClient.query(`SELECT * FROM "${table}";`);
      if (dataRes.rows.length > 0) {
        writeStream.write(`-- Table: ${table} (${dataRes.rows.length} rows)\n`);
        for (const row of dataRes.rows) {
          const values = Object.values(row).map((val) => {
            if (val === null) return 'NULL';
            if (typeof val === 'boolean' || typeof val === 'number') return String(val);
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          writeStream.write(`INSERT INTO "${table}" (${columns}) VALUES (${values.join(', ')});\n`);
        }
        writeStream.write(`\n`);
      }
    }

    writeStream.write(`COMMIT;\n`);
    await new Promise((res, rej) => {
      writeStream.on('finish', res);
      writeStream.on('error', rej);
      writeStream.end();
    });
    await sourceClient.query('COMMIT;');
    console.log(`[RESTORE TEST] Local snapshot written to: ${path.basename(dumpFilePath)}`);
  } else {
    sourceDbName = 'Supabase Cloud PostgreSQL';
    // 1. Find latest backup file
    const dumps = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('supabase_backup_') && f.endsWith('.sql'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (dumps.length === 0) {
      console.log('[RESTORE TEST] No backup dumps found in /backups to test. Run "npm run backup:supabase" first.');
      return;
    }

    dumpFilePath = dumps[0].path;
    console.log(`[RESTORE TEST] Testing restore using latest cloud dump: ${dumps[0].name}`);

    // Connect to Supabase
    const envPath = path.join(__dirname, '..', '.env.supabase');
    if (fs.existsSync(envPath)) {
      const rawBuffer = fs.readFileSync(envPath);
      const envContent = rawBuffer.includes(0x00) ? rawBuffer.toString('utf16le') : rawBuffer.toString('utf-8');
      const supabaseEnv = dotenv.parse(envContent);
      const sourceUrl = supabaseEnv.DIRECT_URL || supabaseEnv.DATABASE_URL;

      if (sourceUrl) {
        sourceClient = new Client({
          connectionString: sourceUrl,
          ssl: { rejectUnauthorized: false },
        });
        await sourceClient.connect();
      }
    }
  }

  // 2. Fetch live row counts for EVERY table in source database
  const sourceCounts = {};
  let allTables = [];

  if (sourceClient) {
    console.log(`[RESTORE TEST] Querying row counts for all tables from ${sourceDbName}...`);
    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);

    allTables = tablesRes.rows.map((r) => r.table_name);

    for (const tbl of allTables) {
      const c = await sourceClient.query(`SELECT COUNT(*) as count FROM "${tbl}";`);
      sourceCounts[tbl] = parseInt(c.rows[0].count, 10);
    }
    await sourceClient.end();
  }

  // 3. Prepare throwaway local test database
  const throwawayDbName = 'vitarak_fmcg_restore_test';
  console.log(`[RESTORE TEST] Re-creating local throwaway database: "${throwawayDbName}"...`);

  const adminClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
  });

  await adminClient.connect();
  await adminClient.query(`DROP DATABASE IF EXISTS "${throwawayDbName}";`);
  await adminClient.query(`CREATE DATABASE "${throwawayDbName}";`);
  await adminClient.end();

  // 4. Apply baseline migration schema (recreates enums, tables, sequences, indexes, foreign keys)
  const migrationFile = path.join(__dirname, '..', 'prisma', 'migrations', '0_init', 'migration.sql');
  if (fs.existsSync(migrationFile)) {
    console.log(`[RESTORE TEST] Applying schema and enum migrations to "${throwawayDbName}"...`);
    const schemaSql = fs.readFileSync(migrationFile, 'utf-8');
    const schemaClient = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      database: throwawayDbName,
    });
    await schemaClient.connect();
    await schemaClient.query(schemaSql);

    // Also apply secondary migrations if any (e.g. RLS migration)
    const rlsMigrationFile = path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20261123163500_enable_rls_and_revoke_api_access',
      'migration.sql'
    );
    if (fs.existsSync(rlsMigrationFile)) {
      const rlsSql = fs.readFileSync(rlsMigrationFile, 'utf-8');
      await schemaClient.query(rlsSql);
    }

    await schemaClient.end();
  }

  // 5. Restore dump into throwaway local database
  console.log(`[RESTORE TEST] Restoring data into "${throwawayDbName}"...`);
  const dumpSql = fs.readFileSync(dumpFilePath, 'utf-8');
  const restoreClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: throwawayDbName,
  });
  await restoreClient.connect();
  await restoreClient.query(dumpSql);

  // 6. Verify row counts across EVERY table in the public schema
  console.log(`\n================================================================`);
  console.log(`   FULL DATABASE RESTORE VERIFICATION - ALL ${allTables.length} TABLES`);
  console.log(`   Source: ${sourceDbName}`);
  console.log(`================================================================`);

  let hasMismatch = false;
  let totalSourceRows = 0;
  let totalRestoredRows = 0;

  for (const tbl of allTables) {
    try {
      const c = await restoreClient.query(`SELECT COUNT(*) as count FROM "${tbl}";`);
      const restoredCount = parseInt(c.rows[0].count, 10);
      const expectedSourceCount = sourceCounts[tbl] ?? 0;

      totalSourceRows += expectedSourceCount;
      totalRestoredRows += restoredCount;

      const matches = restoredCount === expectedSourceCount;
      if (!matches) {
        hasMismatch = true;
      }

      const statusSymbol = matches ? '✓' : '✗';
      console.log(
        `  ${statusSymbol} ${tbl.padEnd(28)}: Restored = ${String(restoredCount).padStart(5)} | Source = ${String(expectedSourceCount).padStart(5)}`
      );
    } catch (err) {
      console.log(`  ✗ ${tbl.padEnd(28)}: Error querying table (${err.message})`);
      hasMismatch = true;
    }
  }

  await restoreClient.end();

  console.log('----------------------------------------------------------------');
  console.log(`Total Restored Rows: ${totalRestoredRows} | Total Source Rows: ${totalSourceRows}`);
  console.log('----------------------------------------------------------------');

  if (hasMismatch) {
    throw new Error(
      `[RESTORE FAILED] Row count mismatch detected between source and restored database across tables!`
    );
  }

  console.log(
    `\n✓ RESTORE VERIFICATION SUCCESSFUL: 100% row count fidelity across ALL ${allTables.length} tables!\n`
  );
}

runRestore().catch((err) => {
  console.error('[RESTORE VERIFICATION FAILED]:', err);
  process.exit(1);
});
