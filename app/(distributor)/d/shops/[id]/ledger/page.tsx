import React from 'react';
import { Metadata } from 'next';
import { ShopLedgerView } from '@/components/distributor/shop-ledger-view';

export const metadata: Metadata = {
  title: 'Shop Credit Ledger | Vitarak Hub',
  description: 'Append-only ledger entries, dues, running balances and order hold controls',
};

export default async function ShopLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShopLedgerView shopId={id} />;
}
