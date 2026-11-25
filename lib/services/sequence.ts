import { prisma } from '../db/prisma';
import { getKolkataZonedTime } from './route-cutoff';

export type SequenceEntityType = 'ORDER' | 'BILL' | 'SHOP';

const DEFAULT_CONFIGS: Record<SequenceEntityType, { prefix: string; padding: number }> = {
  ORDER: { prefix: 'ORD-', padding: 4 },
  BILL: { prefix: 'BILL-', padding: 4 },
  SHOP: { prefix: 'SHP-', padding: 4 },
};

/**
 * Race-Safe Sequence Generator
 * 
 * Formats:
 * - ORDER: ORD-YYYYMMDD-NNNN (Kolkata date + per-tenant per-day counter)
 * - BILL:  BILL-YYYYMMDD-NNNN (Kolkata date + per-tenant per-day counter)
 * - SHOP:  SHP-NNNN (Simple per-tenant progressive counter, e.g. SHP-0001)
 * 
 * The date for orders and bills is strictly computed in Asia/Kolkata timezone.
 */
export async function getNextSequenceNumber(
  tenantId: string,
  entityType: SequenceEntityType,
  options?: { datePrefix?: boolean; refDate?: Date }
): Promise<string> {
  const config = DEFAULT_CONFIGS[entityType];
  const now = options?.refDate || new Date();
  const { dateString } = getKolkataZonedTime(now);

  // F7: Shop codes use a simple per-tenant counter (SHP-0001), not a daily resetting sequence
  const isDailySequence = entityType === 'ORDER' || entityType === 'BILL';
  const entityTypeKey = isDailySequence ? `${entityType}_${dateString}` : entityType;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tenantSequence.findUnique({
      where: {
        tenant_id_entity_type: {
          tenant_id: tenantId,
          entity_type: entityTypeKey,
        },
      },
    });

    if (!existing) {
      const created = await tx.tenantSequence.create({
        data: {
          tenant_id: tenantId,
          entity_type: entityTypeKey,
          current_val: 1,
          prefix: config.prefix,
          padding: config.padding,
        },
      });
      return { val: created.current_val, prefix: created.prefix, padding: created.padding };
    }

    const updated = await tx.tenantSequence.update({
      where: {
        tenant_id_entity_type: {
          tenant_id: tenantId,
          entity_type: entityTypeKey,
        },
      },
      data: {
        current_val: {
          increment: 1,
        },
      },
    });

    return { val: updated.current_val, prefix: updated.prefix, padding: updated.padding };
  });

  const paddedNum = result.val.toString().padStart(result.padding, '0');

  if (isDailySequence) {
    return `${result.prefix}${dateString}-${paddedNum}`;
  }

  // SHOP format: SHP-0001
  return `${result.prefix}${paddedNum}`;
}
