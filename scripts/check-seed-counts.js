const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const counts = {
    tenants: await p.tenant.count(),
    users: await p.user.count(),
    memberships: await p.membership.count(),
    devices: await p.device.count(),
    shops: await p.shop.count(),
    brands: await p.brand.count(),
    products: await p.tenantProduct.count(),
    orders: await p.order.count(),
    bills: await p.bill.count(),
    payments: await p.payment.count(),
    unmatchedPayments: await p.unmatchedPayment.count(),
    ledgerEntries: await p.ledgerEntry.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  await p.$disconnect();
}

check();
