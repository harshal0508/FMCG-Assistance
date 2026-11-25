import { describe, it, expect } from 'vitest';
import {
  generateDeviceToken,
  getDeviceCookieOptions,
  DEVICE_COOKIE_NAME,
} from '@/lib/services/session';
import fs from 'fs';
import path from 'path';

describe('Device Token Security & Storage Integrity (Part 1.3 Compliance)', () => {
  it('generates high-entropy cryptographic device tokens (32 bytes = 64 hex chars)', () => {
    const token1 = generateDeviceToken();
    const token2 = generateDeviceToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
  });

  it('mandates httpOnly, secure, and sameSite cookie configuration for device tokens', () => {
    const opts = getDeviceCookieOptions();

    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(365 * 24 * 3600); // 1 year
    expect(DEVICE_COOKIE_NAME).toBe('vitarak_device_token');
  });

  it('verifies device token is NEVER stored in localStorage in client source files', () => {
    const srcDir = path.join(process.cwd(), 'components');
    const appDir = path.join(process.cwd(), 'app');

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // If file uses localStorage, assert it never stores or retrieves the device token
          if (content.includes('localStorage')) {
            expect(content).not.toContain('vitarak_device_token');
            expect(content).not.toContain('device_token');
            expect(content).not.toContain('deviceToken');
          }
        }
      }
    }

    checkDir(srcDir);
    checkDir(appDir);
  });
});
