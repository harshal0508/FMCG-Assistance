import { NextRequest, NextResponse } from 'next/server';
import { calculateOrderPricing } from '@/lib/services/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId = 'tenant_shree_shyam_alwar', shopId, items } = body;

    if (!shopId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'shopId and items array are required' },
        { status: 400 }
      );
    }

    const result = await calculateOrderPricing(tenantId, shopId, items, {
      checkStock: true,
      checkCutoff: true,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
