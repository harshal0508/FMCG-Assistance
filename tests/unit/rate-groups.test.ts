import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { DiscountType } from '@prisma/client';

describe('B6: Rate Groups & Overrides API', () => {
  let tenantId: string;
  let productId: string;
  let shopId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: { products: true, shops: true },
    });
    if (!tenant) throw new Error('No tenant found');
    tenantId = tenant.id;
    productId = tenant.products[0].id;
    shopId = tenant.shops[0].id;
  });

  it('creates a rate group and adds a product price override', async () => {
    // 1. Create Rate Group
    const rg = await prisma.rateGroup.create({
      data: {
        tenant_id: tenantId,
        name: `Wholesale Tier A ${Date.now()}`,
        discount_type: DiscountType.PERCENTAGE,
        discount_value: 3, // 3%
      },
    });

    expect(rg.id).toBeDefined();

    // 2. Add product override
    const override = await prisma.rateOverride.create({
      data: {
        tenant_id: tenantId,
        rate_group_id: rg.id,
        tenant_product_id: productId,
        special_rate_paise: 9500, // special rate ₹95.00
      },
    });

    expect(override.id).toBeDefined();
    expect(override.special_rate_paise).toBe(9500);

    // 3. Assign rate group to shop
    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: { rate_group_id: rg.id },
    });

    expect(updatedShop.rate_group_id).toBe(rg.id);

    // Cleanup: detach shop, delete override and rate group
    await prisma.shop.update({ where: { id: shopId }, data: { rate_group_id: null } });
    await prisma.rateOverride.delete({ where: { id: override.id } });
    await prisma.rateGroup.delete({ where: { id: rg.id } });
  });
});
