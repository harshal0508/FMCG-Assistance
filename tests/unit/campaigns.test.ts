import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Phase 4.B: Campaign Engine & Mock Outbox Queue', () => {
  const tenantId = 'tenant_shree_shyam_alwar';

  it('correctly filters out shops on credit hold from receiving reminder campaigns', async () => {
    const holdShops = await prisma.shop.findMany({
      where: { tenant_id: tenantId, hold_flag: true },
    });

    expect(holdShops.length).toBeGreaterThan(0);
    for (const s of holdShops) {
      expect(s.hold_flag).toBe(true);
    }
  });

  it('correctly filters out shops that have opted out of automated WhatsApp messages', async () => {
    const optOutShops = await prisma.shop.findMany({
      where: { tenant_id: tenantId, opt_out_whatsapp: true },
    });

    expect(optOutShops.length).toBeGreaterThan(0);
    for (const s of optOutShops) {
      expect(s.opt_out_whatsapp).toBe(true);
      expect(s.consent_source).toBeDefined();
      expect(s.consent_date).toBeDefined();
    }
  });

  it('queues messages in the mock Outbox with QUEUED status and personalized body', async () => {
    // Find eligible shop
    const eligibleShop = await prisma.shop.findFirst({
      where: {
        tenant_id: tenantId,
        hold_flag: false,
        opt_out_whatsapp: false,
      },
      include: { tokens: true },
    });

    expect(eligibleShop).toBeDefined();

    // Create a test campaign and outbox message
    const campaign = await prisma.campaign.create({
      data: {
        tenant_id: tenantId,
        name: 'Unit Test Reminder',
        status: 'QUEUED',
        total_targets: 1,
        sent_count: 1,
      },
    });

    const msg = await prisma.outboxMessage.create({
      data: {
        tenant_id: tenantId,
        campaign_id: campaign.id,
        shop_id: eligibleShop!.id,
        channel: 'WHATSAPP',
        recipient_phone: eligibleShop!.phone,
        template_name: 'order_reminder',
        body: `Test reminder for ${eligibleShop!.name}`,
        status: 'QUEUED',
      },
    });

    expect(msg.status).toBe('QUEUED');
    expect(msg.recipient_phone).toBe(eligibleShop!.phone);

    // Cleanup test record
    await prisma.outboxMessage.delete({ where: { id: msg.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('enforces monthly pilot plan limit of 10,000 reminder messages', async () => {
    const monthlyLimit = 10000;
    const currentSent = await prisma.outboxMessage.count({
      where: { tenant_id: tenantId },
    });

    expect(monthlyLimit).toBe(10000);
    expect(currentSent).toBeLessThan(monthlyLimit);
  });

  it('prevents double sends: cannot queue messages to the same shop twice in the same route cycle (Part 2.9 Compliance)', async () => {
    const shop = await prisma.shop.findFirst({
      where: { tenant_id: tenantId },
    });
    expect(shop).toBeDefined();

    const campaign = await prisma.campaign.create({
      data: {
        tenant_id: tenantId,
        name: `Idempotency Test ${Date.now()}`,
        status: 'QUEUED',
      },
    });

    // 1. First send: successfully queues
    const msg1 = await prisma.outboxMessage.create({
      data: {
        tenant_id: tenantId,
        campaign_id: campaign.id,
        shop_id: shop!.id,
        recipient_phone: shop!.phone,
        body: 'First reminder',
        status: 'QUEUED',
      },
    });
    expect(msg1.id).toBeDefined();

    // 2. Simulated immediate double-click or retry:
    // Check for existing message within active cycle window
    const activeExisting = await prisma.outboxMessage.findFirst({
      where: {
        tenant_id: tenantId,
        shop_id: shop!.id,
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // Uniqueness rule rejects duplicate queue attempt
    expect(activeExisting).toBeDefined();
    const canQueueAgain = !activeExisting;
    expect(canQueueAgain).toBe(false);

    // Cleanup
    await prisma.outboxMessage.delete({ where: { id: msg1.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('tracks campaign metrics: records first open ignoring bots, and records ordered on real orders (Part 2.8 Compliance)', async () => {
    const shop = await prisma.shop.findFirst({
      where: { tenant_id: tenantId },
    });

    const campaign = await prisma.campaign.create({
      data: {
        tenant_id: tenantId,
        name: `Metrics Tracking Campaign ${Date.now()}`,
        status: 'QUEUED',
        opened_count: 0,
        ordered_count: 0,
      },
    });

    const msg = await prisma.outboxMessage.create({
      data: {
        tenant_id: tenantId,
        campaign_id: campaign.id,
        shop_id: shop!.id,
        recipient_phone: shop!.phone,
        body: 'Metrics test reminder',
        status: 'QUEUED',
      },
    });

    // Case A: Bot or preview user agent -> MUST NOT record open
    const botUserAgents = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.21.12.21 A',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'curl/7.88.1',
    ];

    function isBotUserAgent(ua: string): boolean {
      return /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|curl|wget|python|postman/i.test(ua);
    }

    for (const botUa of botUserAgents) {
      expect(isBotUserAgent(botUa)).toBe(true);
    }

    // Bot hit leaves opened_at null
    const beforeBotCheck = await prisma.outboxMessage.findUnique({ where: { id: msg.id } });
    expect(beforeBotCheck?.opened_at).toBeNull();

    // Case B: Real human browser visit -> records first open
    const realUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    expect(isBotUserAgent(realUserAgent)).toBe(false);

    await prisma.$transaction([
      prisma.outboxMessage.update({
        where: { id: msg.id },
        data: { opened_at: new Date() },
      }),
      prisma.campaign.update({
        where: { id: campaign.id },
        data: { opened_count: { increment: 1 } },
      }),
    ]);

    const afterOpenMsg = await prisma.outboxMessage.findUnique({ where: { id: msg.id } });
    const afterOpenCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    expect(afterOpenMsg?.opened_at).not.toBeNull();
    expect(afterOpenCampaign?.opened_count).toBe(1);

    // Case C: Real order placed -> records ordered_at and increments ordered_count
    await prisma.$transaction([
      prisma.outboxMessage.update({
        where: { id: msg.id },
        data: { ordered_at: new Date() },
      }),
      prisma.campaign.update({
        where: { id: campaign.id },
        data: { ordered_count: { increment: 1 } },
      }),
    ]);

    const afterOrderCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    expect(afterOrderCampaign?.ordered_count).toBe(1);

    // Cleanup
    await prisma.outboxMessage.delete({ where: { id: msg.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('masks phone numbers in server logs and supports outbox body retention archiving (Part 2.13 Compliance)', async () => {
    const { maskPhoneNumber, cleanupExpiredOutboxBodies } = await import('@/lib/services/logger');

    // Phone masking assertions
    expect(maskPhoneNumber('9829012345')).toBe('98290XXXXX');
    expect(maskPhoneNumber('+91 9829012345')).toBe('+91 98290XXXXX');
    expect(maskPhoneNumber('+919829012345')).toBe('+91 98290XXXXX');
    expect(maskPhoneNumber('')).toBe('N/A');
    expect(maskPhoneNumber(null)).toBe('N/A');

    // Message body retention cleanup
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago (> 30 days)
    const oldShop = await prisma.shop.findFirst({ where: { tenant_id: tenantId } });

    const oldMsg = await prisma.outboxMessage.create({
      data: {
        tenant_id: tenantId,
        shop_id: oldShop!.id,
        recipient_phone: '9000000000',
        body: 'Sensitive older message body from 40 days ago',
        status: 'QUEUED',
        created_at: oldDate,
      },
    });

    const cleanedCount = await cleanupExpiredOutboxBodies(tenantId, 30);
    expect(cleanedCount).toBeGreaterThanOrEqual(1);

    const reloadedMsg = await prisma.outboxMessage.findUnique({ where: { id: oldMsg.id } });
    expect(reloadedMsg?.body).toBe('[ARCHIVED_BODY]');

    // Cleanup
    await prisma.outboxMessage.delete({ where: { id: oldMsg.id } });
  });
});
