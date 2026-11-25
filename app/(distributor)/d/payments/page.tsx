import React from 'react';
import { Metadata } from 'next';
import { PaymentsView } from '@/components/distributor/payments-view';

export const metadata: Metadata = {
  title: 'Payments & SMS Reconciliation | Vitarak Hub',
  description: 'Reconcile bank SMS and UPI payments with customer bills and ledgers',
};

export default function PaymentsPage() {
  return <PaymentsView />;
}
