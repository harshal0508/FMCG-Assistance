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
    const range = searchParams.get('range') || '8W';
    const areaFilter = searchParams.get('areaId') || 'ALL';

    const now = new Date();
    let startDate: Date | null = null;
    if (range === '7D') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30D') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '8W') {
      startDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    }

    const areas = await prisma.area.findMany({
      where: { tenant_id: tenantId },
      include: {
        route_areas: {
          include: { route_group: true },
        },
        shops: true,
      },
      orderBy: { name: 'asc' },
    });

    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: { not: 'CANCELLED' },
        ...(startDate ? { created_at: { gte: startDate } } : {}),
        ...(areaFilter !== 'ALL' ? { shop: { area_id: areaFilter } } : {}),
      },
      include: {
        shop: {
          include: { area: true },
        },
      },
    });

    const targetAreas = areaFilter === 'ALL' ? areas : areas.filter((a) => a.id === areaFilter);
    const activeShopIdSet = new Set(orders.map((o) => o.shop_id));

    // Build CSV
    const rows: string[] = [];
    rows.push('--- AREA PERFORMANCE SUMMARY ---');
    rows.push('Area Name,Route Group,Total Revenue (INR),Total Orders,Average Order Value (INR),Total Registered Shops,Active Shops,Quiet Shops,Coverage (%)');

    for (const a of targetAreas) {
      const areaOrders = orders.filter((o) => o.shop.area_id === a.id);
      const revRupees = (areaOrders.reduce((sum, o) => sum + o.total_paise, 0) / 100).toFixed(2);
      const ordersCount = areaOrders.length;
      const aovRupees = ordersCount > 0 ? (Number(revRupees) / ordersCount).toFixed(2) : '0.00';
      const totalShops = a.shops.length;
      const activeShops = a.shops.filter((s) => activeShopIdSet.has(s.id)).length;
      const quietShops = Math.max(0, totalShops - activeShops);
      const coveragePct = totalShops > 0 ? ((activeShops / totalShops) * 100).toFixed(1) : '0.0';

      rows.push(`"${a.name}","${a.route_areas[0]?.route_group?.name || 'Unassigned'}",${revRupees},${ordersCount},${aovRupees},${totalShops},${activeShops},${quietShops},${coveragePct}%`);
    }

    rows.push('');
    rows.push('--- SHOP-WISE SPEND REPORT ---');
    rows.push('Area Name,Shop Name,Owner Name,Total Orders,Total Spend (INR)');

    for (const a of targetAreas) {
      for (const s of a.shops) {
        const shopOrders = orders.filter((o) => o.shop_id === s.id);
        const shopRevRupees = (shopOrders.reduce((sum, o) => sum + o.total_paise, 0) / 100).toFixed(2);
        rows.push(`"${a.name}","${s.name}","${s.owner_name}",${shopOrders.length},${shopRevRupees}`);
      }
    }

    const csvContent = rows.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="area-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to export CSV' }, { status: 500 });
  }
}
