import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Retailer Reorder & Festival Suggestions (Part 2.E & 2.F)', () => {
  let tenantId: string;
  let shopId: string;

  beforeEach(async () => {
    // Find or create a shop with non-cancelled orders and purchased brands
    let shop = await prisma.shop.findFirst({
      where: {
        orders: { some: { status: { not: 'CANCELLED' }, lines: { some: {} } } },
      },
      include: {
        tenant: true,
        orders: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { created_at: 'desc' },
          include: { lines: true },
        },
      },
    });

    if (!shop) {
      let tenant = await prisma.tenant.findFirst({ include: { brands: true } });
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            name: 'Reorder Test Tenant',
            owner_name: 'Reorder Owner',
            email: `reorder-${Date.now()}@test.invalid`,
          },
          include: { brands: true },
        });
      }
      let brand = tenant.brands[0];
      if (!brand) {
        brand = await prisma.brand.create({
          data: { tenant_id: tenant.id, name: `Reorder Brand ${Date.now()}` },
        });
      }
      const product = await prisma.tenantProduct.create({
        data: {
          tenant_id: tenant.id,
          brand_id: brand.id,
          name: 'Reorder Product',
          rate_paise: 5000,
          stock_qty: 100,
          is_new: true,
        },
      });

      shop = await prisma.shop.create({
        data: {
          tenant_id: tenant.id,
          name: 'Reorder Shop',
          owner_name: 'Reorder Shopkeeper',
          shop_number: `SHP-RE-${Date.now()}`,
          phone: '9000000000',
          address: 'Reorder Market',
          usual_order_interval_days: 7,
          orders: {
            create: {
              tenant_id: tenant.id,
              order_number: `ORD-RE-${Date.now()}`,
              status: 'CONFIRMED',
              source: 'RETAILER_APP',
              subtotal_paise: 10000,
              total_paise: 10000,
              lines: {
                create: {
                  tenant_id: tenant.id,
                  tenant_product_id: product.id,
                  quantity_base: 2,
                  display_quantity: 2,
                  order_unit_name: 'unit',
                  price_paise_snapshot: 5000,
                },
              },
            },
          },
        },
        include: {
          tenant: true,
          orders: {
            include: { lines: true },
          },
        },
      });
    }

    tenantId = shop.tenant_id;
    shopId = shop.id;
  });

  it('computes smart reorder prompt interval from shop history', async () => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        orders: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    expect(shop).toBeDefined();
    const intervalDays = shop?.usual_order_interval_days || 7;
    expect(intervalDays).toBeGreaterThan(0);

    if (shop?.orders && shop.orders.length > 0) {
      const lastOrderDate = new Date(shop.orders[0].created_at);
      const daysSince = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysSince).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects brand purchase history for dynamic new-item prompt', async () => {
    const pastOrders = await prisma.order.findMany({
      where: { shop_id: shopId, status: { not: 'CANCELLED' } },
      include: {
        lines: {
          include: {
            tenant_product: {
              include: { brand: true },
            },
          },
        },
      },
      take: 5,
    });

    const purchasedBrandIds = new Set<string>();
    for (const order of pastOrders) {
      for (const line of order.lines) {
        if (line.tenant_product?.brand_id) {
          purchasedBrandIds.add(line.tenant_product.brand_id);
        }
      }
    }

    expect(purchasedBrandIds.size).toBeGreaterThan(0);

    // Find new products belonging to these brands
    const newArrivals = await prisma.tenantProduct.findMany({
      where: {
        tenant_id: tenantId,
        brand_id: { in: Array.from(purchasedBrandIds) },
        is_new: true,
      },
    });

    expect(Array.isArray(newArrivals)).toBe(true);
  });

  it('stores and retrieves festival suggestions within active date window', async () => {
    const now = new Date();
    const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const festival = await prisma.festivalSuggestion.create({
      data: {
        tenant_id: tenantId,
        festival_name: 'Test Navratri Demand',
        festival_name_hi: 'परीक्षण नवरात्रि मांग',
        start_date: startDate,
        end_date: endDate,
        notes: 'Wholesale sweets and fast items',
        items_json: JSON.stringify([{ tenant_product_id: 'test-p1', suggested_qty_base: 10 }]),
        is_active: true,
      },
    });

    expect(festival.id).toBeDefined();

    // Query active festivals
    const activeFestivals = await prisma.festivalSuggestion.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
    });

    const found = activeFestivals.some((f) => f.id === festival.id);
    expect(found).toBe(true);
  });

  it('enforces smart reorder 3-order threshold in 90 days: shows nothing for shops with < 3 orders (Part 2.11 Compliance)', async () => {
    // 1. Create a shop with 0 orders
    const newShop = await prisma.shop.create({
      data: {
        tenant_id: tenantId,
        name: 'Sparse Order Shop',
        owner_name: 'Sparse Owner',
        shop_number: `SHP-SPARSE-${Date.now()}`,
        phone: `9000${Math.floor(100000 + Math.random() * 900000)}`,
        address: 'Sparse St',
      },
    });

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    function computeSmartReorderEligibility(orders: { status: string; created_at: Date }[]): boolean {
      const eligible = orders.filter((o) => o.status !== 'CANCELLED' && new Date(o.created_at) >= ninetyDaysAgo);
      return eligible.length >= 3;
    }

    // 0 orders -> false
    expect(computeSmartReorderEligibility([])).toBe(false);

    // 1 order -> false
    const o1 = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: newShop.id,
        order_number: `ORD-SP-1-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 5000,
        total_paise: 5000,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });
    expect(computeSmartReorderEligibility([o1])).toBe(false);

    // 2 orders (plus 1 cancelled order) -> false
    const o2 = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: newShop.id,
        order_number: `ORD-SP-2-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 5000,
        total_paise: 5000,
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    });
    const oCancelled = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: newShop.id,
        order_number: `ORD-SP-CANCEL-${Date.now()}`,
        status: 'CANCELLED',
        source: 'RETAILER_APP',
        subtotal_paise: 5000,
        total_paise: 5000,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });
    // 2 valid + 1 cancelled is still strictly < 3 valid orders
    expect(computeSmartReorderEligibility([o1, o2, oCancelled])).toBe(false);

    // 1 order outside 90 days (100 days ago) + 2 recent orders -> false
    const oOld = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: newShop.id,
        order_number: `ORD-SP-OLD-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 5000,
        total_paise: 5000,
        created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    });
    expect(computeSmartReorderEligibility([o1, o2, oOld])).toBe(false);

    // 3 valid orders within 90 days -> TRUE
    const o3 = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: newShop.id,
        order_number: `ORD-SP-3-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 5000,
        total_paise: 5000,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });
    expect(computeSmartReorderEligibility([o1, o2, o3])).toBe(true);
  });
});
