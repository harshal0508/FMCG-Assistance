import { prisma } from '../db/prisma';

export interface AuditLogInput {
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  targetEntity: string;
  targetId: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
}

/**
 * Audit Logging Service
 * Records an immutable audit log entry for sensitive operational changes.
 */
export async function logAuditEvent(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      tenant_id: input.tenantId,
      actor_user_id: input.actorUserId ?? null,
      action: input.action,
      target_entity: input.targetEntity,
      target_id: input.targetId,
      before_state_json: input.beforeState ? JSON.stringify(input.beforeState) : null,
      after_state_json: input.afterState ? JSON.stringify(input.afterState) : null,
    },
  });
}
