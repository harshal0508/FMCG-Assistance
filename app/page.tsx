import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import {
  Store,
  Building2,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Boxes,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Truck,
  Receipt,
  Users,
  Layers,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react';

export const revalidate = 60;

export default async function HomePage() {
  // Fetch sample shop token & tenant details in parallel
  const [demoShop, tenantRecord] = await Promise.all([
    prisma.shop.findFirst({
      where: { phone: '9829100001' },
      include: {
        tokens: { where: { revoked_at: null }, take: 1 },
        tenant: true,
        area: true,
        orders: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.tenant.findFirst({ select: { name: true } }),
  ]);
  const tenantName = tenantRecord?.name || 'Demo Traders';

  const retailerLink = '/r/demo-portal';

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-orange-100 selection:text-orange-900 font-sans">
      {/* Top Header */}
      <header className="bg-[#17307A] text-white border-b border-blue-950 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F58220] text-white font-black text-lg flex items-center justify-center shadow-xs">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight block leading-tight text-white">
                  Vitarak FMCG Platform
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-blue-900/80 text-[10px] font-bold text-blue-200 border border-blue-700/50">
                  Ratlam Wholesale Node
                </span>
              </div>
              <span className="text-[11px] text-blue-200">
                Unified Wholesale Distribution & Kirana Ordering Ecosystem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/40 text-[11px] text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live System: Active Mandi Operations</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-4 py-8 sm:py-12 space-y-10 flex-1">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#F58220] text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
            <span>Ratlam Wholesale FMCG Commerce Engine</span>
          </div>

          <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-serif font-black text-slate-900 tracking-tight leading-snug max-w-md sm:max-w-xl mx-auto">
            Wholesale Distribution &amp; Retailer Ordering Network
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Select your portal to continue. Manage bulk dispatch, live inventory, and retailer credit ledgers as a wholesale distributor, or browse brand catalogs and place daily replenishment orders as a kirana shopkeeper.
          </p>
        </div>

        {/* TWO PRIMARY PORTALS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* PORTAL 1: DISTRIBUTOR OPERATIONS HUB */}
          <div className="bg-white rounded-3xl border-2 border-slate-200/90 hover:border-[#17307A] transition-all shadow-sm hover:shadow-xl p-6 sm:p-8 flex flex-col justify-between group relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#17307A] via-blue-700 to-indigo-600" />

            <div className="space-y-6">
              {/* Header / Badges */}
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#17307A] shadow-xs group-hover:scale-105 transition-transform">
                  <Building2 className="w-7 h-7 text-[#17307A]" />
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-[#17307A] text-[11px] font-bold border border-blue-200/60">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#17307A]" />
                    <span>Owner Portal</span>
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1 font-mono">
                    Node: {tenantName}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F58220] block mb-1">
                  Wholesale Distributor & Warehouse Hub
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 group-hover:text-[#17307A] transition-colors">
                  Distributor Portal
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Full control center for FMCG wholesale distributors. Manage incoming orders segregated by delivery market areas, generate warehouse pick lists, control live inventory & PTR pricing, and monitor shop credit ledgers.
                </p>
              </div>

              {/* Key Features List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Truck className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Area-Segregated Orders:</strong> Live order inbox segregated by Krishi Mandi, Station Rd, Alkapuri, and Sailana Bus Stand.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Boxes className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Warehouse Pick Lists:</strong> Brand-wise aggregated picking slips and vehicle dispatch loading sheets.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <TrendingUp className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Inventory Valuation:</strong> Live stock tracking with cost vs. wholesale PTR margin computation.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Receipt className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Retailer Credit Ledger:</strong> Outstanding balances, credit holds, and automated WhatsApp payment nudges.
                  </span>
                </div>
              </div>

              {/* Access Mode */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Security Mode:</span>
                <span className="font-semibold text-[#17307A]">Google Sign-In &amp; Device-Bound PIN</span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-6">
              <Link
                href="/d/login"
                className="touch-target w-full py-3.5 px-6 rounded-2xl bg-[#17307A] hover:bg-[#11235A] active:scale-[0.99] text-white font-extrabold text-sm shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 transition-all group-hover:bg-[#11235A]"
              >
                <span>Enter Distributor Portal</span>
                <ArrowRight className="w-4 h-4 text-[#F58220] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* PORTAL 2: RETAILER STOREFRONT (APNI DUKAAN) */}
          <div className="bg-white rounded-3xl border-2 border-slate-200/90 hover:border-[#F58220] transition-all shadow-sm hover:shadow-xl p-6 sm:p-8 flex flex-col justify-between group relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#F58220] via-amber-500 to-orange-600" />

            <div className="space-y-6">
              {/* Header / Badges */}
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F58220] shadow-xs group-hover:scale-105 transition-transform">
                  <Store className="w-7 h-7 text-[#F58220]" />
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-[#F58220] text-[11px] font-bold border border-orange-200/60">
                    <BadgeCheck className="w-3.5 h-3.5 text-[#F58220]" />
                    <span>Kirana Storefront</span>
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1">
                    Zero Passwords • 1-Tap Link
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block mb-1">
                  Kirana Shop Wholesale Ordering
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 group-hover:text-[#F58220] transition-colors">
                  Retailer Portal (Apni Dukaan)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Mobile-first storefront built for kirana shop owners. 1-tap repeat reorders, brand-wise wholesale catalog with pack sizes, and wholesale schemes with transparent &apos;You Save&apos; margin boosters.
                </p>
              </div>

              {/* Key Features List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">1-Tap Repeat Order:</strong> Instant reordering of yesterday&apos;s supplies with live +/- quantity steppers.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">&apos;You Save&apos; Schemes:</strong> Interactive wholesale savings breakdown highlighting profit margin.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Brand-Wise Catalog:</strong> Filter products by Sunrise Foods, Crunch Co, Golden Grains, Daily Fresh, etc.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">18:00 IST Cut-Off:</strong> Real-time dispatch countdown timer for guaranteed next-morning delivery.
                  </span>
                </div>
              </div>

              {/* Retailer Storefront Info */}
              <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200/70 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-[#17307A] flex items-center justify-between">
                  <span>Pre-Linked Retailer Shop:</span>
                  <span className="text-emerald-700 font-bold">Verified Partner</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                  <span>
                    {demoShop?.name || 'Mahadev Kirana'} • {demoShop?.owner_name || 'Ramesh Gupta'} ({demoShop?.area?.name || 'Krishi Mandi, Ratlam'})
                  </span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-6">
              <Link
                href={retailerLink}
                className="touch-target w-full py-3.5 px-6 rounded-2xl bg-[#F58220] hover:bg-[#E07210] active:scale-[0.99] text-white font-extrabold text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>Open Retailer Storefront</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Network Trust & Metrics Strip */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="p-2 space-y-1">
              <div className="text-xl sm:text-2xl font-black text-[#17307A]">2 Node</div>
              <div className="text-xs text-slate-500 font-medium">Wholesale Distributors</div>
            </div>
            <div className="p-2 space-y-1">
              <div className="text-xl sm:text-2xl font-black text-[#17307A]">32+ Shops</div>
              <div className="text-xs text-slate-500 font-medium">Active Ratlam Kiranas</div>
            </div>
            <div className="p-2 space-y-1">
              <div className="text-xl sm:text-2xl font-black text-[#F58220]">18:00 IST</div>
              <div className="text-xs text-slate-500 font-medium">Daily Dispatch Cut-off</div>
            </div>
            <div className="p-2 space-y-1">
              <div className="text-xl sm:text-2xl font-black text-emerald-600">100% Strict</div>
              <div className="text-xs text-slate-500 font-medium">Tenant Data Isolation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 bg-white text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">Vitarak FMCG Platform</span>
            <span>•</span>
            <span>Ratlam Wholesale & Retail Network</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Server-side Pricing Engine</span>
            <span>•</span>
            <span>Zero Passwords for Retailers</span>
            <span>•</span>
            <span>Next-Day Morning Delivery</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
