import React from 'react';
import { Metadata } from 'next';
import { SchemesView } from '@/components/distributor/schemes-view';

export const metadata: Metadata = {
  title: 'Trade Schemes & Promotions | Vitarak Hub',
  description: 'Manage free goods, volume slab discounts, and combos with live cart simulator',
};

export default function SchemesPage() {
  return <SchemesView />;
}
