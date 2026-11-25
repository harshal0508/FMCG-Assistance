import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Vitarak Admin Console - Platform Management',
  manifest: '/manifest-admin.json',
  themeColor: '#0F172A',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 text-white font-bold flex items-center justify-center text-sm">
            A
          </div>
          <div>
            <div className="font-bold text-base text-white">Vitarak Super-Admin</div>
            <div className="text-xs text-slate-400">Multi-Tenant Oversight & Entitlements</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            2FA Active
          </span>
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Exit to Hub
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
