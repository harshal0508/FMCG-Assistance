import { NextRequest, NextResponse } from 'next/server';
import { validateServerSession, setDevicePin, isAuthorizedForSensitiveAction, SESSION_COOKIE_NAME } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized: Session not found' }, { status: 401 });
    }

    const sessionData = await validateServerSession(rawToken);
    if (!sessionData) {
      return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 });
    }

    // If device already has a PIN, changing PIN is a sensitive action
    if (sessionData.device.pin_hash && !isAuthorizedForSensitiveAction(sessionData.session)) {
      return NextResponse.json(
        { error: 'Sensitive action requires recent PIN verification within the last 5 minutes.', requiresPin: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pin } = body;

    const result = await setDevicePin(sessionData.device.id, pin);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Device PIN successfully updated.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update PIN' }, { status: 500 });
  }
}
