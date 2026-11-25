import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/services/audit';

export const dynamic = 'force-dynamic';

interface ParsedProductRow {
  brandName: string;
  skuName: string;
  hindiName?: string;
  categoryName?: string;
  mrpPaise: number;
  ratePaise: number;
  stockQty: number;
  baseUnit: string;
  orderUnit: string;
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = 'tenant_shree_shyam_alwar';
    const body = await req.json();
    const rows: ParsedProductRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No product rows provided for import' }, { status: 400 });
    }

    const imported = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const row of rows) {
        if (!row.brandName || !row.skuName || typeof row.ratePaise !== 'number') {
          continue;
        }

        // 1. Ensure Brand exists for tenant
        let brand = await tx.brand.findFirst({
          where: {
            tenant_id: tenantId,
            name: { equals: row.brandName.trim(), mode: 'insensitive' },
          },
        });

        if (!brand) {
          brand = await tx.brand.create({
            data: {
              tenant_id: tenantId,
              name: row.brandName.trim(),
            },
          });
        }

        // 2. Check if TenantProduct with this name and brand already exists
        let product = await tx.tenantProduct.findFirst({
          where: {
            tenant_id: tenantId,
            brand_id: brand.id,
            name: { equals: row.skuName.trim(), mode: 'insensitive' },
          },
        });

        if (product) {
          product = await tx.tenantProduct.update({
            where: { id: product.id },
            data: {
              hindi_name: row.hindiName?.trim() || product.hindi_name,
              sub_group: row.categoryName?.trim() || product.sub_group,
              mrp_paise: row.mrpPaise,
              rate_paise: row.ratePaise,
              stock_qty: row.stockQty,
              base_unit: row.baseUnit.trim().toLowerCase(),
              default_order_unit: row.orderUnit.trim().toLowerCase(),
              in_stock_flag: row.stockQty > 0,
            },
          });
        } else {
          product = await tx.tenantProduct.create({
            data: {
              tenant_id: tenantId,
              brand_id: brand.id,
              name: row.skuName.trim(),
              hindi_name: row.hindiName?.trim() || null,
              sub_group: row.categoryName?.trim() || 'General',
              mrp_paise: row.mrpPaise,
              rate_paise: row.ratePaise,
              stock_qty: row.stockQty,
              base_unit: row.baseUnit.trim().toLowerCase(),
              default_order_unit: row.orderUnit.trim().toLowerCase(),
              in_stock_flag: row.stockQty > 0,
            },
          });
        }

        results.push(product);
      }

      return results;
    });

    await logAuditEvent({
      tenantId,
      action: 'PRODUCTS_IMPORTED_CSV',
      targetEntity: 'TenantProduct',
      targetId: `count_${imported.length}`,
      afterState: { importedCount: imported.length },
    });

    return NextResponse.json({ success: true, count: imported.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
