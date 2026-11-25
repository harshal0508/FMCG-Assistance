import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  verifyDevicePinAndUnlock,
  isAuthorizedForSensitiveAction,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';
import { MatchStatus, PaymentMethod, LedgerEntryType, BillEventType } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function resolveDistributorSession(req: NextRequest) {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const sessionData = await validateServerSession(rawToken);
    if (sessionData && sessionData.user.memberships?.[0]) {
      return {
        tenantId: sessionData.user.memberships[0].tenant_id,
        userId: sessionData.user.id,
        sessionId: sessionData.session.id,
        deviceId: sessionData.device.id,
        isSensitiveAuthorized: isAuthorizedForSensitiveAction(sessionData.session),
      };
    }
  }

  // Fallback for development / demo mode if session cookie is not set
  if (process.env.NODE_ENV === 'development') {
    const defaultTenant = await prisma.tenant.findFirst({
      where: { is_active: true },
      include: { users: { include: { user: true } } },
    });
    if (defaultTenant) {
      const ownerUser = defaultTenant.users[0]?.user;
      const device = await prisma.device.findFirst({
        where: { user_id: ownerUser?.id, revoked_at: null },
      });
      return {
        tenantId: defaultTenant.id,
        userId: ownerUser?.id || 'demo_user',
        sessionId: 'demo_session',
        deviceId: device?.id || 'demo_device',
        isSensitiveAuthorized: true,
      };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveDistributorSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = session;

    // Fetch payments
    const payments = await prisma.payment.findMany({
      where: { tenant_id: tenantId },
      include: {
        shop: { select: { id: true, name: true, shop_number: true, owner_name: true } },
        allocations: {
          include: {
            bill: { select: { id: true, bill_number: true, total_paise: true } },
          },
        },
        unmatched: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    // Fetch unpaid or partially paid bills
    const allBills = await prisma.bill.findMany({
      where: { tenant_id: tenantId },
      include: {
        shop: { select: { id: true, name: true, shop_number: true, owner_name: true } },
        order: { select: { id: true, order_number: true, created_at: true } },
        allocations: { select: { amount_paise: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    const pendingBills = allBills
      .map((b) => {
        const paidPaise = b.allocations.reduce((acc, a) => acc + a.amount_paise, 0);
        const remainingPaise = Math.max(0, b.total_paise - paidPaise);
        return {
          id: b.id,
          billNumber: b.bill_number,
          orderNumber: b.order?.order_number || '',
          totalPaise: b.total_paise,
          paidPaise,
          remainingPaise,
          shop: b.shop,
          createdAt: b.created_at,
        };
      })
      .filter((b) => b.remainingPaise > 0);

    // Fetch all active shops for assignment dropdown
    const shops = await prisma.shop.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, shop_number: true, owner_name: true, phone: true },
      orderBy: { name: 'asc' },
    });

    const formattedPayments = payments.map((p) => ({
      id: p.id,
      amountPaise: p.amount_paise,
      method: p.method,
      bankUtr: p.bank_utr,
      payerName: p.payer_name,
      rawSms: p.raw_sms,
      matchStatus: p.match_status,
      paymentDate: p.payment_date,
      createdAt: p.created_at,
      shop: p.shop,
      allocations: p.allocations.map((a) => ({
        id: a.id,
        amountPaise: a.amount_paise,
        billId: a.bill_id,
        billNumber: a.bill.bill_number,
        billTotalPaise: a.bill.total_paise,
      })),
      isUnmatched: p.match_status === MatchStatus.UNMATCHED || !p.shop_id,
    }));

    return NextResponse.json({
      payments: formattedPayments,
      pendingBills,
      shops,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveDistributorSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, userId, deviceId, sessionId } = session;
    const body = await req.json();
    const { action = 'RECORD', pin } = body;

    // PIN Verification requirement for recording and reversing payments
    let isAuthorized = session.isSensitiveAuthorized;
    if (!isAuthorized) {
      if (pin && typeof pin === 'string') {
        const pinCheck = await verifyDevicePinAndUnlock(sessionId, deviceId, pin);
        if (pinCheck.success) {
          isAuthorized = true;
        } else {
          return NextResponse.json(
            { error: pinCheck.error || 'Invalid security PIN' },
            { status: pinCheck.locked ? 423 : 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Security PIN required to record or reverse payments' },
          { status: 403 }
        );
      }
    }

    if (action === 'RECORD') {
      const {
        amountPaise,
        bankUtr,
        payerName,
        rawSms,
        method = 'UPI',
        shopId,
        billAllocations = [], // Array<{ billId: string, amountPaise: number }>
        shortAmountDuePaise = 0, // Option to keep Rs X as due
      } = body;

      if (!amountPaise || amountPaise <= 0) {
        return NextResponse.json({ error: 'Valid amount is required (राशि आवश्यक है)' }, { status: 400 });
      }

      // 1. Reject duplicate UTRs
      if (bankUtr && typeof bankUtr === 'string' && bankUtr.trim()) {
        const cleanUtr = bankUtr.trim();
        const existing = await prisma.payment.findUnique({
          where: {
            tenant_id_bank_utr: {
              tenant_id: tenantId,
              bank_utr: cleanUtr,
            },
          },
        });

        if (existing) {
          return NextResponse.json(
            {
              error: `डुप्लिकेट UTR: यह भुगतान संदर्भ (${cleanUtr}) पहले ही दर्ज किया जा चुका है (Duplicate UTR: Reference ${cleanUtr} already recorded on ${existing.created_at.toLocaleDateString('en-IN')}).`,
            },
            { status: 409 }
          );
        }
      }

      // If no shopId provided, record as UNMATCHED
      if (!shopId) {
        const payment = await prisma.$transaction(async (tx) => {
          const p = await tx.payment.create({
            data: {
              tenant_id: tenantId,
              shop_id: null,
              amount_paise: amountPaise,
              method: method as PaymentMethod,
              bank_utr: bankUtr?.trim() || null,
              payer_name: payerName?.trim() || null,
              raw_sms: rawSms?.trim() || null,
              match_status: MatchStatus.UNMATCHED,
              confirmed_by_user_id: userId,
            },
          });

          await tx.unmatchedPayment.create({
            data: {
              tenant_id: tenantId,
              payment_id: p.id,
              notes: 'Recorded from bank SMS/notification; shop unmatched.',
            },
          });

          return p;
        });

        return NextResponse.json({ success: true, payment, isUnmatched: true });
      }

      // Record MATCHED payment with allocations and ledger entries
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            tenant_id: tenantId,
            shop_id: shopId,
            amount_paise: amountPaise,
            method: method as PaymentMethod,
            bank_utr: bankUtr?.trim() || null,
            payer_name: payerName?.trim() || null,
            raw_sms: rawSms?.trim() || null,
            match_status: MatchStatus.MATCHED,
            confirmed_by_user_id: userId,
          },
        });

        // Create allocations if provided
        if (Array.isArray(billAllocations) && billAllocations.length > 0) {
          for (const alloc of billAllocations) {
            if (alloc.billId && alloc.amountPaise > 0) {
              await tx.paymentAllocation.create({
                data: {
                  tenant_id: tenantId,
                  payment_id: p.id,
                  bill_id: alloc.billId,
                  amount_paise: alloc.amountPaise,
                },
              });

              await tx.billEvent.create({
                data: {
                  tenant_id: tenantId,
                  bill_id: alloc.billId,
                  event_type: BillEventType.PAID,
                  actor_user_id: userId,
                  metadata_json: JSON.stringify({
                    paymentId: p.id,
                    allocatedPaise: alloc.amountPaise,
                    utr: p.bank_utr,
                    method: p.method,
                  }),
                },
              });
            }
          }
        }

        // Add append-only LedgerEntry (Negative amount = credit / payment received)
        await tx.ledgerEntry.create({
          data: {
            tenant_id: tenantId,
            shop_id: shopId,
            type: LedgerEntryType.PAYMENT,
            amount_paise: -amountPaise,
            reference_id: p.id,
            description: `Payment received via ${method}${p.bank_utr ? ` (UTR: ${p.bank_utr})` : ''}`,
          },
        });

        // If short amount due option chosen, record as ROUNDING_DUE in ledger
        if (shortAmountDuePaise && shortAmountDuePaise > 0) {
          await tx.ledgerEntry.create({
            data: {
              tenant_id: tenantId,
              shop_id: shopId,
              type: LedgerEntryType.ROUNDING_DUE,
              amount_paise: shortAmountDuePaise,
              reference_id: p.id,
              description: `Short payment adjustment: ₹${(shortAmountDuePaise / 100).toFixed(2)} kept as customer due`,
            },
          });
        }

        return p;
      });

      return NextResponse.json({ success: true, payment });
    }

    if (action === 'ASSIGN_UNMATCHED') {
      const { paymentId, shopId, billAllocations = [], shortAmountDuePaise = 0 } = body;
      if (!paymentId || !shopId) {
        return NextResponse.json({ error: 'paymentId and shopId are required' }, { status: 400 });
      }

      const existing = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { unmatched: true },
      });

      if (!existing || existing.tenant_id !== tenantId) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // Update payment
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            shop_id: shopId,
            match_status: MatchStatus.MATCHED,
          },
        });

        // Mark unmatched record resolved
        if (existing.unmatched) {
          await tx.unmatchedPayment.update({
            where: { id: existing.unmatched.id },
            data: { resolved_at: new Date() },
          });
        }

        // Add allocations
        if (Array.isArray(billAllocations) && billAllocations.length > 0) {
          for (const alloc of billAllocations) {
            if (alloc.billId && alloc.amountPaise > 0) {
              await tx.paymentAllocation.create({
                data: {
                  tenant_id: tenantId,
                  payment_id: paymentId,
                  bill_id: alloc.billId,
                  amount_paise: alloc.amountPaise,
                },
              });
            }
          }
        }

        // Add LedgerEntry
        await tx.ledgerEntry.create({
          data: {
            tenant_id: tenantId,
            shop_id: shopId,
            type: LedgerEntryType.PAYMENT,
            amount_paise: -existing.amount_paise,
            reference_id: paymentId,
            description: `Unmatched payment assigned (UTR: ${existing.bank_utr || 'N/A'})`,
          },
        });

        if (shortAmountDuePaise > 0) {
          await tx.ledgerEntry.create({
            data: {
              tenant_id: tenantId,
              shop_id: shopId,
              type: LedgerEntryType.ROUNDING_DUE,
              amount_paise: shortAmountDuePaise,
              reference_id: paymentId,
              description: `Short payment balance: ₹${(shortAmountDuePaise / 100).toFixed(2)} kept as due`,
            },
          });
        }
      });

      return NextResponse.json({ success: true, paymentId });
    }

    if (action === 'REVERSE') {
      const { paymentId } = body;
      if (!paymentId) {
        return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
      }

      const existing = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { allocations: true },
      });

      if (!existing || existing.tenant_id !== tenantId) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // Delete allocations
        await tx.paymentAllocation.deleteMany({
          where: { payment_id: paymentId },
        });

        // If it was allocated to a shop, add an ADJUSTMENT entry in the ledger
        if (existing.shop_id) {
          await tx.ledgerEntry.create({
            data: {
              tenant_id: tenantId,
              shop_id: existing.shop_id,
              type: LedgerEntryType.ADJUSTMENT,
              amount_paise: existing.amount_paise, // Positive to reverse the credit
              reference_id: paymentId,
              description: `Reversal of payment (UTR: ${existing.bank_utr || 'N/A'})`,
            },
          });
        }

        // Delete unmatched record if any
        await tx.unmatchedPayment.deleteMany({
          where: { payment_id: paymentId },
        });

        // Delete the payment record
        await tx.payment.delete({
          where: { id: paymentId },
        });
      });

      return NextResponse.json({ success: true, reversedPaymentId: paymentId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment action failed' }, { status: 500 });
  }
}
