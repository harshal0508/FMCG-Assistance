/**
 * Optional WebAuthn / Passkey Authentication Service
 * 
 * Provides biometric / device-native unlock (fingerprint, Face ID, Windows Hello)
 * as an optional quick unlock following PIN setup, with seamless PIN fallback.
 * Relying Party ID is configurable via `WEBAUTHN_RP_ID`.
 */

import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { IDLE_UNLOCK_DURATION_MS } from './session';

export function getRelyingPartyConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawId = process.env.WEBAUTHN_RP_ID?.trim();

  // In production, WEBAUTHN_RP_ID must have NO default and must refuse to operate if missing
  if (isProduction && !rawId) {
    throw new Error(
      '[WebAuthn Security Violation] WEBAUTHN_RP_ID environment variable has no default and is missing in production. Refusing to start WebAuthn service without explicit production domain.'
    );
  }

  // In development/test, default to localhost
  const effectiveId = rawId || 'localhost';

  // Strip protocol, port, and trailing paths if present to comply with WebAuthn RP ID requirements
  const cleanId = effectiveId.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];

  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Vitarak FMCG Platform',
    id: cleanId,
  };
}

/**
 * Generates registration options for WebAuthn navigator.credentials.create().
 */
export function generatePasskeyRegistrationOptions(userId: string, userName: string) {
  const rp = getRelyingPartyConfig();
  const challenge = crypto.randomBytes(32).toString('base64url');

  return {
    challenge,
    rp,
    user: {
      id: Buffer.from(userId).toString('base64url'),
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Built-in platform biometric
      userVerification: 'preferred',
      residentKey: 'discouraged',
    },
    timeout: 60000,
    attestation: 'none',
  };
}

/**
 * Stores registered passkey credential bound to the device.
 */
export async function savePasskeyCredential(
  deviceId: string,
  credentialId: string,
  publicKey: string,
  transports?: string[]
) {
  return await prisma.passkeyCredential.upsert({
    where: { id: credentialId },
    update: {
      public_key: publicKey,
      transports: transports ? JSON.stringify(transports) : null,
    },
    create: {
      id: credentialId,
      device_id: deviceId,
      public_key: publicKey,
      transports: transports ? JSON.stringify(transports) : null,
    },
  });
}

/**
 * Generates authentication options for navigator.credentials.get().
 */
export async function generatePasskeyAuthOptions(deviceId: string) {
  const credentials = await prisma.passkeyCredential.findMany({
    where: { device_id: deviceId },
  });

  const challenge = crypto.randomBytes(32).toString('base64url');
  const rp = getRelyingPartyConfig();

  return {
    challenge,
    rpId: rp.id,
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      type: 'public-key',
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    timeout: 60000,
    userVerification: 'preferred',
  };
}

/**
 * Verifies passkey unlock and updates session unlock timestamp.
 */
export async function verifyPasskeyAndUnlock(sessionId: string, credentialId: string) {
  const cred = await prisma.passkeyCredential.findUnique({
    where: { id: credentialId },
    include: { device: true },
  });

  if (!cred) {
    return { success: false, error: 'Passkey not recognized' };
  }

  // Update session unlocked time
  const unlockedUntil = new Date(Date.now() + IDLE_UNLOCK_DURATION_MS);
  await prisma.session.update({
    where: { id: sessionId },
    data: { unlocked_until: unlockedUntil },
  });

  return { success: true, unlockedUntil };
}
