import { describe, it, expect } from 'vitest';
import { assertStaffRole, verifyAdminTotp, StaffSession } from '@/lib/services/auth';
import { validatePinStrength } from '@/lib/services/session';
import { Role } from '@prisma/client';

describe('Owner Auth & Single-Owner Enforcement', () => {
  const nonOwnerSession: StaffSession = {
    userId: 'u_non_owner',
    tenantId: 'tenant_1',
    name: 'Unauthorized User',
    role: 'NON_OWNER' as Role,
    phone: '9829034567',
  };

  const ownerSession: StaffSession = {
    userId: 'u_owner',
    tenantId: 'tenant_1',
    name: 'Anand Verma',
    role: Role.OWNER,
    phone: '9829012345',
  };

  it('allows owner to access owner-only actions', () => {
    expect(() => assertStaffRole(ownerSession, [Role.OWNER])).not.toThrow();
  });

  it('strictly blocks non-owner from accessing owner-only actions', () => {
    expect(() => assertStaffRole(nonOwnerSession, [Role.OWNER])).toThrow(/ACCESS DENIED/);
  });

  it('validates 6-digit TOTP for administrative actions', () => {
    expect(verifyAdminTotp('secret_key', '123456')).toBe(true);
    expect(verifyAdminTotp('secret_key', '12')).toBe(false);
  });

  it('enforces that demo PINs pass the exact same PIN strength rules as real ones (A3 requirement)', () => {
    // Weak PINs must fail
    expect(validatePinStrength('123456').valid).toBe(false);
    expect(validatePinStrength('111111').valid).toBe(false);
    expect(validatePinStrength('123123').valid).toBe(false);

    // Strong demo PIN must pass
    const strongDemoPin = '839201';
    expect(validatePinStrength(strongDemoPin).valid).toBe(true);
  });

  it('enforces WebAuthn RP ID comes strictly from environment and refuses to operate in production without explicit domain (Item 6 Compliance)', async () => {
    const { getRelyingPartyConfig } = await import('@/lib/services/passkey');

    const originalEnv = process.env.NODE_ENV;
    const originalRpId = process.env.WEBAUTHN_RP_ID;

    try {
      // 1. With configured environment variable
      process.env.WEBAUTHN_RP_ID = 'fmcg.vitarak.in';
      const config = getRelyingPartyConfig();
      expect(config.id).toBe('fmcg.vitarak.in');

      // 2. Strips protocol/port if accidentally passed
      process.env.WEBAUTHN_RP_ID = 'https://app.vitarak.in:3000/auth';
      const cleanConfig = getRelyingPartyConfig();
      expect(cleanConfig.id).toBe('app.vitarak.in');

      // 3. In production, missing WEBAUTHN_RP_ID must throw security error
      (process.env as any).NODE_ENV = 'production';
      delete process.env.WEBAUTHN_RP_ID;
      expect(() => getRelyingPartyConfig()).toThrow(/WebAuthn Security Violation/);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.WEBAUTHN_RP_ID = originalRpId;
    }
  });
});
