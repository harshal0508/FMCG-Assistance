import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { StockMovementReason } from '@prisma/client';

describe('B7: Stock Movement History (who, when, why, before and after)', () => {
  let tenantId: string;
  let productId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: { products: true },
    });
    if (!tenant) throw new Error('No tenant found');
    tenantId = tenant.id;
    productId = tenant.products[0].id;
  });

  it('records stock movements and computes running before and after balances accurately', async () => {
    // 1. Initial movement (+100)
    const m1 = await prisma.stockMovement.create({
      data: {
        tenant_id: tenantId,
        tenant_product_id: productId,
        change: 100,
        reason: StockMovementReason.IMPORT,
        actor_user_id: 'Anand Verma (Owner)',
        notes: 'Initial warehouse shipment receipt',
      },
    });

    // 2. Reservation / Order (-20)
    const m2 = await prisma.stockMovement.create({
      data: {
        tenant_id: tenantId,
        tenant_product_id: productId,
        change: -20,
        reason: StockMovementReason.RESERVATION,
        actor_user_id: 'System Dispatch Engine',
        reference_id: 'ORD-20261124-0001',
        notes: 'Stock allocated for confirmed dispatch',
      },
    });

    // 3. Manual Adjustment (+5)
    const m3 = await prisma.stockMovement.create({
      data: {
        tenant_id: tenantId,
        tenant_product_id: productId,
        change: 5,
        reason: StockMovementReason.ADJUSTMENT,
        actor_user_id: 'Anand Verma (Owner)',
        notes: 'Physical count adjustment',
      },
    });

    // Retrieve and compute balances
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: [m1.id, m2.id, m3.id] } },
      orderBy: { created_at: 'asc' },
    });

    let running = 0;
    const computed = movements.map((m) => {
      const before = running;
      const after = running + m.change;
      running = after;
      return {
        who: m.actor_user_id,
        why: m.notes,
        reason: m.reason,
        when: m.created_at,
        change: m.change,
        before,
        after,
      };
    });

    expect(computed[0].before).toBe(0);
    expect(computed[0].after).toBe(100);
    expect(computed[0].who).toContain('Owner');

    expect(computed[1].before).toBe(100);
    expect(computed[1].after).toBe(80);
    expect(computed[1].change).toBe(-20);

    expect(computed[2].before).toBe(80);
    expect(computed[2].after).toBe(85);

    // Cleanup
    await prisma.stockMovement.deleteMany({
      where: { id: { in: [m1.id, m2.id, m3.id] } },
    });
  });
});
