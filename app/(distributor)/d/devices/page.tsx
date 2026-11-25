import { prisma } from '@/lib/db/prisma';
import DevicesClientView, { DeviceItem } from '@/components/distributor/devices-client-view';

export const dynamic = 'force-dynamic';

export default async function DevicesManagementPage() {
  const devices = await prisma.device.findMany({
    where: { revoked_at: null },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            select: { role: true },
            take: 1,
          },
        },
      },
      sessions: {
        where: { revoked_at: null },
        select: { id: true, last_seen_at: true },
      },
    },
    orderBy: { last_active_at: 'desc' },
  });

  const formatted: DeviceItem[] = devices.map((d) => ({
    id: d.id,
    deviceName: d.device_name,
    deviceToken: d.device_fingerprint,
    userName: d.user.name,
    userRole: d.user.memberships[0]?.role,
    lastActiveAt: d.last_active_at.toISOString(),
    createdAt: d.created_at.toISOString(),
    isLocked: Boolean(d.pin_locked_at || d.pin_failed_attempts >= 5),
    activeSessionsCount: d.sessions.length,
  }));

  return (
    <div className="space-y-6">
      <DevicesClientView initialDevices={formatted} />
    </div>
  );
}
