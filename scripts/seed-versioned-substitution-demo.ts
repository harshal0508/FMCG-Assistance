import { prisma } from '../lib/db/prisma';

async function seedSubstitutionDemo() {
  console.log('Finding demo tenant...');
  const tenant = await prisma.tenant.findFirst({
    where: { name: 'Demo Traders' },
    include: {
      shops: { include: { area: true } },
      products: { include: { master_product: true } },
    },
  });

  if (!tenant) {
    throw new Error('Demo tenant not found');
  }

  const shop = tenant.shops[0];
  if (!shop) throw new Error('No shops found for tenant');

  if (tenant.products.length < 2) {
    throw new Error('Need at least 2 tenant products for substitution');
  }

  const prod1 = tenant.products[0];
  const prod2 = tenant.products[1];

  // 1. Check if demo substitution order already exists
  const existingOrder = await prisma.order.findFirst({
    where: {
      tenant_id: tenant.id,
      order_number: 'ORD-DEMO-SUB01',
    },
    include: {
      bills: { orderBy: { version: 'desc' } },
      lines: true,
    },
  });

  if (existingOrder && existingOrder.bills.length > 1) {
    console.log('Demo substitution order already exists:', existingOrder.order_number);
    console.log('Latest Bill Number:', existingOrder.bills[0].bill_number);
    return existingOrder.bills[0].bill_number;
  }

  console.log('Creating demo order for substitution after billing...');
  const lineRate1 = prod1.rate_paise || 25000;
  const lineQty1 = 2;
  const initialTotalPaise = lineRate1 * lineQty1;

  const order = await prisma.order.create({
    data: {
      tenant_id: tenant.id,
      shop_id: shop.id,
      order_number: 'ORD-DEMO-SUB01',
      status: 'CONFIRMED',
      subtotal_paise: initialTotalPaise,
      scheme_discount_paise: 0,
      total_paise: initialTotalPaise,
    },
  });

  const line = await prisma.orderLine.create({
    data: {
      tenant_id: tenant.id,
      order_id: order.id,
      tenant_product_id: prod1.id,
      order_unit_name: 'BAG',
      display_quantity: lineQty1,
      quantity_base: lineQty1 * 10,
      price_paise_snapshot: lineRate1,
    },
  });

  const baseBillNumber = 'BILL-20261125-0001';
  const upiId = tenant.upi_id || 'demo@invalid';
  const tenantName = tenant.name || 'Demo Traders';

  // 2. Create Initial Version 1 Bill
  const upiStringV1 = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(tenantName)}&am=${(initialTotalPaise / 100).toFixed(2)}&cu=INR&tn=Bill%20${encodeURIComponent(baseBillNumber)}&tr=tr_subdemo_v1`;

  const billV1 = await prisma.bill.create({
    data: {
      tenant_id: tenant.id,
      shop_id: shop.id,
      order_id: order.id,
      bill_number: baseBillNumber,
      version: 1,
      total_paise: initialTotalPaise,
      upi_reference: 'tr_subdemo_v1',
      upi_string: upiStringV1,
    },
  });

  await prisma.billEvent.create({
    data: {
      tenant_id: tenant.id,
      bill_id: billV1.id,
      event_type: 'CREATED',
      metadata_json: JSON.stringify({ version: 1, initial: true }),
    },
  });

  console.log('Version 1 Bill created:', billV1.bill_number, 'Total Paise:', initialTotalPaise);

  // 3. Perform Substitution on the line: replace prod1 with prod2
  const lineRate2 = prod2.rate_paise || 28000;
  const newTotalPaise = lineRate2 * lineQty1;

  // Create substitution record (ACCEPTED)
  await prisma.substitution.create({
    data: {
      tenant_id: tenant.id,
      order_id: order.id,
      order_line_id: line.id,
      original_product_id: prod1.id,
      suggested_product_id: prod2.id,
      requested_qty_base: lineQty1,
      shop_reply: 'ACCEPTED',
    },
  });

  // Update order line to suggested product
  await prisma.orderLine.update({
    where: { id: line.id },
    data: {
      tenant_product_id: prod2.id,
      price_paise_snapshot: lineRate2,
    },
  });

  // Update order total
  await prisma.order.update({
    where: { id: order.id },
    data: { total_paise: newTotalPaise },
  });

  // 4. In accordance with Rule 7: Unpaid bill exists -> superseded by Version 2
  await prisma.billEvent.create({
    data: {
      tenant_id: tenant.id,
      bill_id: billV1.id,
      event_type: 'CANCELLED',
      metadata_json: JSON.stringify({
        reason: 'SUBSTITUTION_VERSIONED',
        superseded_by_version: 2,
        new_bill_number: `${baseBillNumber}-v2`,
      }),
    },
  });

  const billNumberV2 = `${baseBillNumber}-v2`;
  const upiRefV2 = `tr_subdemo_v2`;
  const upiStringV2 = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(tenantName)}&am=${(newTotalPaise / 100).toFixed(2)}&cu=INR&tn=Bill%20${encodeURIComponent(billNumberV2)}&tr=${upiRefV2}`;

  const billV2 = await prisma.bill.create({
    data: {
      tenant_id: tenant.id,
      shop_id: shop.id,
      order_id: order.id,
      bill_number: billNumberV2,
      version: 2,
      total_paise: newTotalPaise,
      upi_reference: upiRefV2,
      upi_string: upiStringV2,
    },
  });

  await prisma.billEvent.create({
    data: {
      tenant_id: tenant.id,
      bill_id: billV2.id,
      event_type: 'CREATED',
      metadata_json: JSON.stringify({
        version: 2,
        previous_bill_id: billV1.id,
      }),
    },
  });

  console.log('✓ Successfully created Version 2 Bill:', billNumberV2, 'Total Paise:', newTotalPaise);
  return billNumberV2;
}

seedSubstitutionDemo()
  .then((billNumber) => {
    console.log('Demo bill ready:', billNumber);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed demo error:', err);
    process.exit(1);
  });
