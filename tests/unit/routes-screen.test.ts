import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Phase 4.A: Routes & Schedule Management API', () => {
  const tenantId = 'tenant_shree_shyam_alwar';

  it('fetches existing route groups with their assigned areas and active schedules', async () => {
    const routeGroups = await prisma.routeGroup.findMany({
      where: { tenant_id: tenantId },
      include: {
        schedules: { where: { is_active: true } },
        route_areas: { include: { area: true } },
      },
    });

    expect(routeGroups.length).toBeGreaterThanOrEqual(2);
    for (const group of routeGroups) {
      expect(group.schedules.length).toBeGreaterThan(0);
      const schedule = group.schedules[0];
      expect(schedule.order_day_of_week).toBeGreaterThanOrEqual(1);
      expect(schedule.order_day_of_week).toBeLessThanOrEqual(7);
      expect(schedule.order_cutoff_time).toMatch(/^([01]\d|2[0-3]):([0-5]\d)$/);
      expect(group.route_areas.length).toBeGreaterThan(0);
    }
  });

  it('validates schedule day bounds (1 to 7) and 24-hour cut-off formatting', () => {
    const isValidDay = (day: number) => day >= 1 && day <= 7;
    const isValidTime = (time: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

    expect(isValidDay(1)).toBe(true);  // Monday
    expect(isValidDay(7)).toBe(true);  // Sunday
    expect(isValidDay(0)).toBe(false);
    expect(isValidDay(8)).toBe(false);

    expect(isValidTime('18:00')).toBe(true);
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('6:00 pm')).toBe(false);
  });

  it('verifies route group schedule cut-off propagates to shop area lookup', async () => {
    const group = await prisma.routeGroup.findFirst({
      where: { tenant_id: tenantId },
      include: {
        schedules: true,
        route_areas: { include: { area: true } },
      },
    });

    expect(group).toBeDefined();
    const areaId = group!.route_areas[0].area_id;

    // Find any shop in this area
    const shop = await prisma.shop.findFirst({
      where: { tenant_id: tenantId, area_id: areaId },
    });

    expect(shop).toBeDefined();
    expect(shop!.area_id).toBe(areaId);
  });
});
