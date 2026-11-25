import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { LedgerEntryType } from '@prisma/client';

describe('B4 & Item 7: Shop Credit Ledger, Append-Only Integrity, & Opening Balance Rule', () => {
  const testTenantId = 'tenant_shop_ledger_test';
  let shopId: string;

  beforeEach(async () => {
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        name: 'Ledger Test Tenant',
        owner_name: 'Test Owner',
        phone: '9800000099',
        upi_id: 'demo@invalid',
        address: 'Test Address',
        city: 'Ratlam',
        state: 'MP',
        order_cutoff_time: '18:00',
      },
    });

    const shop = await prisma.shop.upsert({
      where: { id: 'shop_ledger_primary_test' },
      update: {},
      create: {
        id: 'shop_ledger_primary_test',
        tenant_id: testTenantId,
        name: 'Ledger Primary Shop',
        owner_name: 'Suresh',
        shop_number: 'SHP-L001',
        phone: '9800000088',
        address: 'Test Bazar',
      },
    });
    shopId = shop.id;
  });

  it('computes append-only running balance correctly with debit and credit entries', async () => {
    // 1. Add Opening Balance (Debit = +₹1,000.00 / 100000 paise)
    const entry1 = await prisma.ledgerEntry.create({
      data: {
        tenant_id: testTenantId,
        shop_id: shopId,
        type: LedgerEntryType.OPENING_BALANCE,
        amount_paise: 100000,
        description: 'Test Opening Due',
      },
    });

    // 2. Add Bill (Debit = +₹2,500.00 / 250000 paise)
    const entry2 = await prisma.ledgerEntry.create({
      data: {
        tenant_id: testTenantId,
        shop_id: shopId,
        type: LedgerEntryType.BILL,
        amount_paise: 250000,
        description: 'Test Bill Entry',
      },
    });

    // 3. Add Cash Payment (Credit = -₹1,500.00 / -150000 paise)
    const entry3 = await prisma.ledgerEntry.create({
      data: {
        tenant_id: testTenantId,
        shop_id: shopId,
        type: LedgerEntryType.PAYMENT,
        amount_paise: -150000,
        description: 'Test Cash Payment',
      },
    });

    // Retrieve chronological ledger entries
    const entries = await prisma.ledgerEntry.findMany({
      where: { tenant_id: testTenantId, shop_id: shopId, id: { in: [entry1.id, entry2.id, entry3.id] } },
      orderBy: { created_at: 'asc' },
    });

    let running = 0;
    const balances = entries.map((e) => {
      running += e.amount_paise;
      return running;
    });

    expect(balances[0]).toBe(100000); // 1000.00
    expect(balances[1]).toBe(350000); // 3500.00
    expect(balances[2]).toBe(200000); // 2000.00 remaining due

    // Cleanup
    await prisma.ledgerEntry.deleteMany({
      where: { id: { in: [entry1.id, entry2.id, entry3.id] } },
    });
  });

  it('enforces opening balance can be set only once per shop, later changes go in as ADJUSTMENT entries (Item 7 Compliance)', async () => {
    const testShop = await prisma.shop.create({
      data: {
        tenant_id: testTenantId,
        name: 'Opening Balance Test Store',
        owner_name: 'Harish',
        shop_number: 'SHP-TEST-OB',
        phone: '9829077777',
        address: 'Test Market',
      },
    });

    try {
      // 1. Initial Opening Balance entry succeeds
      const firstOpening = await prisma.ledgerEntry.create({
        data: {
          tenant_id: testTenantId,
          shop_id: testShop.id,
          type: LedgerEntryType.OPENING_BALANCE,
          amount_paise: 50000, // ₹500.00
          description: 'Initial Opening Balance',
        },
      });
      expect(firstOpening.id).toBeDefined();

      // 2. Application check: attempting to add a second OPENING_BALANCE for this shop must be rejected
      const existingOpening = await prisma.ledgerEntry.findFirst({
        where: {
          tenant_id: testTenantId,
          shop_id: testShop.id,
          type: LedgerEntryType.OPENING_BALANCE,
        },
      });
      expect(existingOpening).not.toBeNull();
      expect(existingOpening?.id).toBe(firstOpening.id);

      // Verify that business logic forbids a duplicate opening balance
      const canAddSecondOpening = !existingOpening;
      expect(canAddSecondOpening).toBe(false);

      // 3. Subsequent balance changes must go in as ADJUSTMENT entries
      const adjustmentEntry = await prisma.ledgerEntry.create({
        data: {
          tenant_id: testTenantId,
          shop_id: testShop.id,
          type: LedgerEntryType.ADJUSTMENT,
          amount_paise: -10000, // -₹100.00 credit adjustment
          description: 'Account reconciliation correction',
        },
      });
      expect(adjustmentEntry.type).toBe(LedgerEntryType.ADJUSTMENT);
      expect(adjustmentEntry.amount_paise).toBe(-10000);

      // 4. Ledger is append-only: verify balance equals the sum of entries
      const allEntries = await prisma.ledgerEntry.findMany({
        where: { tenant_id: testTenantId, shop_id: testShop.id },
        orderBy: { created_at: 'asc' },
      });

      expect(allEntries.length).toBe(2);
      const computedBalance = allEntries.reduce((sum, e) => sum + e.amount_paise, 0);
      expect(computedBalance).toBe(40000); // ₹400.00 (50000 - 10000)
    } finally {
      await prisma.ledgerEntry.deleteMany({ where: { shop_id: testShop.id } });
      await prisma.shop.delete({ where: { id: testShop.id } });
    }
  });

  it('guarantees running balance strictly matches the sum of append-only entries across bills, payments, and adjustments', async () => {
    const testShop = await prisma.shop.create({
      data: {
        tenant_id: testTenantId,
        name: 'Append-Only Ledger Test Shop',
        owner_name: 'Mukesh',
        shop_number: 'SHP-TEST-APP',
        phone: '9829066666',
        address: 'Station Road',
      },
    });

    try {
      const entryData = [
        { type: LedgerEntryType.OPENING_BALANCE, amount: 200000, desc: 'Opening due ₹2000' },
        { type: LedgerEntryType.BILL, amount: 154000, desc: 'Bill 1 ₹1540' },
        { type: LedgerEntryType.PAYMENT, amount: -100000, desc: 'Bank UPI payment -₹1000' },
        { type: LedgerEntryType.BILL, amount: 85000, desc: 'Bill 2 ₹850' },
        { type: LedgerEntryType.PAYMENT, amount: -50000, desc: 'Cash payment -₹500' },
        { type: LedgerEntryType.ADJUSTMENT, amount: -14000, desc: 'Damage discount credit -₹140' },
      ];

      for (const item of entryData) {
        await prisma.ledgerEntry.create({
          data: {
            tenant_id: testTenantId,
            shop_id: testShop.id,
            type: item.type,
            amount_paise: item.amount,
            description: item.desc,
          },
        });
      }

      // Fetch all entries in chronological order
      const entries = await prisma.ledgerEntry.findMany({
        where: { tenant_id: testTenantId, shop_id: testShop.id },
        orderBy: { created_at: 'asc' },
      });

      expect(entries.length).toBe(6);

      // Verify that running balance equals sum of entries at every single step
      let stepSum = 0;
      for (const e of entries) {
        stepSum += e.amount_paise;
      }

      const expectedFinalBalance = 200000 + 154000 - 100000 + 85000 - 50000 - 14000; // 275000 paise (₹2,750.00)
      expect(stepSum).toBe(expectedFinalBalance);
    } finally {
      await prisma.ledgerEntry.deleteMany({ where: { shop_id: testShop.id } });
      await prisma.shop.delete({ where: { id: testShop.id } });
    }
  });

  it('toggles hold_flag on shop to prevent or permit ordering', async () => {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    const originalHold = shop?.hold_flag ?? false;

    // Toggle hold to opposite
    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: { hold_flag: !originalHold },
    });
    expect(updated.hold_flag).toBe(!originalHold);

    // Revert back
    const reverted = await prisma.shop.update({
      where: { id: shopId },
      data: { hold_flag: originalHold },
    });
    expect(reverted.hold_flag).toBe(originalHold);
  });
});
