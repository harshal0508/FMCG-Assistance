require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const bills = await p.bill.findMany({
    select: {
      id: true,
      bill_number: true,
      version: true,
      total_paise: true,
      order: {
        select: {
          id: true,
          order_number: true,
          status: true,
        },
      },
      events: true,
      allocations: true,
    },
    take: 10,
    orderBy: { created_at: 'desc' },
  });
  console.log('Sample bills:', JSON.stringify(bills, null, 2));

  // Check substitutions
  const subs = await p.substitution.findMany({
    take: 5,
    include: {
      order: {
        include: {
          bills: true,
        },
      },
    },
  });
  console.log('Sample substitutions:', JSON.stringify(subs, null, 2));
}

main().finally(() => p.$disconnect());
