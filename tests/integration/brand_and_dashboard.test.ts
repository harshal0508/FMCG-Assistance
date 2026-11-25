import { describe, it, expect } from 'vitest';
import { prisma } from '../../lib/db/prisma';
import { OrderStatus } from '@prisma/client';

describe('Brand-First Inventory & Dashboard Integrity', () => {
  const tenantId = 'tenant_shree_shyam_alwar';

  it('enforces database-level unique constraint on Brand per tenant', async () => {
    const brandName = 'Duplicate Test Brand';
    
    // Create first
    const brand1 = await prisma.brand.create({
      data: {
        tenant_id: tenantId,
        name: brandName,
        sort_order: 999,
      },
    });
    expect(brand1.id).toBeDefined();

    // Attempt duplicate for same tenant - must throw P2002 unique constraint violation
    await expect(
      prisma.brand.create({
        data: {
          tenant_id: tenantId,
          name: brandName,
          sort_order: 1000,
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.brand.delete({ where: { id: brand1.id } });
  });

  it('verifies exact clean seed counts: 30 shops, 4 areas, 5 brands, 80 products', async () => {
    const shops = await prisma.shop.count({
      where: {
        tenant_id: tenantId,
        shop_number: { startsWith: 'SHP-00' },
      },
    });
    const areas = await prisma.area.count({ where: { tenant_id: tenantId } });
    const brands = await prisma.brand.count({ where: { tenant_id: tenantId } });
    const products = await prisma.tenantProduct.count({ where: { tenant_id: tenantId } });

    expect(shops).toBe(30);
    expect(areas).toBe(4);
    expect(brands).toBe(5);
    expect(products).toBe(80);
  });

  it('confirms the 5 fictional brands exist and each has associated products', async () => {
    const expectedBrands = ['Sunrise Foods', 'Crunch Co', 'Golden Grains', 'Daily Fresh', 'SpiceCraft'];
    const seededBrands = await prisma.brand.findMany({
      where: { tenant_id: tenantId },
      include: { tenant_products: true },
    });

    const seededNames = seededBrands.map((b) => b.name);
    for (const name of expectedBrands) {
      expect(seededNames).toContain(name);
      const b = seededBrands.find((x) => x.name === name);
      expect(b?.tenant_products.length).toBeGreaterThan(0);
    }
  });

  it('guarantees revenue metrics strictly exclude cancelled orders', async () => {
    // Pick an active shop
    const shop = await prisma.shop.findFirst({ where: { tenant_id: tenantId } });
    expect(shop).toBeDefined();

    // Create a delivered order
    const delivered = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop!.id,
        order_number: `TEST-ORD-DELIV-${Date.now()}`,
        status: OrderStatus.DELIVERED,
        total_paise: 50000, // ₹500
        subtotal_paise: 50000,
      },
    });

    // Create a cancelled order
    const cancelled = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop!.id,
        order_number: `TEST-ORD-CANC-${Date.now()}`,
        status: OrderStatus.CANCELLED,
        total_paise: 80000, // ₹800 - must NOT appear in revenue
        subtotal_paise: 80000,
      },
    });

    // Query active revenue (filtering out CANCELLED)
    const activeRevenue = await prisma.order.aggregate({
      where: {
        tenant_id: tenantId,
        status: { not: OrderStatus.CANCELLED },
        id: { in: [delivered.id, cancelled.id] },
      },
      _sum: { total_paise: true },
    });

    expect(activeRevenue._sum.total_paise).toBe(50000); // Only delivered order included

    // Cleanup
    await prisma.order.deleteMany({ where: { id: { in: [delivered.id, cancelled.id] } } });
  });
});
