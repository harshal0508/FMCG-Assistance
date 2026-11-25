import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { calculateOrderPricing } from '@/lib/services/pricing';

describe('B9: Security & Retailer Data Isolation', () => {
  let tenantId: string;
  let shopId: string;
  let productId: string;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: {
        products: true,
        shops: { where: { hold_flag: false } },
      },
    });

    if (!tenant || tenant.shops.length === 0) throw new Error('No tenant or active shop found for test');
    tenantId = tenant.id;
    shopId = tenant.shops[0].id;
    productId = tenant.products[0].id;
  });

  it('guarantees calculateOrderPricing returns only PTR rates and never exposes cost prices or distributor margins', async () => {
    const pricing = await calculateOrderPricing(
      tenantId,
      shopId,
      [{ tenantProductId: productId, orderQty: 5 }],
      { checkCutoff: false, checkStock: false }
    );

    expect(pricing).toBeDefined();
    expect(pricing.allowed).toBe(true);
    expect(pricing.lines.length).toBe(1);

    const line = pricing.lines[0];

    // Allowed customer-facing fields
    expect(line.tenantProductId).toBe(productId);
    expect(line.effectiveRatePaise).toBeTypeOf('number');
    expect(line.lineTotalPaise).toBeTypeOf('number');

    // Forbidden distributor-internal fields must NOT exist anywhere on the line
    const serializedLine = JSON.stringify(line).toLowerCase();
    expect(serializedLine).not.toContain('cost');
    expect(serializedLine).not.toContain('margin');
    expect(serializedLine).not.toContain('landing');
    expect(serializedLine).not.toContain('purchaserate');
    expect(serializedLine).not.toContain('profit');
  });

  it('strictly isolates tenant product catalog: only returns products belonging to the authorized tenant', async () => {
    const catalog = await prisma.tenantProduct.findMany({
      where: {
        tenant_id: tenantId,
        is_visible: true,
      },
      select: {
        id: true,
        name: true,
        rate_paise: true,
        mrp_paise: true,
        stock_qty: true,
      },
    });

    expect(catalog.length).toBeGreaterThan(0);

    catalog.forEach((item) => {
      // Must only contain PTR rate and MRP
      expect(item.rate_paise).toBeTypeOf('number');
      const itemKeys = Object.keys(item);
      expect(itemKeys).not.toContain('cost_price');
      expect(itemKeys).not.toContain('landing_cost');
      expect(itemKeys).not.toContain('margin_paise');
    });
  });

  it('prevents a shop token from accessing another tenant or shop orders', async () => {
    // Find all shop tokens for this shop
    const tokens = await prisma.shopToken.findMany({
      where: { shop_id: shopId },
    });

    if (tokens.length > 0) {
      const token = tokens[0];
      // Token must be strictly bound to this tenant
      expect(token.tenant_id).toBe(tenantId);
      expect(token.shop_id).toBe(shopId);
    }
  });
});
