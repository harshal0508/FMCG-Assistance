import { prisma } from './prisma';

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(`[TenantIsolationSecurityViolation] ${message}`);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Mandatory Tenant-Scoped Data Access Client
 * 
 * Enforces strict multi-tenant isolation at the data access boundary.
 * Every tenant-owned table requires an explicit tenantId.
 * No queries outside this client are permitted to access tenant data.
 */
export function createTenantClient(tenantId: string) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new TenantIsolationError('A valid tenantId is required to instantiate a tenant client');
  }

  return {
    tenantId,

    // ----------------------------------------------------
    // BRANDS
    // ----------------------------------------------------
    brands: {
      findMany: (args: any = {}) =>
        prisma.brand.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.brand.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.brand.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.brand.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Brand not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.brand.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
      delete: async (args: any) => {
        const item = await prisma.brand.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Brand not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.brand.delete({ where: { id: args.where.id } });
      },
    },

    // ----------------------------------------------------
    // CATEGORIES
    // ----------------------------------------------------
    categories: {
      findMany: (args: any = {}) =>
        prisma.category.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.category.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.category.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.category.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Category not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.category.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
      delete: async (args: any) => {
        const item = await prisma.category.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Category not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.category.delete({ where: { id: args.where.id } });
      },
    },

    // ----------------------------------------------------
    // TENANT PRODUCTS & INVENTORY
    // ----------------------------------------------------
    products: {
      findMany: (args: any = {}) =>
        prisma.tenantProduct.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.tenantProduct.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.tenantProduct.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.tenantProduct.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`TenantProduct not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.tenantProduct.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
      delete: async (args: any) => {
        const item = await prisma.tenantProduct.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`TenantProduct not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.tenantProduct.delete({ where: { id: args.where.id } });
      },
    },

    // ----------------------------------------------------
    // STOCK MOVEMENTS
    // ----------------------------------------------------
    stockMovements: {
      findMany: (args: any = {}) =>
        prisma.stockMovement.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.stockMovement.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // SHOPS
    // ----------------------------------------------------
    shops: {
      findMany: (args: any = {}) =>
        prisma.shop.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.shop.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.shop.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.shop.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Shop not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.shop.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
      delete: async (args: any) => {
        const item = await prisma.shop.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Shop not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.shop.delete({ where: { id: args.where.id } });
      },
    },

    // ----------------------------------------------------
    // SHOP TOKENS
    // ----------------------------------------------------
    shopTokens: {
      findFirst: (args: any = {}) =>
        prisma.shopToken.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.shopToken.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      revoke: async (tokenId: string) => {
        const item = await prisma.shopToken.findFirst({
          where: { id: tokenId, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Token not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.shopToken.update({
          where: { id: tokenId },
          data: { revoked_at: new Date() },
        });
      },
    },

    // ----------------------------------------------------
    // ORDERS & ORDER LINES
    // ----------------------------------------------------
    orders: {
      findMany: (args: any = {}) =>
        prisma.order.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.order.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.order.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.order.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Order not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.order.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
    },

    orderLines: {
      findMany: (args: any = {}) =>
        prisma.orderLine.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.orderLine.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.orderLine.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // BILLS & BILL EVENTS
    // ----------------------------------------------------
    bills: {
      findMany: (args: any = {}) =>
        prisma.bill.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.bill.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.bill.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // PAYMENTS & ALLOCATIONS
    // ----------------------------------------------------
    payments: {
      findMany: (args: any = {}) =>
        prisma.payment.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.payment.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.payment.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.payment.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`Payment not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.payment.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
    },

    paymentAllocations: {
      findMany: (args: any = {}) =>
        prisma.paymentAllocation.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.paymentAllocation.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // LEDGER ENTRIES (Append-Only)
    // ----------------------------------------------------
    ledger: {
      findMany: (args: any = {}) =>
        prisma.ledgerEntry.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.ledgerEntry.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      calculateBalance: async (shopId: string): Promise<number> => {
        const entries = await prisma.ledgerEntry.findMany({
          where: { tenant_id: tenantId, shop_id: shopId },
          select: { amount_paise: true },
        });
        return entries.reduce((acc, curr) => acc + curr.amount_paise, 0);
      },
    },

    // ----------------------------------------------------
    // SCHEMES
    // ----------------------------------------------------
    schemes: {
      findMany: (args: any = {}) =>
        prisma.scheme.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.scheme.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.scheme.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------
    auditLogs: {
      findMany: (args: any = {}) =>
        prisma.auditLog.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.auditLog.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // STAFF INVITES
    // ----------------------------------------------------
    staffInvites: {
      findMany: (args: any = {}) =>
        prisma.staffInvite.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.staffInvite.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // GST VERIFICATIONS
    // ----------------------------------------------------
    gstVerifications: {
      findMany: (args: any = {}) =>
        prisma.gstVerification.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.gstVerification.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
    },

    // ----------------------------------------------------
    // FESTIVAL SUGGESTIONS
    // ----------------------------------------------------
    festivalSuggestions: {
      findMany: (args: any = {}) =>
        prisma.festivalSuggestion.findMany({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      findFirst: (args: any = {}) =>
        prisma.festivalSuggestion.findFirst({
          ...args,
          where: { ...args.where, tenant_id: tenantId },
        }),
      create: (args: any) =>
        prisma.festivalSuggestion.create({
          ...args,
          data: { ...args.data, tenant_id: tenantId },
        }),
      update: async (args: any) => {
        const item = await prisma.festivalSuggestion.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`FestivalSuggestion not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.festivalSuggestion.update({
          ...args,
          where: { id: args.where.id },
          data: { ...args.data, tenant_id: tenantId },
        });
      },
      delete: async (args: any) => {
        const item = await prisma.festivalSuggestion.findFirst({
          where: { id: args.where.id, tenant_id: tenantId },
        });
        if (!item) {
          throw new TenantIsolationError(`FestivalSuggestion not found or does not belong to tenant ${tenantId}`);
        }
        return prisma.festivalSuggestion.delete({ where: { id: args.where.id } });
      },
    },
  };
}
