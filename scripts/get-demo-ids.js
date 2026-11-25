const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bill = await prisma.bill.findFirst({
    orderBy: { created_at: 'desc' },
    select: { id: true, bill_number: true },
  });

  const shop = await prisma.shop.findFirst({
    where: { shop_number: 'SHP-0001' },
    include: { tokens: true },
  });

  const prod = await prisma.tenantProduct.findFirst({
    select: { id: true, name: true },
  });

  console.log(JSON.stringify({
    billId: bill?.id,
    billNumber: bill?.bill_number,
    shopId: shop?.id,
    shopNumber: shop?.shop_number,
    prodId: prod?.id,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
