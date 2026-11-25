import React from 'react';
import { Metadata } from 'next';
import { RateGroupsView } from '@/components/distributor/rate-groups-view';

export const metadata: Metadata = {
  title: 'Rate Groups & Overrides | Vitarak Hub',
  description: 'Manage wholesale tiered rate groups and per-product price overrides',
};

export default function RateGroupsPage() {
  return <RateGroupsView />;
}
