/**
 * Entitlement & Feature Limit Service (F5 Compliance)
 * 
 * Enforces usage limits and feature flags from a single central place.
 * Configurable via environment variables with safe defaults.
 * Single-owner model enforces 1 Owner seat with configurable device and product limits.
 */

export type EntitlementFeature =
  | 'products'
  | 'active_shops'
  | 'orders'
  | 'whatsapp_messages'
  | 'ai_calls'
  | 'ai_parses'
  | 'devices'
  | 'staff_users'
  | 'advanced_analytics'
  | 'pdf_import';

export interface PlanLimits {
  name: string;
  isPilot: boolean;
  maxProducts: number;
  maxActiveShops: number;
  maxOrdersPerMonth: number;
  maxWhatsappMessages: number;
  maxAiCalls: number;
  maxAiParses: number;
  maxDevices: number;
  maxStaffUsers: number;
  flags: Record<string, boolean>;
}

export function getPlanLimits(): PlanLimits {
  return {
    name: process.env.PLAN_NAME || 'Pilot Free',
    isPilot: true,
    // Pilot plan limits (Item 2 compliance): 5,000 products, 500 shops, 10,000 orders/month, 3 devices
    maxProducts: Number(process.env.PLAN_MAX_PRODUCTS || 5000),
    maxActiveShops: Number(process.env.PLAN_MAX_ACTIVE_SHOPS || 500),
    maxOrdersPerMonth: Number(process.env.PLAN_MAX_ORDERS_PER_MONTH || 10000),
    maxWhatsappMessages: Number(process.env.PLAN_MAX_WHATSAPP_MSGS || 10000),
    maxAiCalls: Number(process.env.PLAN_MAX_AI_CALLS || 500),
    maxAiParses: Number(process.env.PLAN_MAX_AI_PARSES || 2000),
    maxDevices: Number(process.env.PLAN_MAX_DEVICES || 3),
    maxStaffUsers: 1, // Single-owner model
    flags: {
      advanced_analytics: process.env.FLAG_ADVANCED_ANALYTICS !== 'false',
      pdf_import: process.env.FLAG_PDF_IMPORT !== 'false',
      voice_ordering: process.env.FLAG_VOICE_ORDERING !== 'false',
      photo_ordering: process.env.FLAG_PHOTO_ORDERING !== 'false',
      campaign_broadcasts: process.env.FLAG_CAMPAIGN_BROADCASTS !== 'false',
    },
  };
}

export const PILOT_PLAN: PlanLimits = getPlanLimits();

export interface UsageState {
  productsCount?: number;
  activeShopsCount: number;
  ordersCount?: number;
  whatsappSentCount: number;
  aiCallsCount: number;
  aiParsesCount: number;
  devicesCount?: number;
  staffUsersCount: number;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  feature: EntitlementFeature;
  currentUsage: number;
  limit: number;
  remaining: number;
  reason?: string;
}

/**
 * Evaluates whether a requested action/amount is allowed within plan limits.
 */
export function evaluateEntitlement(
  feature: EntitlementFeature,
  currentUsage: UsageState,
  plan: PlanLimits = getPlanLimits(),
  requestedAmount = 1
): EntitlementCheckResult {
  if (plan.flags[feature] === false) {
    return {
      allowed: false,
      feature,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      reason: `Feature "${feature}" is disabled on plan "${plan.name}"`,
    };
  }

  let limit = Infinity;
  let current = 0;

  switch (feature) {
    case 'products':
      limit = plan.maxProducts;
      current = currentUsage.productsCount || 0;
      break;
    case 'active_shops':
      limit = plan.maxActiveShops;
      current = currentUsage.activeShopsCount;
      break;
    case 'orders':
      limit = plan.maxOrdersPerMonth;
      current = currentUsage.ordersCount || 0;
      break;
    case 'whatsapp_messages':
      limit = plan.maxWhatsappMessages;
      current = currentUsage.whatsappSentCount;
      break;
    case 'ai_calls':
      limit = plan.maxAiCalls;
      current = currentUsage.aiCallsCount;
      break;
    case 'ai_parses':
      limit = plan.maxAiParses;
      current = currentUsage.aiParsesCount;
      break;
    case 'devices':
      limit = plan.maxDevices;
      current = currentUsage.devicesCount || 0;
      break;
    case 'staff_users':
      limit = plan.maxStaffUsers;
      current = currentUsage.staffUsersCount;
      break;
    case 'advanced_analytics':
    case 'pdf_import':
      return {
        allowed: plan.flags[feature] ?? true,
        feature,
        currentUsage: 0,
        limit: 1,
        remaining: 1,
      };
  }

  const remaining = Math.max(0, limit - current);
  const allowed = current + requestedAmount <= limit;

  return {
    allowed,
    feature,
    currentUsage: current,
    limit,
    remaining,
    reason: allowed
      ? undefined
      : `Limit exceeded for ${feature}. Current: ${current}, Requested: ${requestedAmount}, Limit: ${limit}`,
  };
}
