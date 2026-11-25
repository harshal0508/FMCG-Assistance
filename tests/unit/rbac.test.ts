import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { isDemoLoginAllowed } from '@/lib/services/auth';
import { PATCH as inventoryPatchHandler } from '@/app/api/distributor/inventory/route';
import { PATCH as shopsPatchHandler } from '@/app/api/distributor/shops/route';

describe('Single-Owner Model & Security Enforcement', () => {
  it('proves that inventory PATCH route strictly requires OWNER role (HTTP 403 for non-owners)', async () => {
    const req = new NextRequest('http://localhost:3000/api/distributor/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantProductId: 'prod_test_01',
        ratePaise: 15000,
        actorRole: 'NON_OWNER',
        actorUserId: 'user_unauthorized_01',
      }),
    });

    const res = await inventoryPatchHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/ACCESS DENIED.*Single-owner model/i);
  });

  it('proves that shops PATCH route strictly blocks non-owners from modifying credit hold status (HTTP 403)', async () => {
    const req = new NextRequest('http://localhost:3000/api/distributor/shops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop_test_01',
        holdFlag: true,
        actorRole: 'NON_OWNER',
        actorUserId: 'user_unauthorized_01',
      }),
    });

    const res = await shopsPatchHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/ACCESS DENIED.*Single-owner model/i);
  });

  describe('Demo Login Security Guard (NODE_ENV & ENABLE_DEMO_LOGIN)', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('refuses demo logins when NODE_ENV is production, even if ENABLE_DEMO_LOGIN is set', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ENABLE_DEMO_LOGIN = 'true';
      expect(isDemoLoginAllowed()).toBe(false);
    });

    it('refuses demo logins when in development if ENABLE_DEMO_LOGIN is false or unset', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.ENABLE_DEMO_LOGIN;
      expect(isDemoLoginAllowed()).toBe(false);

      process.env.ENABLE_DEMO_LOGIN = 'false';
      expect(isDemoLoginAllowed()).toBe(false);
    });

    it('allows demo logins ONLY when NODE_ENV === development AND ENABLE_DEMO_LOGIN === true', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      process.env.ENABLE_DEMO_LOGIN = 'true';
      expect(isDemoLoginAllowed()).toBe(true);
    });
  });
});
