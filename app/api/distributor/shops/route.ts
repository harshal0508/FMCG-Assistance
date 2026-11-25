import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import { getNextSequenceNumber } from '@/lib/services/sequence';
import { generateShopToken } from '@/lib/services/token';
import { logAuditEvent } from '@/lib/services/audit';
import { StaffSession } from '@/lib/services/auth';
import { authenticateDistributorRequest } from '@/lib/services/guard';

export const dynamic = 'force-dynamic';

function getSession(req: NextRequest, body: any): StaffSession | null {
  const cookie = req.cookies.get('vitarak_staff_session');
  if (cookie?.value) {
    try {
      return JSON.parse(cookie.value);
    } catch {}
  }
  if (body?.actorRole) {
    return {
      userId: body.actorUserId || 'temp',
      tenantId: body.tenantId || 'tenant_shree_shyam_alwar',
      name: 'Actor',
      role: body.actorRole as Role,
      phone: '0000000000',
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId = 'tenant_shree_shyam_alwar', name, ownerName, phone, altPhone, address, areaId, creditLimitPaise = 500000 } = body;

    if (!name || !ownerName || !phone || !address) {
      return NextResponse.json({ error: 'Name, ownerName, phone, and address are required' }, { status: 400 });
    }

    const shopNumber = await getNextSequenceNumber(tenantId, 'SHOP');
    const { rawToken, tokenHash, expiresAt } = generateShopToken(365);

    const shop = await prisma.$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: {
          tenant_id: tenantId,
          area_id: areaId || null,
          shop_number: shopNumber,
          name,
          owner_name: ownerName,
          phone,
          alt_phone: altPhone || null,
          address,
          credit_limit_paise: Math.round(creditLimitPaise),
        },
      });

      await tx.shopToken.create({
        data: {
          tenant_id: tenantId,
          shop_id: created.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      return created;
    });

    await logAuditEvent({
      tenantId,
      action: 'SHOP_CREATED',
      targetEntity: 'Shop',
      targetId: shop.id,
      afterState: shop,
    });

    return NextResponse.json({ success: true, shop, personalLink: `/r/${rawToken}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopId, holdFlag, creditLimitPaise, rateGroupId, actorUserId } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const hasSessionCookie = Boolean(req.cookies.get('vitarak_staff_session')?.value);
    const isSensitive = holdFlag !== undefined || creditLimitPaise !== undefined || rateGroupId !== undefined;

    if (hasSessionCookie) {
      const guard = await authenticateDistributorRequest(req, {
        sensitiveAction: isSensitive,
        requiredRole: isSensitive ? Role.OWNER : undefined,
      });

      if (!guard.authorized) {
        return guard.response!;
      }
    } else {
      const session = getSession(req, body);

      // RBAC: Only OWNER can change credit hold or credit limit
      if (session && isSensitive) {
        if (session.role !== Role.OWNER) {
          return NextResponse.json(
            { error: 'ACCESS DENIED: Single-owner model enforced. Only Owner can modify credit hold or credit limit.' },
            { status: 403 }
          );
        }
      }
    }

    const existing = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!existing) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof holdFlag === 'boolean') updateData.hold_flag = holdFlag;
    if (typeof creditLimitPaise === 'number') updateData.credit_limit_paise = Math.round(creditLimitPaise);
    if (rateGroupId !== undefined) updateData.rate_group_id = rateGroupId || null;

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: updateData,
    });

    await logAuditEvent({
      tenantId: existing.tenant_id,
      actorUserId: actorUserId ?? null,
      action: 'SHOP_UPDATED',
      targetEntity: 'Shop',
      targetId: shopId,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, shop: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
