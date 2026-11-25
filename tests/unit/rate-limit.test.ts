import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, clearRateLimit, hashRateLimitKey } from '@/lib/rate-limit';
import { prisma } from '@/lib/db/prisma';

describe('Persistent Database Rate Limiter Service', () => {
  const testKey = 'test_ip_192_168_1_50';

  beforeEach(async () => {
    await clearRateLimit(testKey);
  });

  it('allows requests within limit and decrements remaining quota', async () => {
    const res1 = await checkRateLimit(testKey, 5, 10);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(4);

    const res2 = await checkRateLimit(testKey, 5, 10);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(3);
  });

  it('persists attempts directly in the PostgreSQL database table', async () => {
    await checkRateLimit(testKey, 5, 10);
    await checkRateLimit(testKey, 5, 10);

    const count = await prisma.rateLimitEntry.count({
      where: { key: hashRateLimitKey(testKey) },
    });
    expect(count).toBe(2);
  });

  it('blocks requests once limit is exceeded and provides reset duration', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit(testKey, 3, 10);
      expect(res.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(testKey, 3, 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });
});
