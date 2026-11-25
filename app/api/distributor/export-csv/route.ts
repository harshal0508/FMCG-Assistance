import { NextRequest, NextResponse } from 'next/server';
import { generateTableCsv, ExportableTable } from '@/lib/services/export-csv';
import { authenticateDistributorRequest } from '@/lib/services/guard';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Enforce server-side session, 5-minute sensitive action PIN window, and OWNER role
  const guard = await authenticateDistributorRequest(req, {
    sensitiveAction: true,
    requiredRole: Role.OWNER,
  });

  if (!guard.authorized) {
    return guard.response!;
  }

  const { searchParams } = new URL(req.url);
  const table = (searchParams.get('table') as ExportableTable) || 'orders';
  const tenantId = guard.tenantId || 'tenant_shree_shyam_alwar';

  const validTables: ExportableTable[] = ['shops', 'products', 'orders', 'bills', 'payments', 'ledger'];
  if (!validTables.includes(table)) {
    return NextResponse.json({ error: `Invalid table name. Options: ${validTables.join(', ')}` }, { status: 400 });
  }

  try {
    const { filename, csv } = await generateTableCsv(tenantId, table);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
