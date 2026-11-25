import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    const messages = await prisma.outboxMessage.findMany({
      where: { tenant_id: tenantId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            owner_name: true,
            phone: true,
            area: { select: { name: true } },
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      shopName: m.shop.name,
      ownerName: m.shop.owner_name,
      recipientPhone: m.recipient_phone,
      areaName: m.shop.area?.name || 'Ratlam',
      campaignName: m.campaign?.name || 'Ad-Hoc Reminder',
      channel: m.channel,
      status: m.status, // QUEUED, SENT, OPENED, ORDERED
      body: m.body,
      createdAt: m.created_at.toISOString(),
      openedAt: m.opened_at ? m.opened_at.toISOString() : null,
      orderedAt: m.ordered_at ? m.ordered_at.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      totalCount: formattedMessages.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch outbox' }, { status: 500 });
  }
}
