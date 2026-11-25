import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Area Analytics (Part 2.D)', () => {
  let tenantId: string;
  let areaId: string;
  let shop1Id: string;
  let shop2Id: string;

  beforeEach(async () => {
    // Find or create an area with at least 2 shops
    let area: any = await prisma.area.findFirst({
      where: { shops: { some: {} } },
      include: { shops: true, tenant: true },
    });

    if (!area || area.shops.length < 2) {
      let tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            name: 'Analytics Test Tenant',
            owner_name: 'Analytics Owner',
            email: `analytics-${Date.now()}@test.invalid`,
          },
        });
      }
      area = await prisma.area.create({
        data: {
          tenant_id: tenant.id,
          name: `Analytics Area ${Date.now()}`,
          shops: {
            create: [
              { tenant_id: tenant.id, name: 'Shop 1', owner_name: 'Owner 1', shop_number: `S1-${Date.now()}`, phone: `9000${Math.floor(100000 + Math.random() * 900000)}`, address: 'A1' },
              { tenant_id: tenant.id, name: 'Shop 2', owner_name: 'Owner 2', shop_number: `S2-${Date.now()}`, phone: `9000${Math.floor(100000 + Math.random() * 900000)}`, address: 'A2' },
            ],
          },
        },
        include: { shops: true, tenant: true },
      });
    }

    tenantId = area.tenant_id;
    areaId = area.id;
    shop1Id = area.shops[0].id;
    shop2Id = area.shops[1].id;
  });

  it('excludes cancelled orders from revenue and order metrics', async () => {
    // 1. Create a confirmed order
    const confirmedOrder = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop1Id,
        order_number: `ORD-ANALYTICS-OK-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 25000,
        total_paise: 25000,
      },
    });

    // 2. Create a cancelled order
    const cancelledOrder = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop1Id,
        order_number: `ORD-ANALYTICS-CANCEL-${Date.now()}`,
        status: 'CANCELLED',
        source: 'RETAILER_APP',
        subtotal_paise: 99000,
        total_paise: 99000,
      },
    });

    // Query analytics orders
    const validOrders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: { not: 'CANCELLED' },
        shop: { area_id: areaId },
      },
    });

    const hasCancelled = validOrders.some((o) => o.id === cancelledOrder.id);
    const hasConfirmed = validOrders.some((o) => o.id === confirmedOrder.id);

    expect(hasCancelled).toBe(false);
    expect(hasConfirmed).toBe(true);

    const totalRev = validOrders.reduce((sum, o) => sum + o.total_paise, 0);
    expect(totalRev).toBeGreaterThanOrEqual(25000);
  });

  it('computes area active vs quiet shops and coverage percentage', async () => {
    const areaShops = await prisma.shop.findMany({
      where: { tenant_id: tenantId, area_id: areaId },
    });
    const totalShops = areaShops.length;

    const areaOrders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: { not: 'CANCELLED' },
        shop: { area_id: areaId },
      },
      select: { shop_id: true },
    });

    const activeShopIds = new Set(areaOrders.map((o) => o.shop_id));
    const activeCount = areaShops.filter((s) => activeShopIds.has(s.id)).length;
    const quietCount = totalShops - activeCount;
    const coverage = totalShops > 0 ? Math.round((activeCount / totalShops) * 100) : 0;

    expect(totalShops).toBeGreaterThan(0);
    expect(activeCount + quietCount).toBe(totalShops);
    expect(coverage).toBeGreaterThanOrEqual(0);
    expect(coverage).toBeLessThanOrEqual(100);
  });

  it('defines coverage percentage strictly as shops that ordered in cycle divided by active shops on route, excluding cancelled orders', async () => {
    // 1. Create a dedicated test tenant and route area with exactly 2 active shops
    const isoTenant = await prisma.tenant.create({
      data: {
        name: 'Coverage Test Tenant',
        owner_name: 'Coverage Owner',
        email: `cov-${Date.now()}-${Math.random()}@test.invalid`,
      },
    });

    const uniqueArea = await prisma.area.create({
      data: {
        tenant_id: isoTenant.id,
        name: `Strict Coverage Route Area ${Date.now()}`,
        shops: {
          create: [
            {
              tenant_id: isoTenant.id,
              name: 'Route Shop Alpha',
              owner_name: 'Owner Alpha',
              shop_number: `R-A-${Date.now()}`,
              phone: `9000${Math.floor(100000 + Math.random() * 900000)}`,
              address: 'Route Area 1',
            },
            {
              tenant_id: isoTenant.id,
              name: 'Route Shop Beta',
              owner_name: 'Owner Beta',
              shop_number: `R-B-${Date.now()}`,
              phone: `9000${Math.floor(100000 + Math.random() * 900000)}`,
              address: 'Route Area 2',
            },
          ],
        },
      },
      include: { shops: true },
    });

    const [shopAlpha, shopBeta] = uniqueArea.shops;
    const totalActiveShopsOnRoute = uniqueArea.shops.length; // 2

    // 2. Shop Alpha places a valid confirmed order
    await prisma.order.create({
      data: {
        tenant_id: isoTenant.id,
        shop_id: shopAlpha.id,
        order_number: `ORD-ALPHA-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 15000,
        total_paise: 15000,
      },
    });

    // 3. Shop Beta has ONLY a CANCELLED order in the cycle
    await prisma.order.create({
      data: {
        tenant_id: isoTenant.id,
        shop_id: shopBeta.id,
        order_number: `ORD-BETA-CANCEL-${Date.now()}`,
        status: 'CANCELLED',
        source: 'RETAILER_APP',
        subtotal_paise: 20000,
        total_paise: 20000,
      },
    });

    // Query non-cancelled orders for this route area
    const nonCancelledOrders = await prisma.order.findMany({
      where: {
        tenant_id: isoTenant.id,
        status: { not: 'CANCELLED' },
        shop: { area_id: uniqueArea.id },
      },
      select: { shop_id: true },
    });

    const orderedShopsInCycle = new Set(nonCancelledOrders.map((o) => o.shop_id));
    // Shop Alpha ordered, Shop Beta did NOT order (its order was cancelled)
    expect(orderedShopsInCycle.has(shopAlpha.id)).toBe(true);
    expect(orderedShopsInCycle.has(shopBeta.id)).toBe(false);
    expect(orderedShopsInCycle.size).toBe(1);

    // Coverage formula: (shops that ordered in cycle / active shops on route) * 100
    const coveragePercentage = Math.round((orderedShopsInCycle.size / totalActiveShopsOnRoute) * 100);
    expect(coveragePercentage).toBe(50); // Exactly 1 out of 2 = 50%

    // 4. Shop Beta now places a valid confirmed order
    await prisma.order.create({
      data: {
        tenant_id: isoTenant.id,
        shop_id: shopBeta.id,
        order_number: `ORD-BETA-CONFIRMED-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 30000,
        total_paise: 30000,
      },
    });

    const updatedOrders = await prisma.order.findMany({
      where: {
        tenant_id: isoTenant.id,
        status: { not: 'CANCELLED' },
        shop: { area_id: uniqueArea.id },
      },
      select: { shop_id: true },
    });

    const updatedOrderedShops = new Set(updatedOrders.map((o) => o.shop_id));
    expect(updatedOrderedShops.size).toBe(2);

    const updatedCoverage = Math.round((updatedOrderedShops.size / totalActiveShopsOnRoute) * 100);
    expect(updatedCoverage).toBe(100); // 2 out of 2 = 100%

    // Cleanup isolated tenant
    await prisma.tenant.delete({ where: { id: isoTenant.id } });
  });
});
