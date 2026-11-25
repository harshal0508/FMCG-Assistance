import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';
import { AnySchemeRuleSchema, evaluateScheme, CartItemInput } from '@/lib/services/schemes';
import { SchemeType } from '@prisma/client';

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

    const schemes = await prisma.scheme.findMany({
      where: { tenant_id: tenantId },
      include: {
        products: {
          include: {
            tenant_product: { select: { id: true, name: true, hindi_name: true, rate_paise: true } },
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Also fetch tenant products for scheme creation dropdowns
    const products = await prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId, is_visible: true },
      select: {
        id: true,
        name: true,
        hindi_name: true,
        rate_paise: true,
        mrp_paise: true,
        default_order_unit: true,
      },
      orderBy: { name: 'asc' },
    });

    const formatted = schemes.map((s) => {
      let parsedRule: any = null;
      try {
        parsedRule = JSON.parse(s.rule_json);
      } catch {}

      const now = new Date();
      const isExpired = now > s.end_date;
      const isUpcoming = now < s.start_date;
      const isActiveNow = s.is_active && !isExpired && !isUpcoming;

      return {
        id: s.id,
        name: s.name,
        type: s.type,
        rule: parsedRule,
        startDate: s.start_date,
        endDate: s.end_date,
        isActive: s.is_active,
        isActiveNow,
        isExpired,
        isUpcoming,
        applicationsCount: s._count.applications,
        products: s.products.map((p) => ({
          productId: p.tenant_product_id,
          name: p.tenant_product.name,
          hindiName: p.tenant_product.hindi_name,
          isTrigger: p.is_trigger,
          isReward: p.is_reward,
        })),
      };
    });

    return NextResponse.json({ schemes: formatted, products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch schemes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action = 'CREATE' } = body;

    // SIMULATE CART ACTION
    if (action === 'SIMULATE') {
      const { schemeRule, cartItems = [] } = body;
      const parsedRule = AnySchemeRuleSchema.safeParse(schemeRule);
      if (!parsedRule.success) {
        return NextResponse.json(
          { error: 'Invalid scheme rule parameters', details: parsedRule.error.issues },
          { status: 400 }
        );
      }

      const dummyScheme = {
        id: 'sim_scheme',
        name: 'Live Cart Simulation',
        type: schemeRule.type,
        rule_json: JSON.stringify(schemeRule),
        start_date: new Date(Date.now() - 86400000),
        end_date: new Date(Date.now() + 86400000),
        is_active: true,
      };

      const result = evaluateScheme(dummyScheme, cartItems as CartItemInput[]);

      const originalTotalPaise = (cartItems as CartItemInput[]).reduce(
        (sum, item) => sum + item.quantityBase * item.unitPricePaise,
        0
      );

      const discountPaise = result?.discountPaise || 0;
      const netTotalPaise = Math.max(0, originalTotalPaise - discountPaise);

      return NextResponse.json({
        success: true,
        result,
        originalTotalPaise,
        discountPaise,
        netTotalPaise,
        youSavePaise: discountPaise,
      });
    }

    if (action === 'CREATE') {
      const { name, type, rule, startDate, endDate } = body;
      if (!name || !type || !rule || !startDate || !endDate) {
        return NextResponse.json({ error: 'Name, type, rule, startDate, and endDate are required' }, { status: 400 });
      }

      // Validate rule with Zod
      const parsedRule = AnySchemeRuleSchema.safeParse(rule);
      if (!parsedRule.success) {
        return NextResponse.json(
          { error: 'Invalid scheme rule format', details: parsedRule.error.issues },
          { status: 400 }
        );
      }

      const scheme = await prisma.$transaction(async (tx) => {
        const s = await tx.scheme.create({
          data: {
            tenant_id: tenantId,
            name: name.trim(),
            type: type as SchemeType,
            rule_json: JSON.stringify(rule),
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            is_active: true,
          },
        });

        // Link products
        if (rule.type === 'FREE_GOODS') {
          for (const trigId of rule.triggerProductIds) {
            await tx.schemeProduct.create({
              data: {
                tenant_id: tenantId,
                scheme_id: s.id,
                tenant_product_id: trigId,
                is_trigger: true,
                is_reward: false,
              },
            });
          }
          if (rule.rewardProductId) {
            await tx.schemeProduct.create({
              data: {
                tenant_id: tenantId,
                scheme_id: s.id,
                tenant_product_id: rule.rewardProductId,
                is_trigger: false,
                is_reward: true,
              },
            });
          }
        } else if (rule.type === 'SLAB_DISCOUNT') {
          for (const prodId of rule.targetProductIds) {
            await tx.schemeProduct.create({
              data: {
                tenant_id: tenantId,
                scheme_id: s.id,
                tenant_product_id: prodId,
                is_trigger: true,
                is_reward: false,
              },
            });
          }
        } else if (rule.type === 'COMBO') {
          for (const item of rule.requiredItems) {
            await tx.schemeProduct.create({
              data: {
                tenant_id: tenantId,
                scheme_id: s.id,
                tenant_product_id: item.productId,
                is_trigger: true,
                is_reward: false,
              },
            });
          }
        }

        return s;
      });

      return NextResponse.json({ success: true, scheme });
    }

    if (action === 'TOGGLE_ACTIVE') {
      const { schemeId, isActive } = body;
      const updated = await prisma.scheme.update({
        where: { id: schemeId },
        data: { is_active: Boolean(isActive) },
      });
      return NextResponse.json({ success: true, scheme: updated });
    }

    if (action === 'DELETE') {
      const { schemeId } = body;
      await prisma.scheme.delete({
        where: { id: schemeId },
      });
      return NextResponse.json({ success: true, deletedSchemeId: schemeId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Scheme operation failed' }, { status: 500 });
  }
}
