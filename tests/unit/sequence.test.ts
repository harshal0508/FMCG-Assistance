import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { getNextSequenceNumber } from '@/lib/services/sequence';
import { getKolkataZonedTime } from '@/lib/services/route-cutoff';

describe('Sequence Service - Race-Safe Daily Numbering & Simple Shop Codes (F7 Compliance)', () => {
  const testTenantId = 'test_tenant_seq_1';

  beforeEach(async () => {
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'Test Tenant Sequences',
        owner_name: 'Tester',
        phone: '9999900000',
        upi_id: 'test@upi',
        address: 'Test Address',
        city: 'Ratlam',
        state: 'Madhya Pradesh',
      },
    });

    await prisma.tenantSequence.deleteMany({
      where: { tenant_id: testTenantId },
    });
  });

  it('generates exact format ORD-YYYYMMDD-NNNN and BILL-YYYYMMDD-NNNN with daily roll-over', async () => {
    const num1 = await getNextSequenceNumber(testTenantId, 'ORDER');
    const num2 = await getNextSequenceNumber(testTenantId, 'ORDER');
    const num3 = await getNextSequenceNumber(testTenantId, 'ORDER');

    const { dateString } = getKolkataZonedTime();

    expect(num1).toBe(`ORD-${dateString}-0001`);
    expect(num2).toBe(`ORD-${dateString}-0002`);
    expect(num3).toBe(`ORD-${dateString}-0003`);

    // Verify BILL- equivalent
    const bill1 = await getNextSequenceNumber(testTenantId, 'BILL');
    expect(bill1).toBe(`BILL-${dateString}-0001`);
  });

  it('generates simple progressive per-tenant counter for shops: SHP-0001 (F7 requirement)', async () => {
    const shp1 = await getNextSequenceNumber(testTenantId, 'SHOP');
    const shp2 = await getNextSequenceNumber(testTenantId, 'SHOP');

    // F7: Shop codes use a simple per-tenant counter (SHP-0001), not a daily resetting sequence
    expect(shp1).toBe('SHP-0001');
    expect(shp2).toBe('SHP-0002');
  });

  it('correctly shifts date and resets counter to 0001 when server clock is UTC crossing IST midnight', async () => {
    // 1. UTC: 2026-11-24 18:25:00Z -> IST is 2026-11-24 23:55:00 (Day 20261124)
    const lateUtcDate = new Date('2026-11-24T18:25:00Z');
    const numDay1 = await getNextSequenceNumber(testTenantId, 'ORDER', { refDate: lateUtcDate });
    expect(numDay1).toBe('ORD-20261124-0001');

    const numDay1Second = await getNextSequenceNumber(testTenantId, 'ORDER', { refDate: lateUtcDate });
    expect(numDay1Second).toBe('ORD-20261124-0002');

    // 2. UTC: 2026-11-24 18:35:00Z -> IST is 2026-11-25 00:05:00 (Next Day 20261125!)
    const nextDayUtcDate = new Date('2026-11-24T18:35:00Z');
    const numDay2First = await getNextSequenceNumber(testTenantId, 'ORDER', { refDate: nextDayUtcDate });

    // Must advance to 20261125 AND reset counter to 0001!
    expect(numDay2First).toBe('ORD-20261125-0001');

    // Second order on new day must be 0002
    const numDay2Second = await getNextSequenceNumber(testTenantId, 'ORDER', { refDate: nextDayUtcDate });
    expect(numDay2Second).toBe('ORD-20261125-0002');
  });

  it('handles concurrent sequence generation safely without duplicate numbers', async () => {
    const promises = Array.from({ length: 10 }, () =>
      getNextSequenceNumber(testTenantId, 'BILL')
    );
    const results = await Promise.all(promises);

    const uniqueNumbers = new Set(results);
    expect(uniqueNumbers.size).toBe(10);
  });
});
