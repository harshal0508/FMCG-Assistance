import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { calculateOrderPricing } from '@/lib/services/pricing';
import { getNextSequenceNumber } from '@/lib/services/sequence';
import { logAuditEvent } from '@/lib/services/audit';
import { reserveProductStockAtomic, releaseProductStockAtomic } from '@/lib/services/stock';
import { OrderSource, OrderStatus, StockMovementReason, TenantStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, shopId, items, notes, clientTotalPaise, actorUserId } = body;

    if (!tenantId || !shopId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'tenantId, shopId, and at least one item are required' }, { status: 400 });
    }

    // 1. Pending & Suspended Tenant Guard: Business operations are locked
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, name: true },
    });

    if (tenant?.status === TenantStatus.PENDING) {
      return NextResponse.json(
        { error: 'Distributor registration is pending platform approval. Order placement is locked until approved.' },
        { status: 403 }
      );
    }

    if (tenant?.status === TenantStatus.SUSPENDED) {
      return NextResponse.json(
        { error: 'Distributor account is suspended. Read-only access enabled; new orders cannot be placed or confirmed.' },
        { status: 403 }
      );
    }

    // 2. Pure Pricing Engine Recomputation
    // All rates, discounts, taxes, and totals are recomputed purely on the server
    const pricing = await calculateOrderPricing(tenantId, shopId, items, {
      checkStock: true,
      checkCutoff: true,
    });

    if (!pricing.allowed) {
      return NextResponse.json(
        { error: pricing.blockReason, warnings: pricing.warnings },
        { status: 400 }
      );
    }

    // 3. Client Price Tamper Detection:
    // If the client provided a total that conflicts with the server's pure pricing, reject the tampered payload
    if (clientTotalPaise !== undefined && clientTotalPaise !== pricing.totalPaise) {
      return NextResponse.json(
        {
          error: `Price tampering detected: Client submitted total ₹${(clientTotalPaise / 100).toFixed(2)} does not match server recalculated total ₹${(pricing.totalPaise / 100).toFixed(2)}.`,
          serverTotalPaise: pricing.totalPaise,
        },
        { status: 400 }
      );
    }

    const orderNumber = await getNextSequenceNumber(tenantId, 'ORDER', { datePrefix: true });

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          order_number: orderNumber,
          source: OrderSource.STAFF_PHONE,
          status: OrderStatus.RECEIVED,
          subtotal_paise: pricing.subtotalPaise,
          scheme_discount_paise: pricing.discountPaise,
          total_paise: pricing.totalPaise,
          notes: notes || 'Phone order entered by staff',
        },
      });

      for (const line of pricing.lines) {
        await tx.orderLine.create({
          data: {
            tenant_id: tenantId,
            order_id: created.id,
            tenant_product_id: line.tenantProductId,
            quantity_base: line.quantityBase,
            order_unit_name: line.orderUnitName,
            display_quantity: line.orderQty,
            price_paise_snapshot: line.effectiveRatePaise,
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          tenant_id: tenantId,
          order_id: created.id,
          status: OrderStatus.RECEIVED,
          actor_user_id: actorUserId ?? null,
          notes: 'Order created via staff entry',
        },
      });

      return created;
    });

    await logAuditEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: 'ORDER_CREATED',
      targetEntity: 'Order',
      targetId: order.id,
      afterState: { ...order, warnings: pricing.warnings },
    });

    return NextResponse.json({
      success: true,
      order,
      pricingWarnings: pricing.warnings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, newStatus, actorUserId } = body;

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'orderId and newStatus are required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: true,
        tenant: { select: { status: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Suspended tenant guard: Cannot confirm orders while suspended
    if (newStatus === OrderStatus.CONFIRMED && order.tenant.status === TenantStatus.SUSPENDED) {
      return NextResponse.json(
        { error: 'Cannot confirm order: Distributor account is suspended.' },
        { status: 403 }
      );
    }

    const prevStatus = order.status;

    // 1. Atomic Stock Reservation on Confirmation
    if (newStatus === OrderStatus.CONFIRMED && prevStatus === OrderStatus.RECEIVED) {
      for (const line of order.lines) {
        const reservation = await reserveProductStockAtomic(line.tenant_product_id, line.quantity_base);
        if (!reservation.success) {
          return NextResponse.json(
            { error: reservation.error || 'Insufficient stock for allocation' },
            { status: 409 }
          );
        }

        await prisma.stockMovement.create({
          data: {
            tenant_id: order.tenant_id,
            tenant_product_id: line.tenant_product_id,
            change: -line.quantity_base,
            reason: StockMovementReason.RESERVATION,
            reference_id: order.id,
            actor_user_id: actorUserId ?? null,
            notes: `Stock reserved for Order #${order.order_number}`,
          },
        });
      }
    }

    // 2. Atomic Stock Release on Cancellation
    if (
      newStatus === OrderStatus.CANCELLED &&
      (prevStatus === OrderStatus.CONFIRMED || prevStatus === OrderStatus.PACKED)
    ) {
      for (const line of order.lines) {
        await releaseProductStockAtomic(line.tenant_product_id, line.quantity_base);

        await prisma.stockMovement.create({
          data: {
            tenant_id: order.tenant_id,
            tenant_product_id: line.tenant_product_id,
            change: line.quantity_base,
            reason: StockMovementReason.RELEASE,
            reference_id: order.id,
            actor_user_id: actorUserId ?? null,
            notes: `Stock released from cancelled Order #${order.order_number}`,
          },
        });
      }
    }

    // 3. Update Order Status
    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus as OrderStatus },
      });

      await tx.orderEvent.create({
        data: {
          tenant_id: order.tenant_id,
          order_id: order.id,
          status: newStatus as OrderStatus,
          actor_user_id: actorUserId ?? null,
          notes: `Status changed from ${prevStatus} to ${newStatus}`,
        },
      });

      return updatedOrder;
    });

    await logAuditEvent({
      tenantId: order.tenant_id,
      actorUserId: actorUserId ?? null,
      action: 'ORDER_STATUS_CHANGED',
      targetEntity: 'Order',
      targetId: order.id,
      beforeState: { status: prevStatus },
      afterState: { status: newStatus },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
