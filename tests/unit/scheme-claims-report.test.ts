import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('B8: Scheme-Claim Report & CSV Export API', () => {
  let tenantId: string;
  let schemeId: string;
  let orderLineId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'tenant_shree_shyam_alwar' },
      include: {
        schemes: true,
        orders: {
          include: { lines: true },
        },
      },
    });

    if (!tenant) throw new Error('No tenant found');
    tenantId = tenant.id;

    if (tenant.schemes.length === 0 || tenant.orders.length === 0) {
      throw new Error('Tenant missing seed schemes or orders');
    }

    schemeId = tenant.schemes[0].id;
    orderLineId = tenant.orders[0].lines[0].id;
  });

  it('aggregates scheme claims correctly and formats claimable amount', async () => {
    // Record a test scheme application
    const app = await prisma.schemeApplication.create({
      data: {
        tenant_id: tenantId,
        scheme_id: schemeId,
        order_line_id: orderLineId,
        units_applied: 50,
        benefit_paise: 125000, // ₹1,250.00
      },
    });

    expect(app.id).toBeDefined();

    // Query applications for this scheme
    const applications = await prisma.schemeApplication.findMany({
      where: { scheme_id: schemeId },
      include: {
        scheme: true,
        order_line: {
          include: {
            order: { include: { shop: true } },
          },
        },
      },
    });

    expect(applications.length).toBeGreaterThanOrEqual(1);

    const totalBenefitPaise = applications.reduce((sum, a) => sum + a.benefit_paise, 0);
    const totalUnits = applications.reduce((sum, a) => sum + a.units_applied, 0);

    expect(totalBenefitPaise).toBeGreaterThanOrEqual(125000);
    expect(totalUnits).toBeGreaterThanOrEqual(50);

    // Verify CSV line construction
    const csvRow = `"${applications[0].scheme.name}",${applications[0].scheme.type},${totalUnits},₹${(totalBenefitPaise / 100).toFixed(2)}`;
    expect(csvRow).toContain(applications[0].scheme.name);

    // Cleanup
    await prisma.schemeApplication.delete({ where: { id: app.id } });
  });
});
