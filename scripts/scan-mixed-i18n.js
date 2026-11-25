const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const results = [];

  lines.forEach((line, idx) => {
    // Check ternary: language === 'hi' ? '...' : '...'
    const regex1 = /language\s*===\s*['"]hi['"]\s*\?\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = regex1.exec(line)) !== null) {
      const text = match[1];
      if (/[a-zA-Z]/.test(text)) {
        results.push({ lineNum: idx + 1, text, fullLine: line.trim() });
      }
    }

    // Also check: '...' : '...' where the first branch was for 'hi'
    const regex2 = /\?\s*['"`]([\u0900-\u097F\s\w()\[\].,\-_]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g;
    while ((match = regex2.exec(line)) !== null) {
      const text = match[1];
      if (/[\u0900-\u097F]/.test(text) && /[a-zA-Z]/.test(text)) {
        if (!results.find(r => r.lineNum === idx + 1 && r.text === text)) {
          results.push({ lineNum: idx + 1, text, fullLine: line.trim() });
        }
      }
    }
  });

  return results;
}

function scanDir(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.next', '.git'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (stat.isFile() && /\.(tsx|ts)$/.test(item) && !item.includes('.test.')) {
      const issues = scanFile(full);
      if (issues.length > 0) {
        console.log(`\n=== ${full} (${issues.length} issues) ===`);
        issues.forEach(iss => console.log(`  Line ${iss.lineNum}: "${iss.text}"\n    -> ${iss.fullLine}`));
      }
    }
  }
}

scanDir('components');
scanDir('app');
scanDir('lib/i18n');
