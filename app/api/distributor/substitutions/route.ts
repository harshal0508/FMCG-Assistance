import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    const substitutions = await prisma.substitution.findMany({
      where: {
        tenant_id: tenantId,
        ...(orderId ? { order_id: orderId } : {}),
      },
      include: {
        order: {
          select: { id: true, order_number: true, shop_id: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      success: true,
      substitutions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch substitutions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await req.json();

    const {
      orderId,
      orderLineId,
      originalProductId,
      suggestedProductId,
      requestedQtyBase = 1,
      triggerMockCall = false,
    } = body;

    if (!orderId || !orderLineId || !originalProductId || !suggestedProductId) {
      return NextResponse.json(
        { error: 'orderId, orderLineId, originalProductId, and suggestedProductId are required' },
        { status: 400 }
      );
    }

    const [order, originalProd, suggestedProd] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: { shop: true },
      }),
      prisma.tenantProduct.findFirst({
        where: { id: originalProductId, tenant_id: tenantId },
        include: { master_product: true },
      }),
      prisma.tenantProduct.findFirst({
        where: { id: suggestedProductId, tenant_id: tenantId },
        include: { master_product: true },
      }),
    ]);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 1. Create or update substitution with PENDING state
    const substitution = await prisma.substitution.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        order_line_id: orderLineId,
        original_product_id: originalProductId,
        suggested_product_id: suggestedProductId,
        requested_qty_base: requestedQtyBase,
        shop_reply: 'PENDING',
        resolved_by: session.userId,
      },
    });

    let mockCallAttempt = null;

    // 2. Mock call trigger if selected
    if (triggerMockCall && order.shop) {
      mockCallAttempt = await prisma.callAttempt.create({
        data: {
          tenant_id: tenantId,
          shop_id: order.shop.id,
          trigger_reason: 'SUBSTITUTION_PROPOSAL',
          script: `Namaste ${order.shop.owner_name || order.shop.name} ji! Your ordered item ${originalProd?.master_product?.name || 'product'} is out of stock. We have proposed ${suggestedProd?.master_product?.name || 'an alternative'}. Please check your portal to confirm.`,
          result: 'SIMULATED_SUCCESS',
          transcript: '[Simulated Voice Agent]: Out of stock substitution notification placed successfully.',
          cost_paise: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      substitution,
      mockCallAttempt,
      message: 'Substitution proposal sent to shopkeeper. Status: Awaiting Reply.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create substitution' }, { status: 500 });
  }
}
