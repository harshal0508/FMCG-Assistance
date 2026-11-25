import { prisma } from '@/lib/db/prisma';
import PhoneOrderEntry from '@/components/distributor/phone-order-entry';

export const dynamic = 'force-dynamic';

export default async function NewPhoneOrderPage() {
  const tenantId = 'tenant_shree_shyam_alwar';

  const [shops, brands, products] = await Promise.all([
    prisma.shop.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        shop_number: true,
        name: true,
        owner_name: true,
        phone: true,
        address: true,
        hold_flag: true,
        credit_limit_paise: true,
        area: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.brand.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, hindi_name: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.tenantProduct.findMany({
      where: {
        tenant_id: tenantId,
        is_visible: true,
      },
      select: {
        id: true,
        brand_id: true,
        brand: {
          select: { id: true, name: true, hindi_name: true },
        },
        rate_paise: true,
        stock_qty: true,
        in_stock_flag: true,
        base_unit: true,
        default_order_unit: true,
        master_product: {
          select: {
            id: true,
            name: true,
            hindi_name: true,
            mrp_paise: true,
            base_unit: true,
            default_order_unit: true,
            unit_chain_json: true,
            category: {
              select: { id: true, name: true, hindi_name: true },
            },
          },
        },
      },
      orderBy: { master_product: { name: 'asc' } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PhoneOrderEntry
        shops={shops as any}
        brands={brands as any}
        products={products as any}
      />
    </div>
  );
}
