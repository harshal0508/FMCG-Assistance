import { describe, it, expect } from 'vitest';
import { DICTIONARY, TranslationKey } from '../../lib/i18n/translations';
import fs from 'fs';
import path from 'path';

describe('Strict Single-Language i18n System', () => {
  it('guarantees 100% key parity between English and Hindi dictionaries', () => {
    const enKeys = Object.keys(DICTIONARY.en) as TranslationKey[];
    const hiKeys = Object.keys(DICTIONARY.hi) as TranslationKey[];

    expect(enKeys.length).toBeGreaterThan(30);
    expect(hiKeys.length).toBe(enKeys.length);

    for (const key of enKeys) {
      expect(DICTIONARY.hi[key], `Missing Hindi translation for key "${key}"`).toBeDefined();
      expect(typeof DICTIONARY.hi[key]).toBe('string');
      expect(DICTIONARY.hi[key].trim().length).toBeGreaterThan(0);
    }

    for (const key of hiKeys) {
      expect(DICTIONARY.en[key], `Missing English translation for key "${key}"`).toBeDefined();
      expect(typeof DICTIONARY.en[key]).toBe('string');
      expect(DICTIONARY.en[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('strictly forbids bilingual slash or composite patterns in UI labels', () => {
    const enValues = Object.values(DICTIONARY.en);
    const hiValues = Object.values(DICTIONARY.hi);

    // No bilingual "Item / वस्तु", "Orders / ऑर्डर" slash patterns in UI strings
    const bilingualSlashRegex = /\s\/\s/;
    for (const val of [...enValues, ...hiValues]) {
      expect(val).not.toMatch(bilingualSlashRegex);
    }

    // English values should not contain Devanagari Unicode characters
    const devanagariRegex = /[\u0900-\u097F]/;
    for (const [k, val] of Object.entries(DICTIONARY.en)) {
      if (k === 'changeLanguage' || k === 'hindi') {
        // Explicit language indicator buttons are exempt
        continue;
      }
      expect(val, `English dictionary key "${k}" contains Devanagari text`).not.toMatch(devanagariRegex);
    }
  });

  it('strictly forbids Latin text inside Hindi dictionary entries (Item 4 Compliance)', () => {
    const allowedExceptions = new Set(['changeLanguage', 'english']);
    const latinRegex = /[a-zA-Z]/;

    for (const [key, val] of Object.entries(DICTIONARY.hi)) {
      if (allowedExceptions.has(key)) continue;
      expect(val, `Hindi dictionary key "${key}" contains Latin characters: "${val}"`).not.toMatch(latinRegex);
    }
  });

  it('fails on mixed language composite strings like "खाता (Ledger)"', () => {
    const mixedTestString = 'खाता (Ledger)';
    const mixedBilingualPattern = /[\u0900-\u097F]+.*\([A-Za-z\s]+\)/;
    expect(mixedTestString).toMatch(mixedBilingualPattern);

    // Verify none of the Hindi dictionary strings match the mixed pattern
    for (const [key, val] of Object.entries(DICTIONARY.hi)) {
      expect(val, `Hindi dictionary key "${key}" has mixed pattern: "${val}"`).not.toMatch(mixedBilingualPattern);
    }
  });

  it('scans all UI components ensuring no mixed bilingual patterns exist in Hindi strings', () => {
    const componentDirs = [
      path.join(process.cwd(), 'components'),
      path.join(process.cwd(), 'app'),
    ];

    // Matches any parenthetical English in Hindi strings e.g. "खाता (Ledger)" or "(Partial)"
    const parentheticalEnglish = /\([A-Za-z\s]+\)/;

    function checkDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '.git'].includes(file)) {
            checkDir(full);
          }
        } else if (/\.(tsx|ts)$/.test(file) && !file.includes('.test.')) {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Check for ternary: language === 'hi' ? '...' : '...'
            const matchHi = /language\s*===\s*['"]hi['"]\s*\?\s*['"`]([^'"`]+)['"`]/.exec(line);
            if (matchHi) {
              const hindiText = matchHi[1];
              if (parentheticalEnglish.test(hindiText)) {
                expect.fail(`Found parenthetical English in Hindi text "${hindiText}" at ${file}:${idx + 1}`);
              }
            }

            // Check standalone Hindi strings containing parenthetical English
            if (/[\u0900-\u097F]/.test(line)) {
              // Extract string literals with Devanagari
              const stringMatches = line.matchAll(/['"`]([\u0900-\u097F][^'"`]*)['"`]/g);
              for (const sm of stringMatches) {
                const str = sm[1];
                if (parentheticalEnglish.test(str)) {
                  expect.fail(`Found mixed bilingual string "${str}" at ${file}:${idx + 1}`);
                }
              }
            }
          });
        }
      }
    }

    for (const dir of componentDirs) {
      checkDir(dir);
    }
  });
});
