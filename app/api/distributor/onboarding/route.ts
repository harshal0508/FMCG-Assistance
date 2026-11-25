import { NextRequest, NextResponse } from 'next/server';
import { processOwnerOnboarding } from '@/lib/services/onboarding';
import { SESSION_COOKIE_NAME } from '@/lib/services/session';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = await checkRateLimit(`onboarding_${ip}`, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many registration requests. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    // Read stored Google user info from cookie or request body
    const googleUserCookie = req.cookies.get('vitarak_google_user')?.value;
    let googleUser: any = null;
    if (googleUserCookie) {
      try {
        googleUser = JSON.parse(googleUserCookie);
      } catch {}
    }

    const body = await req.json();

    const googleSub = body.googleSub || googleUser?.sub;
    const googleEmail = body.googleEmail || googleUser?.email;

    if (!googleSub || !googleEmail) {
      return NextResponse.json(
        { error: 'Google authentication required before onboarding. Please sign in with Google first.' },
        { status: 401 }
      );
    }

    const deviceFingerprint = req.cookies.get('vitarak_device_fingerprint')?.value || body.deviceFingerprint || `dev_${googleSub.slice(0, 8)}`;
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await processOwnerOnboarding({
      businessName: body.businessName,
      ownerName: body.ownerName || googleUser?.name || 'Owner',
      phone: body.phone,
      city: body.city,
      state: body.state,
      areas: body.areas || [],
      upiId: body.upiId,
      orderCutoffTime: body.orderCutoffTime || '18:00',
      gstin: body.gstin,
      gstinException: body.gstinException,
      gstinExceptionReason: body.gstinExceptionReason,
      termsAccepted: body.termsAccepted,
      termsVersion: body.termsVersion || 'v1.0-2026',
      privacyAccepted: body.privacyAccepted,
      privacyVersion: body.privacyVersion || 'v1.0-2026',
      inviteCode: body.inviteCode,
      googleSub,
      googleEmail,
      deviceFingerprint,
      deviceName: body.deviceName || 'Owner Device',
      pin: body.pin,
      userAgent,
      ip,
    });

    const response = NextResponse.json({
      success: true,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      status: result.status,
      message: result.status === 'PENDING'
        ? 'Registration submitted! Your distributor account is currently PENDING administrator approval.'
        : 'Registration successful! Your distributor portal is active.',
    });

    // Set secure session cookie
    response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    // Clear temporary onboarding cookies
    response.cookies.delete('vitarak_onboarding_token');
    response.cookies.delete('vitarak_google_user');

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Onboarding failed' }, { status: 400 });
  }
}
