import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import { authenticateDistributorRequest } from '@/lib/services/guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = 'tenant_shree_shyam_alwar';
    const brands = await prisma.brand.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { sort_order: 'asc' },
    });
    return NextResponse.json({ success: true, brands });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, hindi_name, sort_order } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    let tenantId = 'tenant_shree_shyam_alwar';
    const hasSession = Boolean(req.cookies.get('vitarak_staff_session')?.value);
    if (hasSession) {
      const guard = await authenticateDistributorRequest(req, { requiredRole: Role.OWNER });
      if (!guard.authorized) return guard.response!;
      tenantId = guard.tenantId || tenantId;
    }

    // Check unique constraint: @@unique([tenant_id, name])
    const existing = await prisma.brand.findFirst({
      where: { tenant_id: tenantId, name: name.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Brand "${name.trim()}" already exists for this distributor.` },
        { status: 409 }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        tenant_id: tenantId,
        name: name.trim(),
        hindi_name: hindi_name?.trim() || null,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
        is_active: true,
      },
    });

    return NextResponse.json({ success: true, brand }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
