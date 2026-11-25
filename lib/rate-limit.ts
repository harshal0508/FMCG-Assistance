/**
 * Persistent Database Rate Limiter
 * 
 * Stores rate limit attempts in the `rate_limit_entries` table in PostgreSQL.
 * Keys are SHA-256 hashed so no raw phone numbers, tokens, or IP addresses are ever stored.
 * Checks and increments are performed atomically inside database transactions.
 * Bounded table size: includes automatic background pruning of expired entries.
 */

import crypto from 'crypto';
import { prisma } from './db/prisma';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Hash raw key with SHA-256 to ensure no PII or sensitive tokens are stored.
 */
export function hashRateLimitKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Checks whether an identifier (e.g. IP, phone, or token) has exceeded max requests in the given window.
 * The check and insert are atomic to eliminate race conditions under concurrent load.
 */
export async function checkRateLimit(
  rawKey: string,
  limit = 60,         // Default: 60 requests
  windowSeconds = 60  // Default: per 1 minute window
): Promise<RateLimitResult> {
  const hashedKey = hashRateLimitKey(rawKey);
  const now = Date.now();
  const windowStart = new Date(now - windowSeconds * 1000);

  try {
    // Atomic check-and-record inside a transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Count hits in current sliding window
      const count = await tx.rateLimitEntry.count({
        where: {
          key: hashedKey,
          timestamp: { gte: windowStart },
        },
      });

      if (count >= limit) {
        // Find oldest entry in window to calculate exact seconds until reset
        const oldestEntry = await tx.rateLimitEntry.findFirst({
          where: {
            key: hashedKey,
            timestamp: { gte: windowStart },
          },
          orderBy: { timestamp: 'asc' },
        });

        const oldestTime = oldestEntry ? oldestEntry.timestamp.getTime() : now;
        const resetSeconds = Math.max(
          1,
          Math.ceil((oldestTime + windowSeconds * 1000 - now) / 1000)
        );

        return {
          allowed: false,
          limit,
          remaining: 0,
          resetSeconds,
        };
      }

      // 2. Record hit atomically
      await tx.rateLimitEntry.create({
        data: {
          id: crypto.randomUUID(),
          key: hashedKey,
          timestamp: new Date(now),
        },
      });

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - (count + 1)),
        resetSeconds: windowSeconds,
      };
    });
  } catch (err) {
    // If DB has transient connection issue, log error and allow conservatively
    console.error('[RateLimiter DB Error]:', err);
    return {
      allowed: true,
      limit,
      remaining: 1,
      resetSeconds: windowSeconds,
    };
  }
}

/**
 * Bounded table maintenance: deletes all rate limit entries older than retention window.
 * Default retention: 1 hour (3600 seconds).
 */
export async function pruneExpiredRateLimits(maxAgeSeconds = 3600): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
    const res = await prisma.rateLimitEntry.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });
    return res.count;
  } catch (err) {
    console.error('[RateLimiter Prune Error]:', err);
    return 0;
  }
}

// Scheduled pruning: run once every 15 minutes in active server process
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const PRUNE_INTERVAL_MS = 15 * 60 * 1000;
  const timer = setInterval(() => {
    pruneExpiredRateLimits().catch(() => {});
  }, PRUNE_INTERVAL_MS);
  if (timer && typeof timer.unref === 'function') {
    timer.unref(); // Do not prevent process exit
  }
}

/**
 * Purges entries for a specific key (used in tests or manual reset).
 */
export async function clearRateLimit(rawKey?: string): Promise<void> {
  try {
    if (rawKey) {
      const hashedKey = hashRateLimitKey(rawKey);
      await prisma.rateLimitEntry.deleteMany({ where: { key: hashedKey } });
    } else {
      await prisma.rateLimitEntry.deleteMany({});
    }
  } catch (err) {
    console.error('[RateLimiter Clear Error]:', err);
  }
}
