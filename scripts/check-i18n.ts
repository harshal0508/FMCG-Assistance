import { DICTIONARY } from '../lib/i18n/translations';

const latinRegex = /[a-zA-Z]/;
const findings: { key: string; val: string }[] = [];

for (const [k, val] of Object.entries(DICTIONARY.hi)) {
  if (latinRegex.test(val)) {
    findings.push({ key: k, val });
  }
}

console.log('Total keys with Latin in Hindi:', findings.length);
findings.forEach(f => console.log(`${f.key}: "${f.val}"`));
