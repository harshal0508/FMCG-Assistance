import { PrismaClient, Role, ShopStatus, OrderSource, OrderStatus, BillEventType, PaymentMethod, MatchStatus, LedgerEntryType, StockMovementReason, SchemeType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateShopToken } from '../lib/services/token';
import { STANDARD_UNIT_CHAINS } from '../lib/units';
import { assertLocalDatabase } from '../lib/db/db-guard';
import { setDevicePin } from '../lib/services/session';

const prisma = new PrismaClient();

async function main() {
  assertLocalDatabase('Database Seed');
  console.log('--- Starting Comprehensive Seed Data Insertion (Local DB Verified) ---');

  const tenantId = 'tenant_shree_shyam_alwar';

  // 0. Idempotency & Clean Reset: Wipe all leftover non-demo tenants, users, devices, and sessions (F1 requirement)
  console.log(`[Seed Idempotency] Wiping existing data for ${tenantId} and clearing leftover test users/devices...`);
  await prisma.session.deleteMany({});
  await prisma.passkeyCredential.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({ where: { id: { not: tenantId } } });

  await prisma.orderEvent.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orderLine.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.order.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.paymentAllocation.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.payment.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.unmatchedPayment.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.billEvent.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.bill.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.ledgerEntry.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.stockMovement.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.schemeApplication.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.schemeProduct.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.scheme.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.rateOverride.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.rateGroup.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.shopToken.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.shopPayerName.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.shop.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.routeSchedule.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.routeGroupArea.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.routeGroup.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.area.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.tenantProduct.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.brand.deleteMany({ where: { tenant_id: tenantId } });
  const demoCatIds = (await prisma.category.findMany({ where: { tenant_id: tenantId }, select: { id: true } })).map(c => c.id);
  if (demoCatIds.length > 0) {
    await prisma.masterProduct.deleteMany({ where: { category_id: { in: demoCatIds } } });
  }
  await prisma.category.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.tenantSequence.deleteMany({ where: { tenant_id: tenantId } });
  console.log(`✓ [Seed Idempotency] Cleared prior demo records and leftover accounts`);

  // 1. Create Demo Distributor (Demo Traders in Ratlam, MP)
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: 'Demo Traders',
      owner_name: 'Demo Owner',
      phone: '9000000000',
      email: 'demo@example.invalid',
      upi_id: 'demo@invalid',
      address: 'Plot 1, Fictional Wholesale Market, Ratlam, Madhya Pradesh 457001',
      city: 'Ratlam',
      state: 'Madhya Pradesh',
      timezone: 'Asia/Kolkata',
      order_cutoff_time: '18:00',
      enable_gst: false,
      is_active: true,
      status: 'ACTIVE',
      settings_json: JSON.stringify({
        allow_phone_orders: true,
        auto_route_reminders: true,
        rounding_tolerance_paise: 500, // ₹5 tolerance
      }),
    },
    create: {
      id: tenantId,
      name: 'Demo Traders',
      owner_name: 'Demo Owner',
      phone: '9000000000',
      email: 'demo@example.invalid',
      upi_id: 'demo@invalid',
      address: 'Plot 1, Fictional Wholesale Market, Ratlam, Madhya Pradesh 457001',
      city: 'Ratlam',
      state: 'Madhya Pradesh',
      timezone: 'Asia/Kolkata',
      order_cutoff_time: '18:00',
      enable_gst: false,
      is_active: true,
      status: 'ACTIVE',
      settings_json: JSON.stringify({
        allow_phone_orders: true,
        auto_route_reminders: true,
        rounding_tolerance_paise: 500,
      }),
    },
  });
  console.log(`✓ Distributor: ${tenant.name} (${tenant.id})`);

  // 2. Single-Owner Model (Strictly 1 Owner User, 1 Membership, 2 Trusted Devices)
  const defaultPasswordHash = await bcrypt.hash('demo123', 10);
  const ownerUser = await prisma.user.create({
    data: {
      email: 'demo@example.invalid',
      name: 'Demo Owner',
      phone: '9000000000',
      password_hash: defaultPasswordHash,
      memberships: {
        create: {
          tenant_id: tenantId,
          role: Role.OWNER,
        },
      },
    },
  });

  // Seed exactly 2 trusted devices for the Owner with strong peppered PIN 839201
  const dev1 = await prisma.device.create({
    data: {
      user_id: ownerUser.id,
      device_name: 'Owner Main Terminal (Countertop)',
      device_fingerprint: 'dev_main_countertop_terminal_01',
      is_trusted: true,
      pin_failed_attempts: 0,
    },
  });
  await setDevicePin(dev1.id, '839201');

  const dev2 = await prisma.device.create({
    data: {
      user_id: ownerUser.id,
      device_name: 'Owner Android Tablet (Warehouse)',
      device_fingerprint: 'dev_mobile_warehouse_tablet_02',
      is_trusted: true,
      pin_failed_attempts: 0,
    },
  });
  await setDevicePin(dev2.id, '839201');

  console.log(`✓ Single-Owner Verified: Demo Owner (OWNER) with 2 trusted hardware terminals`);

  // 3. Plan & Entitlements
  const plan = await prisma.plan.upsert({
    where: { name: 'PILOT_3_MONTH_FREE' },
    update: {},
    create: {
      name: 'PILOT_3_MONTH_FREE',
      max_active_shops: 500,
      max_whatsapp_msgs: 10000,
      max_ai_calls: 500,
      max_ai_parses: 2000,
      max_staff_users: 20,
      feature_flags_json: JSON.stringify({
        max_products: 5000,
        advanced_analytics: true,
        pdf_import: true,
        voice_ordering: true,
        photo_ordering: true,
        campaign_broadcasts: true,
      }),
    },
  });

  await prisma.tenantPlan.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: {
      tenant_id: tenantId,
      plan_id: plan.id,
      start_date: new Date('2026-10-01'),
    },
  });

  // 4. Categories (Category-Agnostic Engine)
  const categoryDefs = [
    { name: 'Staples & Grains', hindi_name: 'खाद्यान्न और दालें', icon: 'Wheat', allow_decimal_quantity: true, sort_order: 1 },
    { name: 'Edible Oil & Ghee', hindi_name: 'खाद्य तेल और घी', icon: 'Droplets', allow_decimal_quantity: true, track_batch_expiry: true, sort_order: 2 },
    { name: 'Snacks & Biscuits', hindi_name: 'नमकीन और बिस्कुट', icon: 'Cookie', allow_decimal_quantity: false, track_batch_expiry: true, sort_order: 3 },
    { name: 'Beverages', hindi_name: 'पेय पदार्थ और चाय', icon: 'Coffee', allow_decimal_quantity: false, sort_order: 4 },
    { name: 'Personal Care', hindi_name: 'व्यक्तिगत देखभाल', icon: 'Sparkles', allow_decimal_quantity: false, sort_order: 5 },
    { name: 'Home Care', hindi_name: 'घरेलू सफाई', icon: 'Home', allow_decimal_quantity: false, sort_order: 6 },
  ];

  const categories: Record<string, any> = {};
  for (const c of categoryDefs) {
    const cat = await prisma.category.create({
      data: {
        tenant_id: tenantId,
        name: c.name,
        hindi_name: c.hindi_name,
        icon: c.icon,
        allow_decimal_quantity: c.allow_decimal_quantity,
        track_batch_expiry: c.track_batch_expiry ?? false,
        sort_order: c.sort_order,
      },
    });
    categories[c.name] = cat;
  }
  console.log(`✓ Categories Created: 6 categories`);

  // 4b. 5 Fictional Brands
  const brandDefs = [
    { name: 'Sunrise Foods', hindi_name: 'सनराइज फूड्स', sort_order: 1 },
    { name: 'Crunch Co', hindi_name: 'क्रंच कं.', sort_order: 2 },
    { name: 'Golden Grains', hindi_name: 'गोल्डन ग्रेन्स', sort_order: 3 },
    { name: 'Daily Fresh', hindi_name: 'डेली फ्रेश', sort_order: 4 },
    { name: 'SpiceCraft', hindi_name: 'स्पाइसक्राफ्ट', sort_order: 5 },
  ];
  const brands: Record<string, any> = {};
  for (const b of brandDefs) {
    const brand = await prisma.brand.create({
      data: {
        tenant_id: tenantId,
        name: b.name,
        hindi_name: b.hindi_name,
        sort_order: b.sort_order,
        is_active: true,
      },
    });
    brands[b.name] = brand;
  }
  console.log(`✓ Brands Created: 5 fictional brands (Sunrise Foods, Crunch Co, Golden Grains, Daily Fresh, SpiceCraft)`);

  // 5. 80 Master Products & Distributor Inventory across Fictional Brands
  const productSeeds = [
    // Staples & Grains (15 items) -> Sunrise Foods & Golden Grains (Discrete Bags & Pouches)
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Chakki Fresh Whole Wheat Atta 10kg', hi: 'चक्की फ्रेश आटा १० किलो', mrp: 42000, ptr: 36500, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 500 },
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Chakki Fresh Whole Wheat Atta 50kg Bag', hi: 'चक्की फ्रेश आटा ५० किलो बोरी', mrp: 195000, ptr: 172000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 200 },
    { brand: 'Golden Grains', subGroup: 'Wheat & Rice', cat: 'Staples & Grains', name: 'Premium Sharbati Wheat 50kg Bag', hi: 'शरबती गेहूँ ५० किलो बोरी', mrp: 230000, ptr: 205000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 150 },
    { brand: 'Golden Grains', subGroup: 'Wheat & Rice', cat: 'Staples & Grains', name: 'Classic Basmati Rice 25kg Bag', hi: 'बासमती चावल २५ किलो', mrp: 280000, ptr: 245000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 160 },
    { brand: 'Golden Grains', subGroup: 'Pulses & Dals', cat: 'Staples & Grains', name: 'Unpolished Toor Dal 1kg Pouch', hi: 'अरहर / तूर दाल १ किलो', mrp: 18000, ptr: 15400, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 800 },
    { brand: 'Golden Grains', subGroup: 'Pulses & Dals', cat: 'Staples & Grains', name: 'Unpolished Toor Dal 30kg Bag', hi: 'तूर दाल ३० किलो बोरी', mrp: 520000, ptr: 450000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 100 },
    { brand: 'Golden Grains', subGroup: 'Pulses & Dals', cat: 'Staples & Grains', name: 'Unpolished Moong Dal Dhuli 1kg', hi: 'मूंग दाल धुली १ किलो', mrp: 14000, ptr: 12000, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 750 },
    { brand: 'Golden Grains', subGroup: 'Pulses & Dals', cat: 'Staples & Grains', name: 'Desi Chana Dal 1kg Pouch', hi: 'चना दाल १ किलो', mrp: 11000, ptr: 9200, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 1200 },
    { brand: 'Golden Grains', subGroup: 'Pulses & Dals', cat: 'Staples & Grains', name: 'Kabuli Chana Premium 1kg', hi: 'काबुली चना १ किलो', mrp: 16000, ptr: 13500, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 600 },
    { brand: 'Sunrise Foods', subGroup: 'Essentials', cat: 'Staples & Grains', name: 'Thick Poha 500g Pouch', hi: 'मोटा पोहा ५०० ग्राम', mrp: 4500, ptr: 3600, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 800 },
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Pure Fine Besan 500g', hi: 'शुद्ध बेसन ५०० ग्राम', mrp: 6000, ptr: 4900, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 1000 },
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Pure Fine Besan 10kg Bag', hi: 'शुद्ध बेसन १० किलो', mrp: 115000, ptr: 96000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 200 },
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Fine Refined Maida 1kg', hi: 'मैदा १ किलो', mrp: 4800, ptr: 3900, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 600 },
    { brand: 'Sunrise Foods', subGroup: 'Flour & Atta', cat: 'Staples & Grains', name: 'Roasted Sooji 500g Pouch', hi: 'सूजी ५०० ग्राम', mrp: 4000, ptr: 3200, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 900 },
    { brand: 'Sunrise Foods', subGroup: 'Essentials', cat: 'Staples & Grains', name: 'Refined Crystal Sugar 50kg Bag', hi: 'सफेद चीनी ५० किलो बोरी', mrp: 225000, ptr: 202000, base: 'bag', order: 'bag', chain: STANDARD_UNIT_CHAINS.DISCRETE_BAG, stock: 160 },

    // Edible Oil & Ghee (12 items) -> Daily Fresh (Discrete Pouches, Tins, Jars, Bottles)
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Refined Soyabean Oil 1L Pouch', hi: 'सोयाबीन तेल १ लीटर पाउच', mrp: 13500, ptr: 11600, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 2400 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Refined Soyabean Oil 15L Tin', hi: 'सोयाबीन तेल १५ लीटर पीपा', mrp: 195000, ptr: 171000, base: 'tin', order: 'tin', chain: STANDARD_UNIT_CHAINS.DISCRETE_TIN, stock: 180 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Kacchi Ghani Mustard Oil 1L Bottle', hi: 'कच्ची घानी सरसों तेल १ लीटर', mrp: 16500, ptr: 14200, base: 'bottle', order: 'bottle', chain: STANDARD_UNIT_CHAINS.DISCRETE_BOTTLE, stock: 1800 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Kacchi Ghani Mustard Oil 5L Jar', hi: 'सरसों तेल ५ लीटर जार', mrp: 80000, ptr: 69000, base: 'jar', order: 'jar', chain: STANDARD_UNIT_CHAINS.DISCRETE_JAR, stock: 300 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Kacchi Ghani Mustard Oil 15L Tin', hi: 'सरसों तेल १५ लीटर पीपा', mrp: 235000, ptr: 206000, base: 'tin', order: 'tin', chain: STANDARD_UNIT_CHAINS.DISCRETE_TIN, stock: 300 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Refined Sunflower Oil 1L Pouch', hi: 'सूरजमुखी तेल १ लीटर', mrp: 15000, ptr: 12900, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 1200 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Refined Sunflower Oil 15L Tin', hi: 'सूरजमुखी तेल १५ लीटर', mrp: 215000, ptr: 188000, base: 'tin', order: 'tin', chain: STANDARD_UNIT_CHAINS.DISCRETE_TIN, stock: 120 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Filtered Groundnut Oil 1L Pouch', hi: 'मूंगफली तेल १ लीटर', mrp: 19000, ptr: 16500, base: 'pouch', order: 'pouch', chain: STANDARD_UNIT_CHAINS.DISCRETE_POUCH, stock: 800 },
    { brand: 'Daily Fresh', subGroup: 'Cooking Oils', cat: 'Edible Oil & Ghee', name: 'Filtered Groundnut Oil 15L Tin', hi: 'मूंगफली तेल १५ लीटर', mrp: 275000, ptr: 242000, base: 'tin', order: 'tin', chain: STANDARD_UNIT_CHAINS.DISCRETE_TIN, stock: 100 },
    { brand: 'Daily Fresh', subGroup: 'Pure Ghee', cat: 'Edible Oil & Ghee', name: 'Pure Desi Cow Ghee 500ml Jar', hi: 'गाय का शुद्ध घी ५०० मिली', mrp: 38000, ptr: 32500, base: 'jar', order: 'jar', chain: STANDARD_UNIT_CHAINS.DISCRETE_JAR, stock: 800 },
    { brand: 'Daily Fresh', subGroup: 'Pure Ghee', cat: 'Edible Oil & Ghee', name: 'Pure Desi Cow Ghee 1L Jar', hi: 'गाय का शुद्ध घी १ लीटर', mrp: 74000, ptr: 63500, base: 'jar', order: 'jar', chain: STANDARD_UNIT_CHAINS.DISCRETE_JAR, stock: 600 },
    { brand: 'Daily Fresh', subGroup: 'Pure Ghee', cat: 'Edible Oil & Ghee', name: 'Pure Desi Cow Ghee 15kg Tin', hi: 'शुद्ध घी १५ किलो टिन', mrp: 1080000, ptr: 935000, base: 'tin', order: 'tin', chain: STANDARD_UNIT_CHAINS.DISCRETE_TIN, stock: 60 },

    // Snacks & Biscuits (20 items) -> Crunch Co
    { brand: 'Crunch Co', subGroup: 'Chips & Crisps', cat: 'Snacks & Biscuits', name: 'Salted Potato Wafers 50g Pouch', hi: 'साल्टेड आलू वेफर्स ५० ग्राम', mrp: 2000, ptr: 1650, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 3600 },
    { brand: 'Crunch Co', subGroup: 'Chips & Crisps', cat: 'Snacks & Biscuits', name: 'Masala Spicy Potato Chips 50g', hi: 'मसाला पोटैटो चिप्स ५० ग्राम', mrp: 2000, ptr: 1650, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 4200 },
    { brand: 'Crunch Co', subGroup: 'Chips & Crisps', cat: 'Snacks & Biscuits', name: 'Tangy Tomato Crunch Chips 50g', hi: 'टोमैटो क्रंच चिप्स ५० ग्राम', mrp: 2000, ptr: 1650, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 2400 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Khatta Meetha Mixture Namkeen 200g', hi: 'खट्टा मीठा नमकीन २०० ग्राम', mrp: 5500, ptr: 4400, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1800 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Khatta Meetha Mixture Namkeen 400g', hi: 'खट्टा मीठा नमकीन ४०० ग्राम', mrp: 10000, ptr: 8100, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1200 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Crispy Aloo Bhujia 200g Pouch', hi: 'आलू भुजिया २०० ग्राम', mrp: 6000, ptr: 4800, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 2400 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Crispy Aloo Bhujia 400g Pouch', hi: 'आलू भुजिया ४०० ग्राम', mrp: 11000, ptr: 8900, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1500 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Crispy Aloo Bhujia 1kg Family Pack', hi: 'आलू भुजिया १ किलो पैक', mrp: 26000, ptr: 21500, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 800 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Spicy Ratlami Sev 200g Pouch', hi: 'रतलामी सेंव २०० ग्राम', mrp: 6000, ptr: 4800, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1600 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Salted Moong Dal Namkeen 200g', hi: 'मूंग दाल नमकीन २०० ग्राम', mrp: 6500, ptr: 5200, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1400 },
    { brand: 'Crunch Co', subGroup: 'Namkeen', cat: 'Snacks & Biscuits', name: 'Crunchy Salted Peanuts 100g', hi: 'साल्टेड मूंगफली १०० ग्राम', mrp: 3000, ptr: 2400, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1200 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Energy Glucose Biscuits 50g', hi: 'ग्लूकोज बिस्कुट ५० ग्राम', mrp: 500, ptr: 410, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 12000 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Energy Glucose Biscuits 200g Family Pack', hi: 'ग्लूकोज बिस्कुट २०० ग्राम', mrp: 2000, ptr: 1680, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 4800 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Marie Light Tea Biscuits 250g', hi: 'मैरी लाइट बिस्कुट २५० ग्राम', mrp: 3500, ptr: 2850, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 3600 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Sweet Milk & Malt Biscuits 150g', hi: 'मिल्क बिस्कुट १५० ग्राम', mrp: 2500, ptr: 2050, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 2400 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Butter Cashew Cookies 200g', hi: 'बटर काजू कुकीज २०० ग्राम', mrp: 5000, ptr: 4100, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1800 },
    { brand: 'Crunch Co', subGroup: 'Biscuits', cat: 'Snacks & Biscuits', name: 'Chocolate Cream Sandwich Biscuits 100g', hi: 'चॉकलेट क्रीम बिस्कुट १०० ग्राम', mrp: 3000, ptr: 2450, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 2200 },
    { brand: 'Crunch Co', subGroup: 'Instant Foods', cat: 'Snacks & Biscuits', name: 'Instant Masala Noodles 70g Single Pkt', hi: 'मसाला नूडल्स ७० ग्राम', mrp: 1400, ptr: 1150, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 7200 },
    { brand: 'Crunch Co', subGroup: 'Instant Foods', cat: 'Snacks & Biscuits', name: 'Instant Masala Noodles 280g (4-in-1)', hi: 'मसाला नूडल्स ४-इन-१ पैक', mrp: 5200, ptr: 4300, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 1800 },
    { brand: 'Crunch Co', subGroup: 'Instant Foods', cat: 'Snacks & Biscuits', name: 'Plain Wheat Hakka Noodles 300g', hi: 'हक्का नूडल्स ३०० ग्राम', mrp: 4500, ptr: 3650, base: 'packet', order: 'bundle', chain: STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE, stock: 900 },

    // Beverages (10 items) -> Daily Fresh
    { brand: 'Daily Fresh', subGroup: 'Tea & Chai', cat: 'Beverages', name: 'CTC Leaf Tea Premium Blend 250g Box', hi: 'प्रीमियम चाय पत्ती २५० ग्राम', mrp: 13000, ptr: 10800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1200 },
    { brand: 'Daily Fresh', subGroup: 'Tea & Chai', cat: 'Beverages', name: 'CTC Leaf Tea Premium Blend 1kg Jar', hi: 'प्रीमियम चाय १ किलो जार', mrp: 48000, ptr: 40500, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 600 },
    { brand: 'Daily Fresh', subGroup: 'Tea & Chai', cat: 'Beverages', name: 'Pure Green Tea 100g Box', hi: 'ग्रीन टी १०० ग्राम', mrp: 16000, ptr: 13200, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 400 },
    { brand: 'Daily Fresh', subGroup: 'Coffee', cat: 'Beverages', name: 'Instant Roasted Coffee 50g Glass Jar', hi: 'कॉफी ५० ग्राम जार', mrp: 19000, ptr: 15800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 500 },
    { brand: 'Daily Fresh', subGroup: 'Coffee', cat: 'Beverages', name: 'Instant Roasted Coffee 200g Pouch', hi: 'कॉफी २०० ग्राम पाउच', mrp: 45000, ptr: 37500, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 350 },
    { brand: 'Daily Fresh', subGroup: 'Cold Drinks', cat: 'Beverages', name: 'Mango Natural Fruit Drink 750ml Bottle', hi: 'मैंगो फ्रूट ड्रिंक ७५० मिली', mrp: 4500, ptr: 3650, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1400 },
    { brand: 'Daily Fresh', subGroup: 'Cold Drinks', cat: 'Beverages', name: 'Orange Fizzy Drink 500ml PET', hi: 'ऑरेंज ड्रिंक ५०० मिली', mrp: 3000, ptr: 2400, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1800 },
    { brand: 'Daily Fresh', subGroup: 'Cold Drinks', cat: 'Beverages', name: 'Orange Fizzy Drink 2L Family Bottle', hi: 'ऑरेंज ड्रिंक २ लीटर', mrp: 9500, ptr: 7800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 600 },
    { brand: 'Daily Fresh', subGroup: 'Cold Drinks', cat: 'Beverages', name: 'Packaged Natural Water 1L Bottle', hi: 'मिनरल वाटर १ लीटर बोतल', mrp: 2000, ptr: 1350, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 3600 },
    { brand: 'Daily Fresh', subGroup: 'Cold Drinks', cat: 'Beverages', name: 'Almond Badam Drink 200ml Tin Can', hi: 'बादाम मिल्क २०० मिली कैन', mrp: 4000, ptr: 3250, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 800 },

    // Personal Care (12 items) -> SpiceCraft
    { brand: 'SpiceCraft', subGroup: 'Soaps & Shaving', cat: 'Personal Care', name: 'Herbal Neem Bathing Soap 100g (4-Pack)', hi: 'नीम साबुन १०० ग्राम (४ का पैक)', mrp: 12000, ptr: 9800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1500 },
    { brand: 'SpiceCraft', subGroup: 'Soaps & Shaving', cat: 'Personal Care', name: 'Sandalwood Fragrant Soap 125g Single', hi: 'चंदन साबुन १२५ ग्राम', mrp: 4500, ptr: 3650, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 2400 },
    { brand: 'SpiceCraft', subGroup: 'Hair Care', cat: 'Personal Care', name: 'Anti-Dandruff Herbal Shampoo 180ml', hi: 'एंटी-डैंड्रफ शैम्पू १८० मिली', mrp: 16000, ptr: 13100, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 900 },
    { brand: 'SpiceCraft', subGroup: 'Hair Care', cat: 'Personal Care', name: 'Anti-Dandruff Herbal Shampoo 360ml', hi: 'एंटी-डैंड्रफ शैम्पू ३६० मिली', mrp: 29000, ptr: 24200, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 600 },
    { brand: 'SpiceCraft', subGroup: 'Dental Care', cat: 'Personal Care', name: 'Fresh Mint Gel Toothpaste 150g', hi: 'मिंट टूथपेस्ट १५० ग्राम', mrp: 9500, ptr: 7800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1400 },
    { brand: 'SpiceCraft', subGroup: 'Dental Care', cat: 'Personal Care', name: 'Ayurvedic Clove Toothpaste 100g', hi: 'लौंग टूथपेस्ट १०० ग्राम', mrp: 6500, ptr: 5300, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1800 },
    { brand: 'SpiceCraft', subGroup: 'Hair Care', cat: 'Personal Care', name: 'Pure Coconut Hair Oil 100ml Bottle', hi: 'नारियल तेल १०० मिली', mrp: 4200, ptr: 3450, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1600 },
    { brand: 'SpiceCraft', subGroup: 'Hair Care', cat: 'Personal Care', name: 'Pure Coconut Hair Oil 200ml Bottle', hi: 'नारियल तेल २०० मिली', mrp: 8000, ptr: 6600, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1200 },
    { brand: 'SpiceCraft', subGroup: 'Soaps & Shaving', cat: 'Personal Care', name: 'Moisturizing Shaving Cream 100g Tube', hi: 'शेविंग क्रीम १०० ग्राम', mrp: 7000, ptr: 5650, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 800 },
    { brand: 'SpiceCraft', subGroup: 'Skin Care', cat: 'Personal Care', name: 'Aloe Vera Daily Moisturizer Cream 100ml', hi: 'एलोवेरा क्रीम १०० मिली', mrp: 11000, ptr: 8900, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 650 },
    { brand: 'SpiceCraft', subGroup: 'Skin Care', cat: 'Personal Care', name: 'Glycerin Deep Care Body Lotion 250ml', hi: 'बॉडी लोशन २५० मिली', mrp: 18000, ptr: 14800, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 450 },
    { brand: 'SpiceCraft', subGroup: 'Dental Care', cat: 'Personal Care', name: 'Soft Charcoal Bristle Toothbrush (4-Pack)', hi: 'टूथब्रश (४ का पैक)', mrp: 8000, ptr: 6200, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1100 },

    // Home Care (11 items) -> SpiceCraft
    { brand: 'SpiceCraft', subGroup: 'Laundry', cat: 'Home Care', name: 'Active Oxygen Detergent Powder 1kg Bag', hi: 'डिटर्जेंट पाउडर १ किलो', mrp: 11000, ptr: 8900, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 2200 },
    { brand: 'SpiceCraft', subGroup: 'Laundry', cat: 'Home Care', name: 'Active Oxygen Detergent Powder 5kg Bag', hi: 'डिटर्जेंट पाउडर ५ किलो', mrp: 52000, ptr: 43000, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 950 },
    { brand: 'SpiceCraft', subGroup: 'Laundry', cat: 'Home Care', name: 'Blue Fabric Detergent Bar 250g (4-Pack)', hi: 'कपड़े धोने का साबुन (४ पैक)', mrp: 5000, ptr: 4050, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 2800 },
    { brand: 'SpiceCraft', subGroup: 'Dishwash', cat: 'Home Care', name: 'Lemon Power Dishwash Liquid 500ml Bottle', hi: 'डिशवॉश लिक्विड ५०० मिली', mrp: 9500, ptr: 7700, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1400 },
    { brand: 'SpiceCraft', subGroup: 'Dishwash', cat: 'Home Care', name: 'Lemon Power Dishwash Liquid 1L Refill', hi: 'डिशवॉश १ लीटर रिफिल', mrp: 17500, ptr: 14400, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 800 },
    { brand: 'SpiceCraft', subGroup: 'Dishwash', cat: 'Home Care', name: 'Grease Buster Dishwash Bar 200g (Tub)', hi: 'बर्तन धोने की टिकिया २०० ग्राम', mrp: 3000, ptr: 2400, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 3200 },
    { brand: 'SpiceCraft', subGroup: 'Cleaners', cat: 'Home Care', name: 'Pine Floor Disinfectant Cleaner 1L', hi: 'फर्श क्लीनर १ लीटर', mrp: 14000, ptr: 11200, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1100 },
    { brand: 'SpiceCraft', subGroup: 'Cleaners', cat: 'Home Care', name: 'Pine Floor Disinfectant Cleaner 5L Can', hi: 'फर्श क्लीनर ५ लीटर कैन', mrp: 55000, ptr: 44500, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 400 },
    { brand: 'SpiceCraft', subGroup: 'Cleaners', cat: 'Home Care', name: 'Multi-Surface Glass Cleaner Spray 500ml', hi: 'ग्लास क्लीनर स्प्रे ५०० मिली', mrp: 9500, ptr: 7600, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 750 },
    { brand: 'SpiceCraft', subGroup: 'Cleaners', cat: 'Home Care', name: 'Heavy Duty Toilet Cleaner Liquid 500ml', hi: 'टॉयलेट क्लीनर ५०० मिली', mrp: 8500, ptr: 6850, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 1300 },
    { brand: 'SpiceCraft', subGroup: 'Pest Control', cat: 'Home Care', name: 'Mosquito Vaporizer Refill Twin Pack (45ml x 2)', hi: 'मच्छर अगरबत्ती/लिक्विड रिफिल', mrp: 14500, ptr: 11900, base: 'piece', order: 'box', chain: STANDARD_UNIT_CHAINS.DISCRETE_PIECE_BOX, stock: 900 },
  ];

  const tenantProducts: any[] = [];
  for (let idx = 0; idx < productSeeds.length; idx++) {
    const p = productSeeds[idx];
    const cat = categories[p.cat];

    const mp = await prisma.masterProduct.create({
      data: {
        category_id: cat.id,
        name: p.name,
        hindi_name: p.hi,
        mrp_paise: p.mrp,
        image_url: `/placeholder-fmcg-${(idx % 12) + 1}.png`,
        base_unit: p.base,
        default_order_unit: p.order,
        unit_chain_json: JSON.stringify(p.chain.steps),
      },
    });

    const isNew = idx >= 75; // Flag last 5 items as "new"
    const newUntil = isNew ? new Date(Date.now() + 21 * 86400000) : null;

    const tp = await prisma.tenantProduct.create({
      data: {
        tenant_id: tenantId,
        brand_id: brands[p.brand].id,
        sub_group: p.subGroup,
        master_product_id: mp.id,
        name: p.name,
        hindi_name: p.hi,
        mrp_paise: p.mrp,
        base_unit: p.base,
        default_order_unit: p.order,
        unit_chain_json: JSON.stringify(p.chain.steps),
        rate_paise: p.ptr,
        stock_qty: p.stock,
        in_stock_flag: true,
        daily_max_limit: idx % 10 === 0 ? 50 : null,
        is_new: isNew,
        new_until_date: newUntil,
      },
      include: {
        master_product: true,
        brand: true,
      },
    });
    tenantProducts.push(tp);

    // Initial stock movement
    await prisma.stockMovement.create({
      data: {
        tenant_id: tenantId,
        tenant_product_id: tp.id,
        change: p.stock,
        reason: StockMovementReason.IMPORT,
        notes: 'Initial warehouse stock onboarding',
      },
    });
  }
  console.log(`✓ Products Created: 80 products with units across 6 categories`);

  // 6. Areas and Routes (Authentic Ratlam, Madhya Pradesh Topography)
  const areaNames = [
    { name: 'Manek Chowk & Chandni Chowk', notes: 'Ratlam central wholesale grocery & bullion bazar, tempo access' },
    { name: 'Station Road & Do Batti', notes: 'Ratlam junction commercial avenue & transport hub' },
    { name: 'Industrial Area (Namkeen Cluster & Jaora Road)', notes: 'Namkeen/sev manufacturing hub & warehouses' },
    { name: 'Sailana Road & Alkapuri', notes: 'High-density retail grocery & residential clusters' },
  ];

  const areas: any[] = [];
  for (const a of areaNames) {
    const area = await prisma.area.create({
      data: {
        tenant_id: tenantId,
        name: a.name,
        notes: a.notes,
      },
    });
    areas.push(area);
  }

  // Route Groups
  const routeMonday = await prisma.routeGroup.create({
    data: {
      tenant_id: tenantId,
      name: 'Monday City Route (Manek Chowk + Station Road)',
    },
  });
  await prisma.routeGroupArea.create({ data: { tenant_id: tenantId, route_group_id: routeMonday.id, area_id: areas[0].id } });
  await prisma.routeGroupArea.create({ data: { tenant_id: tenantId, route_group_id: routeMonday.id, area_id: areas[1].id } });
  await prisma.routeSchedule.create({
    data: {
      tenant_id: tenantId,
      route_group_id: routeMonday.id,
      order_day_of_week: 1, // Monday
      order_cutoff_time: '11:30',
      packing_day_of_week: 1,
      delivery_day_of_week: 1,
    },
  });

  const routeThursday = await prisma.routeGroup.create({
    data: {
      tenant_id: tenantId,
      name: 'Thursday Industrial & Highway Route (Namkeen Cluster + Sailana Road)',
    },
  });
  await prisma.routeGroupArea.create({ data: { tenant_id: tenantId, route_group_id: routeThursday.id, area_id: areas[2].id } });
  await prisma.routeGroupArea.create({ data: { tenant_id: tenantId, route_group_id: routeThursday.id, area_id: areas[3].id } });
  await prisma.routeSchedule.create({
    data: {
      tenant_id: tenantId,
      route_group_id: routeThursday.id,
      order_day_of_week: 4, // Thursday
      order_cutoff_time: '11:30',
      packing_day_of_week: 4,
      delivery_day_of_week: 4,
    },
  });
  console.log(`✓ Logistics Created: 4 Ratlam areas, 2 route groups with weekly schedules`);

  // 7. 30 Retailer Shops with diverse histories
  const shopData = [
    { name: 'Gupta Kirana Store', owner: 'Ramesh Gupta', phone: '9829100001', area: 0, interval: 7, hold: false, optOut: false, payer: 'Ramesh Kumar Gupta' },
    { name: 'Mahadev Provision Store', owner: 'Sanjay Sharma', phone: '9829100002', area: 0, interval: 5, hold: false, optOut: false, payer: 'Mahadev Traders' },
    { name: 'Krishna Daily Needs', owner: 'Kishore Soni', phone: '9829100003', area: 0, interval: 7, hold: false, optOut: false, payer: 'Kishore Soni' },
    { name: 'Shree Ram General Store', owner: 'Mohan Ram', phone: '9829100004', area: 0, interval: 3, hold: false, optOut: false, payer: 'Mohan Lal Sharma' },
    { name: 'Jai Jinendra Super Mart', owner: 'Virendra Kumar', phone: '9829100005', area: 0, interval: 7, hold: true, optOut: false, payer: 'Virendra Kumar' }, // On credit hold
    { name: 'Balaji Kirana Bhandar', owner: 'Mukesh Yadav', phone: '9829100006', area: 0, interval: 10, hold: false, optOut: false, payer: 'Mukesh Yadav' },
    { name: 'Agarwal Traders', owner: 'Pawan Agarwal', phone: '9829100007', area: 0, interval: 7, hold: false, optOut: false, payer: 'Agarwal Traders' },
    { name: 'Pooja Daily Grocery', owner: 'Dinesh Kumar', phone: '9829100008', area: 0, interval: 14, hold: false, optOut: false, payer: 'Dinesh Kumar' },

    { name: 'Station Road Mart', owner: 'Ashok Meena', phone: '9829100009', area: 1, interval: 7, hold: false, optOut: false, payer: 'Ashok Kumar Meena' },
    { name: 'Ratlam Sweets & Namkeen', owner: 'Radheshyam Halwai', phone: '9829100010', area: 1, interval: 4, hold: false, optOut: false, payer: 'Ratlam Sweets' },
    { name: 'Khandelwal Departmental', owner: 'Sunil Khandelwal', phone: '9829100011', area: 1, interval: 7, hold: false, optOut: false, payer: 'Sunil Khandelwal' },
    { name: 'City Corner Store', owner: 'Vikas Verma', phone: '9829100012', area: 1, interval: 6, hold: false, optOut: false, payer: 'Vikas Verma' },
    { name: 'Saraswati Provisions', owner: 'Gopal Saini', phone: '9829100013', area: 1, interval: 7, hold: false, optOut: false, payer: 'Gopal Saini' },
    { name: 'Anand Wholesale Kirana', owner: 'Anand Prakash', phone: '9829100014', area: 1, interval: 5, hold: false, optOut: false, payer: 'Anand Kirana' },
    { name: 'New Bharat Store', owner: 'Jagdish Chand', phone: '9829100015', area: 1, interval: 7, hold: false, optOut: true, payer: 'Jagdish Chand' }, // Opted out whatsapp

    { name: 'MIA Canteen Supplies', owner: 'Harish Rawat', phone: '9829100016', area: 2, interval: 7, hold: false, optOut: false, payer: 'Harish Rawat' },
    { name: 'Industrial Hub Grocery', owner: 'Satish Jangid', phone: '9829100017', area: 2, interval: 7, hold: false, optOut: false, payer: 'Satish Kumar' },
    { name: 'Jaora Road Kirana', owner: 'Prem Singh', phone: '9829100018', area: 2, interval: 10, hold: false, optOut: false, payer: 'Prem Singh' },
    { name: 'Factory Gate Provisions', owner: 'Deepak Chouhan', phone: '9829100019', area: 2, interval: 7, hold: false, optOut: false, payer: 'Deepak Chouhan' },
    { name: 'Shyam Shagun Store', owner: 'Nand Lal', phone: '9829100020', area: 2, interval: 14, hold: true, optOut: false, payer: 'Nand Lal' }, // On credit hold
    { name: 'Ganesh General Mart', owner: 'Bhagwan Das', phone: '9829100021', area: 2, interval: 7, hold: false, optOut: false, payer: 'Ganesh Traders' },
    { name: 'Kalyan Daily Store', owner: 'Kalyan Sahay', phone: '9829100022', area: 2, interval: 21, hold: false, optOut: false, payer: 'Kalyan Sahay' }, // Quiet shop candidate

    { name: 'Highway Dhaba Mart', owner: 'Gurpreet Singh', phone: '9829100023', area: 3, interval: 7, hold: false, optOut: false, payer: 'Gurpreet Singh' },
    { name: 'Alkapuri Mart', owner: 'Kailash Chand', phone: '9829100024', area: 3, interval: 7, hold: false, optOut: false, payer: 'Kailash Chand' },
    { name: 'Om Sai Kirana', owner: 'Manoj Kumar', phone: '9829100025', area: 3, interval: 5, hold: false, optOut: false, payer: 'Manoj Kumar' },
    { name: 'A-One Traders', owner: 'Naveen Gupta', phone: '9829100026', area: 3, interval: 7, hold: false, optOut: false, payer: 'Naveen Gupta' },
    { name: 'Shri Nath Super Store', owner: 'Govind Ram', phone: '9829100027', area: 3, interval: 7, hold: false, optOut: false, payer: 'Govind Ram' },
    { name: 'Janta Kirana Ratlam', owner: 'Purushottam Lal', phone: '9829100028', area: 3, interval: 25, hold: false, optOut: false, payer: 'Purushottam Lal' }, // Deliberately quiet shop
    { name: 'Choudhary General Mart', owner: 'Rampal Choudhary', phone: '9829100029', area: 3, interval: 28, hold: false, optOut: false, payer: 'Rampal Choudhary' }, // Deliberately quiet shop
    { name: 'Maruti Wholesale Point', owner: 'Hemant Saini', phone: '9829100030', area: 3, interval: 7, hold: false, optOut: false, payer: 'Maruti Provisions' },
  ];

  const shops: any[] = [];
  for (let i = 0; i < shopData.length; i++) {
    const s = shopData[i];
    const shopNum = `SHP-${String(i + 1).padStart(4, '0')}`;
    const shop = await prisma.shop.create({
      data: {
        tenant_id: tenantId,
        area_id: areas[s.area].id,
        shop_number: shopNum,
        name: s.name,
        owner_name: s.owner,
        phone: s.phone,
        address: `${s.name}, Main Bazar, ${areas[s.area].name}, Ratlam`,
        credit_limit_paise: 500000, // ₹5,000 credit limit
        hold_flag: s.hold,
        opt_out_whatsapp: s.optOut,
        usual_order_interval_days: s.interval,
        status: ShopStatus.ACTIVE,
      },
    });

    // Generate secure token
    const { rawToken, tokenHash, expiresAt } = generateShopToken(365);
    await prisma.shopToken.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Payer name for SMS matcher
    await prisma.shopPayerName.create({
      data: {
        tenant_id: tenantId,
        shop_id: shop.id,
        payer_name: s.payer,
      },
    });

    shops.push({ ...shop, rawToken });
  }
  console.log(`✓ Shops Created: 30 shops with tokens and payer mappings`);

  // 8. Schemes (Cross-Category & Multi-Tier)
  const scheme1 = await prisma.scheme.create({
    data: {
      tenant_id: tenantId,
      name: 'Buy 10 Bundles Wafers, Get 1 Pkt Biscuit Free',
      type: SchemeType.FREE_GOODS,
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-12-31'),
      is_active: true,
      rule_json: JSON.stringify({
        type: 'FREE_GOODS',
        triggerProductIds: [tenantProducts[27].id], // Potato Wafers 50g
        triggerQuantityBase: 120, // 10 bundles = 120 pkts
        rewardProductId: tenantProducts[38].id, // Glucose Biscuits 50g
        rewardQuantityBase: 1,
      }),
    },
  });

  const scheme2 = await prisma.scheme.create({
    data: {
      tenant_id: tenantId,
      name: 'Bulk Edible Oil Slab Discount',
      type: SchemeType.SLAB_DISCOUNT,
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-12-31'),
      is_active: true,
      rule_json: JSON.stringify({
        type: 'SLAB_DISCOUNT',
        targetProductIds: [tenantProducts[16].id], // Soyabean Oil 15L Tin
        slabs: [
          { minQuantityBase: 5, discountPaisePerUnit: 25000 }, // ₹250.00 off per tin for >= 5
        ],
      }),
    },
  });

  const scheme3 = await prisma.scheme.create({
    data: {
      tenant_id: tenantId,
      name: 'Flour & Ghee Wedding Season Combo',
      type: SchemeType.COMBO,
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-12-31'),
      is_active: true,
      rule_json: JSON.stringify({
        type: 'COMBO',
        requiredItems: [
          { productId: tenantProducts[1].id, quantityBase: 2 }, // 2 bags 50kg atta
          { productId: tenantProducts[25].id, quantityBase: 1 }, // 1 jar 1L Desi Ghee
        ],
        flatDiscountPaise: 15000, // ₹150.00 combo discount
      }),
    },
  });
  console.log(`✓ Schemes Created: 3 active cross-category schemes`);

  // 9. 8 Weeks of Historical Orders, Bills, Payments & Ledger Entries
  const existingOrdersCount = await prisma.order.count({ where: { tenant_id: tenantId } });
  if (existingOrdersCount === 0) {
    console.log('Generating 8 weeks of historical order & payment flow...');
    let orderSequence = 1;
    const now = new Date('2026-11-23T11:00:00Z');

    for (let week = 8; week >= 1; week--) {
    const weekDate = new Date(now.getTime() - week * 7 * 86400000);

    for (let sIdx = 0; sIdx < shops.length; sIdx++) {
      const shop = shops[sIdx];
      // Skip quiet shops in recent weeks so they show as "Quiet"
      if (sIdx >= 27 && week <= 4) {
        continue;
      }

      const dateStr = weekDate.toISOString().slice(0, 10).replace(/-/g, '');
      const ordNumber = `ORD-${dateStr}-${String(orderSequence).padStart(4, '0')}`;
      const billNumber = `BILL-${dateStr}-${String(orderSequence).padStart(4, '0')}`;
      orderSequence++;

      // Pick 3-5 products for this shop order
      const p1 = tenantProducts[(sIdx * 2) % tenantProducts.length];
      const p2 = tenantProducts[(sIdx * 3 + 1) % tenantProducts.length];
      const p3 = tenantProducts[(sIdx * 5 + 2) % tenantProducts.length];

      const qty1 = 5;
      const qty2 = 10;
      const qty3 = 2;

      const subtotal = p1.rate_paise * qty1 + p2.rate_paise * qty2 + p3.rate_paise * qty3;
      const total = subtotal;

      const order = await prisma.order.create({
        data: {
          tenant_id: tenantId,
          shop_id: shop.id,
          order_number: ordNumber,
          source: sIdx % 4 === 0 ? OrderSource.STAFF_PHONE : OrderSource.RETAILER_APP,
          status: OrderStatus.DELIVERED,
          subtotal_paise: subtotal,
          total_paise: total,
          created_at: weekDate,
          updated_at: weekDate,
        },
      });

      // Lines
      await prisma.orderLine.createMany({
        data: [
          {
            tenant_id: tenantId,
            order_id: order.id,
            tenant_product_id: p1.id,
            quantity_base: qty1,
            order_unit_name: p1.master_product.default_order_unit,
            display_quantity: qty1,
            price_paise_snapshot: p1.rate_paise,
            created_at: weekDate,
          },
          {
            tenant_id: tenantId,
            order_id: order.id,
            tenant_product_id: p2.id,
            quantity_base: qty2,
            order_unit_name: p2.master_product.default_order_unit,
            display_quantity: qty2,
            price_paise_snapshot: p2.rate_paise,
            created_at: weekDate,
          },
          {
            tenant_id: tenantId,
            order_id: order.id,
            tenant_product_id: p3.id,
            quantity_base: qty3,
            order_unit_name: p3.master_product.default_order_unit,
            display_quantity: qty3,
            price_paise_snapshot: p3.rate_paise,
            created_at: weekDate,
          },
        ],
      });

      // Bill
      const upiRef = `tr_bill_${orderSequence}_${week}`;
      const upiString = `upi://pay?pa=demo@invalid&pn=Demo%20Traders&am=${(total / 100).toFixed(2)}&cu=INR&tn=Bill%20${billNumber}&tr=${upiRef}`;
      const bill = await prisma.bill.create({
        data: {
          tenant_id: tenantId,
          shop_id: shop.id,
          order_id: order.id,
          bill_number: billNumber,
          total_paise: total,
          upi_reference: upiRef,
          upi_string: upiString,
          created_at: weekDate,
        },
      });

      // Bill Event
      await prisma.billEvent.create({
        data: {
          tenant_id: tenantId,
          bill_id: bill.id,
          event_type: BillEventType.CREATED,
          created_at: weekDate,
        },
      });

      // Ledger Debit for Bill
      await prisma.ledgerEntry.create({
        data: {
          tenant_id: tenantId,
          shop_id: shop.id,
          type: LedgerEntryType.BILL,
          amount_paise: total, // Debit increases balance
          reference_id: bill.id,
          description: `Bill #${billNumber}`,
          created_at: weekDate,
        },
      });

      // Payments: If week 1 (most recent week), leave some bills UNPAID for realism
      const isUnpaidBill = week === 1 && (sIdx % 3 === 0);
      if (!isUnpaidBill) {
        // Payment made
        const paymentDate = new Date(weekDate.getTime() + 2 * 86400000); // 2 days later

        // Simulate short payment on a few bills (e.g. ₹890 paid on ₹893)
        const hasRoundingShortage = sIdx % 7 === 0;
        const paidAmount = hasRoundingShortage ? total - 300 : total; // ₹3 short

        const payment = await prisma.payment.create({
          data: {
            tenant_id: tenantId,
            shop_id: shop.id,
            amount_paise: paidAmount,
            method: PaymentMethod.UPI,
            bank_utr: `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`,
            payer_name: shop.owner_name,
            match_status: MatchStatus.MATCHED,
            payment_date: paymentDate,
            created_at: paymentDate,
          },
        });

        // Allocation
        await prisma.paymentAllocation.create({
          data: {
            tenant_id: tenantId,
            payment_id: payment.id,
            bill_id: bill.id,
            amount_paise: paidAmount,
            created_at: paymentDate,
          },
        });

        // Ledger Credit for Payment
        await prisma.ledgerEntry.create({
          data: {
            tenant_id: tenantId,
            shop_id: shop.id,
            type: LedgerEntryType.PAYMENT,
            amount_paise: -paidAmount, // Negative reduces due
            reference_id: payment.id,
            description: `Payment received via UPI (UTR: ${payment.bank_utr})`,
            created_at: paymentDate,
          },
        });

        // If short, record the ₹3 rounding due entry
        if (hasRoundingShortage) {
          await prisma.ledgerEntry.create({
            data: {
              tenant_id: tenantId,
              shop_id: shop.id,
              type: LedgerEntryType.ROUNDING_DUE,
              amount_paise: 0, // Carried over as due in ledger
              reference_id: bill.id,
              description: `Short payment adjustment: ₹3.00 remaining due on Bill #${billNumber}`,
              created_at: paymentDate,
            },
          });
        }

        // Bill Event: Paid or Partially Paid
        await prisma.billEvent.create({
          data: {
            tenant_id: tenantId,
            bill_id: bill.id,
            event_type: hasRoundingShortage ? BillEventType.PARTIALLY_PAID : BillEventType.PAID,
            created_at: paymentDate,
          },
        });
      }
    }
  }

  // 10. Seed Realistic Unmatched Bank Payments (B3 requirement)
  console.log('Seeding realistic unmatched bank payments for reconciliation...');
  const nowRef = new Date('2026-11-23T11:00:00Z');
  const unmatchedDefs = [
    {
      amount_paise: 185000, // ₹1,850.00
      bank_utr: 'UTR982183920194',
      payer_name: 'Shree Ram Trading Co',
      notes: 'Payment received via HDFC Bank UPI; payer name does not match any registered shop owner.',
      received_at: new Date(nowRef.getTime() - 1 * 86400000), // 1 day ago
    },
    {
      amount_paise: 320000, // ₹3,200.00
      bank_utr: 'UTR472910384729',
      payer_name: 'Unknown UPI User',
      notes: 'Customer transferred via Google Pay without shop reference.',
      received_at: new Date(nowRef.getTime() - 3 * 86400000), // 3 days ago
    },
    {
      amount_paise: 75000, // ₹750.00
      bank_utr: 'UTR109283746192',
      payer_name: 'Cash Deposit - Ratlam Mandi Branch',
      notes: 'Branch cash deposit; needs verification from market shopkeeper.',
      received_at: new Date(nowRef.getTime() - 4 * 86400000), // 4 days ago
    },
  ];

  for (const um of unmatchedDefs) {
    const pay = await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        shop_id: null,
        amount_paise: um.amount_paise,
        method: PaymentMethod.UPI,
        bank_utr: um.bank_utr,
        payer_name: um.payer_name,
        match_status: MatchStatus.UNMATCHED,
        payment_date: um.received_at,
        created_at: um.received_at,
      },
    });

    await prisma.unmatchedPayment.create({
      data: {
        tenant_id: tenantId,
        payment_id: pay.id,
        notes: um.notes,
      },
    });
  }
  console.log('✓ Unmatched Payments Seeded: 3 realistic pending reconciliation entries');

  // Set sequence generator starting numbers
  await prisma.tenantSequence.upsert({
    where: { tenant_id_entity_type: { tenant_id: tenantId, entity_type: 'ORDER' } },
    update: { current_val: orderSequence },
    create: { tenant_id: tenantId, entity_type: 'ORDER', current_val: orderSequence, prefix: 'ORD-20261123-', padding: 4 },
  });
  await prisma.tenantSequence.upsert({
    where: { tenant_id_entity_type: { tenant_id: tenantId, entity_type: 'BILL' } },
    update: { current_val: orderSequence },
    create: { tenant_id: tenantId, entity_type: 'BILL', current_val: orderSequence, prefix: 'BILL-20261123-', padding: 4 },
  });
  await prisma.tenantSequence.upsert({
    where: { tenant_id_entity_type: { tenant_id: tenantId, entity_type: 'SHOP' } },
    update: { current_val: shops.length },
    create: { tenant_id: tenantId, entity_type: 'SHOP', current_val: shops.length, prefix: 'SHP-', padding: 4 },
  });

    console.log(`✓ 8 Weeks of Order History & Payments Seeded (${orderSequence - 1} orders & bills)`);
  } else {
    console.log(`✓ 8 Weeks of Order History & Payments Already Seeded (${existingOrdersCount} orders present)`);
  }

  // 10. Seed Festival Stock Suggestion (Part 2.F)
  const existingFestival = await prisma.festivalSuggestion.findFirst({
    where: { tenant_id: tenantId },
  });
  if (!existingFestival && tenantProducts.length >= 2) {
    const festivalStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const festivalEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    await prisma.festivalSuggestion.create({
      data: {
        tenant_id: tenantId,
        festival_name: 'Diwali Festive Stocking',
        festival_name_hi: 'दीपावली त्योहार विशेष स्टॉक',
        start_date: festivalStart,
        end_date: festivalEnd,
        notes: 'High retail turnover anticipated across namkeen, snacks, and tea packs.',
        items_json: JSON.stringify([
          { tenant_product_id: tenantProducts[0].id, suggested_qty_base: 5 },
          { tenant_product_id: tenantProducts[1].id, suggested_qty_base: 10 },
        ]),
        is_active: true,
      },
    });
    console.log(`✓ Festival Suggestion Seeded: Diwali Festive Stocking`);
  }

  console.log(`✓ Demo Retailer Links:`);
  console.log(`  - Active Shop: http://localhost:3000/r/${shops[0].rawToken} (${shops[0].name})`);
  console.log(`  - Credit Hold Shop: http://localhost:3000/r/${shops[4].rawToken} (${shops[4].name})`);
  console.log(`  - Quiet Shop: http://localhost:3000/r/${shops[27].rawToken} (${shops[27].name})`);
  console.log('--- Database Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
