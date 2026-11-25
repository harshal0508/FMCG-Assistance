import { prisma } from '../db/prisma';
import { formatPaise } from '../money';

export type ExportableTable = 'shops' | 'products' | 'orders' | 'bills' | 'payments' | 'ledger';

/**
 * Escapes values for safe CSV formatting
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates CSV string for any key business table scoped by tenant
 */
export async function generateTableCsv(
  tenantId: string,
  table: ExportableTable
): Promise<{ filename: string; csv: string }> {
  const timestamp = new Date().toISOString().split('T')[0];

  switch (table) {
    case 'shops': {
      const rows = await prisma.shop.findMany({
        where: { tenant_id: tenantId },
        include: { area: true },
        orderBy: { shop_number: 'asc' },
      });
      const headers = ['Shop Number', 'Shop Name', 'Owner Name', 'Phone', 'Area', 'Credit Limit (INR)', 'On Hold', 'Status'];
      const data = rows.map((s) => [
        s.shop_number,
        s.name,
        s.owner_name,
        s.phone,
        s.area?.name ?? '',
        (s.credit_limit_paise / 100).toFixed(2),
        s.hold_flag ? 'YES' : 'NO',
        s.status,
      ]);
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `shops_${timestamp}.csv`, csv };
    }

    case 'products': {
      const rows = await prisma.tenantProduct.findMany({
        where: { tenant_id: tenantId },
        include: { brand: true, master_product: { include: { category: true } } },
      });
      const headers = ['Brand', 'SKU Name', 'Hindi Name', 'Category', 'MRP (INR)', 'PTR Rate (INR)', 'Stock (Base Unit)', 'Base Unit', 'Order Unit', 'In Stock'];
      const data = rows.map((p) => [
        p.brand?.name ?? '',
        p.name || p.master_product?.name || '',
        p.hindi_name || p.master_product?.hindi_name || '',
        p.master_product?.category.name ?? p.sub_group ?? '',
        ((p.mrp_paise || p.master_product?.mrp_paise || p.rate_paise) / 100).toFixed(2),
        (p.rate_paise / 100).toFixed(2),
        p.stock_qty,
        p.base_unit || p.master_product?.base_unit || 'unit',
        p.default_order_unit || p.master_product?.default_order_unit || 'unit',
        p.in_stock_flag ? 'YES' : 'NO',
      ]);
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `products_${timestamp}.csv`, csv };
    }

    case 'orders': {
      const rows = await prisma.order.findMany({
        where: { tenant_id: tenantId },
        include: { shop: true },
        orderBy: { created_at: 'desc' },
      });
      const headers = ['Order #', 'Date', 'Shop Name', 'Owner', 'Source', 'Total (INR)', 'Status'];
      const data = rows.map((o) => [
        o.order_number,
        new Date(o.created_at).toISOString().split('T')[0],
        o.shop.name,
        o.shop.owner_name,
        o.source,
        (o.total_paise / 100).toFixed(2),
        o.status,
      ]);
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `orders_${timestamp}.csv`, csv };
    }

    case 'bills': {
      const rows = await prisma.bill.findMany({
        where: { tenant_id: tenantId },
        include: { shop: true, allocations: true },
        orderBy: { created_at: 'desc' },
      });
      const headers = ['Bill #', 'Date', 'Shop Name', 'Total (INR)', 'Paid (INR)', 'UPI Ref', 'Status'];
      const data = rows.map((b) => {
        const paid = b.allocations.reduce((sum, a) => sum + a.amount_paise, 0);
        const status = paid >= b.total_paise ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
        return [
          b.bill_number,
          new Date(b.created_at).toISOString().split('T')[0],
          b.shop.name,
          (b.total_paise / 100).toFixed(2),
          (paid / 100).toFixed(2),
          b.upi_reference,
          status,
        ];
      });
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `bills_${timestamp}.csv`, csv };
    }

    case 'payments': {
      const rows = await prisma.payment.findMany({
        where: { tenant_id: tenantId },
        include: { shop: true },
        orderBy: { payment_date: 'desc' },
      });
      const headers = ['Payment Date', 'Shop Name', 'Amount (INR)', 'Method', 'Bank UTR', 'Payer Name', 'Match Status'];
      const data = rows.map((p) => [
        new Date(p.payment_date).toISOString().split('T')[0],
        p.shop?.name ?? 'Unmatched',
        (p.amount_paise / 100).toFixed(2),
        p.method,
        p.bank_utr ?? '',
        p.payer_name ?? '',
        p.match_status,
      ]);
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `payments_${timestamp}.csv`, csv };
    }

    case 'ledger': {
      const rows = await prisma.ledgerEntry.findMany({
        where: { tenant_id: tenantId },
        include: { shop: true },
        orderBy: { created_at: 'desc' },
      });
      const headers = ['Date', 'Shop Name', 'Type', 'Amount (INR)', 'Description'];
      const data = rows.map((l) => [
        new Date(l.created_at).toISOString().split('T')[0],
        l.shop.name,
        l.type,
        (l.amount_paise / 100).toFixed(2),
        l.description,
      ]);
      const csv = [headers.join(','), ...data.map((r) => r.map(escapeCsv).join(','))].join('\n');
      return { filename: `ledger_${timestamp}.csv`, csv };
    }
  }
}
