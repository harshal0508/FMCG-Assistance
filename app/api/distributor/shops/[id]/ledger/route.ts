import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateServerSession,
  verifyDevicePinAndUnlock,
  isAuthorizedForSensitiveAction,
  SESSION_COOKIE_NAME,
} from '@/lib/services/session';
import { LedgerEntryType, PaymentMethod, MatchStatus } from '@prisma/client';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveDistributorSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shopId } = await params;
    const { tenantId } = session;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        rate_group: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });

    if (!shop || shop.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Retrieve all ledger entries in chronological order
    const rawEntries = await prisma.ledgerEntry.findMany({
      where: {
        tenant_id: tenantId,
        shop_id: shopId,
      },
      orderBy: { created_at: 'asc' },
    });

    // Compute running balance: Positive amount = Debit (due increases), Negative amount = Credit (due decreases)
    let runningBalancePaise = 0;
    let totalDebitsPaise = 0;
    let totalCreditsPaise = 0;

    const entriesWithRunningBalance = rawEntries.map((entry) => {
      runningBalancePaise += entry.amount_paise;
      if (entry.amount_paise > 0) {
        totalDebitsPaise += entry.amount_paise;
      } else {
        totalCreditsPaise += Math.abs(entry.amount_paise);
      }

      return {
        id: entry.id,
        type: entry.type,
        amountPaise: entry.amount_paise,
        runningBalancePaise,
        referenceId: entry.reference_id,
        description: entry.description,
        createdAt: entry.created_at,
      };
    });

    const isOverLimit = runningBalancePaise > shop.credit_limit_paise;

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        shopNumber: shop.shop_number,
        ownerName: shop.owner_name,
        phone: shop.phone,
        address: shop.address,
        creditLimitPaise: shop.credit_limit_paise,
        holdFlag: shop.hold_flag,
        area: shop.area,
        rateGroup: shop.rate_group,
      },
      summary: {
        currentDuePaise: runningBalancePaise,
        creditLimitPaise: shop.credit_limit_paise,
        totalDebitsPaise,
        totalCreditsPaise,
        isOverLimit,
        isHold: shop.hold_flag,
        entriesCount: entriesWithRunningBalance.length,
      },
      entries: entriesWithRunningBalance.reverse(), // Newest on top for ledger UI presentation
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch ledger' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveDistributorSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shopId } = await params;
    const { tenantId, userId, sessionId, deviceId } = session;
    const body = await req.json();
    const { action, pin } = body;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop || shop.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // PIN check helper for financial modifications
    const checkPinAuthorization = async () => {
      if (session.isSensitiveAuthorized) return true;
      if (pin && typeof pin === 'string') {
        const pinCheck = await verifyDevicePinAndUnlock(sessionId, deviceId, pin);
        return pinCheck.success;
      }
      return false;
    };

    if (action === 'OPENING_BALANCE') {
      const authorized = await checkPinAuthorization();
      if (!authorized) {
        return NextResponse.json(
          { error: 'सुरक्षा पिन आवश्यक है।' },
          { status: 403 }
        );
      }

      // Opening balance can only be set once per shop (Item 7 compliance)
      const existingOpening = await prisma.ledgerEntry.findFirst({
        where: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.OPENING_BALANCE,
        },
      });

      if (existingOpening) {
        return NextResponse.json(
          {
            error: 'प्रारंभिक शेष केवल एक बार दर्ज किया जा सकता है। बाद के परिवर्तनों के लिए समायोजन प्रविष्टि करें।',
            code: 'OPENING_BALANCE_ALREADY_EXISTS',
          },
          { status: 400 }
        );
      }

      const { amountPaise, description } = body;
      if (typeof amountPaise !== 'number' || amountPaise === 0) {
        return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
      }

      const entry = await prisma.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.OPENING_BALANCE,
          amount_paise: amountPaise, // positive if previous dues, negative if advance credit
          description: description || 'प्रारंभिक शेष',
        },
      });

      return NextResponse.json({ success: true, entry });
    }

    if (action === 'ADJUSTMENT') {
      const authorized = await checkPinAuthorization();
      if (!authorized) {
        return NextResponse.json(
          { error: 'सुरक्षा पिन आवश्यक है।' },
          { status: 403 }
        );
      }

      const { amountPaise, description } = body;
      if (typeof amountPaise !== 'number' || amountPaise === 0) {
        return NextResponse.json({ error: 'Valid adjustment amount is required' }, { status: 400 });
      }

      const entry = await prisma.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shopId,
          type: LedgerEntryType.ADJUSTMENT,
          amount_paise: amountPaise,
          description: description || 'खाता समायोजन प्रविष्टि',
        },
      });

      return NextResponse.json({ success: true, entry });
    }

    if (action === 'CASH_PAYMENT') {
      const authorized = await checkPinAuthorization();
      if (!authorized) {
        return NextResponse.json(
          { error: 'सुरक्षा पिन आवश्यक है।' },
          { status: 403 }
        );
      }

      const { amountPaise, notes, receiptNumber } = body;
      if (!amountPaise || amountPaise <= 0) {
        return NextResponse.json({ error: 'Valid positive amount required' }, { status: 400 });
      }

      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            tenant_id: tenantId,
            shop_id: shopId,
            amount_paise: amountPaise,
            method: PaymentMethod.CASH,
            match_status: MatchStatus.MATCHED,
            payer_name: shop.owner_name,
            raw_sms: receiptNumber ? `Cash Receipt #${receiptNumber}` : null,
            confirmed_by_user_id: userId,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            tenant_id: tenantId,
            shop_id: shopId,
            type: LedgerEntryType.PAYMENT,
            amount_paise: -amountPaise, // Negative for credit
            reference_id: p.id,
            description: notes
              ? `नकद भुगतान: ${notes}`
              : `नकद भुगतान प्राप्त${receiptNumber ? ` [रसीद #${receiptNumber}]` : ''}`,
          },
        });

        return p;
      });

      return NextResponse.json({ success: true, payment });
    }

    if (action === 'TOGGLE_HOLD') {
      const { holdFlag } = body;
      const updated = await prisma.shop.update({
        where: { id: shopId },
        data: { hold_flag: Boolean(holdFlag) },
      });

      return NextResponse.json({ success: true, holdFlag: updated.hold_flag });
    }

    if (action === 'UPDATE_CREDIT_LIMIT') {
      const { creditLimitPaise } = body;
      if (typeof creditLimitPaise !== 'number' || creditLimitPaise < 0) {
        return NextResponse.json({ error: 'Valid credit limit required' }, { status: 400 });
      }

      const updated = await prisma.shop.update({
        where: { id: shopId },
        data: { credit_limit_paise: creditLimitPaise },
      });

      return NextResponse.json({ success: true, creditLimitPaise: updated.credit_limit_paise });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ledger action failed' }, { status: 500 });
  }
}
