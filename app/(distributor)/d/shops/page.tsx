import { prisma } from '@/lib/db/prisma';
import ShopDirectory, { ShopItem, AreaItem, RateGroupOption } from '@/components/distributor/shop-directory';

export const dynamic = 'force-dynamic';

export default async function DistributorShopsPage() {
  const activeTenant = await prisma.tenant.findFirst({
    where: { is_active: true },
  });
  const tenantId = activeTenant?.id || 'tenant_shree_shyam_alwar';

  const areas = await prisma.area.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const rateGroups = await prisma.rateGroup.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true, discount_type: true, discount_value: true },
    orderBy: { name: 'asc' },
  });

  const shops = await prisma.shop.findMany({
    where: { tenant_id: tenantId },
    include: {
      area: {
        select: { id: true, name: true },
      },
      rate_group: {
        select: { id: true, name: true, discount_type: true, discount_value: true },
      },
      tokens: {
        where: { revoked_at: null },
        select: { token_hash: true },
        take: 1,
      },
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          created_at: true,
          total_paise: true,
        },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
    orderBy: { shop_number: 'asc' },
  });

  // Serialize dates for Client Component
  const serializedShops: ShopItem[] = shops.map((s) => ({
    id: s.id,
    shop_number: s.shop_number,
    name: s.name,
    owner_name: s.owner_name,
    phone: s.phone,
    address: s.address,
    credit_limit_paise: s.credit_limit_paise,
    hold_flag: s.hold_flag,
    usual_order_interval_days: s.usual_order_interval_days,
    area: s.area ? { id: s.area.id, name: s.area.name } : null,
    rate_group: s.rate_group
      ? { id: s.rate_group.id, name: s.rate_group.name, discount_type: s.rate_group.discount_type, discount_value: s.rate_group.discount_value }
      : null,
    tokens: s.tokens.map((t) => ({ token_hash: t.token_hash })),
    orders: s.orders.map((o) => ({
      created_at: o.created_at.toISOString(),
      total_paise: o.total_paise,
    })),
  }));

  const areaItems: AreaItem[] = areas.map((a) => ({ id: a.id, name: a.name }));
  const rateGroupItems: RateGroupOption[] = rateGroups.map((rg) => ({
    id: rg.id,
    name: rg.name,
    discount_type: rg.discount_type,
    discount_value: rg.discount_value,
  }));

  return (
    <div className="space-y-6">
      <ShopDirectory initialShops={serializedShops} areas={areaItems} rateGroups={rateGroupItems} />
    </div>
  );
}
