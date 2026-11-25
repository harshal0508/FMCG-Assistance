import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { Role, TenantStatus } from '@prisma/client';
import {
  createServerSession,
  validateServerSession,
  revokeServerSession,
  revokeAllUserSessions,
  setDevicePin,
  verifyDevicePinAndUnlock,
  getOrCreateDevice,
} from '@/lib/services/session';
import { reserveProductStockAtomic, releaseProductStockAtomic } from '@/lib/services/stock';
import { checkDuplicateGstin } from '@/lib/services/gst-verifier';
import { generateMockTestGstin } from '@/lib/services/gstin';

describe('Server Sessions, Device Binding, Staff Invites, and Atomic Concurrency', () => {
  const testTenantId = 'tenant_session_test_01';
  let testUserId: string;
  let testDeviceId: string;

  beforeAll(async () => {
    // 1. Setup Test Tenant
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'Session Test Distributor',
        owner_name: 'Test Owner',
        phone: '9999000001',
        city: 'Jaipur',
        status: TenantStatus.ACTIVE,
        gstin: generateMockTestGstin(27, 'TESTA'),
      },
    });

    // 2. Setup Test User
    const user = await prisma.user.upsert({
      where: { email: 'session_test@vitarak.io' },
      update: {},
      create: {
        email: 'session_test@vitarak.io',
        name: 'Session Tester',
      },
    });
    testUserId = user.id;

    // 3. Setup Test Device
    const device = await getOrCreateDevice(testUserId, 'fp_test_device_001', 'Test Pixel 8');
    testDeviceId = device.id;
  });

  afterAll(async () => {
    // Cleanup sessions, devices, invites
    await prisma.session.deleteMany({ where: { user_id: testUserId } });
    await prisma.device.deleteMany({ where: { user_id: testUserId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  // ----------------------------------------------------
  // 1. Session Lifecycle & Token Hashing
  // ----------------------------------------------------
  it('creates a stateful server session storing only the SHA-256 token hash', async () => {
    const { session, rawToken } = await createServerSession(
      testUserId,
      testDeviceId,
      'Mozilla/5.0 TestBrowser',
      '192.168.1.1'
    );

    expect(rawToken).toHaveLength(64); // 32 random bytes hex
    expect(session.token_hash).not.toBe(rawToken);
    expect(session.token_hash).toHaveLength(64); // SHA-256 hex length
    expect(session.revoked_at).toBeNull();
    expect(session.unlocked_until).toBeNull(); // Starts locked

    // Validate using rawToken
    const validated = await validateServerSession(rawToken);
    expect(validated).not.toBeNull();
    expect(validated?.session.id).toBe(session.id);
    expect(validated?.isUnlocked).toBe(false);
    expect(validated?.requiresPin).toBe(true);
  });

  it('immediately invalidates session upon server-side revocation (Logout)', async () => {
    const { session, rawToken } = await createServerSession(testUserId, testDeviceId);

    const revoked = await revokeServerSession(rawToken);
    expect(revoked).toBe(true);

    const check = await validateServerSession(rawToken);
    expect(check).toBeNull();
  });

  it('supports "Log Out Everywhere" by revoking all user sessions', async () => {
    const s1 = await createServerSession(testUserId, testDeviceId);
    const s2 = await createServerSession(testUserId, testDeviceId);

    await revokeAllUserSessions(testUserId);

    expect(await validateServerSession(s1.rawToken)).toBeNull();
    expect(await validateServerSession(s2.rawToken)).toBeNull();
  });

  // ----------------------------------------------------
  // 2. PIN Verification, Unlock & 5-Attempt Lockout
  // ----------------------------------------------------
  it('locks device after 5 consecutive incorrect PIN attempts', async () => {
    // Set PIN to '492817'
    await setDevicePin(testDeviceId, '492817');

    const { session } = await createServerSession(testUserId, testDeviceId);

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const attempt = await verifyDevicePinAndUnlock(session.id, testDeviceId, '000001');
      expect(attempt.success).toBe(false);
      expect(attempt.locked).toBe(false);
      expect(attempt.remainingAttempts).toBe(5 - i);
    }

    // 5th failed attempt -> locks device!
    const fifthAttempt = await verifyDevicePinAndUnlock(session.id, testDeviceId, '000001');
    expect(fifthAttempt.success).toBe(false);
    expect(fifthAttempt.locked).toBe(true);
    expect(fifthAttempt.remainingAttempts).toBe(0);

    // Even with correct PIN, locked device must reject!
    const lockedAttempt = await verifyDevicePinAndUnlock(session.id, testDeviceId, '492817');
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.locked).toBe(true);
  });

  it('successfully unlocks session for 15 minutes when correct PIN is entered', async () => {
    // Reset failed counter and set valid PIN
    await prisma.device.update({
      where: { id: testDeviceId },
      data: { pin_failed_attempts: 0, pin_locked_at: null },
    });
    await setDevicePin(testDeviceId, '938204');

    const { session, rawToken } = await createServerSession(testUserId, testDeviceId);

    const unlock = await verifyDevicePinAndUnlock(session.id, testDeviceId, '938204');
    expect(unlock.success).toBe(true);
    expect(unlock.locked).toBe(false);

    const validated = await validateServerSession(rawToken);
    expect(validated?.isUnlocked).toBe(true);
    expect(validated?.requiresPin).toBe(false);
  });

  // ----------------------------------------------------
  // 3. Duplicate GSTIN Detection
  // ----------------------------------------------------
  it('detects duplicate GSTIN registrations and flags them', async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: testTenantId } });
    if (!tenant?.gstin) throw new Error('Test tenant missing gstin');

    // Querying same GSTIN from another tenant id must return isDuplicate: true
    const dupCheck = await checkDuplicateGstin(tenant.gstin, 'different_tenant_id');
    expect(dupCheck.isDuplicate).toBe(true);
    expect(dupCheck.existingTenantId).toBe(testTenantId);

    // Querying for own tenant id must return isDuplicate: false
    const selfCheck = await checkDuplicateGstin(tenant.gstin, testTenantId);
    expect(selfCheck.isDuplicate).toBe(false);
  });

  // ----------------------------------------------------
  // 5. Stock Reservation Concurrency Test (No Overselling)
  // ----------------------------------------------------
  it('atomically prevents overselling under parallel concurrent reservation requests', async () => {
    // Create temporary master product and tenant product with exactly 5 items in stock
    const category = await prisma.category.findFirst({ where: { tenant_id: testTenantId } }) ||
      await prisma.category.create({
        data: {
          tenant_id: testTenantId,
          name: 'Biscuits',
          hindi_name: 'बिस्कुट',
          icon: 'Cookie',
        },
      });

    const master = await prisma.masterProduct.create({
      data: {
        category_id: category.id,
        name: 'Parle-G 100g Concurrency Test',
        mrp_paise: 1000,
        image_url: '/placeholder.png',
        base_unit: 'packet',
        default_order_unit: 'packet',
        unit_chain_json: JSON.stringify([{ unit_name: 'packet', factor: 1 }]),
      },
    });

    const tp = await prisma.tenantProduct.create({
      data: {
        tenant_id: testTenantId,
        master_product_id: master.id,
        rate_paise: 1000,
        stock_qty: 5, // Exactly 5 packets in warehouse
        in_stock_flag: true,
      },
    });

    // 10 concurrent requests each attempting to reserve 1 packet
    // Since only 5 exist, exactly 5 must succeed and 5 must fail!
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        reserveProductStockAtomic(tp.id, 1)
      )
    );

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(succeeded).toHaveLength(5);
    expect(failed).toHaveLength(5);

    // Warehouse stock must be exactly 0, NEVER negative
    const finalProduct = await prisma.tenantProduct.findUnique({ where: { id: tp.id } });
    expect(finalProduct?.stock_qty).toBe(0);

    // Cleanup test product
    await prisma.tenantProduct.delete({ where: { id: tp.id } });
    await prisma.masterProduct.delete({ where: { id: master.id } });
  });
});
