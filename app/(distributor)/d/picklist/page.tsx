import { prisma } from '@/lib/db/prisma';
import PickListView, { PickListItem, RouteFilterOption } from '@/components/distributor/pick-list-view';

export const dynamic = 'force-dynamic';

export default async function DistributorPickListPage() {
  const tenantId = 'tenant_shree_shyam_alwar';

  // Fetch delivery areas
  const areas = await prisma.area.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch orders to pack / dispatch (CONFIRMED, PACKED, RECEIVED)
  let orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      status: {
        in: ['CONFIRMED', 'PACKED', 'RECEIVED'],
      },
    },
    include: {
      shop: {
        include: {
          area: true,
        },
      },
      lines: {
        include: {
          tenant_product: {
            include: {
              brand: true,
              master_product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // If no pending orders, fallback to recent 30 orders for dispatch manifest
  if (orders.length === 0) {
    orders = await prisma.order.findMany({
      where: { tenant_id: tenantId },
      include: {
        shop: {
          include: {
            area: true,
          },
        },
        lines: {
          include: {
            tenant_product: {
              include: {
                brand: true,
                master_product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 30,
    });
  }

  // Aggregate pick items by product
  const productMap: Record<string, PickListItem> = {};
  let totalVolumeValuePaise = 0;

  for (const order of orders) {
    totalVolumeValuePaise += order.total_paise;

    for (const line of order.lines) {
      const prod = line.tenant_product;
      const prodId = prod.id;
      const brandName = prod.brand?.name || 'General FMCG';

      if (!productMap[prodId]) {
        productMap[prodId] = {
          productId: prodId,
          productName: prod.name || prod.master_product?.name || 'Product',
          hindiName: prod.hindi_name || prod.master_product?.hindi_name || null,
          brandName,
          categoryName: prod.sub_group || prod.master_product?.category?.name || 'General',
          orderUnitName: line.order_unit_name,
          totalQuantity: 0,
          currentStock: prod.stock_qty,
          shopBreakdown: [],
        };
      }

      productMap[prodId].totalQuantity += line.display_quantity;
      productMap[prodId].shopBreakdown.push({
        shopName: order.shop.name,
        shopNumber: order.shop.shop_number,
        areaName: order.shop.area?.name || 'Ratlam Main',
        quantity: line.display_quantity,
        orderNumber: order.order_number,
      });
    }
  }

  const pickList: PickListItem[] = Object.values(productMap).sort((a, b) =>
    a.brandName.localeCompare(b.brandName) || a.productName.localeCompare(b.productName)
  );

  const routeOptions: RouteFilterOption[] = areas.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <div className="space-y-6">
      <PickListView
        pickList={pickList}
        routes={routeOptions}
        totalOrdersCount={orders.length}
        totalVolumeValuePaise={totalVolumeValuePaise}
      />
    </div>
  );
}
