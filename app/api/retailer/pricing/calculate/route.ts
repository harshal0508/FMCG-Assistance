import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/services/token';
import { calculateOrderPricing } from '@/lib/services/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token =
      req.headers.get('x-shop-token') ||
      req.nextUrl.searchParams.get('token') ||
      body.token;

    if (!token) {
      return NextResponse.json({ error: 'Missing retailer token' }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.shopToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        shop: {
          include: { tenant: true },
        },
      },
    });

    if (!tokenRecord || (tokenRecord.revoked_at && tokenRecord.revoked_at <= new Date())) {
      return NextResponse.json({ error: 'Invalid or expired retailer token' }, { status: 401 });
    }

    const { shop } = tokenRecord;
    const { items = [] } = body;

    const pricing = await calculateOrderPricing(shop.tenant_id, shop.id, items, {
      checkStock: true,
      checkCutoff: true,
    });

    return NextResponse.json({
      success: true,
      pricing,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
