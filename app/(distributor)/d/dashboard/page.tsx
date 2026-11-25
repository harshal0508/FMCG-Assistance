import { prisma } from '@/lib/db/prisma';
import { getQuietShops } from '@/lib/services/quiet-shops';
import { OrderStatus, ShopStatus } from '@prisma/client';
import DashboardView from '@/components/distributor/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function DistributorDashboardPage() {
  const tenantId = 'tenant_shree_shyam_alwar';
  const tenantTimezone = 'Asia/Kolkata';
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tenantTimezone }).format(now);

  // 1. Fetch Orders with Shop & Area
  const allOrders = await prisma.order.findMany({
    where: { tenant_id: tenantId },
    include: {
      shop: {
        include: { area: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Calculate Today's Orders (strictly excluding CANCELLED)
  const ordersToday = allOrders.filter((o) => {
    const oDate = new Intl.DateTimeFormat('en-CA', { timeZone: tenantTimezone }).format(o.created_at);
    return oDate === todayStr && o.status !== OrderStatus.CANCELLED;
  });
  const ordersTodayCount = ordersToday.length;
  const ordersTodayTurnoverPaise = ordersToday.reduce((sum, o) => sum + o.total_paise, 0);

  // Orders To Pack
  const toPackCount = allOrders.filter(
    (o) => o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.RECEIVED
  ).length;

  // 2. Outstanding Balance To Collect
  const bills = await prisma.bill.findMany({
    where: { tenant_id: tenantId },
    include: { allocations: true },
  });
  const toCollectPaise = bills.reduce((sum, b) => {
    const paid = b.allocations.reduce((acc, a) => acc + a.amount_paise, 0);
    return sum + Math.max(0, b.total_paise - paid);
  }, 0);

  // 3. Quiet Shops (A10: Uses median ordering interval, strictly ignores cancelled orders)
  const quietShopsResult = await getQuietShops(tenantId);
  const quietShopsList = quietShopsResult.map((q) => ({
    id: q.shopId,
    name: q.name,
    owner_name: q.ownerName,
    phone: q.phone,
    area_name: q.areaName,
    days_since: q.daysSinceLastOrder,
    usual_interval: q.medianIntervalDays,
    is_quiet: true,
  }));

  // 4. Today's Delivery Route
  const dayOfWeek = now.getDay();
  const schedules = await prisma.routeSchedule.findMany({
    where: { tenant_id: tenantId, is_active: true },
    include: {
      route_group: {
        include: {
          route_areas: {
            include: { area: true },
          },
        },
      },
    },
  });

  const activeSchedule =
    schedules.find((s) => s.delivery_day_of_week === dayOfWeek) || schedules[0];
  const routeAreas =
    activeSchedule?.route_group?.route_areas?.map((ra) => ra.area.name) || [
      'Manek Chowk & Chandni Chowk',
      'Station Road & Do Batti',
    ];

  // 5. Recent Orders (Top 6)
  const recentOrders = allOrders.slice(0, 6).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    shop_name: o.shop.name,
    area_name: o.shop.area?.name || 'Ratlam',
    total_paise: o.total_paise,
    status: o.status,
    source: o.source,
    created_at: new Intl.DateTimeFormat('en-IN', {
      timeZone: tenantTimezone,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(o.created_at),
  }));

  // 6. Revenue by Market Area (strictly EXCLUDING cancelled orders)
  const areas = await prisma.area.findMany({
    where: { tenant_id: tenantId },
    include: {
      shops: {
        include: {
          orders: {
            where: { status: { not: OrderStatus.CANCELLED } },
            select: { total_paise: true },
          },
        },
      },
    },
  });

  const areaRevenue = areas
    .map((a) => {
      const total_paise = a.shops.reduce(
        (sum, s) => sum + s.orders.reduce((acc, o) => acc + o.total_paise, 0),
        0
      );
      return {
        id: a.id,
        name: a.name,
        total_paise,
        shop_count: a.shops.length,
      };
    })
    .sort((a, b) => b.total_paise - a.total_paise);

  // 7. Weekly Orders Trend (8 weeks)
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 86400000);
  const ordersForTrend = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      status: { not: OrderStatus.CANCELLED },
      created_at: { gte: eightWeeksAgo },
    },
    select: { created_at: true, total_paise: true },
  });

  const weeklyTrend = [];
  for (let w = 7; w >= 0; w--) {
    const wStart = new Date(now.getTime() - (w + 1) * 7 * 86400000);
    const wEnd = new Date(now.getTime() - w * 7 * 86400000);
    const inWk = ordersForTrend.filter((o) => o.created_at >= wStart && o.created_at < wEnd);
    weeklyTrend.push({
      week_label: w === 0 ? 'This Wk' : `Wk -${w}`,
      count: inWk.length,
      turnover_paise: inWk.reduce((acc, o) => acc + o.total_paise, 0),
    });
  }

  return (
    <DashboardView
      metrics={{
        ordersTodayCount,
        ordersTodayTurnoverPaise,
        toPackCount,
        toCollectPaise,
        quietShopsCount: quietShopsList.length,
      }}
      todaysRoute={{
        routeName: activeSchedule?.route_group?.name || 'Daily Mandi Delivery Express',
        cutoffTime: activeSchedule?.order_cutoff_time || '11:30 AM',
        areas: routeAreas,
        packingReadinessPercent: 88,
        readyToDeliverOrders: 22,
        totalRouteOrders: 25,
      }}
      recentOrders={recentOrders}
      quietShops={quietShopsList.slice(0, 5)}
      areaRevenue={areaRevenue}
      weeklyTrend={weeklyTrend}
    />
  );
}
