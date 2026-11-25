import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';
import { DiscountType } from '@prisma/client';

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

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateGroups = await prisma.rateGroup.findMany({
      where: { tenant_id: tenantId },
      include: {
        _count: { select: { shops: true } },
        overrides: {
          include: {
            tenant_product: {
              select: {
                id: true,
                name: true,
                hindi_name: true,
                rate_paise: true,
                mrp_paise: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const products = await prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId, is_visible: true },
      select: {
        id: true,
        name: true,
        hindi_name: true,
        rate_paise: true,
        mrp_paise: true,
      },
      orderBy: { name: 'asc' },
    });

    const formatted = rateGroups.map((rg) => ({
      id: rg.id,
      name: rg.name,
      discountType: rg.discount_type,
      discountValue: rg.discount_value,
      shopsCount: rg._count.shops,
      overrides: rg.overrides.map((ov) => ({
        id: ov.id,
        productId: ov.tenant_product_id,
        productName: ov.tenant_product.name,
        hindiName: ov.tenant_product.hindi_name,
        standardRatePaise: ov.tenant_product.rate_paise,
        specialRatePaise: ov.special_rate_paise,
      })),
      createdAt: rg.created_at,
    }));

    return NextResponse.json({ rateGroups: formatted, products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch rate groups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_GROUP') {
      const { name, discountType = 'PERCENTAGE', discountValue = 0 } = body;
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Rate group name is required' }, { status: 400 });
      }

      const created = await prisma.rateGroup.create({
        data: {
          tenant_id: tenantId,
          name: name.trim(),
          discount_type: discountType as DiscountType,
          discount_value: Math.round(Number(discountValue) || 0),
        },
      });

      return NextResponse.json({ success: true, rateGroup: created });
    }

    if (action === 'UPDATE_GROUP') {
      const { rateGroupId, name, discountType, discountValue } = body;
      if (!rateGroupId) {
        return NextResponse.json({ error: 'rateGroupId is required' }, { status: 400 });
      }

      const updated = await prisma.rateGroup.update({
        where: { id: rateGroupId },
        data: {
          name: name?.trim(),
          discount_type: discountType as DiscountType,
          discount_value: Math.round(Number(discountValue) || 0),
        },
      });

      return NextResponse.json({ success: true, rateGroup: updated });
    }

    if (action === 'DELETE_GROUP') {
      const { rateGroupId } = body;
      if (!rateGroupId) {
        return NextResponse.json({ error: 'rateGroupId is required' }, { status: 400 });
      }

      // Detach shops first
      await prisma.shop.updateMany({
        where: { rate_group_id: rateGroupId },
        data: { rate_group_id: null },
      });

      await prisma.rateGroup.delete({
        where: { id: rateGroupId },
      });

      return NextResponse.json({ success: true, deletedRateGroupId: rateGroupId });
    }

    if (action === 'UPSERT_OVERRIDE') {
      const { rateGroupId, tenantProductId, specialRatePaise } = body;
      if (!rateGroupId || !tenantProductId || typeof specialRatePaise !== 'number') {
        return NextResponse.json(
          { error: 'rateGroupId, tenantProductId, and specialRatePaise are required' },
          { status: 400 }
        );
      }

      const override = await prisma.rateOverride.upsert({
        where: {
          rate_group_id_tenant_product_id: {
            rate_group_id: rateGroupId,
            tenant_product_id: tenantProductId,
          },
        },
        create: {
          tenant_id: tenantId,
          rate_group_id: rateGroupId,
          tenant_product_id: tenantProductId,
          special_rate_paise: Math.round(specialRatePaise),
        },
        update: {
          special_rate_paise: Math.round(specialRatePaise),
        },
      });

      return NextResponse.json({ success: true, override });
    }

    if (action === 'DELETE_OVERRIDE') {
      const { overrideId } = body;
      if (!overrideId) {
        return NextResponse.json({ error: 'overrideId is required' }, { status: 400 });
      }

      await prisma.rateOverride.delete({
        where: { id: overrideId },
      });

      return NextResponse.json({ success: true, deletedOverrideId: overrideId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Rate group operation failed' }, { status: 500 });
  }
}
