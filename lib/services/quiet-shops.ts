import { prisma } from '@/lib/db/prisma';
import { OrderStatus } from '@prisma/client';

export interface QuietShopAnalysis {
  shopId: string;
  name: string;
  ownerName: string;
  phone: string;
  areaName: string;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number;
  medianIntervalDays: number;
  thresholdDays: number;
  isQuiet: boolean;
}

/**
 * Calculates median value from an array of numbers.
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 7; // Default fallback: 7 days
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * Evaluates whether a shop is quiet based on its own median order interval.
 * Strictly ignores CANCELLED orders when determining the last valid order date.
 */
export async function getQuietShops(
  tenantId: string,
  options?: { thresholdMultiplier?: number; refDate?: Date }
): Promise<QuietShopAnalysis[]> {
  const refDate = options?.refDate || new Date();
  const multiplier = options?.thresholdMultiplier ?? 1.0;

  const shops = await prisma.shop.findMany({
    where: {
      tenant_id: tenantId,
      status: 'ACTIVE',
    },
    include: {
      area: true,
      orders: {
        where: {
          status: { not: OrderStatus.CANCELLED }, // A10: Strictly ignores cancelled orders
        },
        select: {
          created_at: true,
        },
        orderBy: {
          created_at: 'asc',
        },
      },
    },
  });

  const results: QuietShopAnalysis[] = [];

  for (const shop of shops) {
    const validOrders = shop.orders;

    // 1. Calculate intervals between consecutive valid orders
    const intervals: number[] = [];
    for (let i = 1; i < validOrders.length; i++) {
      const diffMs = validOrders[i].created_at.getTime() - validOrders[i - 1].created_at.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      intervals.push(diffDays);
    }

    // 2. Use median interval from order history, falling back to shop's usual_order_interval_days
    const medianInterval =
      intervals.length > 0
        ? calculateMedian(intervals)
        : shop.usual_order_interval_days || 7;

    const thresholdDays = Math.round(medianInterval * multiplier);

    // 3. Find last valid order
    const lastOrder = validOrders[validOrders.length - 1];
    const lastOrderDate = lastOrder ? lastOrder.created_at : null;

    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((refDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((refDate.getTime() - shop.created_at.getTime()) / (1000 * 60 * 60 * 24));

    const isQuiet = daysSinceLastOrder > thresholdDays;

    results.push({
      shopId: shop.id,
      name: shop.name,
      ownerName: shop.owner_name,
      phone: shop.phone,
      areaName: shop.area?.name || 'General Area',
      lastOrderDate,
      daysSinceLastOrder,
      medianIntervalDays: medianInterval,
      thresholdDays,
      isQuiet,
    });
  }

  return results
    .filter((r) => r.isQuiet)
    .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
}
