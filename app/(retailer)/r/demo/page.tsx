import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function RetailerDemoRedirect() {
  const shop = await prisma.shop.findFirst({
    where: { phone: '9829100001' },
    include: {
      tokens: { where: { revoked_at: null }, take: 1 },
    },
  });

  if (!shop || !shop.tokens[0]) {
    redirect('/');
  }

  // Find raw token in seed or use fallback
  redirect(`/r/demo-portal`);
}
