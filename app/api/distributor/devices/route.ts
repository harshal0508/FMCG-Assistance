import { NextRequest, NextResponse } from 'next/server';
import { validateServerSession, isAuthorizedForSensitiveAction, revokeAllUserSessions, SESSION_COOKIE_NAME } from '@/lib/services/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionData = await validateServerSession(rawToken || '');
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const devices = await prisma.device.findMany({
      where: {
        user_id: sessionData.user.id,
        revoked_at: null,
      },
      include: {
        sessions: {
          where: { revoked_at: null },
          select: { id: true, last_seen_at: true, unlocked_until: true },
        },
      },
      orderBy: { last_active_at: 'desc' },
    });

    const formatted = devices.map((d) => ({
      id: d.id,
      deviceName: d.device_name,
      deviceToken: d.device_fingerprint,
      lastActiveAt: d.last_active_at,
      createdAt: d.created_at,
      isCurrentDevice: d.id === sessionData.device.id,
      isLocked: Boolean(d.pin_locked_at || d.pin_failed_attempts >= 5),
      activeSessionsCount: d.sessions.length,
    }));

    return NextResponse.json({ devices: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionData = await validateServerSession(rawToken || '');
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sensitive action check
    if (!isAuthorizedForSensitiveAction(sessionData.session)) {
      return NextResponse.json(
        { error: 'Sensitive action requires recent PIN verification within the last 5 minutes.', requiresPin: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action'); // "revoke_device" or "logout_everywhere"
    const deviceId = searchParams.get('deviceId');

    if (action === 'logout_everywhere') {
      // Revoke all sessions except current session
      await revokeAllUserSessions(sessionData.user.id, sessionData.session.id);
      return NextResponse.json({ success: true, message: 'All other sessions have been logged out.' });
    }

    if (deviceId) {
      // Revoke specific device and terminate its sessions
      await prisma.$transaction([
        prisma.device.update({
          where: { id: deviceId, user_id: sessionData.user.id },
          data: { revoked_at: new Date() },
        }),
        prisma.session.updateMany({
          where: { device_id: deviceId },
          data: { revoked_at: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Device revoked successfully.' });
    }

    return NextResponse.json({ error: 'Invalid device management action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
