import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/services/token';
import { getShopRouteCutoffInfo } from '@/lib/services/route-cutoff';
import RetailerPortal, {
  RetailerProduct,
  RetailerScheme,
  LastOrderSummary,
  RetailerSubstitution,
  HistoricalOrder,
} from '@/components/retailer/retailer-portal';

interface Props {
  params: {
    token: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function RetailerPersonalPage({ params }: Props) {
  const { token } = params;

  // Compute SHA-256 hash to look up token
  let tokenHash: string;
  try {
    tokenHash = hashToken(token);
  } catch {
    return notFound();
  }

  // Find token in database with all previous orders for this shop
  const tokenRecord = await prisma.shopToken.findUnique({
    where: { token_hash: tokenHash },
    include: {
      shop: {
        include: {
          tenant: true,
          area: true,
          orders: {
            orderBy: { created_at: 'desc' },
            include: {
              lines: {
                include: {
                  tenant_product: {
                    include: {
                      master_product: true,
                      brand: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!tokenRecord || (tokenRecord.revoked_at && tokenRecord.revoked_at <= new Date())) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 font-bold mx-auto flex items-center justify-center">
            ⚠️
          </div>
          <h1 className="text-lg font-bold text-slate-900">Invalid or Expired Link</h1>
          <p className="text-xs text-slate-500">
            यह व्यक्तिगत ऑर्डर लिंक अमान्य या समाप्त हो चुका है। कृपया अपने वितरक से नया लिंक प्राप्त करें।
          </p>
        </div>
      </div>
    );
  }

  const { shop } = tokenRecord;
  const { tenant } = shop;

  // 1. Campaign Metrics: Record first open per campaign & shop, ignoring bot/preview user agents (Part 2.8 Compliance)
  try {
    const userAgent = headers().get('user-agent') || '';
    const isBot = /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|curl|wget|python|postman/i.test(userAgent);
    if (!isBot && shop.id) {
      const pendingMessage = await prisma.outboxMessage.findFirst({
        where: {
          tenant_id: tenant.id,
          shop_id: shop.id,
          opened_at: null,
          created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { created_at: 'desc' },
      });

      if (pendingMessage) {
        await prisma.$transaction([
          prisma.outboxMessage.update({
            where: { id: pendingMessage.id },
            data: { opened_at: new Date() },
          }),
          ...(pendingMessage.campaign_id
            ? [
                prisma.campaign.update({
                  where: { id: pendingMessage.campaign_id },
                  data: { opened_count: { increment: 1 } },
                }),
              ]
            : []),
        ]);
      }
    }
  } catch (err) {
    console.error('Failed to record campaign message open:', err);
  }

  // 2. Smart Reorder Threshold: Show nothing for shops with fewer than 3 orders in the last 90 days (Part 2.11 Compliance)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const eligibleRecentOrders = shop.orders.filter(
    (o) => o.status !== 'CANCELLED' && new Date(o.created_at) >= ninetyDaysAgo
  );
  const isSmartReorderEligible = eligibleRecentOrders.length >= 3;

  const lastOrderRaw = shop.orders[0];

  // Fetch Brands, Products, Schemes, Pending Substitutions, Festivals & Route Cutoff in parallel
  const [brands, products, schemes, pendingSubstitutions, activeFestivals, routeCutoff] = await Promise.all([
    prisma.brand.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantProduct.findMany({
      where: {
        tenant_id: tenant.id,
        is_visible: true,
      },
      include: {
        brand: true,
        master_product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.scheme.findMany({
      where: {
        tenant_id: tenant.id,
        is_active: true,
      },
      take: 4,
    }),
    prisma.substitution.findMany({
      where: {
        tenant_id: tenant.id,
        order: { shop_id: shop.id },
        shop_reply: 'PENDING',
      },
      include: {
        order: true,
        order_line: true,
      },
      take: 5,
    }),
    prisma.festivalSuggestion.findMany({
      where: {
        tenant_id: tenant.id,
        is_active: true,
        end_date: { gte: new Date() },
      },
      orderBy: { start_date: 'asc' },
      take: 3,
    }),
    getShopRouteCutoffInfo(shop.id).catch((err) => {
      console.error('Failed to compute route cutoff for shop:', err);
      return null;
    }),
  ]);

  // Map products to serialized format
  const serializedProducts: RetailerProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name || p.master_product?.name || 'Product',
    hindi_name: p.hindi_name || p.master_product?.hindi_name || null,
    brand_id: p.brand_id,
    brand_name: p.brand?.name || 'General FMCG',
    sub_group: p.sub_group || p.master_product?.category?.name || 'General',
    mrp_paise: p.mrp_paise || p.master_product?.mrp_paise || null,
    rate_paise: p.rate_paise,
    stock_qty: p.stock_qty,
    in_stock_flag: p.in_stock_flag,
    default_order_unit: p.default_order_unit || p.master_product?.default_order_unit || 'unit',
    base_unit: p.base_unit || p.master_product?.base_unit || 'unit',
    is_new: p.is_new,
  }));

  const serializedSchemes: RetailerScheme[] = schemes.map((s) => {
    let parsedRule: any = {};
    try {
      parsedRule = JSON.parse(s.rule_json);
    } catch {}
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      discount_percent: parsedRule.discountPercent || null,
      discount_paise: parsedRule.discountPaise || null,
      description: parsedRule.description || s.name,
    };
  });

  const serializedOrdersHistory: HistoricalOrder[] = shop.orders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    created_at: o.created_at.toISOString(),
    status: o.status,
    total_paise: o.total_paise,
    lines: o.lines.map((l) => ({
      tenant_product_id: l.tenant_product_id,
      product_name:
        l.tenant_product.name || l.tenant_product.master_product?.name || 'Item',
      display_quantity: l.display_quantity,
      order_unit_name: l.order_unit_name,
      price_paise: l.price_paise_snapshot,
    })),
  }));

  const serializedLastOrder: LastOrderSummary | null = lastOrderRaw
    ? {
        id: lastOrderRaw.id,
        order_number: lastOrderRaw.order_number,
        created_at: lastOrderRaw.created_at.toISOString(),
        total_paise: lastOrderRaw.total_paise,
        lines: lastOrderRaw.lines.map((l) => ({
          tenant_product_id: l.tenant_product_id,
          product_name:
            l.tenant_product.name || l.tenant_product.master_product?.name || 'Item',
          display_quantity: l.display_quantity,
          order_unit_name: l.order_unit_name,
          price_paise: l.price_paise_snapshot,
        })),
      }
    : null;

  const productLookup = new Map(products.map((p) => [p.id, p]));

  const substitutions: RetailerSubstitution[] = pendingSubstitutions.map((s) => {
    const orig = productLookup.get(s.original_product_id);
    const sugg = productLookup.get(s.suggested_product_id);
    const origRate = orig?.rate_paise || s.order_line?.price_paise_snapshot || 0;
    const suggRate = sugg?.rate_paise || 0;

    return {
      id: s.id,
      order_number: s.order.order_number,
      original_product_name: orig?.name || orig?.master_product?.name || 'Original Item',
      suggested_product_name: sugg?.name || sugg?.master_product?.name || 'Replacement Item',
      suggested_product_id: s.suggested_product_id,
      requested_qty: s.requested_qty_base,
      price_difference_paise: suggRate - origRate,
      pack_difference: sugg?.default_order_unit ? `${sugg.default_order_unit} pack` : undefined,
    };
  });



  const festivalSuggestions = activeFestivals.map((fest) => {
    let parsedItems: { tenant_product_id: string; suggested_qty_base: number }[] = [];
    try {
      parsedItems = JSON.parse(fest.items_json);
    } catch {}

    return {
      id: fest.id,
      name: fest.festival_name,
      start_date: fest.start_date.toISOString(),
      end_date: fest.end_date.toISOString(),
      notes: fest.notes,
      items: parsedItems.map((it) => {
        const prod = productLookup.get(it.tenant_product_id);
        return {
          tenant_product_id: it.tenant_product_id,
          product_name: prod?.name || prod?.master_product?.name || 'Festival Item',
          brand_name: prod?.brand?.name || 'General',
          suggested_qty_base: it.suggested_qty_base || 1,
          unit_name: prod?.default_order_unit || prod?.base_unit || 'unit',
          rate_paise: prod?.rate_paise || 0,
        };
      }),
    };
  });



  return (
    <RetailerPortal
      token={token}
      shop={{
        id: shop.id,
        name: shop.name,
        owner_name: shop.owner_name,
        shop_number: shop.shop_number,
        phone: shop.phone,
        area_name: shop.area?.name || 'Ratlam',
        hold_flag: shop.hold_flag,
        usual_order_interval_days: shop.usual_order_interval_days,
      }}
      tenant={{
        id: tenant.id,
        name: tenant.name,
        owner_name: tenant.owner_name,
        order_cutoff_time: tenant.order_cutoff_time,
        upi_id: tenant.upi_id,
        phone: tenant.phone,
        address: tenant.address,
      }}
      routeCutoff={routeCutoff}
      brands={brands}
      products={serializedProducts}
      schemes={serializedSchemes}
      lastOrder={serializedLastOrder}
      ordersHistory={serializedOrdersHistory}
      substitutions={substitutions}
      festivalSuggestions={festivalSuggestions}
      isSmartReorderEligible={isSmartReorderEligible}
    />
  );
}
