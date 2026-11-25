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

    // Fetch campaigns with messages and performance aggregates
    const campaigns = await prisma.campaign.findMany({
      where: { tenant_id: tenantId },
      include: {
        route_group: {
          select: { id: true, name: true },
        },
        messages: {
          include: {
            shop: {
              select: { id: true, name: true, owner_name: true, phone: true },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Compute order values generated from campaigns
    const formattedCampaigns = await Promise.all(
      campaigns.map(async (c) => {
        // Find orders placed by shops in this campaign around the campaign time
        const shopIds = c.messages.map((m) => m.shop_id);
        const orders = await prisma.order.findMany({
          where: {
            tenant_id: tenantId,
            shop_id: { in: shopIds },
            status: { not: 'CANCELLED' },
            created_at: { gte: c.created_at },
          },
          select: { total_paise: true },
        });

        const totalOrderValuePaise = orders.reduce((sum, o) => sum + o.total_paise, 0);

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          routeGroupName: c.route_group?.name || 'All Market Areas',
          createdAt: c.created_at.toISOString(),
          totalTargets: c.total_targets,
          sentCount: c.sent_count,
          openedCount: c.opened_count,
          orderedCount: c.ordered_count,
          totalOrderValuePaise,
        };
      })
    );

    // Fetch Route Groups and Areas for campaign targeting
    const [routeGroups, areas, totalSentThisMonth] = await Promise.all([
      prisma.routeGroup.findMany({
        where: { tenant_id: tenantId },
        include: {
          route_areas: {
            include: { area: true },
          },
          schedules: {
            where: { is_active: true },
          },
        },
      }),
      prisma.area.findMany({
        where: { tenant_id: tenantId },
        include: {
          shops: {
            select: { id: true },
          },
        },
      }),
      prisma.outboxMessage.count({
        where: {
          tenant_id: tenantId,
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      campaigns: formattedCampaigns,
      routeGroups: routeGroups.map((g) => ({
        id: g.id,
        name: g.name,
        areas: g.route_areas.map((ra) => ({ id: ra.area.id, name: ra.area.name })),
        cutoffTime: g.schedules[0]?.order_cutoff_time || '18:00',
        orderDay: g.schedules[0]?.order_day_of_week || 1,
      })),
      areas: areas.map((a) => ({
        id: a.id,
        name: a.name,
        shopCount: a.shops.length,
      })),
      planUsage: {
        sentThisMonth: totalSentThisMonth,
        monthlyLimit: 10000, // Pilot Plan Limit
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch campaigns' }, { status: 500 });
  }
}
