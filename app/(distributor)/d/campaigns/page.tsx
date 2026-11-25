import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';
import CampaignsView from '@/components/distributor/campaigns-view';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/d/login');
  }

  const sessionData = await validateServerSession(sessionToken);
  if (!sessionData || !sessionData.isUnlocked) {
    redirect('/d/login');
  }

  const tenantId = sessionData.tenantId;

  // Map requested tab
  let initialTab: 'TRIGGER' | 'SUMMARY' | 'OUTBOX' | 'FESTIVALS' = 'TRIGGER';
  const rawTab = (searchParams?.tab || '').toUpperCase();
  if (rawTab === 'OUTBOX') initialTab = 'OUTBOX';
  else if (rawTab === 'SUMMARY' || rawTab === 'CAMPAIGNS') initialTab = 'SUMMARY';
  else if (rawTab === 'FESTIVALS') initialTab = 'FESTIVALS';

  // 1. Fetch campaigns with performance summary
  const campaigns = await prisma.campaign.findMany({
    where: { tenant_id: tenantId },
    include: {
      route_group: {
        select: { id: true, name: true },
      },
      messages: {
        select: { shop_id: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const formattedCampaigns = await Promise.all(
    campaigns.map(async (c) => {
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

  // 2. Fetch Route Groups & Areas
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

  return (
    <CampaignsView
      initialCampaigns={formattedCampaigns}
      initialRouteGroups={routeGroups.map((g) => ({
        id: g.id,
        name: g.name,
        areas: g.route_areas.map((ra) => ({ id: ra.area.id, name: ra.area.name })),
        cutoffTime: g.schedules[0]?.order_cutoff_time || '18:00',
        orderDay: g.schedules[0]?.order_day_of_week || 1,
      }))}
      initialAreas={areas.map((a) => ({
        id: a.id,
        name: a.name,
        shopCount: a.shops.length,
      }))}
      initialPlanUsage={{
        sentThisMonth: totalSentThisMonth,
        monthlyLimit: 10000,
      }}
      initialTab={initialTab}
    />
  );
}
