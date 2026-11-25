/**
 * Atomic Stock Reservation & Allocation Service
 * 
 * Guarantees that concurrent order placements cannot oversell limited inventory.
 * Uses atomic conditional updates (`WHERE stock_qty >= :qty`) via the stock data access object.
 */

import { prisma } from '../db/prisma';
import { executeAtomicStockReservation, executeAtomicStockRelease } from '../db/stock-dao';

export interface StockReservationResult {
  success: boolean;
  tenantProductId: string;
  requestedQty: number;
  remainingStock?: number;
  error?: string;
}

/**
 * Atomically reserves inventory for a product in base units.
 * Fails immediately if available stock is less than requested quantity.
 */
export async function reserveProductStockAtomic(
  tenantProductId: string,
  qtyBase: number
): Promise<StockReservationResult> {
  if (qtyBase <= 0) {
    return { success: true, tenantProductId, requestedQty: 0 };
  }

  try {
    const updated = await executeAtomicStockReservation(tenantProductId, qtyBase);

    if (!updated || updated.length === 0) {
      const current = await prisma.tenantProduct.findUnique({
        where: { id: tenantProductId },
        select: { stock_qty: true, master_product: { select: { name: true } } },
      });

      return {
        success: false,
        tenantProductId,
        requestedQty: qtyBase,
        remainingStock: current?.stock_qty ?? 0,
        error: `Insufficient stock for "${current?.master_product?.name || tenantProductId}". Requested: ${qtyBase}, Available: ${current?.stock_qty ?? 0}`,
      };
    }

    return {
      success: true,
      tenantProductId,
      requestedQty: qtyBase,
      remainingStock: updated[0].stock_qty,
    };
  } catch (err: any) {
    return {
      success: false,
      tenantProductId,
      requestedQty: qtyBase,
      error: err.message,
    };
  }
}

/**
 * Atomically releases reserved stock back into available warehouse inventory.
 */
export async function releaseProductStockAtomic(
  tenantProductId: string,
  qtyBase: number
): Promise<void> {
  if (qtyBase <= 0) return;
  await executeAtomicStockRelease(tenantProductId, qtyBase);
}
