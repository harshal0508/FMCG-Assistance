import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';

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

    const { routeGroupId, areaIds, templateType = 'order_reminder' } = body;

    // 1. Identify Target Area IDs
    let targetAreaIds: string[] = [];

    if (routeGroupId && routeGroupId !== 'ALL') {
      const groupAreas = await prisma.routeGroupArea.findMany({
        where: { route_group_id: routeGroupId, tenant_id: tenantId },
        select: { area_id: true },
      });
      targetAreaIds = groupAreas.map((ga) => ga.area_id);
    } else if (Array.isArray(areaIds) && areaIds.length > 0) {
      targetAreaIds = areaIds;
    } else {
      // All areas for this tenant
      const allAreas = await prisma.area.findMany({
        where: { tenant_id: tenantId },
        select: { id: true },
      });
      targetAreaIds = allAreas.map((a) => a.id);
    }

    // 2. Fetch all shops in target areas with recent order & token info
    const [shops, tenant] = await Promise.all([
      prisma.shop.findMany({
        where: {
          tenant_id: tenantId,
          area_id: { in: targetAreaIds },
        },
        include: {
          area: true,
          tokens: {
            where: { revoked_at: null, expires_at: { gt: new Date() } },
            take: 1,
          },
          orders: {
            where: {
              status: { not: 'CANCELLED' },
              created_at: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24 hours
              },
            },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
      }),
    ]);

    // 3. Classify Shops into Eligible and Excluded
    const eligibleShops: any[] = [];
    const excludedShops: {
      shopId: string;
      shopName: string;
      ownerName: string;
      phone: string;
      areaName: string;
      reason: 'CREDIT_HOLD' | 'OPTED_OUT' | 'ALREADY_ORDERED' | 'NO_PHONE';
      reasonLabel: string;
      reasonLabelHindi: string;
    }[] = [];

    for (const s of shops) {
      // Rule 1: No phone
      if (!s.phone || !/^\d{10}$/.test(s.phone.replace(/\D/g, '').slice(-10))) {
        excludedShops.push({
          shopId: s.id,
          shopName: s.name,
          ownerName: s.owner_name,
          phone: s.phone || 'N/A',
          areaName: s.area?.name || 'Ratlam',
          reason: 'NO_PHONE',
          reasonLabel: 'No valid phone number on file',
          reasonLabelHindi: 'कोई वैध फोन नंबर दर्ज नहीं है',
        });
        continue;
      }

      // Rule 2: Opted out of WhatsApp marketing
      if (s.opt_out_whatsapp) {
        excludedShops.push({
          shopId: s.id,
          shopName: s.name,
          ownerName: s.owner_name,
          phone: s.phone,
          areaName: s.area?.name || 'Ratlam',
          reason: 'OPTED_OUT',
          reasonLabel: 'Shopkeeper opted out of automated reminders',
          reasonLabelHindi: 'दुकानदार ने संदेश न भेजने का विकल्प चुना है',
        });
        continue;
      }

      // Rule 3: Credit hold
      if (s.hold_flag) {
        excludedShops.push({
          shopId: s.id,
          shopName: s.name,
          ownerName: s.owner_name,
          phone: s.phone,
          areaName: s.area?.name || 'Ratlam',
          reason: 'CREDIT_HOLD',
          reasonLabel: 'Account on strict credit hold due to outstanding dues',
          reasonLabelHindi: 'बकाया राशि के कारण खाता क्रेडिट होल्ड पर है',
        });
        continue;
      }

      // Rule 4: Already ordered in the last 24h
      if (s.orders && s.orders.length > 0) {
        excludedShops.push({
          shopId: s.id,
          shopName: s.name,
          ownerName: s.owner_name,
          phone: s.phone,
          areaName: s.area?.name || 'Ratlam',
          reason: 'ALREADY_ORDERED',
          reasonLabel: 'Shopkeeper already submitted wholesale order for this cycle',
          reasonLabelHindi: 'दुकानदार इस चक्र का ऑर्डर पहले ही दे चुका है',
        });
        continue;
      }

      // Otherwise Eligible
      eligibleShops.push({
        id: s.id,
        name: s.name,
        owner_name: s.owner_name,
        phone: s.phone,
        area_name: s.area?.name || 'Ratlam',
        token: s.tokens[0]?.token_hash || 'demo-token',
      });
    }

    // 4. Construct Sample Personalized Message Preview
    const sampleShop = eligibleShops[0] || shops[0] || {
      name: 'Gupta Kirana Store',
      owner_name: 'Ramesh Gupta',
      phone: '9829100001',
    };

    const distributorName = tenant?.name || 'Demo Traders';
    const cutoffTime = tenant?.order_cutoff_time || '18:00';
    const sampleLink = `https://vitarak.demo/r/vtr_sample_token`;

    const sampleMessageEnglish =
      `नमस्ते ${sampleShop.owner_name || sampleShop.name} ji!\n\n` +
      `This is a quick order reminder from ${distributorName}.\n` +
      `Today's truck delivery dispatch cut-off is ${cutoffTime} IST.\n\n` +
      `Tap your 1-click personal store link to check active wholesale trade schemes and restock:\n` +
      `${sampleLink}\n\n` +
      `- ${distributorName}, Ratlam`;

    const sampleMessageHindi =
      `नमस्ते ${sampleShop.owner_name || sampleShop.name} जी!\n\n` +
      `${distributorName} से साप्ताहिक ऑर्डर स्मरण।\n` +
      `आज का ट्रक डिलीवरी कट-ऑफ शाम ${cutoffTime} बजे तक है।\n\n` +
      `अपनी दुकान का स्टॉक मंगाने एवं चालू व्यापार योजनाओं का लाभ लेने हेतु नीचे दिए लिंक पर टैप करें:\n` +
      `${sampleLink}\n\n` +
      `- ${distributorName}, रतलाम`;

    // 5. Excluded breakdown counters
    const breakdown = {
      CREDIT_HOLD: excludedShops.filter((e) => e.reason === 'CREDIT_HOLD').length,
      OPTED_OUT: excludedShops.filter((e) => e.reason === 'OPTED_OUT').length,
      ALREADY_ORDERED: excludedShops.filter((e) => e.reason === 'ALREADY_ORDERED').length,
      NO_PHONE: excludedShops.filter((e) => e.reason === 'NO_PHONE').length,
    };

    // 6. Plan Message Limits & Remaining Messages (Part 2.10 Compliance)
    const sentThisMonth = await prisma.outboxMessage.count({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });
    const monthlyLimit = 10000;
    const remainingMessages = Math.max(0, monthlyLimit - sentThisMonth);

    return NextResponse.json({
      success: true,
      totalTargets: shops.length,
      eligibleCount: eligibleShops.length,
      excludedCount: excludedShops.length,
      excludedBreakdown: breakdown,
      eligibleShops,
      excludedShops,
      messagePreview: {
        en: sampleMessageEnglish,
        hi: sampleMessageHindi,
      },
      planMessages: {
        monthlyLimit,
        sentThisMonth,
        remainingMessages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate preview' }, { status: 500 });
  }
}
