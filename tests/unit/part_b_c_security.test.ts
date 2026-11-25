import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  validateGstin,
  maskGstin,
  computeGstinChecksum,
  generateMockTestGstin,
} from '@/lib/services/gstin';
import {
  calculatePureOrderPricing,
  PureProduct,
  PureShop,
  PureTenant,
  PureOrderItemInput,
} from '@/lib/services/pricing-pure';
import {
  validatePinStrength,
  hashToken,
  isAuthorizedForSensitiveAction,
  pepperPin,
  getPinPepper,
  IDLE_UNLOCK_DURATION_MS,
  SENSITIVE_ACTION_DURATION_MS,
} from '@/lib/services/session';
import { NextRequest } from 'next/server';
import { POST as ordersPostHandler } from '@/app/api/distributor/orders/route';
import { GET as exportCsvGetHandler } from '@/app/api/distributor/export-csv/route';
import { prisma } from '@/lib/db/prisma';
import { TenantStatus } from '@prisma/client';

describe('Part B, C & Security Enhancements Verification', () => {
  // ----------------------------------------------------
  // 1. GSTIN Checksum & Validation Tests (Using Synthetic Test Data Only)
  // ----------------------------------------------------
  describe('GSTIN Luhn Modulo-36 Checksum & Validation Engine', () => {
    it('accurately verifies generated synthetic test GSTINs', () => {
      // Generated test GSTIN for Maharashtra (27)
      const testGstin = generateMockTestGstin(27, 'TEST1');
      expect(testGstin).toHaveLength(15);

      const result = validateGstin(testGstin);
      expect(result.valid).toBe(true);
      expect(result.gstin).toBe(testGstin);
    });

    it('rejects corrupted check characters with bilingual English & Hindi error messages', () => {
      const validGstin = generateMockTestGstin(27, 'TEST2');
      const corruptedCheckChar = validGstin[14] === '0' ? '1' : '0';
      const corruptedGstin = validGstin.slice(0, 14) + corruptedCheckChar;

      const result = validateGstin(corruptedGstin);
      expect(result.valid).toBe(false);
      expect(result.errorEn).toContain('checksum verification failed');
      expect(result.errorHi).toContain('चेकसम सत्यापन विफल रहा');
    });

    it('rejects invalid GSTIN length and formats with bilingual messages', () => {
      const shortRes = validateGstin('27ABCDE1234F');
      expect(shortRes.valid).toBe(false);
      expect(shortRes.errorEn).toContain('exactly 15 characters');
      expect(shortRes.errorHi).toContain('15 अक्षरों का होना चाहिए');

      const invalidStateRes = validateGstin('99ABCDE1234F1Z0');
      expect(invalidStateRes.valid).toBe(false);
      expect(invalidStateRes.errorEn).toContain('Invalid State Code');
      expect(invalidStateRes.errorHi).toContain('राज्य कोड');
    });

    it('safely masks GSTIN for logs and non-owner interfaces (state code and last 2 characters only)', () => {
      const testGstin = generateMockTestGstin(27, 'TEST3');
      const masked = maskGstin(testGstin);

      // Must reveal first 2 chars (State code), mask 11 chars with *, reveal last 2 chars
      expect(masked).toHaveLength(15);
      expect(masked.slice(0, 2)).toBe(testGstin.slice(0, 2));
      expect(masked.slice(2, 13)).toBe('***********');
      expect(masked.slice(13)).toBe(testGstin.slice(13));
    });
  });

  // ----------------------------------------------------
  // 2. Pure Pricing Engine & GST-Off Defaults
  // ----------------------------------------------------
  describe('Pure Pricing Engine (Zero Database Dependencies & Strict Server Recalculation)', () => {
    const mockTenant: PureTenant = {
      timezone: 'Asia/Kolkata',
      orderCutoffTime: '18:00',
      enableGst: false, // OFF by default
    };

    const mockShop: PureShop = {
      id: 'shop_001',
      name: 'Adarsh Kirana',
      creditHold: false,
      creditLimitPaise: 500000,
      currentBalancePaise: 100000,
      rateOverrides: {
        prod_tea_01: 9500, // Overridden PTR rate: ₹95.00 instead of ₹100.00
      },
    };

    const productsMap = new Map<string, PureProduct>([
      [
        'prod_tea_01',
        {
          id: 'prod_tea_01',
          name: 'Taj Mahal Tea 250g',
          ratePaise: 10000,
          stockQty: 50,
          inStockFlag: true,
          dailyMaxBaseUnits: 20,
          baseUnit: 'packets',
          gstRatePercent: 18,
        },
      ],
      [
        'prod_oil_01',
        {
          id: 'prod_oil_01',
          name: 'Fortune Mustard Oil 1L',
          ratePaise: 15000,
          stockQty: 100,
          inStockFlag: true,
          dailyMaxBaseUnits: null, // Unlimited
          baseUnit: 'pouches',
          gstRatePercent: 5,
        },
      ],
    ]);

    it('ignores client-supplied prices and recomputes effective rates from catalog/overrides', () => {
      const items: PureOrderItemInput[] = [
        {
          tenantProductId: 'prod_tea_01',
          orderQty: 2,
          clientPricePaise: 100, // Tampered client rate of ₹1.00!
        },
        {
          tenantProductId: 'prod_oil_01',
          orderQty: 1,
          clientPricePaise: 50, // Tampered client rate!
        },
      ];

      const res = calculatePureOrderPricing(mockTenant, mockShop, productsMap, items);

      expect(res.allowed).toBe(true);
      // Tea line must resolve to overridden rate ₹95.00 (9500 paise), NOT tampered ₹1.00
      expect(res.lines[0].effectiveRatePaise).toBe(9500);
      expect(res.lines[0].lineSubtotalPaise).toBe(19000); // 2 * 9500

      // Oil line must resolve to base rate ₹150.00 (15000 paise)
      expect(res.lines[1].effectiveRatePaise).toBe(15000);
      expect(res.lines[1].lineSubtotalPaise).toBe(15000);

      expect(res.subtotalPaise).toBe(34000);
    });

    it('strictly omits GST when enableGst is false (totals equal sum of lines with 0 tax)', () => {
      const items: PureOrderItemInput[] = [
        { tenantProductId: 'prod_tea_01', orderQty: 1 },
      ];

      const res = calculatePureOrderPricing(mockTenant, mockShop, productsMap, items);

      expect(res.allowed).toBe(true);
      expect(res.gstPaise).toBe(0);
      expect(res.totalPaise).toBe(res.subtotalPaise);
      expect(res.lines[0].gstPaise).toBe(0);
      expect(res.lines[0].lineTotalPaise).toBe(res.lines[0].lineSubtotalPaise);
    });

    it('applies GST only when enableGst is explicitly true', () => {
      const gstTenant: PureTenant = { ...mockTenant, enableGst: true };
      const items: PureOrderItemInput[] = [
        { tenantProductId: 'prod_tea_01', orderQty: 1 }, // 9500 paise * 18% = 1710 paise GST
      ];

      const res = calculatePureOrderPricing(gstTenant, mockShop, productsMap, items);

      expect(res.allowed).toBe(true);
      expect(res.gstPaise).toBe(1710);
      expect(res.totalPaise).toBe(9500 + 1710);
    });

    it('blocks order when daily maximum purchase quota in base units is exceeded across unit chains', () => {
      // 1 case = 24 packets; ordered 1 case (24 packets) against daily limit of 20 packets
      const items: PureOrderItemInput[] = [
        {
          tenantProductId: 'prod_tea_01',
          orderQty: 1,
          orderUnitName: 'Case',
          conversionFactor: 24, // 24 packets in 1 case
        },
      ];

      const res = calculatePureOrderPricing(mockTenant, mockShop, productsMap, items);

      expect(res.allowed).toBe(false);
      expect(res.blockReason).toContain('exceeds daily quota limit of 20 packets');
    });

    it('evaluates cut-off time using the tenant timezone (Asia/Kolkata), even when server is in UTC', () => {
      // 13:00 UTC = 18:30 IST. Cutoff is 18:00 IST.
      const simulatedUtcDate = new Date('2026-11-23T13:00:00.000Z');

      const items: PureOrderItemInput[] = [
        { tenantProductId: 'prod_oil_01', orderQty: 1 },
      ];

      const res = calculatePureOrderPricing(mockTenant, mockShop, productsMap, items, {
        checkStock: true,
        checkCutoff: true,
        referenceDate: simulatedUtcDate,
      });

      expect(res.cutoffInfo.isPastCutoff).toBe(true);
      expect(res.cutoffInfo.localCurrentTime).toBe('18:30');
      expect(res.cutoffInfo.timezone).toBe('Asia/Kolkata');
      expect(res.warnings.some((w) => w.includes('cutoff time of 18:00'))).toBe(true);
    });

    it('strictly blocks order placement when shop is on credit hold', () => {
      const holdShop: PureShop = { ...mockShop, creditHold: true };
      const items: PureOrderItemInput[] = [
        { tenantProductId: 'prod_tea_01', orderQty: 1 },
      ];

      const res = calculatePureOrderPricing(mockTenant, holdShop, productsMap, items);

      expect(res.allowed).toBe(false);
      expect(res.blockReason).toContain('Credit Hold');
    });
  });

  // ----------------------------------------------------
  // 3. PIN Security, Strength, and Sensitive Action Windows
  // ----------------------------------------------------
  describe('PIN Security, Lockout Rules & Sensitive Action Window', () => {
    it('rejects trivial, repeating, and sequential PINs', () => {
      expect(validatePinStrength('111111').valid).toBe(false);
      expect(validatePinStrength('123456').valid).toBe(false);
      expect(validatePinStrength('654321').valid).toBe(false);
      expect(validatePinStrength('123').valid).toBe(false); // too short
      expect(validatePinStrength('abcdef').valid).toBe(false); // non-numeric
    });

    it('accepts non-sequential, strong 6-digit PINs', () => {
      expect(validatePinStrength('849201').valid).toBe(true);
      expect(validatePinStrength('391748').valid).toBe(true);
    });

    it('hashes tokens using SHA-256 with consistent digest', () => {
      const token = 'sample-random-session-token-123456';
      const hash1 = hashToken(token);
      const hash2 = crypto.createHash('sha256').update(token).digest('hex');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('permits sensitive actions within 5 minutes of PIN unlock and restricts thereafter', () => {
      const now = Date.now();

      // Case A: Just unlocked (15 minutes remaining on unlock) -> Elapsed = 0 mins -> ALLOWED
      const freshUnlock = {
        unlocked_until: new Date(now + IDLE_UNLOCK_DURATION_MS),
      };
      expect(isAuthorizedForSensitiveAction(freshUnlock)).toBe(true);

      // Case B: 12 minutes remaining (3 minutes elapsed since unlock) -> ALLOWED (<= 5 mins)
      const threeMinUnlock = {
        unlocked_until: new Date(now + 12 * 60 * 1000),
      };
      expect(isAuthorizedForSensitiveAction(threeMinUnlock)).toBe(true);

      // Case C: 8 minutes remaining (7 minutes elapsed since unlock) -> RESTRICTED (> 5 mins)
      const sevenMinUnlock = {
        unlocked_until: new Date(now + 8 * 60 * 1000),
      };
      expect(isAuthorizedForSensitiveAction(sevenMinUnlock)).toBe(false);

      // Case D: Expired unlock -> RESTRICTED
      const expiredUnlock = {
        unlocked_until: new Date(now - 1000),
      };
      expect(isAuthorizedForSensitiveAction(expiredUnlock)).toBe(false);

      // Case E: Locked session (null) -> RESTRICTED
      expect(isAuthorizedForSensitiveAction({ unlocked_until: null })).toBe(false);
    });

    it('blends server-side pepper secret with PIN to prevent offline dictionary attacks', () => {
      const pin = '482910';
      const peppered = pepperPin(pin);
      
      // Peppered value must be a 64-hex-character HMAC digest
      expect(peppered).toHaveLength(64);
      expect(peppered).not.toBe(pin);
      
      // Verification: same PIN produces same peppered digest under same server pepper
      expect(pepperPin(pin)).toBe(peppered);
      
      // Different PIN produces completely different digest
      expect(pepperPin('482911')).not.toBe(peppered);
    });

    it('strictly blocks PENDING tenants from creating wholesale orders (HTTP 403)', async () => {
      const pendingTenantId = 'tenant_test_pending_guard_01';
      
      // Ensure test tenant exists in PENDING status
      await prisma.tenant.upsert({
        where: { id: pendingTenantId },
        update: { status: TenantStatus.PENDING },
        create: {
          id: pendingTenantId,
          name: 'Pending Wholesale Corp',
          owner_name: 'Pending Owner',
          status: TenantStatus.PENDING,
          timezone: 'Asia/Kolkata',
          order_cutoff_time: '18:00',
        },
      });

      const req = new NextRequest('http://localhost:3000/api/distributor/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: pendingTenantId,
          shopId: 'shop_mock_01',
          items: [{ tenantProductId: 'prod_mock_01', orderQty: 1 }],
        }),
      });

      const res = await ordersPostHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/pending platform approval/i);

      // Clean up
      await prisma.tenant.delete({ where: { id: pendingTenantId } }).catch(() => {});
    });

    it('strictly blocks sensitive actions like CSV export without valid PIN session (HTTP 401/403)', async () => {
      // Unauthenticated request without session cookie
      const req = new NextRequest('http://localhost:3000/api/distributor/export-csv?table=orders');
      const res = await exportCsvGetHandler(req);
      
      // Route guard immediately stops unauthorized request
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/unauthorized/i);
    });
  });
});
