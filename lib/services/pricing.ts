/**
 * Server Pricing Adapter
 * 
 * Fetches tenant, shop, rates, and catalog from database,
 * delegates calculations to the pure pricing engine `calculatePureOrderPricing`,
 * and guarantees that client-submitted prices are ignored.
 */

import { prisma } from '../db/prisma';
import {
  calculatePureOrderPricing,
  PureProduct,
  PureShop,
  PureTenant,
  PureOrderItemInput,
  PurePricingResult,
} from './pricing-pure';

export type { PureOrderItemInput as OrderItemInput, PurePricingResult as PricingCalculationResult };

export async function calculateOrderPricing(
  tenantId: string,
  shopId: string,
  items: PureOrderItemInput[],
  options: { checkStock?: boolean; checkCutoff?: boolean; referenceDate?: Date } = {
    checkStock: true,
    checkCutoff: true,
  }
): Promise<PurePricingResult> {
  // 1. Fetch Tenant settings
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      timezone: true,
      order_cutoff_time: true,
      enable_gst: true,
    },
  });

  const pureTenant: PureTenant = {
    timezone: tenant?.timezone || 'Asia/Kolkata',
    orderCutoffTime: tenant?.order_cutoff_time || '18:00',
    enableGst: tenant?.enable_gst || false,
  };

  // 2. Fetch Shop with rate group and overrides
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      rate_group: {
        include: {
          overrides: true,
        },
      },
      bills: {
        include: { allocations: true },
      },
    },
  });

  if (!shop || shop.tenant_id !== tenantId) {
    return {
      allowed: false,
      blockReason: 'Shop not found or belongs to another distributor',
      warnings: [],
      lines: [],
      subtotalPaise: 0,
      discountPaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      shopCredit: {
        creditLimitPaise: 0,
        currentBalancePaise: 0,
        projectedBalancePaise: 0,
        isExceeded: false,
        isOnHold: false,
      },
      cutoffInfo: {
        isPastCutoff: false,
        cutoffTime: pureTenant.orderCutoffTime,
        localCurrentTime: '00:00',
        timezone: pureTenant.timezone,
      },
    };
  }

  // Calculate current balance
  const currentBalancePaise = shop.bills.reduce((acc, bill) => {
    const paid = bill.allocations.reduce((p, a) => p + a.amount_paise, 0);
    return acc + Math.max(0, bill.total_paise - paid);
  }, 0);

  const rateOverridesMap: Record<string, number> = {};
  if (shop.rate_group?.overrides) {
    for (const ov of shop.rate_group.overrides) {
      rateOverridesMap[ov.tenant_product_id] = ov.special_rate_paise;
    }
  }

  const pureShop: PureShop = {
    id: shop.id,
    name: shop.name,
    creditHold: shop.hold_flag,
    creditLimitPaise: shop.credit_limit_paise,
    currentBalancePaise,
    rateOverrides: rateOverridesMap,
  };

  // 3. Fetch Products Map
  const productIds = items.map((i) => i.tenantProductId);
  const products = await prisma.tenantProduct.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: productIds },
    },
    include: {
      master_product: {
        include: {
          category: true,
        },
      },
    },
  });

  const productsMap = new Map<string, PureProduct>();
  for (const prod of products) {
    productsMap.set(prod.id, {
      id: prod.id,
      name: prod.name || prod.master_product?.name || 'Item',
      ratePaise: prod.rate_paise,
      stockQty: prod.stock_qty,
      inStockFlag: prod.in_stock_flag,
      dailyMaxBaseUnits: prod.daily_max_limit,
      baseUnit: prod.base_unit || prod.master_product?.base_unit || 'unit',
      gstRatePercent: 0,
    });
  }

  return calculatePureOrderPricing(pureTenant, pureShop, productsMap, items, options);
}
