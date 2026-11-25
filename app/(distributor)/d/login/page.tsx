import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDemoLoginAllowed } from '@/lib/services/auth';
import { validateServerSession, SESSION_COOKIE_NAME } from '@/lib/services/session';
import LoginForm from '@/components/distributor/login-form';
import Link from 'next/link';
import { ArrowLeft, Building2, ShieldCheck, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function StaffLoginPage() {
  const allowDemo = isDemoLoginAllowed();
  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;

  // Retrieve current tenant & owner details from DB
  const tenant = await prisma.tenant.findFirst({
    select: { name: true, city: true, state: true, owner_name: true },
  });

  const businessName = tenant?.name || 'Demo Traders';
  const ownerNameFallback = tenant?.owner_name || 'Demo Owner';
  const city = tenant?.city || 'Ratlam';

  let deviceName = 'Owner Workstation (Demo)';
  let ownerName = ownerNameFallback;

  if (sessionToken) {
    const sessionData = await validateServerSession(sessionToken);
    if (sessionData) {
      if (sessionData.isUnlocked) {
        redirect('/d/dashboard');
      }
      deviceName = sessionData.device.device_name;
      ownerName = sessionData.user.name || ownerNameFallback;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/70 to-amber-50/40 text-slate-800 flex flex-col justify-between items-center p-4 selection:bg-orange-100 selection:text-orange-900 font-sans">
      {/* Top Header Navigation */}
      <header className="w-full max-w-md mx-auto py-3 flex items-center justify-between z-10">
        <Link
          href="/"
          className="text-xs font-bold text-[#17307A] hover:text-blue-900 flex items-center gap-1.5 transition-all bg-white hover:bg-blue-50/80 px-4 py-2 rounded-xl border border-blue-200/80 shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#F58220]" />
          <span>Back to Portals</span>
        </Link>
        <span className="text-xs text-slate-800 font-bold flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs">
          <Building2 className="w-3.5 h-3.5 text-[#F58220]" />
          <span>{businessName} • {city}</span>
        </span>
      </header>

      {/* Center Two-Tone Color-Rich Terminal Card */}
      <div className="max-w-md w-full my-auto py-6 z-10">
        <div className="rounded-3xl shadow-xl shadow-blue-950/10 overflow-hidden border border-slate-200">
          {/* Card Top Section: Royal Navy Accent Banner */}
          <div className="bg-gradient-to-br from-[#17307A] via-[#1A3688] to-[#122660] text-white p-6 sm:p-7 relative overflow-hidden">
            {/* Subtle saffron glow highlight */}
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-[#F58220]/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Wholesale Terminal</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center font-black text-lg shadow-sm">
                V
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Distributor Operations Hub
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 font-medium">
              Single-Owner Wholesale Order Dispatch &amp; Inventory Terminal
            </p>
          </div>

          {/* Card Bottom Section: Light Styled Form */}
          <div className="bg-white p-6 sm:p-7 space-y-5">
            <LoginForm
              deviceName={deviceName}
              ownerName={ownerName}
              allowDemo={allowDemo}
            />

            {/* Security Trust Footnote */}
            <div className="pt-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 border-t border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Device-Bound Security • Peppered Bcrypt • 15m Idle Lock</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto py-3 text-center text-xs text-slate-500 font-medium z-10">
        Vitarak FMCG Platform • Authorized Wholesale Terminal
      </footer>
    </div>
  );
}
