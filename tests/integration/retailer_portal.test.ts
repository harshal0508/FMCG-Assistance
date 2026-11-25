import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { generateShopToken } from '@/lib/services/token';
import { POST as placeRetailerOrder, GET as getRetailerOrders } from '@/app/api/retailer/orders/route';
import { POST as handleSubstitution } from '@/app/api/retailer/substitutions/route';
import { calculateOrderPricing } from '@/lib/services/pricing';
import { NextRequest } from 'next/server';
import { SubstitutionStatus } from '@prisma/client';

describe('Retailer Portal Integration & Security Tests', () => {
  const tenantId = 'tenant_shree_shyam_alwar';
  let shopA: any;
  let shopB: any;
  let rawTokenA: string;
  let rawTokenB: string;
  let testProduct1: any;
  let testProduct2: any;

  beforeAll(async () => {
    // 1. Create 2 isolated test shops
    const tokenGenA = generateShopToken(30);
    rawTokenA = tokenGenA.rawToken;

    shopA = await prisma.shop.create({
      data: {
        tenant_id: tenantId,
        shop_number: 'SHP-TEST-RETAILER-A',
        name: 'Shop A Retailers',
        owner_name: 'Owner A',
        phone: '9888800001',
        address: 'Manek Chowk, Ratlam',
        tokens: {
          create: {
            tenant_id: tenantId,
            token_hash: tokenGenA.tokenHash,
            expires_at: tokenGenA.expiresAt,
          },
        },
      },
    });

    const tokenGenB = generateShopToken(30);
    rawTokenB = tokenGenB.rawToken;

    shopB = await prisma.shop.create({
      data: {
        tenant_id: tenantId,
        shop_number: 'SHP-TEST-RETAILER-B',
        name: 'Shop B Retailers',
        owner_name: 'Owner B',
        phone: '9888800002',
        address: 'Station Road, Ratlam',
        tokens: {
          create: {
            tenant_id: tenantId,
            token_hash: tokenGenB.tokenHash,
            expires_at: tokenGenB.expiresAt,
          },
        },
      },
    });

    // 2. Fetch 2 distinct in-stock products
    const prods = await prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId, in_stock_flag: true, stock_qty: { gt: 100 } },
      take: 2,
    });
    testProduct1 = prods[0];
    testProduct2 = prods[1];
  });

  afterAll(async () => {
    // Clean up test shops & their created records
    await prisma.shop.deleteMany({
      where: { id: { in: [shopA.id, shopB.id] } },
    });
  });

  // TEST 1: Token Scope Security
  it('enforces strict token scope: Shop A token cannot view or access Shop B data', async () => {
    const reqA = new NextRequest('http://localhost/api/retailer/orders', {
      headers: { 'x-shop-token': rawTokenA },
    });

    const resA = await getRetailerOrders(reqA);
    const dataA = await resA.json();

    expect(resA.status).toBe(200);
    expect(dataA.shop.id).toBe(shopA.id);
    expect(dataA.shop.name).toBe('Shop A Retailers');

    // Invalid token returns 401
    const reqInvalid = new NextRequest('http://localhost/api/retailer/orders', {
      headers: { 'x-shop-token': 'invalid_garbage_token_12345' },
    });
    const resInvalid = await getRetailerOrders(reqInvalid);
    expect(resInvalid.status).toBe(401);
  });

  // TEST 2: Server-side Pricing Recalculation & Tamper Rejection
  it('strictly rejects client-tampered prices and recomputes authoritative totals', async () => {
    const itemQty = 3;
    const authoritativeTotal = testProduct1.rate_paise * itemQty;
    const tamperedClientTotal = 100; // Client sends ₹1.00 instead of real price

    const req = new NextRequest('http://localhost/api/retailer/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-token': rawTokenA,
      },
      body: JSON.stringify({
        token: rawTokenA,
        items: [{ tenantProductId: testProduct1.id, displayQty: itemQty }],
        clientTotalPaise: tamperedClientTotal,
      }),
    });

    const res = await placeRetailerOrder(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Price tampering detected/i);
    expect(data.serverTotalPaise).toBe(authoritativeTotal);
  });

  // TEST 3: Order Cut-off Calculation in Asia/Kolkata
  it('calculates order cut-off using Asia/Kolkata timezone, flagging orders past cut-off', async () => {
    // Reference date set to 23:30 IST (well past 18:00 cut-off)
    const lateNightIST = new Date('2026-11-24T18:00:00.000Z'); // 23:30 in Asia/Kolkata (+5:30)

    const pricing = await calculateOrderPricing(
      tenantId,
      shopA.id,
      [{ tenantProductId: testProduct1.id, displayQty: 1 }],
      { checkStock: true, checkCutoff: true, referenceDate: lateNightIST }
    );

    expect(pricing.cutoffInfo.isPastCutoff).toBe(true);
    expect(pricing.cutoffInfo.timezone).toBe('Asia/Kolkata');
    expect(pricing.warnings.some((w) => w.includes('cutoff time'))).toBe(true);
  });

  // TEST 4: Successful Order Placement & Repeat Order Flow
  it('successfully places an order via retailer token and supports repeat order flow', async () => {
    const itemQty = 2;
    const req = new NextRequest('http://localhost/api/retailer/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-token': rawTokenA,
      },
      body: JSON.stringify({
        token: rawTokenA,
        items: [{ tenantProductId: testProduct1.id, displayQty: itemQty }],
      }),
    });

    const res = await placeRetailerOrder(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.order.orderNumber).toBeDefined();

    // Verify order was bound to Shop A
    const createdOrder = await prisma.order.findUnique({
      where: { id: data.order.id },
      include: { lines: true },
    });
    expect(createdOrder?.shop_id).toBe(shopA.id);
    expect(createdOrder?.lines.length).toBe(1);
    expect(createdOrder?.lines[0].display_quantity).toBe(itemQty);

    // Repeat Order Flow: Reordering the same lines for Shop A
    const repeatReq = new NextRequest('http://localhost/api/retailer/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-token': rawTokenA,
      },
      body: JSON.stringify({
        token: rawTokenA,
        items: createdOrder!.lines.map((l) => ({
          tenantProductId: l.tenant_product_id,
          displayQty: l.display_quantity + 1, // Retailer adjusted quantity +1
        })),
      }),
    });

    const repeatRes = await placeRetailerOrder(repeatReq);
    const repeatData = await repeatRes.json();

    expect(repeatRes.status).toBe(200);
    expect(repeatData.success).toBe(true);
    expect(repeatData.order.orderNumber).not.toBe(createdOrder?.order_number);
  });

  // TEST 5: Substitution Response Flow
  it('allows retailer to accept a substitution and rejects cross-shop substitution tampering', async () => {
    // Create an order for Shop A with an order line
    const orderA = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        shop_id: shopA.id,
        order_number: 'ORD-SUB-TEST-01',
        source: 'RETAILER_APP',
        status: 'RECEIVED',
        subtotal_paise: testProduct1.rate_paise,
        total_paise: testProduct1.rate_paise,
        lines: {
          create: {
            tenant_id: tenantId,
            tenant_product_id: testProduct1.id,
            quantity_base: 5,
            order_unit_name: 'pack',
            display_quantity: 5,
            price_paise_snapshot: testProduct1.rate_paise,
          },
        },
      },
      include: { lines: true },
    });

    // Create a pending substitution proposing testProduct2 instead of testProduct1
    const sub = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: orderA.id,
        order_line_id: orderA.lines[0].id,
        original_product_id: testProduct1.id,
        suggested_product_id: testProduct2.id,
        requested_qty_base: 5,
        shop_reply: SubstitutionStatus.PENDING,
      },
    });

    // Cross-shop attack: Shop B tries to accept Shop A's substitution
    const crossReq = new NextRequest('http://localhost/api/retailer/substitutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawTokenB, // Shop B token!
        substitutionId: sub.id,
        action: 'ACCEPT',
      }),
    });
    const crossRes = await handleSubstitution(crossReq);
    expect(crossRes.status).toBe(404);

    // Legitimate Shop A accepts substitution
    const legitReq = new NextRequest('http://localhost/api/retailer/substitutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawTokenA,
        substitutionId: sub.id,
        action: 'ACCEPT',
      }),
    });
    const legitRes = await handleSubstitution(legitReq);
    const legitData = await legitRes.json();

    expect(legitRes.status).toBe(200);
    expect(legitData.status).toBe('ACCEPTED');

    // Verify order line was updated to suggested product
    const updatedLine = await prisma.orderLine.findUnique({
      where: { id: orderA.lines[0].id },
    });
    expect(updatedLine?.tenant_product_id).toBe(testProduct2.id);
  });
});
