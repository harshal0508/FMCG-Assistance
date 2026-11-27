/**
 * Server-Side Session and Device Management Service
 * 
 * Replaces stateless JWTs with stateful database sessions.
 * Enforces device binding, device PIN lockouts, idle unlock periods, and sensitive action guards.
 * Stores only SHA-256 hashes of session tokens.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';

export const SESSION_COOKIE_NAME = 'vitarak_staff_session';
export const DEVICE_COOKIE_NAME = 'vitarak_device_token';
export const IDLE_UNLOCK_DURATION_MS = 15 * 60 * 1000;      // 15 minutes
export const SENSITIVE_ACTION_DURATION_MS = 5 * 60 * 1000;  // 5 minutes
export const MAX_PIN_FAILED_ATTEMPTS = 5;

// List of trivial / weak 6-digit PINs rejected on setup
const WEAK_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
  '123456', '654321', '012345', '543210', '987654',
  '121212', '123123', '112233', '102030', '123450'
]);

/**
 * Retrieves the server-side PIN pepper from environment variables.
 * Blends a high-entropy secret into the 6-digit PIN before hashing,
 * rendering offline dictionary attacks impossible even if the database is leaked.
 */
export function getPinPepper(): string {
  return process.env.PIN_PEPPER || 'vitarak_server_secret_pin_pepper_salt_2026';
}

/**
 * Combines 6-digit PIN with a specified pepper using HMAC-SHA256.
 */
export function pepperPinWith(pin: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(pin).digest('hex');
}

/**
 * Combines 6-digit PIN with the active server-side pepper using HMAC-SHA256.
 */
export function pepperPin(pin: string): string {
  return pepperPinWith(pin, getPinPepper());
}

/**
 * Generates a cryptographically random device token to identify bound physical devices.
 */
export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Standard secure cookie options for device identification.
 * Stored in an httpOnly, secure, sameSite cookie, NEVER local storage.
 */
export function getDeviceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 24 * 3600, // 1 year
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 3600, // 7 days
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function validatePinStrength(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'PIN must be exactly 6 digits (6 अंकों का पिन होना चाहिए)' };
  }
  if (WEAK_PINS.has(pin)) {
    return { valid: false, error: 'PIN is too simple or common. Choose a stronger combination (यह पिन बहुत सरल है, कृपया दूसरा चुनें)' };
  }
  // Check sequential ascending/descending
  const isAscending = '0123456789'.includes(pin);
  const isDescending = '9876543210'.includes(pin);
  if (isAscending || isDescending) {
    return { valid: false, error: 'Sequential PINs are not allowed (लगातार अंकों का पिन अमान्य है)' };
  }
  return { valid: true };
}

/**
 * Registers or retrieves an existing device bound to a user.
 */
export async function getOrCreateDevice(
  userId: string,
  fingerprint: string,
  deviceName = 'Unknown Device'
) {
  return await prisma.device.upsert({
    where: {
      user_id_device_fingerprint: {
        user_id: userId,
        device_fingerprint: fingerprint,
      },
    },
    update: {
      device_name: deviceName,
      last_active_at: new Date(),
    },
    create: {
      user_id: userId,
      device_fingerprint: fingerprint,
      device_name: deviceName,
      last_active_at: new Date(),
    },
  });
}

/**
 * Creates a stateful server-side session.
 * Generates a high-entropy 256-bit token, stores only its SHA-256 hash in DB,
 * and returns the raw token to be set in an httpOnly cookie.
 */
export async function createServerSession(
  userId: string,
  deviceId: string,
  userAgent?: string,
  ip?: string,
  unlockedUntil?: Date | null
) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : null;

  const session = await prisma.session.create({
    data: {
      user_id: userId,
      device_id: deviceId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      unlocked_until: unlockedUntil ?? null,
      user_agent: userAgent || null,
      ip_hash: ipHash,
    },
    include: {
      user: true,
      device: true,
    },
  });

  return { session, rawToken };
}

/**
 * Validates a server session token from cookie.
 * Confirms session is not expired, not revoked, and device is not revoked.
 */
export async function validateServerSession(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            where: { is_active: true },
            include: { tenant: true },
          },
        },
      },
      device: true,
    },
  });

  if (!session) return null;
  if (session.revoked_at !== null) return null;
  if (session.device.revoked_at !== null) return null;
  if (session.expires_at < now) return null;

  // Touch last_seen_at asynchronously
  prisma.session.update({
    where: { id: session.id },
    data: { last_seen_at: now },
  }).catch(() => {});

  const isUnlocked = Boolean(session.unlocked_until && session.unlocked_until > now);

  // Convenience accessors — derived from the first active membership
  const tenantId = session.user.memberships[0]?.tenant.id ?? '';
  const userId = session.user.id;

  return {
    session,
    user: session.user,
    device: session.device,
    isUnlocked,
    requiresPin: !isUnlocked,
    tenantId,
    userId,
  };
}

/**
 * Revokes a session on the server (Logout).
 */
export async function revokeServerSession(rawToken: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(rawToken);
    await prisma.session.update({
      where: { token_hash: tokenHash },
      data: { revoked_at: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revokes all sessions for a user (or device), optionally preserving current session.
 */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      user_id: userId,
      revoked_at: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revoked_at: new Date() },
  });
}

/**
 * Sets or updates a 6-digit PIN for a device.
 * Protects against offline cracking via server-side pepper HMAC.
 */
export async function setDevicePin(deviceId: string, pin: string) {
  const strength = validatePinStrength(pin);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  const peppered = pepperPin(pin);
  const pinHash = await bcrypt.hash(peppered, 10);

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      pin_hash: pinHash,
      pin_failed_attempts: 0,
      pin_locked_at: null,
      last_active_at: new Date(),
    },
  });

  return { success: true };
}

/**
 * Verifies a device PIN and unlocks the session if correct.
 * Automatically locks the device after 5 consecutive failures.
 * Supports transparent upgrade migration for legacy unpeppered hashes.
 */
export async function verifyDevicePinAndUnlock(
  sessionId: string,
  deviceId: string,
  pin: string
) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    return { success: false, locked: false, remainingAttempts: 0, error: 'Device not found' };
  }

  // Check if already locked
  if (device.pin_locked_at || device.pin_failed_attempts >= MAX_PIN_FAILED_ATTEMPTS) {
    return {
      success: false,
      locked: true,
      remainingAttempts: 0,
      error: 'Device is locked due to too many failed attempts. Recovery required (अत्यधिक गलत प्रयासों के कारण डिवाइस लॉक है).',
    };
  }

  if (!device.pin_hash) {
    return {
      success: false,
      locked: false,
      remainingAttempts: MAX_PIN_FAILED_ATTEMPTS,
      error: 'PIN has not been set on this device yet.',
    };
  }

  const peppered = pepperPin(pin);
  let match = await bcrypt.compare(peppered, device.pin_hash);

  // Pepper Rotation Support: if primary pepper fails, check against PIN_PEPPER_OLD if configured
  if (!match && process.env.PIN_PEPPER_OLD) {
    const oldPeppered = pepperPinWith(pin, process.env.PIN_PEPPER_OLD);
    const oldMatch = await bcrypt.compare(oldPeppered, device.pin_hash);
    if (oldMatch) {
      match = true;
      // Transparently migrate the device PIN to the new active pepper
      const upgradedHash = await bcrypt.hash(peppered, 10);
      await prisma.device.update({
        where: { id: deviceId },
        data: { pin_hash: upgradedHash },
      });
    }
  }

  // Transparent upgrade: if legacy unpeppered PIN matches, upgrade to peppered hash
  if (!match) {
    const legacyMatch = await bcrypt.compare(pin, device.pin_hash);
    if (legacyMatch) {
      match = true;
      const upgradedHash = await bcrypt.hash(peppered, 10);
      await prisma.device.update({
        where: { id: deviceId },
        data: { pin_hash: upgradedHash },
      });
    }
  }

  if (match) {
    // Reset failed counter and unlock session
    const unlockedUntil = new Date(Date.now() + IDLE_UNLOCK_DURATION_MS);
    await prisma.$transaction([
      prisma.device.update({
        where: { id: deviceId },
        data: {
          pin_failed_attempts: 0,
          pin_locked_at: null,
          last_active_at: new Date(),
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { unlocked_until: unlockedUntil },
      }),
    ]);

    return {
      success: true,
      locked: false,
      remainingAttempts: MAX_PIN_FAILED_ATTEMPTS,
      unlockedUntil,
    };
  } else {
    // Increment failed attempts
    const newFailed = device.pin_failed_attempts + 1;
    const isLocked = newFailed >= MAX_PIN_FAILED_ATTEMPTS;

    await prisma.device.update({
      where: { id: deviceId },
      data: {
        pin_failed_attempts: newFailed,
        pin_locked_at: isLocked ? new Date() : null,
      },
    });

    const remaining = Math.max(0, MAX_PIN_FAILED_ATTEMPTS - newFailed);
    return {
      success: false,
      locked: isLocked,
      remainingAttempts: remaining,
      error: isLocked
        ? 'PIN entered incorrectly 5 times. Device locked (पिन 5 बार गलत डाला गया। डिवाइस लॉक हो गया है).'
        : `Incorrect PIN. ${remaining} attempts remaining (गलत पिन। ${remaining} प्रयास शेष).`,
    };
  }
}

/**
 * Checks whether the session is authorized to perform sensitive actions
 * (rates, payments, exports, staff management, device revocation).
 * Requires PIN verified within the last 5 minutes.
 */
export function isAuthorizedForSensitiveAction(session: { unlocked_until: Date | null }): boolean {
  if (!session.unlocked_until) return false;
  const now = Date.now();
  const unlockedUntil = session.unlocked_until.getTime();
  
  // Must be currently unlocked
  if (unlockedUntil < now) return false;

  // Sensitive actions window: must be within the first 5 minutes of unlock
  // Since unlock window is 15 minutes, remaining must be > 10 minutes
  const remainingMs = unlockedUntil - now;
  const elapsedSinceUnlock = IDLE_UNLOCK_DURATION_MS - remainingMs;

  return elapsedSinceUnlock <= SENSITIVE_ACTION_DURATION_MS;
}

/**
 * Checks if a PIN matches a device's pin_hash.
 */
export async function verifyDevicePin(deviceId: string, pin: string): Promise<boolean> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.pin_hash) return false;
  const peppered = pepperPin(pin);
  let match = await bcrypt.compare(peppered, device.pin_hash);
  if (!match) {
    match = await bcrypt.compare(pin, device.pin_hash);
  }
  return match;
}

/**
 * Unlocks a session for the standard idle duration.
 */
export async function unlockSession(sessionId: string): Promise<Date> {
  const unlockedUntil = new Date(Date.now() + IDLE_UNLOCK_DURATION_MS);
  await prisma.session.update({
    where: { id: sessionId },
    data: { unlocked_until: unlockedUntil },
  });
  return unlockedUntil;
}
