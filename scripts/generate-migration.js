const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = path.join(__dirname, '..', 'prisma', 'migrations', '0_init');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('Generating baseline migration SQL...');
const sql = execSync('npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', {
  encoding: 'utf-8',
});

const targetFile = path.join(dir, 'migration.sql');
fs.writeFileSync(targetFile, sql, 'utf-8');
console.log('✓ Baseline migration written to prisma/migrations/0_init/migration.sql');
