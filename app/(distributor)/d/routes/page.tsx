import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';
import RoutesView from '@/components/distributor/routes-view';

export const revalidate = 10;

export default async function RoutesPage() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/d/login');
  }

  const sessionData = await validateServerSession(sessionToken);
  if (!sessionData) {
    redirect('/d/login');
  }

  if (!sessionData.isUnlocked) {
    redirect('/d/login');
  }

  const tenantId = sessionData.tenantId;

  const [routeGroups, areas, totalShops] = await Promise.all([
    prisma.routeGroup.findMany({
      where: { tenant_id: tenantId },
      include: {
        schedules: {
          where: { is_active: true },
        },
        route_areas: {
          include: {
            area: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.area.findMany({
      where: { tenant_id: tenantId },
      include: {
        shops: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.shop.count({
      where: { tenant_id: tenantId },
    }),
  ]);

  const formattedGroups = routeGroups.map((g) => ({
    id: g.id,
    name: g.name,
    areas: g.route_areas.map((ra) => ({
      id: ra.area.id,
      name: ra.area.name,
    })),
    schedules: g.schedules.map((s) => ({
      id: s.id,
      order_day_of_week: s.order_day_of_week,
      order_cutoff_time: s.order_cutoff_time,
      packing_day_of_week: s.packing_day_of_week,
      delivery_day_of_week: s.delivery_day_of_week,
      is_active: s.is_active,
    })),
  }));

  const formattedAreas = areas.map((a) => ({
    id: a.id,
    name: a.name,
    shopCount: a.shops.length,
    assignedRouteGroupId: routeGroups.find((g) =>
      g.route_areas.some((ra) => ra.area_id === a.id)
    )?.id || null,
  }));

  return (
    <RoutesView
      initialRouteGroups={formattedGroups}
      initialAreas={formattedAreas}
      totalShops={totalShops}
    />
  );
}
