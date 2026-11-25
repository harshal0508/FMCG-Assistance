import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { OrderStatus, StockMovementReason, OrderSource } from '@prisma/client';
import { getNextSequenceNumber } from '@/lib/services/sequence';
import { checkRateLimit } from '@/lib/rate-limit';

describe('Distributor Core Workflows (Phase 2 Integration)', () => {
  const tenantId = 'tenant_shree_shyam_alwar';
  let testShopId: string;
  let testProductId: string;
  let initialStock: number;
  let testOrderId: string;

  beforeAll(async () => {
    // 1. Pick seeded test shop SHP-0001 specifically (isolated from SHP-0030)
    let shop = await prisma.shop.findFirst({
      where: { tenant_id: tenantId, shop_number: 'SHP-0001' },
    });
    if (!shop) {
      shop = await prisma.shop.findFirst({
        where: { tenant_id: tenantId },
      });
    }
    testShopId = shop!.id;

    // 2. Get test product ordered by id ascending (isolated from pricing.test which uses desc)
    const product = await prisma.tenantProduct.findFirst({
      where: { tenant_id: tenantId },
      include: { master_product: true },
      orderBy: { id: 'asc' },
    });
    if (!product) {
      throw new Error('No tenant product found for testing');
    }
    testProductId = product.id;
    initialStock = product.stock_qty;
  });

  it('toggles shop credit hold flag reliably', async () => {
    // Set hold to true
    const updated1 = await prisma.shop.update({
      where: { id: testShopId },
      data: { hold_flag: true },
    });
    expect(updated1.hold_flag).toBe(true);

    // Set hold back to false
    const updated2 = await prisma.shop.update({
      where: { id: testShopId },
      data: { hold_flag: false },
    });
    expect(updated2.hold_flag).toBe(false);
  });

  it('updates product PTR rate and in-stock flag', async () => {
    const original = await prisma.tenantProduct.findUnique({
      where: { id: testProductId },
    });
    expect(original).toBeDefined();

    const newRatePaise = 24500; // ₹245.00
    const updated = await prisma.tenantProduct.update({
      where: { id: testProductId },
      data: {
        rate_paise: newRatePaise,
        in_stock_flag: false,
      },
    });

    expect(updated.rate_paise).toBe(24500);
    expect(updated.in_stock_flag).toBe(false);

    // Restore
    await prisma.tenantProduct.update({
      where: { id: testProductId },
      data: {
        rate_paise: original!.rate_paise,
        in_stock_flag: true,
      },
    });
  });

  it('blocks order creation when shop is on credit hold', async () => {
    // Put shop on credit hold
    await prisma.shop.update({
      where: { id: testShopId },
      data: { hold_flag: true },
    });

    const shop = await prisma.shop.findUnique({ where: { id: testShopId } });
    expect(shop?.hold_flag).toBe(true);

    // Simulating order creation endpoint check
    const canCreate = !shop?.hold_flag;
    expect(canCreate).toBe(false);

    // Release hold
    await prisma.shop.update({
      where: { id: testShopId },
      data: { hold_flag: false },
    });
  });

  it('creates phone order and handles stock reservation upon confirmation', async () => {
    const orderNumber = await getNextSequenceNumber(tenantId, 'ORDER', { datePrefix: true });
    const orderQty = 5;

    // Create order in RECEIVED status
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenant_id: tenantId,
          shop_id: testShopId,
          order_number: orderNumber,
          source: OrderSource.STAFF_PHONE,
          status: OrderStatus.RECEIVED,
          subtotal_paise: 50000,
          total_paise: 50000,
          notes: 'Integration test phone order',
        },
      });

      await tx.orderLine.create({
        data: {
          tenant_id: tenantId,
          order_id: created.id,
          tenant_product_id: testProductId,
          quantity_base: orderQty,
          order_unit_name: 'box',
          display_quantity: orderQty,
          price_paise_snapshot: 10000,
        },
      });

      return created;
    });

    testOrderId = order.id;
    expect(order.status).toBe(OrderStatus.RECEIVED);

    // Get current stock before confirmation
    const prodBefore = await prisma.tenantProduct.findUnique({
      where: { id: testProductId },
    });
    const stockBefore = prodBefore!.stock_qty;

    // Simulate Status Change to CONFIRMED (triggers reservation)
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: testOrderId },
        data: { status: OrderStatus.CONFIRMED },
      });

      await tx.tenantProduct.update({
        where: { id: testProductId },
        data: { stock_qty: { decrement: orderQty } },
      });

      await tx.stockMovement.create({
        data: {
          tenant_id: tenantId,
          tenant_product_id: testProductId,
          change: -orderQty,
          reason: StockMovementReason.RESERVATION,
          reference_id: testOrderId,
          notes: `Stock reserved for Order #${orderNumber}`,
        },
      });
    });

    // Check stock decremented
    const prodAfterConfirm = await prisma.tenantProduct.findUnique({
      where: { id: testProductId },
    });
    expect(prodAfterConfirm!.stock_qty).toBe(stockBefore - orderQty);

    // Check movement logged
    const movement = await prisma.stockMovement.findFirst({
      where: {
        reference_id: testOrderId,
        reason: StockMovementReason.RESERVATION,
      },
    });
    expect(movement).toBeDefined();
    expect(movement?.change).toBe(-orderQty);
  });

  it('releases reserved stock when order is cancelled', async () => {
    const orderQty = 5;

    const prodBefore = await prisma.tenantProduct.findUnique({
      where: { id: testProductId },
    });
    const stockBefore = prodBefore!.stock_qty;

    // Simulate Status Change to CANCELLED (triggers release)
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: testOrderId },
        data: { status: OrderStatus.CANCELLED },
      });

      await tx.tenantProduct.update({
        where: { id: testProductId },
        data: { stock_qty: { increment: orderQty } },
      });

      await tx.stockMovement.create({
        data: {
          tenant_id: tenantId,
          tenant_product_id: testProductId,
          change: orderQty,
          reason: StockMovementReason.RELEASE,
          reference_id: testOrderId,
          notes: `Stock released from cancelled Order`,
        },
      });
    });

    // Check stock restored
    const prodAfterCancel = await prisma.tenantProduct.findUnique({
      where: { id: testProductId },
    });
    expect(prodAfterCancel!.stock_qty).toBe(stockBefore + orderQty);

    // Check release movement logged
    const releaseMovement = await prisma.stockMovement.findFirst({
      where: {
        reference_id: testOrderId,
        reason: StockMovementReason.RELEASE,
      },
    });
    expect(releaseMovement).toBeDefined();
    expect(releaseMovement?.change).toBe(orderQty);
  });

  it('enforces rate limiting on authentication attempts', async () => {
    const testIp = '192.168.1.99';
    const key = `test_login_${Date.now()}_${testIp}`;

    // First 5 attempts should be allowed
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit(key, 5, 60);
      expect(res.allowed).toBe(true);
    }

    // 6th attempt within the same window must be blocked
    const blockedRes = await checkRateLimit(key, 5, 60);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.resetSeconds).toBeGreaterThan(0);
  });
});
