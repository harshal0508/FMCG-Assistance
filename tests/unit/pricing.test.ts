import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { calculateOrderPricing } from '@/lib/services/pricing';

describe('Shared Pricing & Validation Engine Unit Tests', () => {
  const tenantId = 'tenant_shree_shyam_alwar';
  let normalShopId: string;
  let holdShopId: string;
  let inStockProductId: string;
  let lowStockProductId: string;

  beforeAll(async () => {
    // Normal Shop from seed (SHP-0030, isolated from SHP-0001)
    const normal = await prisma.shop.findFirst({
      where: { tenant_id: tenantId, shop_number: 'SHP-0030' },
    });
    if (!normal) throw new Error('Shop SHP-0030 not found');
    normalShopId = normal.id;

    // Credit Hold Shop from seed (SHP-0005)
    const hold = await prisma.shop.findFirst({
      where: { tenant_id: tenantId, shop_number: 'SHP-0005' },
    });
    if (!hold) throw new Error('Shop SHP-0005 not found');
    holdShopId = hold.id;

    // In Stock Product (ordered by name desc so it doesn't collide with distributor-core)
    const prod = await prisma.tenantProduct.findFirst({
      where: {
        tenant_id: tenantId,
        in_stock_flag: true,
        stock_qty: { gt: 50 },
        daily_max_limit: null,
      },
      orderBy: { name: 'desc' },
    });
    if (!prod) throw new Error('No in-stock product found');
    inStockProductId = prod.id;
  });

  it('strictly blocks orders when a shop is on Credit Hold', async () => {
    const result = await calculateOrderPricing(tenantId, holdShopId, [
      { tenantProductId: inStockProductId, displayQty: 2 },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/Credit Hold/i);
    expect(result.shopCredit.isOnHold).toBe(true);
  });

  it('calculates prices correctly for valid in-stock products', async () => {
    const result = await calculateOrderPricing(tenantId, normalShopId, [
      { tenantProductId: inStockProductId, displayQty: 5 },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].displayQty).toBe(5);
    expect(result.lines[0].lineSubtotalPaise).toBe(
      result.lines[0].effectiveRatePaise * 5
    );
    expect(result.totalPaise).toBe(result.subtotalPaise - result.discountPaise);
  });

  it('blocks order when requested quantity exceeds available physical stock', async () => {
    const prod = await prisma.tenantProduct.findUnique({
      where: { id: inStockProductId },
    });
    const excessQty = prod!.stock_qty + 1000;

    const result = await calculateOrderPricing(tenantId, normalShopId, [
      { tenantProductId: inStockProductId, displayQty: excessQty },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/Insufficient stock/i);
  });

  it('blocks order when product is marked Out of Stock', async () => {
    // Temporarily mark product out of stock
    await prisma.tenantProduct.update({
      where: { id: inStockProductId },
      data: { in_stock_flag: false },
    });

    const result = await calculateOrderPricing(tenantId, normalShopId, [
      { tenantProductId: inStockProductId, displayQty: 1 },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/Out of Stock/i);

    // Restore
    await prisma.tenantProduct.update({
      where: { id: inStockProductId },
      data: { in_stock_flag: true },
    });
  });

  it('blocks order when daily maximum purchase quota is exceeded', async () => {
    // Temporarily set daily max limit to 3
    await prisma.tenantProduct.update({
      where: { id: inStockProductId },
      data: { daily_max_limit: 3 },
    });

    const result = await calculateOrderPricing(tenantId, normalShopId, [
      { tenantProductId: inStockProductId, displayQty: 5 },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/daily quota limit/i);

    // Restore
    await prisma.tenantProduct.update({
      where: { id: inStockProductId },
      data: { daily_max_limit: null },
    });
  });

  it('adds credit warning when projected dues exceed shop credit limit', async () => {
    // Temporarily set credit limit to small amount (₹10.00 = 1000 paise)
    await prisma.shop.update({
      where: { id: normalShopId },
      data: { credit_limit_paise: 1000 },
    });

    const result = await calculateOrderPricing(tenantId, normalShopId, [
      { tenantProductId: inStockProductId, displayQty: 5 },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.shopCredit.isExceeded).toBe(true);
    expect(result.warnings.some((w) => w.includes('exceeds the shop\'s credit threshold'))).toBe(true);

    // Restore
    await prisma.shop.update({
      where: { id: normalShopId },
      data: { credit_limit_paise: 500000 },
    });
  });
});
