import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { TenantStatus } from '@prisma/client';
import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/services/admin-auth';

export const dynamic = 'force-dynamic';

function getAdminUser(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    return JSON.parse(cookie);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminUser(req);
    // Allow local development inspect or require admin session in production
    if (process.env.NODE_ENV === 'production' && !admin) {
      return NextResponse.json({ error: 'Unauthorized: Admin session required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as TenantStatus | null;

    const tenants = await prisma.tenant.findMany({
      where: status ? { status } : undefined,
      include: {
        gst_verifications: {
          orderBy: { checked_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formatted = tenants.map((t) => {
      const latestGst = t.gst_verifications[0];
      return {
        id: t.id,
        enteredBusinessName: t.name,
        ownerName: t.owner_name,
        city: t.city,
        state: t.state,
        status: t.status,
        gstin: t.gstin,
        gstinStatus: t.gstin_status,
        gstLegalName: latestGst?.legal_name || null,
        gstTradeName: latestGst?.trade_name || null,
        gstinException: t.gstin_exception,
        gstinExceptionReason: t.gstin_exception_reason,
        termsAcceptedAt: t.terms_accepted_at,
        termsVersion: t.terms_version,
        createdAt: t.created_at,
      };
    });

    return NextResponse.json({ tenants: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminUser(req);
    if (process.env.NODE_ENV === 'production' && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tenantId, action, reason } = body; // action: "APPROVE" | "REJECT" | "SUSPEND" | "ACTIVATE"

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'tenantId and action are required' }, { status: 400 });
    }

    let newStatus: TenantStatus;
    switch (action) {
      case 'APPROVE':
      case 'ACTIVATE':
        newStatus = TenantStatus.ACTIVE;
        break;
      case 'REJECT':
        newStatus = TenantStatus.REJECTED;
        break;
      case 'SUSPEND':
        newStatus = TenantStatus.SUSPENDED;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Choose APPROVE, REJECT, or SUSPEND' }, { status: 400 });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: newStatus },
    });

    return NextResponse.json({
      success: true,
      tenantId: updated.id,
      name: updated.name,
      status: updated.status,
      message: `Tenant "${updated.name}" is now ${updated.status}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
