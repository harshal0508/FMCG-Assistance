/**
 * Supabase Automated Daily Backup Script (Universal Consistent Snapshot Engine)
 * 
 * Guarantees:
 * 1. Single Consistent Snapshot: Uses `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;`
 *    so all tables and sequence states reflect the exact same instant in time.
 * 2. Full Sequence State: Captures `setval(...)` for all public sequences so auto-increment IDs continue seamlessly.
 * 3. Schema & Constraints: Fully reproducible in tandem with versioned Prisma migrations.
 * 4. Cross-Version Resilience: Direct PostgreSQL wire protocol eliminates pg_dump client/server mismatches (e.g. PG 15 vs PG 17).
 * 5. 14 Daily Rolling Retentions saved to /backups.
 * 6. NEVER prints, logs, or leaks credentials or secrets.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

async function main() {
  // 1. Load .env.supabase safely
  const envPath = path.join(__dirname, '..', '.env.supabase');
  if (!fs.existsSync(envPath)) {
    console.error('[BACKUP ERROR] .env.supabase not found.');
    process.exit(1);
  }

  const rawBuffer = fs.readFileSync(envPath);
  const envContent = rawBuffer.includes(0x00) ? rawBuffer.toString('utf16le') : rawBuffer.toString('utf-8');
  const supabaseEnv = dotenv.parse(envContent);

  const targetUrl = supabaseEnv.DIRECT_URL || supabaseEnv.DATABASE_URL;
  if (!targetUrl) {
    console.error('[BACKUP ERROR] No DATABASE_URL or DIRECT_URL found in .env.supabase.');
    process.exit(1);
  }

  // 2. Prepare Backup Folder
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 3. Format Date Filename
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `supabase_backup_${timestamp}.sql`;
  const targetFile = path.join(backupDir, filename);

  console.log(`[BACKUP] Connecting to Supabase to generate full consistent snapshot dump...`);

  // Strip sslmode parameter so pg client uses explicit ssl options
  const cleanUrl = targetUrl.replace(/[?&]sslmode=[^&]+/g, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  // 4. Enforce Consistent Point-in-Time Snapshot
  // Guarantees all table queries see the exact same transaction state without locks or drift
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');

  const writeStream = fs.createWriteStream(targetFile, { encoding: 'utf-8' });

  writeStream.write(`-- Vitarak FMCG Platform - Supabase Consistent Database Backup\n`);
  writeStream.write(`-- Generated: ${now.toISOString()}\n`);
  writeStream.write(`-- Isolation Level: REPEATABLE READ (Consistent Point-in-Time Snapshot)\n\n`);
  writeStream.write(`BEGIN;\n`);
  writeStream.write(`SET statement_timeout = 0;\n`);
  writeStream.write(`SET lock_timeout = 0;\n`);
  writeStream.write(`SET client_encoding = 'UTF8';\n`);
  writeStream.write(`SET session_replication_role = 'replica';\n\n`);

  // 5. Query all domain tables in public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map((r) => r.table_name);
  console.log(`[BACKUP] Dumping data from ${tables.length} tables under consistent transaction...`);

  for (const table of tables) {
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    const cols = colsRes.rows.map((c) => c.column_name);
    if (cols.length === 0) continue;

    const rowsRes = await client.query(`SELECT * FROM "${table}"`);
    const rows = rowsRes.rows;

    writeStream.write(`-- Table: ${table} (${rows.length} rows)\n`);

    if (rows.length > 0) {
      const colList = cols.map((c) => `"${c}"`).join(', ');

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const valueClauses = batch.map((row) => {
          const vals = cols.map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return String(v);
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          return `(${vals.join(', ')})`;
        });

        writeStream.write(`INSERT INTO "${table}" (${colList}) VALUES\n  ${valueClauses.join(',\n  ')};\n`);
      }
    }
    writeStream.write(`\n`);
  }

  // 6. Dump Sequences State (Captures setval for all sequences)
  const seqRes = await client.query(`
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name;
  `);

  if (seqRes.rows.length > 0) {
    writeStream.write(`-- Sequence States\n`);
    for (const seqRow of seqRes.rows) {
      const seqName = seqRow.sequence_name;
      try {
        const valRes = await client.query(`SELECT last_value, is_called FROM "${seqName}"`);
        if (valRes.rows.length > 0) {
          const { last_value, is_called } = valRes.rows[0];
          writeStream.write(`SELECT pg_catalog.setval('public."${seqName}"', ${last_value}, ${is_called ? 'true' : 'false'});\n`);
        }
      } catch {
        // Skip if permission or system sequence
      }
    }
    writeStream.write(`\n`);
  }

  writeStream.write(`SET session_replication_role = 'origin';\n`);
  writeStream.write(`COMMIT;\n`);

  // Close live snapshot transaction and connection
  await client.query('COMMIT;');
  await client.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });

  const stats = fs.statSync(targetFile);
  const sizeKb = (stats.size / 1024).toFixed(2);
  console.log(`✓ Backup completed successfully: ${filename} (${sizeKb} KB)`);

  // Record metadata for Admin Portal
  const metaFile = path.join(backupDir, 'latest-backup.json');
  fs.writeFileSync(
    metaFile,
    JSON.stringify({
      lastBackupDate: now.toISOString(),
      filename,
      sizeBytes: stats.size,
      tablesCount: tables.length,
      snapshotIsolation: 'REPEATABLE READ',
    }, null, 2),
    'utf-8'
  );

  // 7. Retain 14 rolling backups
  const allFiles = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('supabase_backup_') && f.endsWith('.sql'))
    .map((f) => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  if (allFiles.length > 14) {
    const toDelete = allFiles.slice(14);
    for (const item of toDelete) {
      fs.unlinkSync(item.path);
    }
  }

  console.log(`✓ Retaining ${Math.min(allFiles.length, 14)} rolling daily backups in /backups.`);
}

main().catch((err) => {
  const sanitized = err.message.replace(/:[^:@]+@/g, ':****@');
  console.error('[BACKUP FAILED]:', sanitized);
  process.exit(1);
});
