import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';

export const dynamic = 'force-dynamic';

async function resolveTenantId(req: NextRequest) {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const sessionData = await validateServerSession(rawToken);
    if (sessionData && sessionData.user.memberships?.[0]) {
      return sessionData.user.memberships[0].tenant_id;
    }
  }
  if (process.env.NODE_ENV === 'development') {
    const defaultTenant = await prisma.tenant.findFirst({ where: { is_active: true } });
    if (defaultTenant) return defaultTenant.id;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    // Default to last 90 days if not specified
    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 90 * 86400000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date(Date.now() + 86400000);

    // Fetch all active and past schemes
    const schemes = await prisma.scheme.findMany({
      where: { tenant_id: tenantId },
      include: {
        applications: {
          where: {
            created_at: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            order_line: {
              include: {
                order: {
                  include: {
                    shop: {
                      select: { id: true, name: true, shop_number: true, owner_name: true },
                    },
                  },
                },
                tenant_product: { select: { name: true, hindi_name: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const reportRows = schemes.map((s) => {
      const totalUnits = s.applications.reduce((sum, app) => sum + app.units_applied, 0);
      const totalBenefitPaise = s.applications.reduce((sum, app) => sum + app.benefit_paise, 0);

      const uniqueShopsMap = new Map<string, { id: string; name: string; shopNumber: string }>();
      s.applications.forEach((app) => {
        const shop = app.order_line?.order?.shop;
        if (shop) {
          uniqueShopsMap.set(shop.id, {
            id: shop.id,
            name: shop.name,
            shopNumber: shop.shop_number,
          });
        }
      });

      return {
        schemeId: s.id,
        schemeName: s.name,
        schemeType: s.type,
        startDate: s.start_date,
        endDate: s.end_date,
        dateRangeStr: `${s.start_date.toLocaleDateString('en-IN')} to ${s.end_date.toLocaleDateString('en-IN')}`,
        cartonsUnitsSold: totalUnits,
        shopsCount: uniqueShopsMap.size,
        shopsList: Array.from(uniqueShopsMap.values()),
        claimableBenefitPaise: totalBenefitPaise,
        claimableBenefitRupees: (totalBenefitPaise / 100).toFixed(2),
        applicationsCount: s.applications.length,
      };
    });

    // Summary KPI totals
    const totalClaimablePaise = reportRows.reduce((sum, r) => sum + r.claimableBenefitPaise, 0);
    const totalCartonsUnits = reportRows.reduce((sum, r) => sum + r.cartonsUnitsSold, 0);

    if (format === 'csv') {
      const csvHeader = 'Scheme Name,Type,Date Range,Units/Cartons Sold,Participating Shops,Claimable Amount (INR)\n';
      const csvLines = reportRows.map((r) => {
        const cleanName = `"${r.schemeName.replace(/"/g, '""')}"`;
        const range = `"${r.dateRangeStr}"`;
        return `${cleanName},${r.schemeType},${range},${r.cartonsUnitsSold},${r.shopsCount},${r.claimableBenefitRupees}`;
      });

      const csvContent = csvHeader + csvLines.join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Scheme_Claims_Report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      reportRows,
      summary: {
        totalSchemes: schemes.length,
        totalCartonsUnits,
        totalClaimablePaise,
        totalClaimableRupees: (totalClaimablePaise / 100).toFixed(2),
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate scheme claims report' }, { status: 500 });
  }
}
