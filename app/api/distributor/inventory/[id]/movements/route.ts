import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';

export const dynamic = 'force-dynamic';

async function resolveTenantId(req: NextRequest) {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const sessionData = await validateServerSession(rawToken);
    if (sessionData && sessionData.user.memberships?.[0]) {
      return sessionData.user.memberships[0].tenant_id;
    }
  }
  if (process.env.NODE_ENV === 'development') {
    const defaultTenant = await prisma.tenant.findFirst({ where: { is_active: true } });
    if (defaultTenant) return defaultTenant.id;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: productId } = await params;

    const product = await prisma.tenantProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        hindi_name: true,
        stock_qty: true,
        base_unit: true,
        default_order_unit: true,
        brand: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Retrieve all movements chronologically to compute running before and after balances
    const movements = await prisma.stockMovement.findMany({
      where: {
        tenant_product_id: productId,
      },
      orderBy: { created_at: 'asc' },
    });

    // Compute before and after balances
    let running = 0;
    const computed = movements.map((m) => {
      const stockBefore = running;
      const stockAfter = running + m.change;
      running = stockAfter;

      return {
        id: m.id,
        change: m.change,
        stockBefore,
        stockAfter,
        reason: m.reason,
        referenceId: m.reference_id,
        actorUserId: m.actor_user_id || 'Owner / System',
        notes: m.notes || 'Inventory movement',
        createdAt: m.created_at,
      };
    });

    return NextResponse.json({
      product,
      movements: computed.reverse(), // Newest on top for user view
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch movements' }, { status: 500 });
  }
}
