import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Substitution Workflow (Part 2.C)', () => {
  let tenantId: string;
  let shopId: string;
  let orderId: string;
  let orderLineId: string;
  let productAId: string;
  let productBId: string;
  let brandId: string;

  beforeEach(async () => {
    // Find or create a test tenant with brand, products, and shops
    let tenant: any = await prisma.tenant.findFirst({
      where: {
        brands: { some: {} },
        shops: { some: {} },
      },
      include: {
        brands: { include: { tenant_products: true } },
        shops: true,
      },
    });

    if (!tenant || tenant.brands.length === 0 || tenant.brands[0].tenant_products.length < 2 || tenant.shops.length === 0) {
      const newTenant = await prisma.tenant.create({
        data: {
          name: 'Sub Test Tenant',
          owner_name: 'Sub Owner',
          email: `sub-${Date.now()}@test.invalid`,
        },
      });
      const newBrand = await prisma.brand.create({
        data: {
          tenant_id: newTenant.id,
          name: `Sub Brand ${Date.now()}`,
        },
      });
      const prodA = await prisma.tenantProduct.create({
        data: {
          tenant_id: newTenant.id,
          brand_id: newBrand.id,
          rate_paise: 5000,
          name: 'Item A',
          stock_qty: 100,
        },
      });
      const prodB = await prisma.tenantProduct.create({
        data: {
          tenant_id: newTenant.id,
          brand_id: newBrand.id,
          rate_paise: 6000,
          name: 'Item B',
          stock_qty: 100,
        },
      });
      const newShop = await prisma.shop.create({
        data: {
          tenant_id: newTenant.id,
          name: 'Sub Test Shop',
          owner_name: 'Sub Shopkeeper',
          shop_number: `SHP-${Date.now()}`,
          phone: `9000${Math.floor(100000 + Math.random() * 900000)}`,
          address: 'Sub Market',
        },
      });
      tenant = {
        id: newTenant.id,
        shops: [newShop],
        brands: [{ id: newBrand.id, tenant_products: [prodA, prodB] }],
      };
    }

    tenantId = tenant.id;
    shopId = tenant.shops[0].id;
    brandId = tenant.brands[0].id;
    productAId = tenant.brands[0].tenant_products[0].id;
    productBId = tenant.brands[0].tenant_products[1].id;

    // 4. Create an order with line A
    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        order_number: `TEST-ORD-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 10000,
        total_paise: 10000,
        lines: {
          create: {
            tenant_id: tenantId,
            tenant_product_id: productAId,
            quantity_base: 2,
            display_quantity: 2,
            order_unit_name: 'pack',
            price_paise_snapshot: 5000,
          },
        },
      },
      include: {
        lines: true,
      },
    });

    orderId = order.id;
    orderLineId = order.lines[0].id;

    // Create corresponding bill
    await prisma.bill.create({
      data: {
        tenant: { connect: { id: tenantId } },
        shop: { connect: { id: shopId } },
        order: { connect: { id: orderId } },
        bill_number: `TEST-BILL-${Date.now()}`,
        upi_reference: `TEST-UPI-REF-${Date.now()}`,
        upi_string: 'upi://pay?pa=demo@invalid&am=100.00',
        total_paise: 10000,
      },
    });
  });

  it('proposes alternative substitution with pending state and optional mock call trigger', async () => {
    // 1. Create substitution proposal
    const sub = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        order_line_id: orderLineId,
        original_product_id: productAId,
        suggested_product_id: productBId,
        requested_qty_base: 2,
        shop_reply: 'PENDING',
      },
    });

    expect(sub.id).toBeDefined();
    expect(sub.shop_reply).toBe('PENDING');

    // 2. Verify mock call attempt creation
    const callAttempt = await prisma.callAttempt.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        trigger_reason: 'SUBSTITUTION_PROPOSAL',
        script: 'Test notification script',
        result: 'SIMULATED_SUCCESS',
        transcript: 'Simulated voice trigger',
      },
    });

    expect(callAttempt.id).toBeDefined();
    expect(callAttempt.trigger_reason).toBe('SUBSTITUTION_PROPOSAL');
  });

  it('handles substitution BEFORE billing (no bill exists): updates order line and total only', async () => {
    // 1. Create order without any bill
    const orderNoBill = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        order_number: `ORD-NOBILL-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 10000,
        total_paise: 10000,
        lines: {
          create: {
            tenant_id: tenantId,
            tenant_product_id: productAId,
            quantity_base: 2,
            display_quantity: 2,
            order_unit_name: 'pack',
            price_paise_snapshot: 5000,
          },
        },
      },
      include: { lines: true },
    });

    const sub = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: orderNoBill.id,
        order_line_id: orderNoBill.lines[0].id,
        original_product_id: productAId,
        suggested_product_id: productBId,
        requested_qty_base: 2,
        shop_reply: 'PENDING',
      },
    });

    // Accept substitution before billing
    const newRate = 6000;
    const newTotal = newRate * 2;

    await prisma.$transaction(async (tx) => {
      await tx.substitution.update({
        where: { id: sub.id },
        data: { shop_reply: 'ACCEPTED' },
      });
      await tx.orderLine.update({
        where: { id: orderNoBill.lines[0].id },
        data: {
          tenant_product_id: productBId,
          price_paise_snapshot: newRate,
        },
      });
      await tx.order.update({
        where: { id: orderNoBill.id },
        data: { total_paise: newTotal },
      });

      // Confirm no bill exists
      const existingBill = await tx.bill.findFirst({
        where: { order_id: orderNoBill.id },
      });
      expect(existingBill).toBeNull();
    });

    const finalOrder = await prisma.order.findUnique({ where: { id: orderNoBill.id } });
    expect(finalOrder?.total_paise).toBe(12000);
    const bills = await prisma.bill.findMany({ where: { order_id: orderNoBill.id } });
    expect(bills.length).toBe(0);
  });

  it('handles substitution AFTER billing when UNPAID: creates new bill version, preserves original bill, updates QR amount only on new version', async () => {
    // Original bill was created in beforeEach (10000 paise, v1)
    const originalBill = await prisma.bill.findFirst({
      where: { order_id: orderId },
      include: { allocations: true },
    });
    expect(originalBill).toBeDefined();
    expect(originalBill?.total_paise).toBe(10000);
    expect(originalBill?.version).toBe(1);

    const sub = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        order_line_id: orderLineId,
        original_product_id: productAId,
        suggested_product_id: productBId,
        requested_qty_base: 2,
        shop_reply: 'PENDING',
      },
    });

    const newRate = 6000;
    const newTotal = 12000;

    // Simulate substitution acceptance logic
    await prisma.$transaction(async (tx) => {
      await tx.substitution.update({
        where: { id: sub.id },
        data: { shop_reply: 'ACCEPTED' },
      });
      await tx.orderLine.update({
        where: { id: orderLineId },
        data: {
          tenant_product_id: productBId,
          price_paise_snapshot: newRate,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { total_paise: newTotal },
      });

      const existingBill = await tx.bill.findFirst({
        where: { order_id: orderId },
        include: { allocations: true },
        orderBy: { version: 'desc' },
      });

      expect(existingBill).toBeDefined();
      const paidAmount = existingBill!.allocations.reduce((sum, a) => sum + a.amount_paise, 0);
      expect(paidAmount).toBe(0); // UNPAID

      // Create new version v2, keep original untouched
      const newVersion = existingBill!.version + 1;
      const baseBillNumber = existingBill!.bill_number.replace(/-v\d+$/, '');
      const newBillNumber = `${baseBillNumber}-v${newVersion}`;
      const newUpiRef = `tr_test_${Date.now()}_v${newVersion}`;
      const newUpiString = `upi://pay?pa=demo@invalid&pn=Demo%20Traders&am=${(newTotal / 100).toFixed(2)}&cu=INR&tn=Bill%20${newBillNumber}&tr=${newUpiRef}`;

      await tx.billEvent.create({
        data: {
          tenant_id: tenantId,
          bill_id: existingBill!.id,
          event_type: 'CANCELLED',
          metadata_json: JSON.stringify({ reason: 'SUBSTITUTION_VERSIONED', superseded_by_version: newVersion }),
        },
      });

      await tx.bill.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          order_id: orderId,
          bill_number: newBillNumber,
          version: newVersion,
          total_paise: newTotal,
          upi_reference: newUpiRef,
          upi_string: newUpiString,
        },
      });
    });

    // Verify all bills for this order
    const allBills = await prisma.bill.findMany({
      where: { order_id: orderId },
      orderBy: { version: 'asc' },
    });

    expect(allBills.length).toBe(2);
    // Original v1 bill remains unchanged at 10000 paise
    expect(allBills[0].version).toBe(1);
    expect(allBills[0].total_paise).toBe(10000);
    expect(allBills[0].upi_string).toContain('am=100.00');

    // New v2 bill has updated total 12000 paise and new QR string
    expect(allBills[1].version).toBe(2);
    expect(allBills[1].total_paise).toBe(12000);
    expect(allBills[1].upi_string).toContain('am=120.00');
  });

  it('handles substitution AFTER PAYMENT: never alters paid bill, creates ledger adjustment', async () => {
    // 1. Create order with a bill that is already PAID
    const paidOrder = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        order_number: `ORD-PAID-${Date.now()}`,
        status: 'CONFIRMED',
        source: 'RETAILER_APP',
        subtotal_paise: 10000,
        total_paise: 10000,
        lines: {
          create: {
            tenant_id: tenantId,
            tenant_product_id: productAId,
            quantity_base: 2,
            display_quantity: 2,
            order_unit_name: 'pack',
            price_paise_snapshot: 5000,
          },
        },
      },
      include: { lines: true },
    });

    const paidBill = await prisma.bill.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        order_id: paidOrder.id,
        bill_number: `BILL-PAID-${Date.now()}`,
        version: 1,
        total_paise: 10000,
        upi_reference: `UPI-PAID-${Date.now()}`,
        upi_string: 'upi://pay?pa=demo@invalid&am=100.00',
      },
    });

    // Record payment & allocation
    const payment = await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopId,
        amount_paise: 10000,
        method: 'UPI',
        payer_name: 'Shop Owner',
        bank_utr: `UTR-${Date.now()}`,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        tenant_id: tenantId,
        payment_id: payment.id,
        bill_id: paidBill.id,
        amount_paise: 10000,
      },
    });

    // Create substitution
    const sub = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: paidOrder.id,
        order_line_id: paidOrder.lines[0].id,
        original_product_id: productAId,
        suggested_product_id: productBId,
        requested_qty_base: 2,
        shop_reply: 'PENDING',
      },
    });

    const newRate = 6000;
    const newTotal = 12000;
    const diffPaise = newTotal - paidBill.total_paise; // +2000 paise

    // Execute acceptance on paid order
    await prisma.$transaction(async (tx) => {
      await tx.substitution.update({
        where: { id: sub.id },
        data: { shop_reply: 'ACCEPTED' },
      });
      await tx.orderLine.update({
        where: { id: paidOrder.lines[0].id },
        data: {
          tenant_product_id: productBId,
          price_paise_snapshot: newRate,
        },
      });
      await tx.order.update({
        where: { id: paidOrder.id },
        data: { total_paise: newTotal },
      });

      const existingBill = await tx.bill.findFirst({
        where: { order_id: paidOrder.id },
        include: { allocations: true },
      });

      const paidAmount = existingBill!.allocations.reduce((sum, a) => sum + a.amount_paise, 0);
      expect(paidAmount).toBe(10000); // Fully paid!

      // Rule: NEVER alter a paid bill. Issue ledger adjustment.
      await tx.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: 'ADJUSTMENT',
          amount_paise: diffPaise,
          reference_id: existingBill!.id,
          description: `Ledger Debit Adjustment for Substitution on Order #${paidOrder.order_number}`,
        },
      });
    });

    // Check that paid bill total and QR string are strictly unchanged
    const billAfter = await prisma.bill.findUnique({ where: { id: paidBill.id } });
    expect(billAfter?.total_paise).toBe(10000); // STILL 10000, never altered!
    expect(billAfter?.upi_string).toBe('upi://pay?pa=demo@invalid&am=100.00');

    // Check that ledger entry was appended
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: { reference_id: paidBill.id, type: 'ADJUSTMENT' },
    });
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry?.amount_paise).toBe(2000);
  });
});
