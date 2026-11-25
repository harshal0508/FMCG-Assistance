import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '8W'; // '7D' | '30D' | '8W' | 'ALL'
    const areaFilter = searchParams.get('areaId') || 'ALL';

    // 1. Calculate date threshold
    const now = new Date();
    let startDate: Date | null = null;
    if (range === '7D') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30D') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '8W') {
      startDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    }

    // 2. Fetch all market areas and route groups for tenant
    const areas = await prisma.area.findMany({
      where: { tenant_id: tenantId },
      include: {
        route_areas: {
          include: {
            route_group: {
              include: { schedules: true },
            },
          },
        },
        shops: {
          select: {
            id: true,
            name: true,
            owner_name: true,
            hold_flag: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 3. Fetch all orders (EXCLUDING CANCELLED ORDERS)
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: { not: 'CANCELLED' },
        ...(startDate ? { created_at: { gte: startDate } } : {}),
        ...(areaFilter !== 'ALL' ? { shop: { area_id: areaFilter } } : {}),
      },
      include: {
        shop: {
          include: {
            area: true,
          },
        },
        lines: {
          include: {
            tenant_product: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // 4. Summary metrics
    const totalOrders = orders.length;
    const totalRevenuePaise = orders.reduce((sum, o) => sum + o.total_paise, 0);
    const averageOrderValuePaise = totalOrders > 0 ? Math.round(totalRevenuePaise / totalOrders) : 0;

    // Filtered areas list
    const targetAreas = areaFilter === 'ALL' ? areas : areas.filter((a) => a.id === areaFilter);
    const allShopsInTarget = targetAreas.flatMap((a) => a.shops);
    const totalShopsCount = allShopsInTarget.length;

    // Active shops = placed at least 1 order in window
    const activeShopIdSet = new Set(orders.map((o) => o.shop_id));
    const activeShopsCount = allShopsInTarget.filter((s) => activeShopIdSet.has(s.id)).length;
    const quietShopsCount = Math.max(0, totalShopsCount - activeShopsCount);
    const overallCoveragePercent = totalShopsCount > 0 ? Math.round((activeShopsCount / totalShopsCount) * 100) : 0;

    // 5. Per-Area Breakdown
    const areaBreakdowns = targetAreas.map((area) => {
      const areaOrders = orders.filter((o) => o.shop.area_id === area.id);
      const areaRevenue = areaOrders.reduce((sum, o) => sum + o.total_paise, 0);
      const areaOrdersCount = areaOrders.length;
      const areaAov = areaOrdersCount > 0 ? Math.round(areaRevenue / areaOrdersCount) : 0;

      const areaShops = area.shops;
      const areaActiveShops = areaShops.filter((s) => activeShopIdSet.has(s.id)).length;
      const areaQuietShops = Math.max(0, areaShops.length - areaActiveShops);
      const areaCoverage = areaShops.length > 0 ? Math.round((areaActiveShops / areaShops.length) * 100) : 0;

      // Top & Bottom shops in this area
      const shopSpendMap = new Map<string, { id: string; name: string; owner: string; spendPaise: number; orderCount: number }>();
      for (const s of areaShops) {
        shopSpendMap.set(s.id, { id: s.id, name: s.name, owner: s.owner_name, spendPaise: 0, orderCount: 0 });
      }
      for (const o of areaOrders) {
        const item = shopSpendMap.get(o.shop_id);
        if (item) {
          item.spendPaise += o.total_paise;
          item.orderCount += 1;
        }
      }

      const sortedShops = Array.from(shopSpendMap.values()).sort((a, b) => b.spendPaise - a.spendPaise);
      const topShops = sortedShops.slice(0, 3).filter((s) => s.spendPaise > 0);
      const bottomShops = sortedShops.slice(-3).reverse().filter((s) => s.spendPaise === 0 || sortedShops.length > 3);

      const routeGroup = area.route_areas[0]?.route_group;
      const schedule = routeGroup?.schedules[0];

      return {
        id: area.id,
        name: area.name,
        routeGroupName: routeGroup?.name || 'Unassigned',
        orderDayOfWeek: schedule?.order_day_of_week || 1,
        cutoffTime: schedule?.order_cutoff_time || '18:00',
        totalShops: areaShops.length,
        activeShops: areaActiveShops,
        quietShops: areaQuietShops,
        coveragePercent: areaCoverage,
        ordersCount: areaOrdersCount,
        revenuePaise: areaRevenue,
        aovPaise: areaAov,
        topShops,
        bottomShops,
      };
    });

    // 6. Weekday Comparison (1=Monday ... 7=Sunday)
    const weekdayLabels = [
      { day: 1, name: 'Monday', nameHi: 'सोमवार' },
      { day: 2, name: 'Tuesday', nameHi: 'मंगलवार' },
      { day: 3, name: 'Wednesday', nameHi: 'बुधवार' },
      { day: 4, name: 'Thursday', nameHi: 'गुरुवार' },
      { day: 5, name: 'Friday', nameHi: 'शुक्रवार' },
      { day: 6, name: 'Saturday', nameHi: 'शनिवार' },
      { day: 7, name: 'Sunday', nameHi: 'रविवार' },
    ];

    const weekdayComparison = weekdayLabels.map((w) => {
      // JavaScript Date getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
      // Convert to 1-7 ISO where 1 is Monday and 7 is Sunday
      const matchingOrders = orders.filter((o) => {
        const d = new Date(o.created_at);
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return isoDay === w.day;
      });

      const dayRevenuePaise = matchingOrders.reduce((sum, o) => sum + o.total_paise, 0);

      return {
        day: w.day,
        name: w.name,
        nameHi: w.nameHi,
        ordersCount: matchingOrders.length,
        revenuePaise: dayRevenuePaise,
      };
    });

    // 7. Brand Mix Distribution
    const brandSalesMap = new Map<string, { id: string; name: string; revenuePaise: number }>();
    for (const order of orders) {
      for (const line of order.lines) {
        const brand = line.tenant_product?.brand;
        if (!brand) continue;
        const lineTotal = line.price_paise_snapshot * line.display_quantity;
        const existing = brandSalesMap.get(brand.id) || { id: brand.id, name: brand.name, revenuePaise: 0 };
        existing.revenuePaise += Math.round(lineTotal);
        brandSalesMap.set(brand.id, existing);
      }
    }

    const brandMix = Array.from(brandSalesMap.values())
      .map((b) => ({
        ...b,
        percentage: totalRevenuePaise > 0 ? Math.round((b.revenuePaise / totalRevenuePaise) * 100) : 0,
      }))
      .sort((a, b) => b.revenuePaise - a.revenuePaise);

    return NextResponse.json({
      success: true,
      filters: { range, areaFilter },
      summary: {
        totalRevenuePaise,
        totalOrders,
        averageOrderValuePaise,
        totalShopsCount,
        activeShopsCount,
        quietShopsCount,
        overallCoveragePercent,
      },
      areaBreakdowns,
      weekdayComparison,
      brandMix,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute area analytics' }, { status: 500 });
  }
}
