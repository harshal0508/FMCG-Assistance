import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apni Dukaan - Retailer Ordering',
  manifest: '/manifest-retailer.json',
  themeColor: '#17307A',
};

export default function RetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {children}
    </div>
  );
}
