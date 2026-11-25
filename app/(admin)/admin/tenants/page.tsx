import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { TenantStatus, GstinStatus } from '@prisma/client';
import { maskGstin } from '@/lib/services/gstin';
import TenantApprovalControls from '@/components/admin/tenant-approval-controls';

export const dynamic = 'force-dynamic';

export default async function AdminTenantsPage() {
  const tenants = await prisma.tenant.findMany({
    include: {
      gst_verifications: {
        orderBy: { checked_at: 'desc' },
        take: 1,
      },
      shops: { select: { id: true } },
      orders: { select: { id: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span>
            <span>Distributor Tenant Verification & Approvals</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review entered business details against official GST legal/trade names. Approve, suspend, or reject onboarding applications.
          </p>
        </div>
        <Link
          href="/admin"
          className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
        >
          ← Back to Admin Console
        </Link>
      </div>

      {/* Verification Notice Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-xs text-blue-300 flex items-start gap-3">
        <span className="text-base">ℹ️</span>
        <div>
          <span className="font-bold">GSTIN Verification Policy:</span> New distributors start in <span className="underline font-semibold">PENDING</span> status until validated. Once approved, distributors can invite staff and confirm retailer orders. Suspended distributors retain read-only access but cannot confirm new orders.
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-semibold text-sm text-white flex justify-between items-center">
          <span>All Registered Distributors ({tenants.length})</span>
          <span className="text-xs text-slate-400">Comparing Entered Business Name vs Official GST Identity</span>
        </div>

        <div className="table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">Entered Business Name</th>
                <th className="p-4">GST Legal & Trade Name</th>
                <th className="p-4">GSTIN & Status</th>
                <th className="p-4">Owner / Contact</th>
                <th className="p-4 text-center">Current Status</th>
                <th className="p-4 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tenants.map((t) => {
                const latestGst = t.gst_verifications[0];
                return (
                  <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                    {/* Entered Business Name */}
                    <td className="p-4 font-semibold text-white">
                      <div className="text-sm font-bold">{t.name}</div>
                      <div className="text-[11px] text-slate-400">{t.city}, {t.state}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">ID: {t.id}</div>
                    </td>

                    {/* Official GST Legal & Trade Name */}
                    <td className="p-4">
                      {t.gstin_exception ? (
                        <div className="text-amber-400 font-medium">
                          <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-[10px]">
                            Exemption Claimed
                          </span>
                          <div className="text-[11px] text-slate-400 mt-1 italic">
                            "{t.gstin_exception_reason}"
                          </div>
                        </div>
                      ) : latestGst ? (
                        <div>
                          <div className="font-semibold text-slate-200">
                            {latestGst.legal_name || 'Legal Name Not Found'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Trade: {latestGst.trade_name || 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            State: {latestGst.state || t.state}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No GST check on record</span>
                      )}
                    </td>

                    {/* GSTIN & Status */}
                    <td className="p-4">
                      {t.gstin ? (
                        <div>
                          <code className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-slate-200">
                            {t.gstin}
                          </code>
                          <div className="mt-1">
                            {t.gstin_status === GstinStatus.VERIFIED && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                ✓ Verified Match
                              </span>
                            )}
                            {t.gstin_status === GstinStatus.FORMAT_OK && (
                              <span className="text-[10px] text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full font-medium">
                                Format Valid
                              </span>
                            )}
                            {t.gstin_status === GstinStatus.UNVERIFIED && (
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                                Unverified
                              </span>
                            )}
                            {t.gstin_status === GstinStatus.REJECTED && (
                              <span className="text-[10px] text-rose-400 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-full font-bold">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None (Exempt)</span>
                      )}
                    </td>

                    {/* Owner / Contact */}
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{t.owner_name}</div>
                      <div className="text-[11px] text-slate-400">{t.email || 'No Google Email'}</div>
                      {t.phone && <div className="text-[11px] text-slate-500">Phone: {t.phone}</div>}
                    </td>

                    {/* Current Status Badge */}
                    <td className="p-4 text-center">
                      {t.status === TenantStatus.ACTIVE && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-xs">
                          ACTIVE
                        </span>
                      )}
                      {t.status === TenantStatus.PENDING && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-400 font-bold text-xs">
                          PENDING
                        </span>
                      )}
                      {t.status === TenantStatus.SUSPENDED && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-400 font-bold text-xs">
                          SUSPENDED
                        </span>
                      )}
                      {t.status === TenantStatus.REJECTED && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs">
                          REJECTED
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <TenantApprovalControls
                        tenantId={t.id}
                        tenantName={t.name}
                        currentStatus={t.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
