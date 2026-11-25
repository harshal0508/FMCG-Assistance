import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { MatchStatus, PaymentMethod, LedgerEntryType } from '@prisma/client';

describe('B2 & B3: Payments and SMS Reconciliation API', () => {
  let tenantId: string;
  let shopId: string;
  let billId: string;

  beforeEach(async () => {
    // Locate demo or test tenant
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: {
        shops: {
          include: { bills: true },
        },
      },
    });

    if (!tenant) throw new Error('No tenant found for test');
    tenantId = tenant.id;

    // Pick first shop and bill or create a quick test bill
    const shop = tenant.shops[0];
    shopId = shop.id;

    if (shop.bills.length > 0) {
      billId = shop.bills[0].id;
    } else {
      // Create a test order and bill
      const order = await prisma.order.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          order_number: `ORD-TEST-${Date.now()}`,
          subtotal_paise: 250000,
          total_paise: 250000,
          status: 'CONFIRMED',
          source: 'RETAILER_APP',
        },
      });

      const bill = await prisma.bill.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          order_id: order.id,
          bill_number: `BILL-TEST-${Date.now()}`,
          total_paise: 250000,
          upi_reference: `REF-TEST-${Date.now()}`,
          upi_string: 'upi://pay?pa=test@upi',
        },
      });
      billId = bill.id;
    }
  });

  it('rejects duplicate bank UTR under the same tenant', async () => {
    const testUtr = `TESTUTR${Date.now()}`;

    // Create first payment with testUtr
    const p1 = await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        amount_paise: 50000,
        bank_utr: testUtr,
        method: PaymentMethod.UPI,
        match_status: MatchStatus.MATCHED,
      },
    });

    expect(p1.id).toBeDefined();

    // Attempting to create second payment with duplicate UTR must fail with unique constraint
    await expect(
      prisma.payment.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          amount_paise: 50000,
          bank_utr: testUtr,
          method: PaymentMethod.UPI,
          match_status: MatchStatus.MATCHED,
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.payment.delete({ where: { id: p1.id } });
  });

  it('records a matched payment with bill allocation and negative ledger entry', async () => {
    const testUtr = `ALLOC${Date.now()}`;
    const amountPaise = 150000;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          amount_paise: amountPaise,
          bank_utr: testUtr,
          method: PaymentMethod.UPI,
          match_status: MatchStatus.MATCHED,
        },
      });

      await tx.paymentAllocation.create({
        data: {
          tenant_id: tenantId,
          payment_id: p.id,
          bill_id: billId,
          amount_paise: amountPaise,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.PAYMENT,
          amount_paise: -amountPaise,
          reference_id: p.id,
          description: `Payment allocated to bill`,
        },
      });

      return p;
    });

    expect(payment.id).toBeDefined();

    // Verify allocation exists
    const allocations = await prisma.paymentAllocation.findMany({
      where: { payment_id: payment.id },
    });
    expect(allocations.length).toBe(1);
    expect(allocations[0].amount_paise).toBe(amountPaise);

    // Verify ledger entry is negative (credit)
    const ledger = await prisma.ledgerEntry.findFirst({
      where: { reference_id: payment.id, type: LedgerEntryType.PAYMENT },
    });
    expect(ledger?.amount_paise).toBe(-amountPaise);

    // Cleanup
    await prisma.paymentAllocation.deleteMany({ where: { payment_id: payment.id } });
    await prisma.ledgerEntry.deleteMany({ where: { reference_id: payment.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
  });

  it('handles short payment with keep Rs X as due ledger entry', async () => {
    const testUtr = `SHORT${Date.now()}`;
    const amountPaise = 90000;
    const shortDuePaise = 10000;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          amount_paise: amountPaise,
          bank_utr: testUtr,
          method: PaymentMethod.UPI,
          match_status: MatchStatus.MATCHED,
        },
      });

      // Credit entry
      await tx.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.PAYMENT,
          amount_paise: -amountPaise,
          reference_id: p.id,
          description: `Short payment received`,
        },
      });

      // Short amount kept as due (ROUNDING_DUE)
      await tx.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.ROUNDING_DUE,
          amount_paise: shortDuePaise,
          reference_id: p.id,
          description: `Short payment kept as customer due`,
        },
      });

      return p;
    });

    const dues = await prisma.ledgerEntry.findFirst({
      where: { reference_id: payment.id, type: LedgerEntryType.ROUNDING_DUE },
    });
    expect(dues?.amount_paise).toBe(shortDuePaise);

    // Cleanup
    await prisma.ledgerEntry.deleteMany({ where: { reference_id: payment.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
  });

  it('records unmatched payment and resolves it later', async () => {
    const testUtr = `UNMATCH${Date.now()}`;
    const amountPaise = 75000;

    // 1. Create unmatched payment
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          shop_id: null,
          amount_paise: amountPaise,
          bank_utr: testUtr,
          method: PaymentMethod.UPI,
          match_status: MatchStatus.UNMATCHED,
        },
      });

      await tx.unmatchedPayment.create({
        data: {
          tenant_id: tenantId,
          payment_id: p.id,
          notes: 'Unmatched SMS notification',
        },
      });

      return p;
    });

    expect(payment.shop_id).toBeNull();
    expect(payment.match_status).toBe(MatchStatus.UNMATCHED);

    // 2. Resolve unmatched payment to a shop
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { shop_id: shopId, match_status: MatchStatus.MATCHED },
      });

      await tx.unmatchedPayment.update({
        where: { payment_id: payment.id },
        data: { resolved_at: new Date() },
      });
    });

    const updated = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { unmatched: true },
    });

    expect(updated?.shop_id).toBe(shopId);
    expect(updated?.match_status).toBe(MatchStatus.MATCHED);
    expect(updated?.unmatched?.resolved_at).not.toBeNull();

    // Cleanup
    await prisma.unmatchedPayment.deleteMany({ where: { payment_id: payment.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
  });
});
