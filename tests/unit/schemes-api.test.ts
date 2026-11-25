import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { evaluateScheme, AnySchemeRuleSchema, CartItemInput } from '@/lib/services/schemes';
import { SchemeType } from '@prisma/client';

describe('B5: Schemes API, Rules, and Live Cart Simulator', () => {
  let tenantId: string;
  let prod1Id: string;
  let prod2Id: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: { products: true },
    });
    if (!tenant) throw new Error('No tenant found');
    tenantId = tenant.id;
    prod1Id = tenant.products[0].id;
    prod2Id = tenant.products[1].id;
  });

  it('validates and evaluates FREE_GOODS scheme (Buy 10 -> Get 1 Free)', () => {
    const rule = {
      type: 'FREE_GOODS' as const,
      triggerProductIds: [prod1Id],
      triggerQuantityBase: 10,
      rewardProductId: prod2Id,
      rewardQuantityBase: 1,
    };

    expect(AnySchemeRuleSchema.safeParse(rule).success).toBe(true);

    const scheme = {
      id: 'test_fg',
      name: 'Buy 10 Get 1 Free',
      type: 'FREE_GOODS',
      rule_json: JSON.stringify(rule),
      start_date: new Date(Date.now() - 100000),
      end_date: new Date(Date.now() + 100000),
      is_active: true,
    };

    // Cart with 25 units -> should earn 2 free units (floor(25/10) = 2)
    const cart: CartItemInput[] = [
      { productId: prod1Id, quantityBase: 25, unitPricePaise: 10000 },
    ];

    const result = evaluateScheme(scheme, cart);
    expect(result).not.toBeNull();
    expect(result?.appliedCount).toBe(2);
    expect(result?.freeGoods[0].quantityBase).toBe(2);
    expect(result?.freeGoods[0].productId).toBe(prod2Id);
  });

  it('validates and evaluates SLAB_DISCOUNT scheme', () => {
    const rule = {
      type: 'SLAB_DISCOUNT' as const,
      targetProductIds: [prod1Id],
      slabs: [
        { minQuantityBase: 5, discountPaisePerUnit: 25000 }, // ₹250 off per unit for >= 5
        { minQuantityBase: 20, discountPaisePerUnit: 50000 }, // ₹500 off per unit for >= 20
      ],
    };

    expect(AnySchemeRuleSchema.safeParse(rule).success).toBe(true);

    const scheme = {
      id: 'test_slab',
      name: 'Volume Slab Discount',
      type: 'SLAB_DISCOUNT',
      rule_json: JSON.stringify(rule),
      start_date: new Date(Date.now() - 100000),
      end_date: new Date(Date.now() + 100000),
      is_active: true,
    };

    // Cart with 22 units -> hits the 20+ slab (22 * 50000 = 1,100,000 paise / ₹11,000)
    const cart: CartItemInput[] = [
      { productId: prod1Id, quantityBase: 22, unitPricePaise: 200000 },
    ];

    const result = evaluateScheme(scheme, cart);
    expect(result).not.toBeNull();
    expect(result?.discountPaise).toBe(1100000);
  });

  it('validates and evaluates COMBO scheme', () => {
    const rule = {
      type: 'COMBO' as const,
      requiredItems: [
        { productId: prod1Id, quantityBase: 2 },
        { productId: prod2Id, quantityBase: 1 },
      ],
      flatDiscountPaise: 15000, // ₹150 off per combo
    };

    expect(AnySchemeRuleSchema.safeParse(rule).success).toBe(true);

    const scheme = {
      id: 'test_combo',
      name: 'Breakfast Combo',
      type: 'COMBO',
      rule_json: JSON.stringify(rule),
      start_date: new Date(Date.now() - 100000),
      end_date: new Date(Date.now() + 100000),
      is_active: true,
    };

    // Cart with 5 units of prod1 and 2 units of prod2 -> can form 2 complete combos
    const cart: CartItemInput[] = [
      { productId: prod1Id, quantityBase: 5, unitPricePaise: 5000 },
      { productId: prod2Id, quantityBase: 2, unitPricePaise: 8000 },
    ];

    const result = evaluateScheme(scheme, cart);
    expect(result).not.toBeNull();
    expect(result?.appliedCount).toBe(2);
    expect(result?.discountPaise).toBe(30000); // 2 * 15000 = 30000 paise / ₹300
  });

  it('rejects expired schemes', () => {
    const rule = {
      type: 'SLAB_DISCOUNT' as const,
      targetProductIds: [prod1Id],
      slabs: [{ minQuantityBase: 5, discountPaisePerUnit: 25000 }],
    };

    const expiredScheme = {
      id: 'expired',
      name: 'Expired Scheme',
      type: 'SLAB_DISCOUNT',
      rule_json: JSON.stringify(rule),
      start_date: new Date(Date.now() - 200000),
      end_date: new Date(Date.now() - 100000), // In the past
      is_active: true,
    };

    const cart: CartItemInput[] = [
      { productId: prod1Id, quantityBase: 10, unitPricePaise: 10000 },
    ];

    const result = evaluateScheme(expiredScheme, cart);
    expect(result).toBeNull();
  });
});
