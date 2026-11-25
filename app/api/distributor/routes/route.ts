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

    const [routeGroups, areas, shopsCount] = await Promise.all([
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

    return NextResponse.json({
      success: true,
      routeGroups: formattedGroups,
      areas: formattedAreas,
      totalShops: shopsCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json();

    const {
      routeGroupId,
      name,
      orderDayOfWeek,
      orderCutoffTime,
      packingDayOfWeek,
      deliveryDayOfWeek,
      assignedAreaIds,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Route group name is required' }, { status: 400 });
    }

    const orderDay = parseInt(orderDayOfWeek, 10);
    const packingDay = parseInt(packingDayOfWeek, 10);
    const deliveryDay = parseInt(deliveryDayOfWeek, 10);

    if (isNaN(orderDay) || orderDay < 1 || orderDay > 7) {
      return NextResponse.json({ error: 'Invalid order day of week (must be 1-7, Mon-Sun)' }, { status: 400 });
    }
    if (isNaN(packingDay) || packingDay < 1 || packingDay > 7) {
      return NextResponse.json({ error: 'Invalid packing day of week (must be 1-7, Mon-Sun)' }, { status: 400 });
    }
    if (isNaN(deliveryDay) || deliveryDay < 1 || deliveryDay > 7) {
      return NextResponse.json({ error: 'Invalid delivery day of week (must be 1-7, Mon-Sun)' }, { status: 400 });
    }

    if (!orderCutoffTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(orderCutoffTime)) {
      return NextResponse.json({ error: 'Order cutoff time must be in HH:mm 24-hour format (e.g. 18:00)' }, { status: 400 });
    }

    if (!Array.isArray(assignedAreaIds)) {
      return NextResponse.json({ error: 'assignedAreaIds must be an array of area IDs' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let group;
      if (routeGroupId) {
        group = await tx.routeGroup.update({
          where: { id: routeGroupId },
          data: { name },
        });

        // Update schedule
        await tx.routeSchedule.deleteMany({
          where: { route_group_id: routeGroupId },
        });
      } else {
        group = await tx.routeGroup.create({
          data: {
            tenant_id: tenantId,
            name,
          },
        });
      }

      await tx.routeSchedule.create({
        data: {
          tenant_id: tenantId,
          route_group_id: group.id,
          order_day_of_week: orderDay,
          order_cutoff_time: orderCutoffTime,
          packing_day_of_week: packingDay,
          delivery_day_of_week: deliveryDay,
          is_active: true,
        },
      });

      // Update area mappings: remove existing mappings for these areas or this group
      await tx.routeGroupArea.deleteMany({
        where: {
          OR: [
            { route_group_id: group.id },
            { area_id: { in: assignedAreaIds } },
          ],
        },
      });

      if (assignedAreaIds.length > 0) {
        await tx.routeGroupArea.createMany({
          data: assignedAreaIds.map((areaId: string) => ({
            tenant_id: tenantId,
            route_group_id: group.id,
            area_id: areaId,
          })),
        });
      }

      return group;
    });

    return NextResponse.json({
      success: true,
      routeGroupId: result.id,
      message: 'Route group schedule and area assignments saved successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save route' }, { status: 500 });
  }
}
