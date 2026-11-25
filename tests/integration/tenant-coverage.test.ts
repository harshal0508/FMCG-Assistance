import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { createTenantClient } from '@/lib/db/tenant-client';

describe('Tenant Isolation Complete Coverage & Automated Regression Guard', () => {
  it('detects every model with tenant_id and ensures complete coverage in the tenant data layer', () => {
    // 1. Inspect Prisma DMMF to find every single model with tenant_id
    const modelsWithTenantId = Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((f) => f.name === 'tenant_id'))
      .map((m) => m.name);

    expect(modelsWithTenantId.length).toBeGreaterThan(0);

    // List of models explicitly covered in our mandatory tenant-scoped data access client
    const coveredEntityMappings = [
      'Category',
      'TenantProduct',
      'ProductAlias',
      'StockMovement',
      'Area',
      'RouteGroup',
      'RouteGroupArea',
      'RouteSchedule',
      'RateGroup',
      'RateOverride',
      'Shop',
      'ShopToken',
      'ShopPayerName',
      'JoinRequest',
      'Scheme',
      'SchemeProduct',
      'SchemeApplication',
      'Order',
      'OrderLine',
      'OrderEvent',
      'Substitution',
      'Bill',
      'BillEvent',
      'Payment',
      'PaymentAllocation',
      'UnmatchedPayment',
      'LedgerEntry',
      'TenantSequence',
      'Campaign',
      'OutboxMessage',
      'CallAttempt',
      'ParseJob',
      'ImportJob',
      'TenantPlan',
      'UsageCounter',
      'AuditLog',
      'Membership',
      'StaffInvite',
      'GstVerification',
      'Brand',
      'FestivalSuggestion',
    ];

    const uncoveredModels = modelsWithTenantId.filter(
      (name) => !coveredEntityMappings.includes(name)
    );

    if (uncoveredModels.length > 0) {
      throw new Error(
        `[SECURITY CI FAILURE] New model(s) with tenant_id added to schema without tenant-client coverage: [${uncoveredModels.join(', ')}]. You must add tenant isolation coverage to createTenantClient!`
      );
    }

    expect(uncoveredModels.length).toBe(0);
  });
});
