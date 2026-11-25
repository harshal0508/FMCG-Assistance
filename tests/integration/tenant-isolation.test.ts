import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { createTenantClient, TenantIsolationError } from '@/lib/db/tenant-client';

describe('Tenant Isolation Verification - Cross-Tenant Access Prevention', () => {
  const tenantA_id = 'tenant_alpha_001';
  const tenantB_id = 'tenant_beta_002';

  let clientA: ReturnType<typeof createTenantClient>;
  let clientB: ReturnType<typeof createTenantClient>;

  let categoryA_id: string;
  let masterProductA_id: string;
  let tenantProductA_id: string;
  let shopA_id: string;
  let orderA_id: string;
  let orderLineA_id: string;
  let billA_id: string;
  let paymentA_id: string;
  let schemeA_id: string;

  beforeAll(async () => {
    // Setup Tenant Alpha
    await prisma.tenant.upsert({
      where: { id: tenantA_id },
      update: {},
      create: {
        id: tenantA_id,
        name: 'Distributor Alpha',
        owner_name: 'Alpha Owner',
        phone: '9888800001',
        upi_id: 'alpha@upi',
        address: 'Alpha Complex',
        city: 'Jaipur',
        state: 'Rajasthan',
      },
    });

    // Setup Tenant Beta
    await prisma.tenant.upsert({
      where: { id: tenantB_id },
      update: {},
      create: {
        id: tenantB_id,
        name: 'Distributor Beta',
        owner_name: 'Beta Owner',
        phone: '9888800002',
        upi_id: 'beta@upi',
        address: 'Beta Hub',
        city: 'Kota',
        state: 'Rajasthan',
      },
    });

    clientA = createTenantClient(tenantA_id);
    clientB = createTenantClient(tenantB_id);

    // Create Tenant A Category
    const catA = await clientA.categories.create({
      data: {
        name: 'Alpha Category',
        hindi_name: 'अल्फा श्रेणी',
        icon: 'package',
      },
    });
    categoryA_id = catA.id;

    // Create Master Product
    const mp = await prisma.masterProduct.create({
      data: {
        category_id: categoryA_id,
        name: 'Alpha Wafers 50g',
        mrp_paise: 2000,
        image_url: '/placeholder.png',
        base_unit: 'packet',
        default_order_unit: 'bundle',
        unit_chain_json: JSON.stringify([{ name: 'packet', factorToBase: 1 }]),
      },
    });
    masterProductA_id = mp.id;

    // Create Tenant A Product
    const prodA = await clientA.products.create({
      data: {
        master_product_id: masterProductA_id,
        rate_paise: 1650,
        stock_qty: 1200,
      },
    });
    tenantProductA_id = prodA.id;

    // Create Tenant A Shop
    const shopA = await clientA.shops.create({
      data: {
        shop_number: 'SHP-A01',
        name: 'Alpha Kirana',
        owner_name: 'Ramesh',
        phone: '9777700001',
        address: 'Market Alpha',
      },
    });
    shopA_id = shopA.id;

    // Create Tenant A Order & Line
    const ordA = await clientA.orders.create({
      data: {
        shop_id: shopA_id,
        order_number: 'ORD-A001',
        subtotal_paise: 16500,
        total_paise: 16500,
      },
    });
    orderA_id = ordA.id;

    const lineA = await clientA.orderLines.create({
      data: {
        order_id: orderA_id,
        tenant_product_id: tenantProductA_id,
        quantity_base: 10,
        order_unit_name: 'bundle',
        display_quantity: 10,
        price_paise_snapshot: 1650,
      },
    });
    orderLineA_id = lineA.id;

    // Create Tenant A Bill
    const billA = await clientA.bills.create({
      data: {
        shop_id: shopA_id,
        order_id: orderA_id,
        bill_number: 'BILL-A001',
        total_paise: 16500,
        upi_reference: 'tr_alpha_001',
        upi_string: 'upi://pay?pa=alpha@upi&am=165.00',
      },
    });
    billA_id = billA.id;

    // Create Tenant A Payment
    const pmtA = await clientA.payments.create({
      data: {
        shop_id: shopA_id,
        amount_paise: 16500,
        bank_utr: 'UTR_ALPHA_001',
      },
    });
    paymentA_id = pmtA.id;

    // Create Tenant A Ledger Entry
    await clientA.ledger.create({
      data: {
        shop_id: shopA_id,
        type: 'BILL',
        amount_paise: 16500,
        description: 'Bill #BILL-A001',
      },
    });

    // Create Tenant A Scheme
    const schA = await clientA.schemes.create({
      data: {
        name: 'Alpha Mega Scheme',
        type: 'FREE_GOODS',
        rule_json: '{}',
        start_date: new Date(),
        end_date: new Date(Date.now() + 864000000),
      },
    });
    schemeA_id = schA.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.ledgerEntry.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.payment.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.bill.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.orderLine.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.order.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.scheme.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.shop.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.tenantProduct.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.masterProduct.deleteMany({ where: { id: masterProductA_id } });
    await prisma.category.deleteMany({ where: { tenant_id: { in: [tenantA_id, tenantB_id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA_id, tenantB_id] } } });
  });

  describe('Read Isolation (Tenant B cannot read Tenant A records)', () => {
    it('prevents reading categories of another tenant', async () => {
      const items = await clientB.categories.findMany({ where: { id: categoryA_id } });
      expect(items.length).toBe(0);
    });

    it('prevents reading products of another tenant', async () => {
      const items = await clientB.products.findMany({ where: { id: tenantProductA_id } });
      expect(items.length).toBe(0);
    });

    it('prevents reading shops of another tenant', async () => {
      const items = await clientB.shops.findMany({ where: { id: shopA_id } });
      expect(items.length).toBe(0);
    });

    it('prevents reading orders and order lines of another tenant', async () => {
      const orders = await clientB.orders.findMany({ where: { id: orderA_id } });
      expect(orders.length).toBe(0);

      const lines = await clientB.orderLines.findMany({ where: { id: orderLineA_id } });
      expect(lines.length).toBe(0);
    });

    it('prevents reading bills of another tenant', async () => {
      const bills = await clientB.bills.findMany({ where: { id: billA_id } });
      expect(bills.length).toBe(0);
    });

    it('prevents reading payments of another tenant', async () => {
      const payments = await clientB.payments.findMany({ where: { id: paymentA_id } });
      expect(payments.length).toBe(0);
    });

    it('prevents reading schemes of another tenant', async () => {
      const schemes = await clientB.schemes.findMany({ where: { id: schemeA_id } });
      expect(schemes.length).toBe(0);
    });

    it('returns zero balance when computing ledger for foreign shop', async () => {
      const balance = await clientB.ledger.calculateBalance(shopA_id);
      expect(balance).toBe(0);
    });
  });

  describe('Mutation Isolation (Tenant B cannot update or delete Tenant A records)', () => {
    it('throws TenantIsolationError when attempting to update another tenant category', async () => {
      await expect(
        clientB.categories.update({
          where: { id: categoryA_id },
          data: { name: 'Hacked Category' },
        })
      ).rejects.toThrow(TenantIsolationError);
    });

    it('throws TenantIsolationError when attempting to delete another tenant category', async () => {
      await expect(
        clientB.categories.delete({
          where: { id: categoryA_id },
        })
      ).rejects.toThrow(TenantIsolationError);
    });

    it('throws TenantIsolationError when attempting to update another tenant shop', async () => {
      await expect(
        clientB.shops.update({
          where: { id: shopA_id },
          data: { name: 'Hacked Shop' },
        })
      ).rejects.toThrow(TenantIsolationError);
    });

    it('throws TenantIsolationError when attempting to delete another tenant shop', async () => {
      await expect(
        clientB.shops.delete({
          where: { id: shopA_id },
        })
      ).rejects.toThrow(TenantIsolationError);
    });

    it('throws TenantIsolationError when attempting to update another tenant product', async () => {
      await expect(
        clientB.products.update({
          where: { id: tenantProductA_id },
          data: { rate_paise: 100 },
        })
      ).rejects.toThrow(TenantIsolationError);
    });
  });
});
