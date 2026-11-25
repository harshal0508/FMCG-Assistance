import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/services/token';
import { calculateOrderPricing } from '@/lib/services/pricing';
import { getNextSequenceNumber } from '@/lib/services/sequence';
import { logAuditEvent } from '@/lib/services/audit';
import { reserveProductStockAtomic } from '@/lib/services/stock';
import { OrderSource, OrderStatus, TenantStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function authenticateRetailerToken(req: NextRequest, body?: any) {
  const token =
    req.headers.get('x-shop-token') ||
    req.nextUrl.searchParams.get('token') ||
    body?.token;

  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.shopToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        shop: {
          include: {
            tenant: true,
            area: true,
          },
        },
      },
    });

    if (!tokenRecord || (tokenRecord.revoked_at && tokenRecord.revoked_at <= new Date())) {
      return null;
    }

    if (tokenRecord.expires_at <= new Date()) {
      return null;
    }

    return tokenRecord;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRetailerToken(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired retailer token' }, { status: 401 });
    }

    const { shop } = auth;

    // Fetch active & recent orders for this shop
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: shop.tenant_id,
        shop_id: shop.id,
      },
      include: {
        lines: {
          include: {
            tenant_product: {
              include: {
                brand: true,
                master_product: true,
              },
            },
          },
        },
        substitutions: {
          where: { shop_reply: 'PENDING' },
        },
        events: {
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return NextResponse.json({ success: true, shop, orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await authenticateRetailerToken(req, body);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired retailer token' }, { status: 401 });
    }

    const { shop } = auth;
    const { tenant } = shop;

    // 1. Strict Tenant Guard
    if (tenant.status === TenantStatus.PENDING || tenant.status === TenantStatus.SUSPENDED) {
      return NextResponse.json(
        { error: 'Distributor operations are currently paused. Orders cannot be accepted at this time.' },
        { status: 403 }
      );
    }

    // 2. Strict Credit Hold Check
    if (shop.hold_flag) {
      return NextResponse.json(
        { error: `Account on Credit Hold. Please clear overdue balance before placing new orders.` },
        { status: 403 }
      );
    }

    const { items, notes, clientTotalPaise } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // 3. Pure Pricing Engine Recomputation
    // All rates, schemes, and totals are recomputed purely on the server.
    const pricing = await calculateOrderPricing(tenant.id, shop.id, items, {
      checkStock: true,
      checkCutoff: true,
    });

    if (!pricing.allowed) {
      return NextResponse.json(
        { error: pricing.blockReason, warnings: pricing.warnings },
        { status: 400 }
      );
    }

    // 4. Anti-Tamper Check
    if (clientTotalPaise !== undefined && clientTotalPaise !== pricing.totalPaise) {
      return NextResponse.json(
        {
          error: `Price tampering detected: Client submitted total ₹${(clientTotalPaise / 100).toFixed(2)} does not match server recalculated total ₹${(pricing.totalPaise / 100).toFixed(2)}.`,
          serverTotalPaise: pricing.totalPaise,
        },
        { status: 400 }
      );
    }

    // 5. Generate Sequential Order Number & Create Order
    const orderNumber = await getNextSequenceNumber(tenant.id, 'ORDER', { datePrefix: true });

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenant_id: tenant.id,
          shop_id: shop.id,
          order_number: orderNumber,
          source: OrderSource.RETAILER_APP,
          status: OrderStatus.RECEIVED,
          subtotal_paise: pricing.subtotalPaise,
          scheme_discount_paise: pricing.discountPaise,
          total_paise: pricing.totalPaise,
          notes: notes || 'Online retailer order via personal link',
        },
      });

      for (const line of pricing.lines) {
        await tx.orderLine.create({
          data: {
            tenant_id: tenant.id,
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
          tenant_id: tenant.id,
          order_id: created.id,
          status: OrderStatus.RECEIVED,
          notes: 'Order placed by retailer via personal app link',
        },
      });

      return created;
    });

    // 6. Atomic Stock Reservation for each line
    for (const line of pricing.lines) {
      await reserveProductStockAtomic(
        line.tenantProductId,
        line.quantityBase
      );
    }

    await logAuditEvent({
      tenantId: tenant.id,
      action: 'ORDER_PLACED_RETAILER',
      targetEntity: 'Order',
      targetId: order.id,
      afterState: order,
    });

    // 7. Campaign Conversion Tracking: Link real order to campaign message in same cycle (Part 2.8 Compliance)
    try {
      const pendingCampaignMessage = await prisma.outboxMessage.findFirst({
        where: {
          tenant_id: tenant.id,
          shop_id: shop.id,
          ordered_at: null,
          created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { created_at: 'desc' },
      });

      if (pendingCampaignMessage) {
        await prisma.$transaction([
          prisma.outboxMessage.update({
            where: { id: pendingCampaignMessage.id },
            data: { ordered_at: new Date() },
          }),
          ...(pendingCampaignMessage.campaign_id
            ? [
                prisma.campaign.update({
                  where: { id: pendingCampaignMessage.campaign_id },
                  data: { ordered_count: { increment: 1 } },
                }),
              ]
            : []),
        ]);
      }
    } catch (metricErr) {
      console.error('Failed to link order to campaign metrics:', metricErr);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalPaise: order.total_paise,
      },
      pricing,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
