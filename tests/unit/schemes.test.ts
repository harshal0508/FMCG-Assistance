import { describe, it, expect } from 'vitest';
import { evaluateScheme, AnySchemeRuleSchema } from '@/lib/services/schemes';

describe('Schemes Calculation Engine', () => {
  const prodWafers = 'prod_wafers_01';
  const prodBiscuits = 'prod_biscuits_02';
  const prodOil = 'prod_oil_03';
  const prodFlour = 'prod_flour_04';
  const prodGhee = 'prod_ghee_05';

  const validDates = {
    start_date: new Date('2026-01-01'),
    end_date: new Date('2026-12-31'),
    is_active: true,
  };

  describe('Zod Schema Validation', () => {
    it('validates a correct Free Goods scheme rule', () => {
      const rule = {
        type: 'FREE_GOODS',
        triggerProductIds: [prodWafers],
        triggerQuantityBase: 10,
        rewardProductId: prodBiscuits,
        rewardQuantityBase: 1,
      };
      const parsed = AnySchemeRuleSchema.safeParse(rule);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid scheme types or negative numbers', () => {
      const invalid = {
        type: 'FREE_GOODS',
        triggerProductIds: [prodWafers],
        triggerQuantityBase: -5,
        rewardProductId: prodBiscuits,
        rewardQuantityBase: 0,
      };
      const parsed = AnySchemeRuleSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Free Goods Scheme Evaluation', () => {
    const freeGoodsScheme = {
      id: 'scheme_free_1',
      name: 'Buy 10 Bundles Wafers, Get 1 Pkt Biscuit Free',
      type: 'FREE_GOODS',
      rule_json: JSON.stringify({
        type: 'FREE_GOODS',
        triggerProductIds: [prodWafers],
        triggerQuantityBase: 10,
        rewardProductId: prodBiscuits,
        rewardQuantityBase: 1,
      }),
      ...validDates,
    };

    it('applies free goods accurately when qualifying quantity is met', () => {
      const cart = [{ productId: prodWafers, quantityBase: 25, unitPricePaise: 1650 }];
      const result = evaluateScheme(freeGoodsScheme, cart);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('FREE_GOODS');
      expect(result?.freeGoods[0].productId).toBe(prodBiscuits);
      expect(result?.freeGoods[0].quantityBase).toBe(2); // floor(25/10) = 2 free biscuits
      expect(result?.appliedCount).toBe(2);
    });

    it('returns null if quantity is below trigger requirement', () => {
      const cart = [{ productId: prodWafers, quantityBase: 9, unitPricePaise: 1650 }];
      const result = evaluateScheme(freeGoodsScheme, cart);
      expect(result).toBeNull();
    });

    it('returns null if scheme is expired', () => {
      const expiredScheme = {
        ...freeGoodsScheme,
        end_date: new Date('2025-01-01'),
      };
      const cart = [{ productId: prodWafers, quantityBase: 20, unitPricePaise: 1650 }];
      const result = evaluateScheme(expiredScheme, cart);
      expect(result).toBeNull();
    });
  });

  describe('Slab Discount Scheme Evaluation', () => {
    const slabScheme = {
      id: 'scheme_slab_1',
      name: 'Tiered Bulk Oil Discount',
      type: 'SLAB_DISCOUNT',
      rule_json: JSON.stringify({
        type: 'SLAB_DISCOUNT',
        targetProductIds: [prodOil],
        slabs: [
          { minQuantityBase: 5, discountPaisePerUnit: 10000 },  // ₹100 off per unit for >= 5
          { minQuantityBase: 10, discountPaisePerUnit: 25000 }, // ₹250 off per unit for >= 10
        ],
      }),
      ...validDates,
    };

    it('applies lower slab for 6 units', () => {
      const cart = [{ productId: prodOil, quantityBase: 6, unitPricePaise: 120000 }];
      const result = evaluateScheme(slabScheme, cart);

      expect(result).not.toBeNull();
      expect(result?.discountPaise).toBe(60000); // 6 * 10000 = ₹600.00
    });

    it('applies higher slab for 12 units', () => {
      const cart = [{ productId: prodOil, quantityBase: 12, unitPricePaise: 120000 }];
      const result = evaluateScheme(slabScheme, cart);

      expect(result).not.toBeNull();
      expect(result?.discountPaise).toBe(300000); // 12 * 25000 = ₹3,000.00
    });
  });

  describe('Combo Scheme Evaluation', () => {
    const comboScheme = {
      id: 'scheme_combo_1',
      name: 'Flour + Ghee Wedding Combo',
      type: 'COMBO',
      rule_json: JSON.stringify({
        type: 'COMBO',
        requiredItems: [
          { productId: prodFlour, quantityBase: 2 },
          { productId: prodGhee, quantityBase: 1 },
        ],
        flatDiscountPaise: 15000, // ₹150 off per combo
      }),
      ...validDates,
    };

    it('applies combo discount when all components are present in ratio', () => {
      const cart = [
        { productId: prodFlour, quantityBase: 5, unitPricePaise: 150000 },
        { productId: prodGhee, quantityBase: 2, unitPricePaise: 240000 },
      ];
      // flour: 5/2 = 2 combos; ghee: 2/1 = 2 combos -> 2 combos applied
      const result = evaluateScheme(comboScheme, cart);

      expect(result).not.toBeNull();
      expect(result?.discountPaise).toBe(30000); // 2 * 15000 = ₹300.00
      expect(result?.appliedCount).toBe(2);
    });

    it('returns null if one component of combo is missing', () => {
      const cart = [
        { productId: prodFlour, quantityBase: 10, unitPricePaise: 150000 },
        // Ghee is missing
      ];
      const result = evaluateScheme(comboScheme, cart);
      expect(result).toBeNull();
    });
  });
});
