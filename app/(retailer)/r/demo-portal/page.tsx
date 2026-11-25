import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getShopRouteCutoffInfo } from '@/lib/services/route-cutoff';
import RetailerPortal, {
  RetailerProduct,
  RetailerScheme,
  LastOrderSummary,
  RetailerSubstitution,
  HistoricalOrder,
} from '@/components/retailer/retailer-portal';

export const dynamic = 'force-dynamic';

export default async function RetailerDemoPortalPage() {
  const shop = await prisma.shop.findFirst({
    where: { phone: '9829100001' },
    include: {
      tenant: true,
      area: true,
      tokens: { where: { revoked_at: null }, take: 1 },
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
  });

  if (!shop) {
    return <div className="p-8 text-center text-sm">Please run seed script first.</div>;
  }

  const { tenant } = shop;
  const lastOrderRaw = shop.orders[0];

  const brands = await prisma.brand.findMany({
    where: { tenant_id: tenant.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const products = await prisma.tenantProduct.findMany({
    where: { tenant_id: tenant.id, is_visible: true },
    include: {
      brand: true,
      master_product: { include: { category: true } },
    },
    orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
  });

  const schemes = await prisma.scheme.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    take: 4,
  });

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

  // F4: Compute dynamic route schedule, cut-off countdown, and scheduled delivery date
  let routeCutoff = null;
  try {
    routeCutoff = await getShopRouteCutoffInfo(shop.id);
  } catch (err) {
    console.error('Failed to compute route cutoff for shop:', err);
  }

  // Fetch active festival suggestions for this tenant
  const activeFestivals = await prisma.festivalSuggestion.findMany({
    where: {
      tenant_id: tenant.id,
      is_active: true,
      end_date: { gte: new Date() },
    },
    orderBy: { start_date: 'asc' },
    take: 3,
  });

  const serializedFestivals = activeFestivals.map((fest) => {
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
        const prod = serializedProducts.find((p) => p.id === it.tenant_product_id);
        return {
          tenant_product_id: it.tenant_product_id,
          product_name: prod?.name || 'Festival Item',
          brand_name: prod?.brand_name || 'General',
          suggested_qty_base: it.suggested_qty_base || 1,
          unit_name: prod?.default_order_unit || 'unit',
          rate_paise: prod?.rate_paise || 0,
        };
      }),
    };
  });

  return (
    <RetailerPortal
      token="demo_token_123"
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
      substitutions={[]}
      festivalSuggestions={serializedFestivals}
      isSmartReorderEligible={true}
    />
  );
}
