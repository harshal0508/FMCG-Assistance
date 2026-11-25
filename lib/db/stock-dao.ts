/**
 * Stock Data Access Object (Data Layer Boundary)
 * 
 * Houses atomic database queries for concurrency-safe stock reservation and release.
 */

import { prisma } from './prisma';

export async function executeAtomicStockReservation(
  tenantProductId: string,
  qtyBase: number
): Promise<Array<{ id: string; stock_qty: number }>> {
  return await prisma.$queryRaw<Array<{ id: string; stock_qty: number }>>`
    UPDATE "tenant_products"
    SET "stock_qty" = "stock_qty" - ${qtyBase}
    WHERE "id" = ${tenantProductId} AND "stock_qty" >= ${qtyBase}
    RETURNING "id", "stock_qty";
  `;
}

export async function executeAtomicStockRelease(
  tenantProductId: string,
  qtyBase: number
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "tenant_products"
    SET "stock_qty" = "stock_qty" + ${qtyBase}
    WHERE "id" = ${tenantProductId};
  `;
}
