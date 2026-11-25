import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { calculateMedian, getQuietShops } from '@/lib/services/quiet-shops';
import { OrderStatus, OrderSource } from '@prisma/client';

describe('Quiet Shops Median Interval & Last Order Logic (A10 Compliance)', () => {
  const testTenantId = 'tenant_quiet_test_01';
  const testShopId = 'shop_quiet_test_01';

  beforeEach(async () => {
    // 1. Ensure test tenant
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'Quiet Test Tenant',
        owner_name: 'Anand Verma',
        phone: '9829012345',
        upi_id: 'quiet@upi',
        address: 'Mandi',
        city: 'Ratlam',
        state: 'MP',
      },
    });

    // Clean previous test data
    await prisma.order.deleteMany({ where: { tenant_id: testTenantId } });
    await prisma.shop.deleteMany({ where: { tenant_id: testTenantId } });

    // 2. Create test shop with usual interval 5 days
    await prisma.shop.create({
      data: {
        id: testShopId,
        tenant_id: testTenantId,
        name: 'Sharma Provisions',
        owner_name: 'Ramesh Sharma',
        shop_number: 'SHP-Q01',
        phone: '9829011111',
        usual_order_interval_days: 5,
        status: 'ACTIVE',
        address: 'Shop 12, Station Road, Ratlam',
      },
    });
  });

  it('correctly calculates median interval from uneven intervals', () => {
    // Odd count: [3, 5, 7] -> median is 5
    expect(calculateMedian([3, 5, 7])).toBe(5);
    expect(calculateMedian([7, 3, 5])).toBe(5);

    // Even count: [2, 4, 6, 8] -> average of 4 and 6 is 5
    expect(calculateMedian([2, 4, 6, 8])).toBe(5);
  });

  it('strictly ignores CANCELLED orders when finding the last order date', async () => {
    const baseDate = new Date('2026-11-01T10:00:00Z');
    const validOrderDate = new Date('2026-11-10T10:00:00Z'); // 10 days ago from reference
    const cancelledOrderDate = new Date('2026-11-19T10:00:00Z'); // 1 day ago, but CANCELLED!

    // 1. Valid Order 1: Nov 1
    await prisma.order.create({
      data: {
        tenant_id: testTenantId,
        shop_id: testShopId,
        order_number: 'ORD-20261101-0001',
        source: OrderSource.RETAILER_APP,
        status: OrderStatus.DELIVERED,
        subtotal_paise: 50000,
        total_paise: 50000,
        created_at: baseDate,
      },
    });

    // 2. Valid Order 2: Nov 10
    await prisma.order.create({
      data: {
        tenant_id: testTenantId,
        shop_id: testShopId,
        order_number: 'ORD-20261110-0001',
        source: OrderSource.RETAILER_APP,
        status: OrderStatus.DELIVERED,
        subtotal_paise: 60000,
        total_paise: 60000,
        created_at: validOrderDate,
      },
    });

    // 3. Cancelled Order: Nov 19 (MUST BE IGNORED)
    await prisma.order.create({
      data: {
        tenant_id: testTenantId,
        shop_id: testShopId,
        order_number: 'ORD-20261119-0001',
        source: OrderSource.RETAILER_APP,
        status: OrderStatus.CANCELLED,
        subtotal_paise: 70000,
        total_paise: 70000,
        created_at: cancelledOrderDate,
      },
    });

    // Reference Date: Nov 20, 2026
    const refDate = new Date('2026-11-20T10:00:00Z');

    // Interval between Nov 1 and Nov 10 is 9 days.
    // Days since last valid order (Nov 10) is 10 days (> 9 days threshold)
    // If cancelled order was incorrectly used, days since would be only 1 day and shop would NOT be quiet!
    const quietList = await getQuietShops(testTenantId, { refDate, thresholdMultiplier: 1.0 });

    expect(quietList.length).toBe(1);
    const quietShop = quietList[0];
    expect(quietShop.shopId).toBe(testShopId);
    expect(quietShop.lastOrderDate?.toISOString()).toBe(validOrderDate.toISOString());
    expect(quietShop.daysSinceLastOrder).toBe(10);
    expect(quietShop.isQuiet).toBe(true);
  });
});
