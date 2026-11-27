import { prisma } from '@/lib/db/prisma';
import InventoryManager from '@/components/distributor/inventory-manager';

export const revalidate = 10;

export default async function DistributorInventoryPage() {
  const tenantId = 'tenant_shree_shyam_alwar';

  const [brands, categories, products] = await Promise.all([
    prisma.brand.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.category.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, hindi_name: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId },
      include: {
        brand: true,
        master_product: {
          include: {
            category: {
              select: { id: true, name: true, hindi_name: true },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <InventoryManager
        initialProducts={products as any}
        initialBrands={brands}
        categories={categories}
      />
    </div>
  );
}
