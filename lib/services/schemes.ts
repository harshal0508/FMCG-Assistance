import { z } from 'zod';
import { assertIntegerPaise, addPaise } from '../money';

/**
 * Scheme Rule Schemas (Zod validation per scheme type)
 */

export const FreeGoodsRuleSchema = z.object({
  type: z.literal('FREE_GOODS'),
  triggerProductIds: z.array(z.string()),
  triggerQuantityBase: z.number().int().positive(), // e.g., buy 10 bundles
  rewardProductId: z.string(),
  rewardQuantityBase: z.number().int().positive(),  // e.g., get 1 packet free
});

export const SlabDiscountRuleSchema = z.object({
  type: z.literal('SLAB_DISCOUNT'),
  targetProductIds: z.array(z.string()),
  slabs: z.array(
    z.object({
      minQuantityBase: z.number().int().positive(),
      discountPaisePerUnit: z.number().int().positive(), // e.g. 25000 paise (₹250) off per carton
    })
  ).min(1),
});

export const ComboRuleSchema = z.object({
  type: z.literal('COMBO'),
  requiredItems: z.array(
    z.object({
      productId: z.string(),
      quantityBase: z.number().int().positive(),
    })
  ).min(2),
  flatDiscountPaise: z.number().int().positive(), // e.g. 15000 paise (₹150) off the combo
});

export const AnySchemeRuleSchema = z.discriminatedUnion('type', [
  FreeGoodsRuleSchema,
  SlabDiscountRuleSchema,
  ComboRuleSchema,
]);

export type SchemeRule = z.infer<typeof AnySchemeRuleSchema>;

export interface CartItemInput {
  productId: string;
  quantityBase: number;
  unitPricePaise: number;
}

export interface SchemeEvaluationResult {
  schemeId: string;
  schemeName: string;
  type: 'FREE_GOODS' | 'SLAB_DISCOUNT' | 'COMBO';
  discountPaise: number;
  freeGoods: {
    productId: string;
    quantityBase: number;
  }[];
  appliedCount: number;
  notes: string;
}

/**
 * Pure evaluation function for a single active scheme against cart lines
 */
export function evaluateScheme(
  scheme: { id: string; name: string; type: string; rule_json: string; start_date: Date; end_date: Date; is_active: boolean },
  cartItems: CartItemInput[],
  now: Date = new Date()
): SchemeEvaluationResult | null {
  // Check active & dates
  if (!scheme.is_active || now < scheme.start_date || now > scheme.end_date) {
    return null;
  }

  const parsedRule = AnySchemeRuleSchema.safeParse(JSON.parse(scheme.rule_json));
  if (!parsedRule.success) {
    return null;
  }

  const rule = parsedRule.data;

  // 1. FREE GOODS (e.g. Buy 10 bundles wafers -> 1 packet biscuit free)
  if (rule.type === 'FREE_GOODS') {
    const totalTriggerQty = cartItems
      .filter((item) => rule.triggerProductIds.includes(item.productId))
      .reduce((acc, item) => acc + item.quantityBase, 0);

    const timesApplied = Math.floor(totalTriggerQty / rule.triggerQuantityBase);
    if (timesApplied <= 0) return null;

    const freeQty = timesApplied * rule.rewardQuantityBase;
    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      type: 'FREE_GOODS',
      discountPaise: 0,
      freeGoods: [
        {
          productId: rule.rewardProductId,
          quantityBase: freeQty,
        },
      ],
      appliedCount: timesApplied,
      notes: `Earned ${freeQty} free items (${timesApplied}x scheme multiplier)`,
    };
  }

  // 2. SLAB DISCOUNT (e.g. Buy >= 5 cartons -> get ₹250 off per carton)
  if (rule.type === 'SLAB_DISCOUNT') {
    const matchingItems = cartItems.filter((item) => rule.targetProductIds.includes(item.productId));
    const totalQty = matchingItems.reduce((acc, item) => acc + item.quantityBase, 0);
    if (totalQty <= 0) return null;

    // Find highest qualifying slab
    const sortedSlabs = [...rule.slabs].sort((a, b) => b.minQuantityBase - a.minQuantityBase);
    const qualifyingSlab = sortedSlabs.find((slab) => totalQty >= slab.minQuantityBase);

    if (!qualifyingSlab) return null;

    const discountPaise = qualifyingSlab.discountPaisePerUnit * totalQty;
    assertIntegerPaise(discountPaise, 'discountPaise');

    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      type: 'SLAB_DISCOUNT',
      discountPaise,
      freeGoods: [],
      appliedCount: totalQty,
      notes: `Slab discount applied: ₹${qualifyingSlab.discountPaisePerUnit / 100} off across ${totalQty} units`,
    };
  }

  // 3. COMBO SCHEME (e.g. Buy 2 bags flour + 1 tin ghee -> ₹150 off)
  if (rule.type === 'COMBO') {
    // Check how many complete combos are present in cart
    const comboMultipliers = rule.requiredItems.map((req) => {
      const cartItem = cartItems.find((item) => item.productId === req.productId);
      if (!cartItem) return 0;
      return Math.floor(cartItem.quantityBase / req.quantityBase);
    });

    const maxCombos = Math.min(...comboMultipliers);
    if (maxCombos <= 0) return null;

    const discountPaise = maxCombos * rule.flatDiscountPaise;
    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      type: 'COMBO',
      discountPaise,
      freeGoods: [],
      appliedCount: maxCombos,
      notes: `Combo applied ${maxCombos} time(s)`,
    };
  }

  return null;
}
