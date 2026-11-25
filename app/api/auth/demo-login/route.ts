import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import {
  SESSION_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  createServerSession,
  setDevicePin,
  validatePinStrength,
  getDeviceCookieOptions,
  getSessionCookieOptions,
} from '@/lib/services/session';
import { isDemoLoginAllowed } from '@/lib/services/auth';

export const dynamic = 'force-dynamic';

// Strong demo PIN that passes validatePinStrength (not repetitive, not sequential)
const STRONG_DEMO_PIN = '839201';

export async function POST(req: NextRequest) {
  // A3 Strict Enforcement: Only allowed in development with explicit ENABLE_DEMO_LOGIN=true
  if (!isDemoLoginAllowed()) {
    return NextResponse.json(
      { error: 'ACCESS DENIED: Demo logins are strictly disabled in production.' },
      { status: 403 }
    );
  }

  // Validate that our demo PIN passes the exact same PIN strength rules as real ones
  const strength = validatePinStrength(STRONG_DEMO_PIN);
  if (!strength.valid) {
    return NextResponse.json(
      { error: `Demo PIN strength violation: ${strength.error}` },
      { status: 500 }
    );
  }

  try {
    const tenantId = 'tenant_shree_shyam_alwar';

    // 1. Find or verify Owner user
    let user = await prisma.user.findFirst({
      where: {
        memberships: {
          some: { tenant_id: tenantId, role: Role.OWNER },
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@example.invalid',
          name: 'Demo Owner',
          phone: '9000000000',
          password_hash: await bcrypt.hash('demo_owner_pass_2026', 10),
          memberships: {
            create: {
              tenant_id: tenantId,
              role: Role.OWNER,
            },
          },
        },
      });
    }

    // 2. Identify or register the physical device
    let deviceFingerprint = req.cookies.get('vitarak_device_token')?.value;
    if (!deviceFingerprint) {
      deviceFingerprint = `dev_${crypto.randomBytes(24).toString('hex')}`;
    }

    let device = await prisma.device.findFirst({
      where: {
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        revoked_at: null,
      },
    });

    if (!device) {
      device = await prisma.device.create({
        data: {
          user_id: user.id,
          device_fingerprint: deviceFingerprint,
          device_name: 'Owner Workstation (Demo)',
          is_trusted: true,
          pin_failed_attempts: 0,
        },
      });
    }

    // 3. Set the strong peppered PIN on this registered device
    await setDevicePin(device.id, STRONG_DEMO_PIN);

    // 4. Create active device session
    const userAgent = req.headers.get('user-agent') || 'Browser';
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const { session, rawToken } = await createServerSession(
      user.id,
      device.id,
      userAgent,
      ip
    );

    const res = NextResponse.json({
      success: true,
      message: 'Demo device successfully registered and bound to Owner.',
      deviceId: device.id,
    });

    // Set HTTP-only secure session and device cookies
    res.cookies.set(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions());
    res.cookies.set(DEVICE_COOKIE_NAME, deviceFingerprint, getDeviceCookieOptions());

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Demo login failed' },
      { status: 500 }
    );
  }
}
