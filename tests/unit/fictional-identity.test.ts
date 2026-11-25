import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Strict Fictional Identity Enforcement (Part 1.2 Compliance)', () => {
  const PROHIBITED_STRINGS = [
    'Abhishek',
    'Hingad',
    'abhishekg',
    'okhdfcbank',
    'Malwa',
    'Ramesh Chandra Jain',
    'Jain Enterprise',
    'owner@jainenterprise.demo',
    '9800000001',
  ];

  const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'backups', 'coverage']);

  function scanDirectory(dir: string): { file: string; match: string }[] {
    const results: { file: string; match: string }[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          results.push(...scanDirectory(path.join(dir, entry.name)));
        }
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        // Exclude this test file itself from self-matching
        if (filePath.endsWith('fictional-identity.test.ts')) continue;
        // Only inspect code, config, and script files
        if (
          !filePath.endsWith('.ts') &&
          !filePath.endsWith('.tsx') &&
          !filePath.endsWith('.js') &&
          !filePath.endsWith('.json') &&
          !filePath.endsWith('.sql')
        ) {
          continue;
        }

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const target of PROHIBITED_STRINGS) {
            if (content.includes(target)) {
              results.push({ file: filePath, match: target });
            }
          }
        } catch {
          // ignore binary
        }
      }
    }
    return results;
  }

  it('ensures no prohibited personal, real business, or non-fictional identity strings exist in repository source code', () => {
    const violations = scanDirectory(process.cwd());
    if (violations.length > 0) {
      console.error('Prohibited identity violations detected:', violations);
    }
    expect(violations).toEqual([]);
  });

  it('verifies demo identity constants adhere to strictly fictional patterns', () => {
    const seedContent = fs.readFileSync(path.join(process.cwd(), 'prisma/seed.ts'), 'utf8');
    expect(seedContent).toContain("name: 'Demo Traders'");
    expect(seedContent).toContain("owner_name: 'Demo Owner'");
    expect(seedContent).toContain("email: 'demo@example.invalid'");
    expect(seedContent).toContain("phone: '9000000000'");
    expect(seedContent).toContain("upi_id: 'demo@invalid'");
  });
});
