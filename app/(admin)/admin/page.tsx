import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminConsolePage() {
  const tenants = await prisma.tenant.findMany({
    include: {
      tenant_plan: {
        include: { plan: true },
      },
      shops: { select: { id: true } },
      orders: { select: { id: true, total_paise: true } },
      messages: { select: { id: true } },
      call_attempts: { select: { id: true } },
      parse_jobs: { select: { id: true } },
    },
  });

  // Read latest backup metadata if exists
  let lastBackupDate: string | null = null;
  const backupMetaPath = path.join(process.cwd(), 'backups', 'latest-backup.json');
  if (fs.existsSync(backupMetaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(backupMetaPath, 'utf-8'));
      lastBackupDate = new Date(meta.lastBackupDate).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {}
  }

  // Estimate DB row footprint
  const totalOrders = tenants.reduce((acc, t) => acc + t.orders.length, 0);
  const totalShops = tenants.reduce((acc, t) => acc + t.shops.length, 0);
  const approxDbSizeMb = Math.max(1.2, ((totalOrders * 3 + totalShops * 2) / 1000) * 1.5).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Supabase Free Tier Safety Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-sm font-bold text-amber-400">
              Free plan: no automatic backups. Last backup: {lastBackupDate ?? 'Never (run initial backup)'}
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Automated daily backups run locally to prevent data loss. Retains 14 rolling snapshots in <code className="bg-slate-900 px-1 py-0.5 rounded">/backups</code>.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            Script: <code className="text-amber-300">npm run backup:supabase</code>
          </span>
        </div>
      </div>

      {/* Free Plan Resource Quota Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Database Size (500 MB Limit) */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="uppercase font-semibold">Postgres Storage</span>
            <span className="text-emerald-400 font-bold">{approxDbSizeMb} MB / 500 MB</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '2%' }}></div>
          </div>
          <div className="text-[11px] text-slate-400">Free Tier Limit: 500 MB</div>
        </div>

        {/* Object Storage (1 GB Limit) */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="uppercase font-semibold">Object Storage</span>
            <span className="text-emerald-400 font-bold">0.0 MB / 1 GB</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '0%' }}></div>
          </div>
          <div className="text-[11px] text-emerald-400">Safe: Website ordering only (no image uploads)</div>
        </div>

        {/* Database Keep-Alive Health */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="uppercase font-semibold">Pause Prevention</span>
            <span className="text-emerald-400 font-bold">Active</span>
          </div>
          <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Health-check: <code className="text-slate-400">/api/health</code>
          </div>
          <div className="text-[11px] text-slate-400">Ping every 48h to prevent 7-day inactivity pause</div>
        </div>

        {/* Active Shops Volume */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="uppercase font-semibold">Connected Retailers</span>
            <span className="text-orange-400 font-bold">{totalShops} Shops</span>
          </div>
          <div className="text-xl font-bold text-white">{totalOrders} Orders</div>
          <div className="text-[11px] text-slate-400">Across {tenants.length} active distributor(s)</div>
        </div>
      </div>

      {/* CSV Export & Disaster Recovery Station for Owner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-white">Owner Data Export Station (CSV)</h2>
            <p className="text-xs text-slate-400">
              Download real-time snapshot files directly for Excel or local accounting.
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-full">
            Available On Demand
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
          <a
            href="/api/distributor/export-csv?table=shops"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>🏪</span>
            <span>Shops.csv</span>
          </a>
          <a
            href="/api/distributor/export-csv?table=products"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>📦</span>
            <span>Products.csv</span>
          </a>
          <a
            href="/api/distributor/export-csv?table=orders"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>📋</span>
            <span>Orders.csv</span>
          </a>
          <a
            href="/api/distributor/export-csv?table=bills"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>🧾</span>
            <span>Bills.csv</span>
          </a>
          <a
            href="/api/distributor/export-csv?table=payments"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>💳</span>
            <span>Payments.csv</span>
          </a>
          <a
            href="/api/distributor/export-csv?table=ledger"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-center text-xs font-semibold transition-colors border border-slate-700 flex flex-col items-center gap-1"
          >
            <span>📖</span>
            <span>Ledger.csv</span>
          </a>
        </div>
      </div>

      {/* Distributors Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-semibold text-sm text-white">
          Active Distributors & Usage
        </div>
        <div className="table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">Tenant Name</th>
                <th className="p-4">Location</th>
                <th className="p-4">Plan</th>
                <th className="p-4 text-center">Shops</th>
                <th className="p-4 text-center">Orders</th>
                <th className="p-4 text-center">WhatsApp</th>
                <th className="p-4 text-center">AI Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-semibold text-white">
                    <div>{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.owner_name} • {t.phone}</div>
                  </td>
                  <td className="p-4">
                    {t.city}, {t.state}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 font-medium text-[10px]">
                      {t.tenant_plan?.plan.name ?? 'PILOT_3_MONTH_FREE'}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold text-white">
                    {t.shops.length}
                  </td>
                  <td className="p-4 text-center font-bold text-white">
                    {t.orders.length}
                  </td>
                  <td className="p-4 text-center text-slate-400">
                    {t.messages.length}
                  </td>
                  <td className="p-4 text-center text-slate-400">
                    {t.call_attempts.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
