import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';
import { logSecure } from '@/lib/services/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
    const body = await req.json();

    const {
      name,
      routeGroupId,
      eligibleShopIds,
      scheduleFollowUp = false,
      followUpHoursBeforeCutoff = 2,
    } = body;

    if (!Array.isArray(eligibleShopIds) || eligibleShopIds.length === 0) {
      return NextResponse.json(
        { error: 'No eligible recipients selected for this campaign' },
        { status: 400 }
      );
    }

    const [tenant, shops] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.shop.findMany({
        where: {
          id: { in: eligibleShopIds },
          tenant_id: tenantId,
        },
        include: {
          tokens: {
            where: { revoked_at: null, expires_at: { gt: new Date() } },
            take: 1,
          },
        },
      }),
    ]);

    const campaignName =
      name?.trim() ||
      `Order Reminder - ${new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })}`;

    const distributorName = tenant?.name || 'Demo Traders';
    const cutoffTime = tenant?.order_cutoff_time || '18:00';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Atomic creation of Campaign and Outbox Messages with Double-Send Prevention
    const result = await prisma.$transaction(async (tx) => {
      // 1. Prevent Double Sends (Part 2.9 Compliance)
      // Check for messages already queued for these shops in this active route cycle (last 24 hours)
      const existingActiveMessages = await tx.outboxMessage.findMany({
        where: {
          tenant_id: tenantId,
          shop_id: { in: eligibleShopIds },
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...(routeGroupId && routeGroupId !== 'ALL'
            ? { campaign: { route_group_id: routeGroupId } }
            : {}),
        },
        select: { shop_id: true },
      });

      const alreadySentShopIds = new Set(existingActiveMessages.map((m) => m.shop_id));
      const deduplicatedShops = shops.filter((s) => !alreadySentShopIds.has(s.id));

      if (deduplicatedShops.length === 0) {
        throw new Error('All selected shops have already been queued for a reminder in this route cycle.');
      }

      // 2. Check Plan Message Allowance (Part 2.10 Compliance: 10,000 monthly messages limit)
      const sentThisMonth = await tx.outboxMessage.count({
        where: {
          tenant_id: tenantId,
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });

      const monthlyLimit = 10000;
      if (sentThisMonth + deduplicatedShops.length > monthlyLimit) {
        throw new Error(`Monthly message allowance exceeded (${sentThisMonth}/${monthlyLimit}). Upgrade or contact support.`);
      }

      const campaign = await tx.campaign.create({
        data: {
          tenant_id: tenantId,
          name: campaignName,
          route_group_id: routeGroupId && routeGroupId !== 'ALL' ? routeGroupId : null,
          status: 'QUEUED',
          total_targets: deduplicatedShops.length,
          sent_count: deduplicatedShops.length,
          opened_count: 0,
          ordered_count: 0,
        },
      });

      // Prepare batch message records with personalized private token storefront link
      const messagesData = deduplicatedShops.map((s) => {
        const rawToken = s.tokens[0]?.token_hash ? 'vtr_' + s.tokens[0].token_hash.slice(0, 32) : 'vtr_demo';
        const portalLink = `${appUrl}/r/${rawToken}`;

        const bodyText =
          `नमस्ते ${s.owner_name || s.name} जी!\n\n` +
          `${distributorName} से साप्ताहिक ऑर्डर स्मरण।\n` +
          `आज का डिलीवरी कट-ऑफ शाम ${cutoffTime} बजे तक है।\n\n` +
          `अपनी दुकान का स्टॉक मंगाने एवं चालू व्यापार योजनाओं का लाभ लेने हेतु नीचे दिए लिंक पर टैप करें:\n` +
          `${portalLink}\n\n` +
          `- ${distributorName}, रतलाम`;

        return {
          tenant_id: tenantId,
          campaign_id: campaign.id,
          shop_id: s.id,
          channel: 'WHATSAPP',
          recipient_phone: s.phone,
          template_name: 'order_reminder',
          body: bodyText,
          status: 'QUEUED' as const,
        };
      });

      // Batch insert into messages (mock outbox queue)
      await tx.outboxMessage.createMany({
        data: messagesData,
      });

      return { campaign, queuedCount: deduplicatedShops.length };
    });

    logSecure('info', 'Campaign queued successfully', {
      campaignId: result.campaign.id,
      queuedCount: result.queuedCount,
    });

    return NextResponse.json({
      success: true,
      campaignId: result.campaign.id,
      queuedCount: result.queuedCount,
      // Exact prompt required phrasing: "queued in test outbox"
      message: `${result.queuedCount} reminders successfully queued in test outbox (परीक्षण आउटबॉक्स में ${result.queuedCount} संदेश कतारबद्ध किए गए).`,
      outboxStatus: 'QUEUED_IN_TEST_OUTBOX',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to dispatch campaign' }, { status: 400 });
  }
}
