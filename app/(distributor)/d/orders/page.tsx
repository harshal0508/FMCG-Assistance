import { prisma } from '@/lib/db/prisma';
import OrderInbox, { OrderInboxItem, AreaItem } from '@/components/distributor/order-inbox';

export const dynamic = 'force-dynamic';

export default async function DistributorOrdersPage() {
  const tenantId = 'tenant_shree_shyam_alwar';

  const [areas, orders] = await Promise.all([
    prisma.area.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, notes: true },
      orderBy: { name: 'asc' },
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            shop_number: true,
            owner_name: true,
            phone: true,
            address: true,
            hold_flag: true,
            credit_limit_paise: true,
            area: {
              select: { id: true, name: true },
            },
          },
        },
        lines: {
          include: {
            tenant_product: {
              select: {
                id: true,
                stock_qty: true,
                base_unit: true,
                default_order_unit: true,
                master_product: {
                  select: {
                    name: true,
                    hindi_name: true,
                    base_unit: true,
                    default_order_unit: true,
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
      orderBy: { created_at: 'desc' },
      take: 250,
    }),
  ]);

  // Serialize Date objects for React Client Component
  const serializedOrders: OrderInboxItem[] = orders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status as any,
    source: o.source,
    subtotal_paise: o.subtotal_paise,
    total_paise: o.total_paise,
    discount_paise: o.scheme_discount_paise,
    notes: o.notes,
    created_at: o.created_at.toISOString(),
    shop: o.shop,
    lines: o.lines.map((l) => ({
      id: l.id,
      display_quantity: l.display_quantity,
      order_unit_name: l.order_unit_name,
      price_paise_snapshot: l.price_paise_snapshot,
      tenant_product: l.tenant_product as any,
    })),
    events: o.events.map((e) => ({
      id: e.id,
      status: e.status as any,
      created_at: e.created_at.toISOString(),
      notes: e.notes,
    })),
  }));

  return (
    <div className="space-y-6">
      <OrderInbox initialOrders={serializedOrders} areas={areas} />
    </div>
  );
}
