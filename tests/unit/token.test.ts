import { describe, it, expect } from 'vitest';
import {
  generateShopToken,
  hashToken,
  validateTokenStatus,
} from '@/lib/services/token';

describe('Token Service - Cryptographic Shop Token Hashing & Validation', () => {
  it('generates secure tokens with vtr_ prefix and unique entropy', () => {
    const tokenA = generateShopToken();
    const tokenB = generateShopToken();

    expect(tokenA.rawToken.startsWith('vtr_')).toBe(true);
    expect(tokenB.rawToken.startsWith('vtr_')).toBe(true);
    expect(tokenA.rawToken).not.toBe(tokenB.rawToken);
    expect(tokenA.tokenHash).not.toBe(tokenB.tokenHash);
    expect(tokenA.tokenHash).toBe(hashToken(tokenA.rawToken));
  });

  it('validates genuine token successfully against its hash', () => {
    const { rawToken, tokenHash, expiresAt } = generateShopToken(30);
    const result = validateTokenStatus(rawToken, tokenHash, expiresAt, null);

    expect(result.isValid).toBe(true);
  });

  it('rejects tampered or incorrect tokens', () => {
    const { rawToken, tokenHash, expiresAt } = generateShopToken(30);
    const fakeToken = rawToken.slice(0, -3) + 'xyz';
    const result = validateTokenStatus(fakeToken, tokenHash, expiresAt, null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('MATCH_FAILED');
  });

  it('rejects revoked tokens immediately', () => {
    const { rawToken, tokenHash, expiresAt } = generateShopToken(30);
    const revokedDate = new Date(Date.now() - 1000); // Revoked 1s ago
    const result = validateTokenStatus(rawToken, tokenHash, expiresAt, revokedDate);

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('REVOKED');
  });

  it('rejects expired tokens', () => {
    const { rawToken, tokenHash } = generateShopToken(-1); // Expired yesterday
    const result = validateTokenStatus(rawToken, tokenHash, new Date(Date.now() - 86400000), null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });
});
