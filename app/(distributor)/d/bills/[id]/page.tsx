import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import BillView, { BillData } from '@/components/distributor/bill-view';

export const dynamic = 'force-dynamic';

interface Props {
  params: {
    id: string;
  };
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = params;

  // Find bill by bill id, bill number, or order id
  const billRecord = await prisma.bill.findFirst({
    where: {
      OR: [{ id }, { bill_number: id }, { order_id: id }],
    },
    include: {
      tenant: true,
      shop: {
        include: {
          area: true,
        },
      },
      order: {
        include: {
          lines: {
            include: {
              tenant_product: {
                include: {
                  master_product: true,
                },
              },
            },
          },
        },
      },
      allocations: true,
    },
    orderBy: { version: 'desc' },
  });

  if (!billRecord) {
    notFound();
  }

  const paidAmountPaise = billRecord.allocations.reduce((sum, a) => sum + a.amount_paise, 0);

  let status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
  if (paidAmountPaise >= billRecord.total_paise) {
    status = 'PAID';
  } else if (paidAmountPaise > 0) {
    status = 'PARTIALLY_PAID';
  }

  const formatted: BillData = {
    id: billRecord.id,
    billNumber: billRecord.bill_number,
    version: billRecord.version,
    orderNumber: billRecord.order.order_number,
    createdAt: billRecord.created_at.toISOString(),
    status,
    totalPaise: billRecord.total_paise,
    paidAmountPaise,
    upiReference: billRecord.upi_reference,
    upiString: billRecord.upi_string,
    tenant: {
      name: billRecord.tenant.name,
      ownerName: billRecord.tenant.owner_name,
      phone: billRecord.tenant.phone || '9829012345',
      address: billRecord.tenant.address || 'Station Road, Ratlam, MP',
      gstin: billRecord.tenant.gstin,
      enableGst: billRecord.tenant.enable_gst,
      upiId: billRecord.tenant.upi_id || 'demo@invalid',
    },
    shop: {
      name: billRecord.shop.name,
      ownerName: billRecord.shop.owner_name,
      shopNumber: billRecord.shop.shop_number,
      phone: billRecord.shop.phone,
      address: billRecord.shop.address,
      areaName: billRecord.shop.area?.name || 'Ratlam',
    },
    lines: billRecord.order.lines.map((l) => ({
      id: l.id,
      name: l.tenant_product.name || l.tenant_product.master_product?.name || 'Item',
      hindiName: l.tenant_product.hindi_name || l.tenant_product.master_product?.hindi_name,
      unit: l.order_unit_name,
      quantity: l.display_quantity,
      ratePaise: l.price_paise_snapshot,
      totalPaise: l.price_paise_snapshot * l.display_quantity,
    })),
  };

  return <BillView bill={formatted} />;
}
