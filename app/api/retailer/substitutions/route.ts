import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/services/token';
import { reserveProductStockAtomic, releaseProductStockAtomic } from '@/lib/services/stock';
import { SubstitutionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token =
      req.headers.get('x-shop-token') ||
      req.nextUrl.searchParams.get('token') ||
      body.token;

    if (!token) {
      return NextResponse.json({ error: 'Missing retailer token' }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.shopToken.findUnique({
      where: { token_hash: tokenHash },
      include: { shop: true },
    });

    if (!tokenRecord || (tokenRecord.revoked_at && tokenRecord.revoked_at <= new Date())) {
      return NextResponse.json({ error: 'Invalid or expired retailer token' }, { status: 401 });
    }

    const { substitutionId, action } = body;
    if (!substitutionId || !action) {
      return NextResponse.json({ error: 'substitutionId and action (ACCEPT/REJECT) are required' }, { status: 400 });
    }

    const sub = await prisma.substitution.findUnique({
      where: { id: substitutionId },
      include: {
        order: true,
        order_line: true,
      },
    });

    if (!sub || sub.order.shop_id !== tokenRecord.shop_id) {
      return NextResponse.json({ error: 'Substitution not found or unauthorized' }, { status: 404 });
    }

    if (action === 'ACCEPT') {
      await prisma.$transaction(async (tx) => {
        await tx.substitution.update({
          where: { id: substitutionId },
          data: { shop_reply: SubstitutionStatus.ACCEPTED },
        });

        // 1. Fetch suggested product wholesale price
        const suggestedProd = await tx.tenantProduct.findUnique({
          where: { id: sub.suggested_product_id },
          include: { master_product: true },
        });
        const newRate = suggestedProd?.rate_paise || suggestedProd?.master_product?.mrp_paise || sub.order_line.price_paise_snapshot;

        // 2. Update the order line to the suggested product and its new price snapshot
        await tx.orderLine.update({
          where: { id: sub.order_line_id },
          data: {
            tenant_product_id: sub.suggested_product_id,
            price_paise_snapshot: newRate,
          },
        });

        // 3. Recalculate the entire order total authoritatively
        const allLines = await tx.orderLine.findMany({
          where: { order_id: sub.order_id },
        });
        const newOrderTotal = allLines.reduce(
          (acc, l) => acc + Math.round((l.id === sub.order_line_id ? newRate : l.price_paise_snapshot) * l.display_quantity),
          0
        );

        await tx.order.update({
          where: { id: sub.order_id },
          data: { total_paise: newOrderTotal },
        });

        // 4. Strict Substitution after Billing Logic (Rule 7 Compliance)
        // Find if a bill already exists for this order
        const existingBill = await tx.bill.findFirst({
          where: { order_id: sub.order_id },
          include: { allocations: true },
          orderBy: { version: 'desc' },
        });

        if (existingBill) {
          const paidAmountPaise = existingBill.allocations.reduce((sum, a) => sum + a.amount_paise, 0);

          if (paidAmountPaise > 0) {
            // Case C: Bill is PAID or PARTIALLY_PAID. NEVER alter a paid bill!
            // The original bill stays immutable. Issue an append-only ledger adjustment entry.
            const diffPaise = newOrderTotal - existingBill.total_paise;
            if (diffPaise !== 0) {
              await tx.ledgerEntry.create({
                data: {
                  tenant_id: sub.tenant_id,
                  shop_id: sub.order.shop_id,
                  type: diffPaise > 0 ? 'ADJUSTMENT' : 'CREDIT_NOTE',
                  amount_paise: diffPaise, // positive = debit to retailer, negative = credit to retailer
                  reference_id: existingBill.id,
                  description: diffPaise > 0
                    ? `Ledger Debit Adjustment for Substitution on Order #${sub.order.order_number}`
                    : `Ledger Credit Note for Substitution on Order #${sub.order.order_number}`,
                },
              });
            }
          } else {
            // Case B: Bill exists and is UNPAID. Never silently change the bill!
            // Keep the original version intact and create a new bill version with updated QR amount.
            const newVersion = existingBill.version + 1;
            const baseBillNumber = existingBill.bill_number.replace(/-v\d+$/, '');
            const newBillNumber = `${baseBillNumber}-v${newVersion}`;
            const newUpiRef = `tr_${Date.now()}_v${newVersion}`;

            const tenant = await tx.tenant.findUnique({
              where: { id: sub.tenant_id },
            });
            const upiId = tenant?.upi_id || 'demo@invalid';
            const tenantName = tenant?.name || 'Demo Traders';
            const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(tenantName)}&am=${(newOrderTotal / 100).toFixed(2)}&cu=INR&tn=Bill%20${encodeURIComponent(newBillNumber)}&tr=${newUpiRef}`;

            // Mark old bill event as superseded
            await tx.billEvent.create({
              data: {
                tenant_id: sub.tenant_id,
                bill_id: existingBill.id,
                event_type: 'CANCELLED',
                metadata_json: JSON.stringify({
                  reason: 'SUBSTITUTION_VERSIONED',
                  superseded_by_version: newVersion,
                  new_bill_number: newBillNumber,
                }),
              },
            });

            // Create new bill version with updated amount and new QR string
            const newBill = await tx.bill.create({
              data: {
                tenant_id: sub.tenant_id,
                shop_id: sub.order.shop_id,
                order_id: sub.order_id,
                bill_number: newBillNumber,
                version: newVersion,
                total_paise: newOrderTotal,
                upi_reference: newUpiRef,
                upi_string: upiString,
              },
            });

            await tx.billEvent.create({
              data: {
                tenant_id: sub.tenant_id,
                bill_id: newBill.id,
                event_type: 'CREATED',
                metadata_json: JSON.stringify({
                  version: newVersion,
                  previous_bill_id: existingBill.id,
                }),
              },
            });
          }
        }
        // Case A: Before billing (no bill exists) -> only order is updated; no bill to mutate.
      });

      // Atomically reserve the suggested product stock
      await reserveProductStockAtomic(
        sub.suggested_product_id,
        sub.requested_qty_base
      );

      return NextResponse.json({ success: true, status: 'ACCEPTED' });
    } else if (action === 'REJECT') {
      await prisma.substitution.update({
        where: { id: substitutionId },
        data: { shop_reply: SubstitutionStatus.REJECTED },
      });

      // Release any stock if previously reserved
      await releaseProductStockAtomic(
        sub.original_product_id,
        sub.requested_qty_base
      );

      return NextResponse.json({ success: true, status: 'REJECTED' });
    }

    return NextResponse.json({ error: 'Invalid action. Must be ACCEPT or REJECT' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
