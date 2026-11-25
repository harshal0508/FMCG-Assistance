import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateDistributorRequest } from '@/lib/services/guard';
import { Role } from '@prisma/client';
import { logAuditEvent } from '@/lib/services/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = 'tenant_shree_shyam_alwar';
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        owner_name: true,
        phone: true,
        email: true,
        upi_id: true,
        address: true,
        city: true,
        state: true,
        timezone: true,
        order_cutoff_time: true,
        enable_gst: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenantId = 'tenant_shree_shyam_alwar';
    const body = await req.json();
    const { name, owner_name, phone, upi_id, address, city, state, order_cutoff_time, enable_gst } = body;

    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof name === 'string') updateData.name = name.trim();
    if (typeof owner_name === 'string') {
      updateData.owner_name = owner_name.trim();
      // Keep owner user account in sync
      await prisma.user.updateMany({
        where: {
          memberships: {
            some: { tenant_id: tenantId, role: Role.OWNER },
          },
        },
        data: { name: owner_name.trim() },
      });
    }
    if (typeof phone === 'string') updateData.phone = phone.trim();
    if (typeof upi_id === 'string') updateData.upi_id = upi_id.trim();
    if (typeof address === 'string') updateData.address = address.trim();
    if (typeof city === 'string') updateData.city = city.trim();
    if (typeof state === 'string') updateData.state = state.trim();
    if (typeof order_cutoff_time === 'string') updateData.order_cutoff_time = order_cutoff_time.trim();
    if (typeof enable_gst === 'boolean') updateData.enable_gst = enable_gst;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await logAuditEvent({
      tenantId,
      action: 'TENANT_UPDATED',
      targetEntity: 'Tenant',
      targetId: tenantId,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
