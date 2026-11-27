import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  validateServerSession,
  verifyDevicePinAndUnlock,
  createServerSession,
  SESSION_COOKIE_NAME,
  pepperPin,
  IDLE_UNLOCK_DURATION_MS,
} from '@/lib/services/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: '6-digit PIN is required' }, { status: 400 });
    }

    const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionData = rawToken ? await validateServerSession(rawToken) : null;

    if (sessionData) {
      // 1. Existing recognized session: verify against bound device
      const rateCheck = await checkRateLimit(`pin_${sessionData.device.id}`, 5, 60);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            error: `Too many PIN attempts. Please wait ${rateCheck.resetSeconds} seconds before retrying.`,
            locked: false,
            remainingAttempts: 0,
          },
          { status: 429 }
        );
      }

      const result = await verifyDevicePinAndUnlock(
        sessionData.session.id,
        sessionData.device.id,
        pin.trim()
      );

      if (!result.success) {
        return NextResponse.json(result, { status: result.locked ? 423 : 401 });
      }

      return NextResponse.json({
        success: true,
        redirect: '/d/dashboard',
        unlockedUntil: result.unlockedUntil,
      });
    }

    // 2. Fresh browser / cleared cookie: Verify PIN against Owner trusted device
    const tenant = await prisma.tenant.findFirst({
      where: { is_active: true },
      include: {
        users: {
          where: { role: Role.OWNER },
          include: {
            user: {
              include: {
                devices: {
                  where: { revoked_at: null },
                  orderBy: { created_at: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    const ownerUser = tenant?.users[0]?.user;
    if (!ownerUser || ownerUser.devices.length === 0) {
      return NextResponse.json({ error: 'Distributor owner device not found.' }, { status: 404 });
    }

    // Rate limit by IP for fresh login
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = await checkRateLimit(`pin_ip_${ip}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please wait ${rateCheck.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    // Verify PIN directly in memory against owner's registered devices (no extra DB query)
    let matchedDevice = null;
    const peppered = pepperPin(pin.trim());
    for (const dev of ownerUser.devices) {
      if (dev.pin_hash) {
        let isMatch = await bcrypt.compare(peppered, dev.pin_hash);
        if (!isMatch) {
          isMatch = await bcrypt.compare(pin.trim(), dev.pin_hash);
        }
        if (isMatch) {
          matchedDevice = dev;
          break;
        }
      }
    }

    if (!matchedDevice) {
      return NextResponse.json(
        { error: 'Incorrect 6-digit security PIN. Please try again.' },
        { status: 401 }
      );
    }

    // PIN is correct! Establish verified session & unlock in a single query
    const userAgent = req.headers.get('user-agent') || 'Browser Workstation';
    const unlockedUntil = new Date(Date.now() + IDLE_UNLOCK_DURATION_MS);
    const { session, rawToken: newRawToken } = await createServerSession(
      ownerUser.id,
      matchedDevice.id,
      userAgent,
      ip,
      unlockedUntil
    );

    const response = NextResponse.json({
      success: true,
      redirect: '/d/dashboard',
    });

    const isLocalhost = req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname === '127.0.0.1';
    response.cookies.set(SESSION_COOKIE_NAME, newRawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !isLocalhost && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600, // 30 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'PIN verification failed' }, { status: 500 });
  }
}
