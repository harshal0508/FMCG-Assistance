import React from 'react';
import { Metadata } from 'next';
import { SchemeClaimsView } from '@/components/distributor/scheme-claims-view';

export const metadata: Metadata = {
  title: 'Scheme Claims Report & CSV Export | Vitarak Hub',
  description: 'Audit report and CSV export to claim brand promotion subsidies and free goods',
};

export default function SchemeClaimsReportPage() {
  return <SchemeClaimsView />;
}
