import { describe, it, expect } from 'vitest';
import {
  evaluateEntitlement,
  PILOT_PLAN,
  UsageState,
  PlanLimits,
} from '@/lib/services/entitlements';

describe('Entitlement Service - Plan Limits & Feature Enforcement', () => {
  const mockUsage: UsageState = {
    activeShopsCount: 30,
    whatsappSentCount: 150,
    aiCallsCount: 10,
    aiParsesCount: 25,
    staffUsersCount: 3,
  };

  it('allows actions comfortably within pilot plan limits', () => {
    const result = evaluateEntitlement('whatsapp_messages', mockUsage, PILOT_PLAN, 50);

    expect(result.allowed).toBe(true);
    expect(result.currentUsage).toBe(150);
    expect(result.limit).toBe(10000);
    expect(result.remaining).toBe(9850);
  });

  it('blocks actions when usage exceeds plan limit', () => {
    const strictPlan: PlanLimits = {
      ...PILOT_PLAN,
      maxWhatsappMessages: 100,
    };

    const result = evaluateEntitlement('whatsapp_messages', mockUsage, strictPlan, 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Limit exceeded for whatsapp_messages');
    expect(result.remaining).toBe(0);
  });

  it('blocks actions when feature flag is explicitly disabled in plan', () => {
    const limitedPlan: PlanLimits = {
      ...PILOT_PLAN,
      flags: {
        ...PILOT_PLAN.flags,
        pdf_import: false,
      },
    };

    const result = evaluateEntitlement('pdf_import', mockUsage, limitedPlan);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Feature "pdf_import" is disabled');
  });

  it('enforces 5,000 product limit for pilot plan (F5 compliance)', () => {
    const usageWithProducts: UsageState = {
      ...mockUsage,
      productsCount: 4999,
    };

    // Adding 1 product (4999 + 1 = 5000) is allowed
    const allowResult = evaluateEntitlement('products', usageWithProducts, PILOT_PLAN, 1);
    expect(allowResult.allowed).toBe(true);
    expect(allowResult.limit).toBe(5000);

    // Adding 2 products (4999 + 2 = 5001) exceeds 5000 and is blocked
    const blockResult = evaluateEntitlement('products', usageWithProducts, PILOT_PLAN, 2);
    expect(blockResult.allowed).toBe(false);
    expect(blockResult.reason).toContain('Limit exceeded for products');
  });

  it('enforces exact pilot plan limits: 500 shops, 10,000 orders/mo, 3 devices (Item 2 compliance)', () => {
    expect(PILOT_PLAN.maxProducts).toBe(5000);
    expect(PILOT_PLAN.maxActiveShops).toBe(500);
    expect(PILOT_PLAN.maxOrdersPerMonth).toBe(10000);
    expect(PILOT_PLAN.maxDevices).toBe(3);

    // Shops limit
    const shopsAtLimit = evaluateEntitlement('active_shops', { ...mockUsage, activeShopsCount: 500 }, PILOT_PLAN, 1);
    expect(shopsAtLimit.allowed).toBe(false);

    // Orders limit
    const ordersWithin = evaluateEntitlement('orders', { ...mockUsage, ordersCount: 9999 }, PILOT_PLAN, 1);
    expect(ordersWithin.allowed).toBe(true);
    const ordersExceeded = evaluateEntitlement('orders', { ...mockUsage, ordersCount: 10000 }, PILOT_PLAN, 1);
    expect(ordersExceeded.allowed).toBe(false);

    // Devices limit (3 devices max)
    const devicesAtLimit = evaluateEntitlement('devices', { ...mockUsage, devicesCount: 3 }, PILOT_PLAN, 1);
    expect(devicesAtLimit.allowed).toBe(false);
  });
});
