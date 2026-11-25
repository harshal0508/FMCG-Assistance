import crypto from 'crypto';

/**
 * Token Service for Retailer Link Security
 * 
 * Shop links use cryptographically secure random 256-bit tokens.
 * Plaintext tokens are NEVER stored in the database. Only the SHA-256 hash is persisted.
 * If a database is dumped, tokens cannot be forged or leaked.
 */

export interface GeneratedToken {
  rawToken: string;   // Given to the shopkeeper via personal link (e.g. /r/vtr_...)
  tokenHash: string;  // Stored in the database `shop_tokens.token_hash`
  expiresAt: Date;
}

const TOKEN_PREFIX = 'vtr_';
const DEFAULT_EXPIRY_DAYS = 365; // Long-lived for shopkeeper convenience, revokable anytime

/**
 * Generates a cryptographically secure random token and its SHA-256 hash.
 */
export function generateShopToken(validityDays = DEFAULT_EXPIRY_DAYS): GeneratedToken {
  // 32 bytes = 256 bits of entropy
  const randomBytes = crypto.randomBytes(32).toString('base64url');
  const rawToken = `${TOKEN_PREFIX}${randomBytes}`;
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Produces deterministic SHA-256 hex hash of the raw token.
 */
export function hashToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Validates a raw token against stored hash, checking revocation and expiry.
 */
export function validateTokenStatus(
  rawToken: string,
  storedHash: string,
  expiresAt?: Date | null,
  revokedAt?: Date | null
): {
  isValid: boolean;
  reason?: 'MATCH_FAILED' | 'REVOKED' | 'EXPIRED';
} {
  const computedHash = hashToken(rawToken);

  // Constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(computedHash, 'utf-8');
  const bufB = Buffer.from(storedHash, 'utf-8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { isValid: false, reason: 'MATCH_FAILED' };
  }

  if (revokedAt && revokedAt <= new Date()) {
    return { isValid: false, reason: 'REVOKED' };
  }

  if (expiresAt && expiresAt <= new Date()) {
    return { isValid: false, reason: 'EXPIRED' };
  }

  return { isValid: true };
}
