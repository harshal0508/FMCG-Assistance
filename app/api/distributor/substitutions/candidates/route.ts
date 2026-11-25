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
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId query param is required' }, { status: 400 });
    }

    // 1. Fetch original product
    const original = await prisma.tenantProduct.findFirst({
      where: { id: productId, tenant_id: tenantId },
      include: {
        master_product: {
          include: { category: true },
        },
        brand: true,
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Find alternatives from same brand OR same category
    const candidates = await prisma.tenantProduct.findMany({
      where: {
        tenant_id: tenantId,
        id: { not: productId },
        is_visible: true,
        OR: [
          { brand_id: original.brand_id },
          { master_product: { category_id: original.master_product?.category_id } },
        ],
      },
      include: {
        master_product: true,
        brand: true,
      },
      take: 10,
    });

    // 3. Format candidates with price & pack diff
    const originalRate = original.rate_paise || original.master_product?.mrp_paise || 0;
    const originalUnit = original.default_order_unit || original.master_product?.default_order_unit || 'pack';

    const formattedCandidates = candidates.map((c) => {
      const candidateRate = c.rate_paise || c.master_product?.mrp_paise || 0;
      const candidateUnit = c.default_order_unit || c.master_product?.default_order_unit || 'pack';
      const priceDiffPaise = candidateRate - originalRate;

      let packDifference = '';
      if (candidateUnit === originalUnit) {
        packDifference = `Same pack size (${candidateUnit})`;
      } else {
        packDifference = `${candidateUnit} instead of ${originalUnit}`;
      }

      const isSameBrand = c.brand_id === original.brand_id;

      return {
        id: c.id,
        name: c.name || c.master_product?.name || 'Alternative Product',
        brandName: c.brand?.name || 'Brand',
        ratePaise: candidateRate,
        originalRatePaise: originalRate,
        priceDiffPaise,
        unit: candidateUnit,
        packDifference,
        matchType: isSameBrand ? 'SAME_BRAND' : 'SAME_CATEGORY',
        stockQty: c.stock_qty,
        inStock: c.stock_qty > 0,
      };
    });

    return NextResponse.json({
      success: true,
      originalProduct: {
        id: original.id,
        name: original.name || original.master_product?.name,
        brandName: original.brand?.name,
        ratePaise: originalRate,
        unit: originalUnit,
        stockQty: original.stock_qty,
      },
      candidates: formattedCandidates,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch substitution candidates' }, { status: 500 });
  }
}
