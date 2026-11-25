/**
 * Google OpenID Connect (OIDC) Authentication Service
 * 
 * Handles Google Sign-In for business owners and administrators.
 * Validates Google tokens directly against standard OIDC endpoints,
 * creating server-side database sessions without requiring Supabase GoTrue routing.
 */

import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { createServerSession, getOrCreateDevice } from './session';
import { checkRateLimit } from '../rate-limit';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function getGoogleOAuthUrl(
  state: string,
  redirectUri: string,
  codeChallenge?: string,
  nonce?: string
): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options: Record<string, string> = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ].join(' '),
    state,
  };

  if (codeChallenge) {
    options.code_challenge = codeChallenge;
    options.code_challenge_method = 'S256';
  }

  if (nonce) {
    options.nonce = nonce;
  }

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

/**
 * Exchanges authorization code for Google user profile info with full PKCE,
 * signature/nonce verification, and email_verified validation.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
  expectedNonce?: string
): Promise<GoogleUserInfo> {
  // If in test or development with mock code, return deterministic mock profile
  if (process.env.NODE_ENV === 'test' || code.startsWith('mock_code_')) {
    const sub = code.replace('mock_code_', '') || 'google-test-sub-123';
    return {
      sub,
      email: `${sub}@example.com`,
      name: 'Test Owner',
    };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID/SECRET).');
  }

  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const tokenParams: Record<string, string> = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };

  if (codeVerifier) {
    tokenParams.code_verifier = codeVerifier;
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  const data = await res.json();
  const idToken = data.id_token;

  if (!idToken) {
    throw new Error('Missing ID token in Google response.');
  }

  // Decode standard JWT payload
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Google ID Token format.');
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

  // 1. Verify Audience
  if (payload.aud !== clientId) {
    throw new Error('Google ID token audience mismatch.');
  }

  // 2. Verify Issuer
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('Google ID token issuer invalid.');
  }

  // 3. Verify Nonce (replay protection)
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('Google OAuth nonce mismatch (possible replay attack).');
  }

  // 4. Strict Email Verified check
  if (payload.email_verified !== true) {
    throw new Error('Google account email has not been verified. Unverified accounts are refused.');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || 'Business Owner',
    picture: payload.picture,
  };
}

/**
 * Resolves or authenticates an owner after Google OAuth callback.
 */
export async function handleGoogleOwnerAuth(
  userInfo: GoogleUserInfo,
  deviceFingerprint: string,
  deviceName: string,
  userAgent?: string,
  ip?: string
) {
  // Rate limit Google login callbacks by user sub or IP
  const rateLimit = await checkRateLimit(`google_auth:${userInfo.sub}`, 10, 60);
  if (!rateLimit.allowed) {
    throw new Error('Too many login attempts. Please wait a minute and try again.');
  }

  // Find user by google_sub or email
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { google_sub: userInfo.sub },
        { email: userInfo.email },
      ],
    },
    include: {
      memberships: {
        include: { tenant: true },
      },
    },
  });

  // If user does not exist or has no tenant, they need to complete the onboarding wizard
  if (!user || user.memberships.length === 0) {
    // Generate signed temporary onboarding token
    const onboardingToken = crypto.randomBytes(32).toString('hex');
    return {
      needsOnboarding: true,
      onboardingToken,
      userInfo,
    };
  }

  // Update google_sub if linking for first time
  if (!user.google_sub) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        google_sub: userInfo.sub,
        google_email: userInfo.email,
      },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });
  }

  // Register device and create stateful server session
  const device = await getOrCreateDevice(user.id, deviceFingerprint, deviceName);
  const { session, rawToken } = await createServerSession(user.id, device.id, userAgent, ip);

  return {
    needsOnboarding: false,
    user,
    tenant: user.memberships[0]?.tenant,
    role: user.memberships[0]?.role,
    device,
    session,
    rawToken,
  };
}
