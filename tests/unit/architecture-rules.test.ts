import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Architecture & Data Layer Boundary Enforcement', () => {
  const allowedDirs = [
    path.join(process.cwd(), 'app'),
    path.join(process.cwd(), 'lib', 'services'),
  ];

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('blocks direct raw SQL execution ($queryRaw / $executeRaw) in app routes and business services', () => {
    const filesToCheck: string[] = [];
    for (const d of allowedDirs) {
      getAllFiles(d, filesToCheck);
    }

    const violations: { file: string; line: number; match: string }[] = [];

    // Except /api/health which pings "SELECT 1"
    const allowedExceptions = ['app\\api\\health\\route.ts', 'app/api/health/route.ts'];

    for (const file of filesToCheck) {
      if (allowedExceptions.some((exc) => file.endsWith(exc))) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('$queryRaw') || line.includes('$executeRaw')) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: index + 1,
            match: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      const details = violations.map((v) => `${v.file}:${v.line} -> "${v.match}"`).join('\n');
      throw new Error(
        `[ARCHITECTURE VIOLATION] Raw SQL execution ($queryRaw/$executeRaw) is forbidden in business and UI code:\n${details}`
      );
    }

    expect(violations.length).toBe(0);
  });
});
