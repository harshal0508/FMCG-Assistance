import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { StockMovementReason, Role } from '@prisma/client';
import { logAuditEvent } from '@/lib/services/audit';
import { assertStaffRole, StaffSession } from '@/lib/services/auth';
import { authenticateDistributorRequest } from '@/lib/services/guard';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantProductId, inStock, ratePaise, stockQtyChange, dailyMaxLimit, actorUserId } = body;

    if (!tenantProductId) {
      return NextResponse.json({ error: 'tenantProductId is required' }, { status: 400 });
    }

    // 1. Server-side session & policy authentication
    const hasSessionCookie = Boolean(req.cookies.get('vitarak_staff_session')?.value);
    let sessionRole: Role = Role.OWNER;
    let actorId = actorUserId || 'sys';
    let tenantId = 'tenant_shree_shyam_alwar';

    if (hasSessionCookie) {
      const isRateChange = ratePaise !== undefined;
      const guard = await authenticateDistributorRequest(req, {
        sensitiveAction: isRateChange, // Modifying wholesale PTR requires PIN within last 5 min
        requiredRole: isRateChange ? Role.OWNER : undefined,
      });

      if (!guard.authorized) {
        return guard.response!;
      }

      sessionRole = guard.role || Role.OWNER;
      actorId = guard.userId || actorId;
      tenantId = guard.tenantId || tenantId;
    } else if (body?.actorRole) {
      sessionRole = body.actorRole as Role;
      actorId = body.actorUserId || actorId;
      tenantId = body.tenantId || tenantId;

      if (sessionRole !== Role.OWNER) {
        return NextResponse.json(
          { error: 'ACCESS DENIED: Single-owner model enforced. Only Owner can modify wholesale inventory.' },
          { status: 403 }
        );
      }
    }

    const existing = await prisma.tenantProduct.findUnique({
      where: { id: tenantProductId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof inStock === 'boolean') updateData.in_stock_flag = inStock;
    if (typeof ratePaise === 'number') updateData.rate_paise = Math.round(ratePaise);
    if (dailyMaxLimit !== undefined) updateData.daily_max_limit = dailyMaxLimit ? Math.round(dailyMaxLimit) : null;

    // Handle stock quantity change with immutable stock movement
    if (typeof stockQtyChange === 'number' && stockQtyChange !== 0) {
      updateData.stock_qty = { increment: Math.round(stockQtyChange) };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.tenantProduct.update({
        where: { id: tenantProductId },
        data: updateData,
        include: { master_product: true },
      });

      if (typeof stockQtyChange === 'number' && stockQtyChange !== 0) {
        await tx.stockMovement.create({
          data: {
            tenant_id: existing.tenant_id,
            tenant_product_id: tenantProductId,
            change: Math.round(stockQtyChange),
            reason: StockMovementReason.ADJUSTMENT,
            actor_user_id: actorUserId ?? null,
            notes: 'Manual inventory stock adjustment by staff',
          },
        });
      }

      return prod;
    });

    await logAuditEvent({
      tenantId: existing.tenant_id,
      actorUserId: actorUserId ?? null,
      action: 'STOCK_OR_PRICE_UPDATED',
      targetEntity: 'TenantProduct',
      targetId: tenantProductId,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brand_id,
      name,
      hindi_name,
      sub_group,
      mrp_paise,
      rate_paise,
      base_unit = 'piece',
      default_order_unit = 'box',
      stock_qty = 0,
      daily_max_limit,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    if (typeof rate_paise !== 'number' || rate_paise < 0) {
      return NextResponse.json({ error: 'Valid wholesale rate (rate_paise) is required' }, { status: 400 });
    }

    let tenantId = 'tenant_shree_shyam_alwar';
    const hasSession = Boolean(req.cookies.get('vitarak_staff_session')?.value);
    if (hasSession) {
      const guard = await authenticateDistributorRequest(req, { requiredRole: Role.OWNER });
      if (!guard.authorized) return guard.response!;
      tenantId = guard.tenantId || tenantId;
    }

    const newProduct = await prisma.$transaction(async (tx) => {
      const prod = await tx.tenantProduct.create({
        data: {
          tenant_id: tenantId,
          brand_id: brand_id || null,
          sub_group: sub_group?.trim() || null,
          name: name.trim(),
          hindi_name: hindi_name?.trim() || null,
          mrp_paise: typeof mrp_paise === 'number' ? mrp_paise : rate_paise,
          rate_paise: Math.round(rate_paise),
          base_unit,
          default_order_unit,
          stock_qty: Math.max(0, Math.round(stock_qty)),
          in_stock_flag: stock_qty > 0,
          daily_max_limit: typeof daily_max_limit === 'number' ? daily_max_limit : null,
        },
        include: {
          brand: true,
          master_product: true,
        },
      });

      if (stock_qty > 0) {
        await tx.stockMovement.create({
          data: {
            tenant_id: tenantId,
            tenant_product_id: prod.id,
            change: Math.round(stock_qty),
            reason: StockMovementReason.IMPORT,
            notes: 'Initial stock on product creation',
          },
        });
      }

      return prod;
    });

    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
