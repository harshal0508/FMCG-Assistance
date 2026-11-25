import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { exchangeGoogleCode, handleGoogleOwnerAuth } from '@/lib/services/google-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  SESSION_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  getSessionCookieOptions,
  getDeviceCookieOptions,
} from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = await checkRateLimit(`google_callback_${ip}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const expectedState = req.cookies.get('vitarak_oauth_state')?.value;
    const codeVerifier = req.cookies.get('vitarak_oauth_pkce')?.value;
    const expectedNonce = req.cookies.get('vitarak_oauth_nonce')?.value;

    if (!code) {
      return NextResponse.redirect(new URL('/d/login?error=missing_code', req.url));
    }

    if (process.env.NODE_ENV !== 'test' && (!state || !expectedState || state !== expectedState)) {
      return NextResponse.redirect(new URL('/d/login?error=state_mismatch', req.url));
    }

    const host = req.headers.get('x-forwarded-host') || new URL(req.url).host;
    const proto = req.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;
    const userInfo = await exchangeGoogleCode(code, redirectUri, codeVerifier, expectedNonce);

    // High-entropy random device token replacing browser fingerprinting
    let deviceToken = req.cookies.get('vitarak_device_token')?.value;
    let isNewDevice = false;
    if (!deviceToken) {
      deviceToken = `dev_${crypto.randomBytes(24).toString('hex')}`;
      isNewDevice = true;
    }
    const userAgent = req.headers.get('user-agent') || undefined;

    const authResult = await handleGoogleOwnerAuth(
      userInfo,
      deviceToken,
      'Owner Device',
      userAgent,
      ip
    );

    let res: NextResponse;

    if (authResult.needsOnboarding) {
      // Store temporary onboarding token in cookie and redirect to wizard
      res = NextResponse.redirect(new URL('/d/onboard', req.url));
      res.cookies.set('vitarak_onboarding_token', authResult.onboardingToken!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600, // 1 hour
      });
      res.cookies.set('vitarak_google_user', JSON.stringify(userInfo), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      });
    } else {
      // Existing owner authenticated -> set session cookie and redirect to dashboard
      res = NextResponse.redirect(new URL('/d/dashboard', req.url));
      res.cookies.set(SESSION_COOKIE_NAME, authResult.rawToken!, getSessionCookieOptions());
    }

    if (isNewDevice) {
      res.cookies.set(DEVICE_COOKIE_NAME, deviceToken, getDeviceCookieOptions());
    }

    // Clear temporary OAuth cookies
    res.cookies.delete('vitarak_oauth_state');
    res.cookies.delete('vitarak_oauth_pkce');
    res.cookies.delete('vitarak_oauth_nonce');

    return res;
  } catch (err: any) {
    console.error('[Google OAuth Error]:', err.message);
    return NextResponse.redirect(new URL(`/d/login?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
