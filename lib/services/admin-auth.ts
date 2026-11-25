/**
 * Administrator Authentication & Two-Factor (TOTP) Service
 * 
 * Enforces:
 * 1. Email allowlist restriction via `ADMIN_ALLOWED_EMAILS`
 * 2. Google OIDC identity verification
 * 3. RFC 6238 Time-based One-Time Password (TOTP) two-factor authentication
 */

import crypto from 'crypto';
import { prisma } from '../db/prisma';

export const ADMIN_SESSION_COOKIE_NAME = 'vitarak_admin_session';

/**
 * Checks whether an email is included in the admin allowlist.
 */
export function isEmailInAdminAllowlist(email: string): boolean {
  if (!email) return false;
  const allowlistRaw = process.env.ADMIN_ALLOWED_EMAILS || 'admin@vitarak.in';
  const allowed = allowlistRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Base32 decode for TOTP secret
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < base32.length; i++) {
    const c = base32[i].toUpperCase();
    if (c === '=' || c === ' ') continue;
    const val = alphabet.indexOf(c);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Computes RFC 6238 TOTP code for a secret and counter window.
 */
export function generateTotpCode(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against the secret allowing a +/- 1 step window (90s tolerance).
 */
export function verifyTotpCode(secretBase32: string, token: string, timeStepSeconds = 30): boolean {
  if (!secretBase32 || !token || !/^\d{6}$/.test(token)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / timeStepSeconds);

  for (let offset = -1; offset <= 1; offset++) {
    const code = generateTotpCode(secretBase32, currentCounter + offset);
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(token))) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a random Base32 secret for initial TOTP enrollment.
 */
export function generateTotpSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(20);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return secret;
}

/**
 * Authenticates admin via Google sub/email and verifies TOTP.
 */
export async function authenticateAdmin(email: string, googleSub: string, totpCode: string) {
  if (!isEmailInAdminAllowlist(email)) {
    throw new Error('Access denied. This Google account is not on the administrator allowlist.');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin) {
    throw new Error('Admin profile not found. Please contact the platform superadmin.');
  }

  if (admin.totp_enabled && admin.totp_secret) {
    const isValidTotp = verifyTotpCode(admin.totp_secret, totpCode);
    if (!isValidTotp) {
      throw new Error('Invalid Two-Factor Authentication (TOTP) code.');
    }
  }

  // Update last login
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      google_sub: googleSub,
      last_login_at: new Date(),
    },
  });

  return admin;
}
