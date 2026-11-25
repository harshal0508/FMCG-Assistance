/**
 * Distributor Server-Side Route Guard & Policy Enforcement
 * 
 * Enforces:
 * 1. Stateful server session validation (never trusting client cookies without DB confirmation).
 * 2. Tenant Status Policy: PENDING tenants are strictly blocked from reading or writing business data (HTTP 403).
 * 3. Server-Enforced Idle Lock: Reject requests if session unlocked_until is past 15 min (HTTP 423).
 * 4. Sensitive Action Window: Enforces fresh PIN entry within the last 5 minutes for rates, holds, exports, staff (HTTP 403).
 * 5. Role-Based Access Control (RBAC): OWNER, ORDER_TAKER, PACKER.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Role, TenantStatus } from '@prisma/client';
import {
  SESSION_COOKIE_NAME,
  validateServerSession,
  isAuthorizedForSensitiveAction,
} from './session';

export interface GuardOptions {
  requiredRole?: Role | Role[];
  sensitiveAction?: boolean;
  allowPending?: boolean; // Only for onboarding / status check endpoints
}

export interface GuardResult {
  authorized: boolean;
  response?: NextResponse;
  sessionData?: Awaited<ReturnType<typeof validateServerSession>>;
  userId?: string;
  tenantId?: string;
  role?: Role;
}

export async function authenticateDistributorRequest(
  req: NextRequest,
  options: GuardOptions = {}
): Promise<GuardResult> {
  // 1. Extract session token from cookie
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Support backward-compatible test mocking in unit tests if no cookie present
  if (!rawToken) {
    const authHeader = req.headers.get('x-test-role');
    if (authHeader && process.env.NODE_ENV === 'test') {
      const mockRole = authHeader as Role;
      if (options.requiredRole) {
        const allowed = Array.isArray(options.requiredRole)
          ? options.requiredRole.includes(mockRole)
          : mockRole === options.requiredRole;
        if (!allowed) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: `ACCESS DENIED: Role ${mockRole} unauthorized.` },
              { status: 403 }
            ),
          };
        }
      }
      return {
        authorized: true,
        userId: 'test_user_id',
        tenantId: 'tenant_shree_shyam_alwar',
        role: mockRole,
      };
    }

    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Session missing or expired. Please sign in.' },
        { status: 401 }
      ),
    };
  }

  // 2. Database validation of stateful session
  const sessionData = await validateServerSession(rawToken);
  if (!sessionData) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Session expired or revoked. Please sign in again.' },
        { status: 401 }
      ),
    };
  }

  const membership = sessionData.user.memberships[0];
  if (!membership || !membership.tenant) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'No active distributor tenancy found for this account.' },
        { status: 403 }
      ),
    };
  }

  const tenant = membership.tenant;

  // 3. PENDING / SUSPENDED Tenant Enforcement (Carry-over G)
  if (!options.allowPending && tenant.status !== TenantStatus.ACTIVE) {
    if (tenant.status === TenantStatus.PENDING) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Distributor registration is pending platform approval. Business data access is locked until verified by administrators.',
            status: TenantStatus.PENDING,
            pendingApproval: true,
          },
          { status: 403 }
        ),
      };
    }

    if (tenant.status === TenantStatus.SUSPENDED) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Distributor account has been suspended by platform administrators. Operations are restricted.',
            status: TenantStatus.SUSPENDED,
            suspended: true,
          },
          { status: 403 }
        ),
      };
    }
  }

  // 4. Server-Enforced Idle Lock (Carry-over F)
  // If session is locked or idle period (15 min) has elapsed, require PIN unlock
  const now = new Date();
  const isLocked = !sessionData.session.unlocked_until || sessionData.session.unlocked_until < now;
  if (isLocked) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Session is idle locked. Enter your 6-digit PIN to continue.',
          isLocked: true,
        },
        { status: 423 } // 423 Locked
      ),
    };
  }

  // 5. Server-Enforced Sensitive Action Window (Carry-over F)
  // Sensitive actions (wholesale PTR, credit hold, staff invite, device revoke, CSV export) require PIN entered in last 5 min
  if (options.sensitiveAction) {
    const isSensitiveAllowed = isAuthorizedForSensitiveAction(sessionData.session);
    if (!isSensitiveAllowed) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Sensitive action requires security verification. Please enter your PIN (last verified over 5 minutes ago).',
            requiresPinVerification: true,
          },
          { status: 403 }
        ),
      };
    }
  }

  // 6. Role-Based Access Control
  if (options.requiredRole) {
    const allowed = Array.isArray(options.requiredRole)
      ? options.requiredRole.includes(membership.role)
      : membership.role === options.requiredRole;

    if (!allowed) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: `ACCESS DENIED: Role ${membership.role} is not permitted to perform this action.` },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true,
    sessionData,
    userId: sessionData.user.id,
    tenantId: tenant.id,
    role: membership.role,
  };
}
