'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TenantStatus } from '@prisma/client';

interface Props {
  tenantId: string;
  tenantName: string;
  currentStatus: TenantStatus;
}

export default function TenantApprovalControls({ tenantId, tenantName, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'APPROVE' | 'SUSPEND' | 'REJECT') => {
    const confirmMsg =
      action === 'APPROVE'
        ? `Approve distributor "${tenantName}"? This activates their ordering portal and allows staff invites.`
        : action === 'SUSPEND'
        ? `Suspend distributor "${tenantName}"? This immediately blocks new order confirmations while preserving read-only access.`
        : `Reject onboarding application for "${tenantName}"?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Action failed');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {currentStatus !== TenantStatus.ACTIVE && (
        <button
          onClick={() => handleAction('APPROVE')}
          disabled={loading}
          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[11px] transition-colors disabled:opacity-50 min-h-[32px]"
          title="Approve / Activate Distributor"
        >
          ✓ Approve
        </button>
      )}

      {currentStatus === TenantStatus.ACTIVE && (
        <button
          onClick={() => handleAction('SUSPEND')}
          disabled={loading}
          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-[11px] transition-colors disabled:opacity-50 min-h-[32px]"
          title="Suspend Distributor (Blocks order confirmation)"
        >
          ⏸ Suspend
        </button>
      )}

      {currentStatus === TenantStatus.PENDING && (
        <button
          onClick={() => handleAction('REJECT')}
          disabled={loading}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded text-[11px] border border-slate-700 transition-colors disabled:opacity-50 min-h-[32px]"
          title="Reject Application"
        >
          ✕ Reject
        </button>
      )}
    </div>
  );
}
