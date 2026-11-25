import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { getKolkataZonedTime, getShopRouteCutoffInfo } from '@/lib/services/route-cutoff';

describe('Route Group Schedule & Cut-off Service (F4 Compliance)', () => {
  const testTenantId = 'tenant_route_test';
  const testAreaId = 'area_mandi_test';
  const testShopId = 'shop_cutoff_test_01';
  const testRouteGroupId = 'rg_mon_mandi_test';

  beforeEach(async () => {
    // 1. Create Tenant
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'Route Test Tenant',
        owner_name: 'Anand Verma',
        phone: '9829012345',
        upi_id: 'test@upi',
        address: 'Mandi Road',
        city: 'Ratlam',
        state: 'MP',
        order_cutoff_time: '18:00',
      },
    });

    // 2. Create Area
    await prisma.area.upsert({
      where: { id: testAreaId },
      update: {},
      create: {
        id: testAreaId,
        tenant_id: testTenantId,
        name: 'Krishi Mandi Test Area',
      },
    });

    // 3. Create RouteGroup
    await prisma.routeGroup.upsert({
      where: { tenant_id_name: { tenant_id: testTenantId, name: 'Monday Mandi Route' } },
      update: {},
      create: {
        id: testRouteGroupId,
        tenant_id: testTenantId,
        name: 'Monday Mandi Route',
      },
    });

    // 4. Link Area to RouteGroup
    await prisma.routeGroupArea.upsert({
      where: { route_group_id_area_id: { route_group_id: testRouteGroupId, area_id: testAreaId } },
      update: {},
      create: {
        tenant_id: testTenantId,
        route_group_id: testRouteGroupId,
        area_id: testAreaId,
      },
    });

    // 5. Add Schedule: Orders on Monday (1) with 18:00 IST cut-off, Packing Monday (1), Delivery Tuesday (2)
    await prisma.routeSchedule.deleteMany({ where: { route_group_id: testRouteGroupId } });
    await prisma.routeSchedule.create({
      data: {
        tenant_id: testTenantId,
        route_group_id: testRouteGroupId,
        order_day_of_week: 1, // Monday
        order_cutoff_time: '18:00',
        packing_day_of_week: 1, // Monday
        delivery_day_of_week: 2, // Tuesday
        is_active: true,
      },
    });

    // 6. Create Shop in Area
    await prisma.shop.upsert({
      where: { id: testShopId },
      update: { area_id: testAreaId },
      create: {
        id: testShopId,
        tenant_id: testTenantId,
        name: 'Mahadev Kirana Test',
        owner_name: 'Sanjay',
        shop_number: 'SHP-0099',
        phone: '9829099999',
        area_id: testAreaId,
        address: 'Shop 99, Mandi Road, Ratlam',
      },
    });
  });

  it('accurately computes Kolkata zoned time components regardless of server UTC time', () => {
    // 2026-11-23T11:30:00Z is 2026-11-23 17:00:00 IST (Monday)
    const refUtc = new Date('2026-11-23T11:30:00Z');
    const kolkata = getKolkataZonedTime(refUtc);

    expect(kolkata.year).toBe(2026);
    expect(kolkata.month).toBe(11);
    expect(kolkata.day).toBe(23);
    expect(kolkata.dayOfWeek).toBe(1); // Monday
    expect(kolkata.hours).toBe(17);
    expect(kolkata.minutes).toBe(0);
    expect(kolkata.dateString).toBe('20261123');
  });

  it('calculates dynamic delivery date and schedule text from route group without fixed "tomorrow morning" (F4)', async () => {
    // Reference: Monday 23 Nov 2026 16:30 IST (which is 11:00 UTC) -> 90 mins before 18:00 IST cut-off
    const refDate = new Date('2026-11-23T11:00:00Z');
    const result = await getShopRouteCutoffInfo(testShopId, refDate);

    expect(result.cutoffTime).toBe('18:00');
    expect(result.cutoffTimeFormatted).toBe('18:00 IST');
    expect(result.isPastCutoff).toBe(false);
    expect(result.minutesRemaining).toBe(90);

    // F4: Must NOT say fixed "tomorrow morning"; must specify route schedule packing day and delivery date
    expect(result.deliveryNotice).not.toContain('tomorrow morning');
    expect(result.deliveryNotice).toContain('packed Monday');
    expect(result.deliveryNotice).toContain('delivered on Tuesday, 24 Nov 2026');
    expect(result.deliveryDateFormatted).toBe('Tuesday, 24 Nov 2026');
    expect(result.deliveryDayName).toBe('Tuesday');
    expect(result.packingDayName).toBe('Monday');
    expect(result.orderDayName).toBe('Monday');
    expect(result.deliveryNotice).toContain('Krishi Mandi Test Area');
  });

  it('flags isPastCutoff=true and computes next dispatch schedule date when current time exceeds cut-off', async () => {
    // Reference: Monday 23 Nov 2026 18:30 IST (13:00 UTC) -> 30 mins PAST 18:00 IST cut-off
    const refDate = new Date('2026-11-23T13:00:00Z');
    const result = await getShopRouteCutoffInfo(testShopId, refDate);

    expect(result.isPastCutoff).toBe(true);
    expect(result.minutesRemaining).toBe(0);
    expect(result.deliveryNotice).toContain('Cut-off for today has passed');
    expect(result.deliveryNotice).toContain('Next order dispatch');
    expect(result.deliveryNotice).toContain('order Monday');
    expect(result.deliveryNotice).toContain('Tuesday, 1 Dec 2026');
  });

  it('correctly isolates two shops on two different routes with different cut-off times and delivery days', async () => {
    // Set up Route 2 with different cut-off (16:00 IST), order on Thursday (4), delivery on Saturday (6)
    const testAreaId2 = 'area_industrial_test';
    const testRouteGroupId2 = 'rg_thu_industrial_test';
    const testShopId2 = 'shop_cutoff_test_02';

    // 1. Create Area 2
    await prisma.area.upsert({
      where: { id: testAreaId2 },
      update: {},
      create: {
        id: testAreaId2,
        tenant_id: testTenantId,
        name: 'Industrial Area Test',
      },
    });

    // 2. Create RouteGroup 2
    await prisma.routeGroup.upsert({
      where: { tenant_id_name: { tenant_id: testTenantId, name: 'Thursday Industrial Route' } },
      update: {},
      create: {
        id: testRouteGroupId2,
        tenant_id: testTenantId,
        name: 'Thursday Industrial Route',
      },
    });

    // 3. Link Area 2 to RouteGroup 2
    await prisma.routeGroupArea.upsert({
      where: { route_group_id_area_id: { route_group_id: testRouteGroupId2, area_id: testAreaId2 } },
      update: {},
      create: {
        tenant_id: testTenantId,
        route_group_id: testRouteGroupId2,
        area_id: testAreaId2,
      },
    });

    // 4. Add Schedule for Route 2: Orders Thursday (4) cut-off 16:00 IST, packing Thursday, delivery Saturday (6)
    await prisma.routeSchedule.deleteMany({ where: { route_group_id: testRouteGroupId2 } });
    await prisma.routeSchedule.create({
      data: {
        tenant_id: testTenantId,
        route_group_id: testRouteGroupId2,
        order_day_of_week: 4, // Thursday
        order_cutoff_time: '16:00', // 4:00 PM (different from Route 1's 18:00)
        packing_day_of_week: 4,
        delivery_day_of_week: 6, // Saturday (different from Route 1's Tuesday)
        is_active: true,
      },
    });

    // 5. Create Shop 2 in Area 2
    await prisma.shop.upsert({
      where: { id: testShopId2 },
      update: { area_id: testAreaId2 },
      create: {
        id: testShopId2,
        tenant_id: testTenantId,
        name: 'Industrial Stores Test',
        owner_name: 'Vikram',
        shop_number: 'SHP-0100',
        phone: '9829088888',
        area_id: testAreaId2,
        address: 'Plot 4, Industrial Area, Ratlam',
      },
    });

    // TEST CASE A: Evaluated on Monday 23 Nov 2026 at 16:30 IST (11:00 UTC)
    const mondayRef = new Date('2026-11-23T11:00:00Z');

    // Route 1 Shop (Monday Route): Active today, 90 mins remaining until 18:00, delivery Tuesday
    const shop1Monday = await getShopRouteCutoffInfo(testShopId, mondayRef);
    expect(shop1Monday.cutoffTime).toBe('18:00');
    expect(shop1Monday.isPastCutoff).toBe(false);
    expect(shop1Monday.minutesRemaining).toBe(90);
    expect(shop1Monday.deliveryDayName).toBe('Tuesday');
    expect(shop1Monday.routeGroupName).toBe('Monday Mandi Route');

    // Route 2 Shop (Thursday Route): Monday is off-schedule; next order is Thursday, cut-off 16:00, delivery Saturday
    const shop2Monday = await getShopRouteCutoffInfo(testShopId2, mondayRef);
    expect(shop2Monday.cutoffTime).toBe('16:00');
    expect(shop2Monday.isPastCutoff).toBe(true);
    expect(shop2Monday.minutesRemaining).toBe(0);
    expect(shop2Monday.deliveryDayName).toBe('Saturday');
    expect(shop2Monday.deliveryNotice).toContain('order Thursday');
    expect(shop2Monday.deliveryNotice).toContain('16:00 IST');
    expect(shop2Monday.routeGroupName).toBe('Thursday Industrial Route');

    // TEST CASE B: Evaluated on Thursday 26 Nov 2026 at 14:45 IST (09:15 UTC)
    const thursdayRef = new Date('2026-11-26T09:15:00Z');

    // Route 2 Shop (Thursday Route): Active today, 75 mins remaining until 16:00, delivery Saturday 28 Nov 2026
    const shop2Thursday = await getShopRouteCutoffInfo(testShopId2, thursdayRef);
    expect(shop2Thursday.cutoffTime).toBe('16:00');
    expect(shop2Thursday.isPastCutoff).toBe(false);
    expect(shop2Thursday.minutesRemaining).toBe(75);
    expect(shop2Thursday.deliveryDayName).toBe('Saturday');
    expect(shop2Thursday.deliveryDateFormatted).toBe('Saturday, 28 Nov 2026');
    expect(shop2Thursday.deliveryNotice).toContain('delivered on Saturday, 28 Nov 2026');

    // Route 1 Shop (Monday Route): Thursday is off-schedule; next order is next Monday 30 Nov
    const shop1Thursday = await getShopRouteCutoffInfo(testShopId, thursdayRef);
    expect(shop1Thursday.cutoffTime).toBe('18:00');
    expect(shop1Thursday.isPastCutoff).toBe(true);
    expect(shop1Thursday.deliveryDayName).toBe('Tuesday');
    expect(shop1Thursday.deliveryNotice).toContain('order Monday');
    expect(shop1Thursday.deliveryNotice).toContain('18:00 IST');
  });
});
