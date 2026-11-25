import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGoogleOAuthUrl, generatePkce } from '@/lib/services/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || new URL(req.url).host;
  const proto = req.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const { verifier, challenge } = generatePkce();

  const googleUrl = getGoogleOAuthUrl(state, redirectUri, challenge, nonce);

  const res = NextResponse.redirect(googleUrl);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 300, // 5 minutes
  };

  res.cookies.set('vitarak_oauth_state', state, cookieOptions);
  res.cookies.set('vitarak_oauth_pkce', verifier, cookieOptions);
  res.cookies.set('vitarak_oauth_nonce', nonce, cookieOptions);

  return res;
}
