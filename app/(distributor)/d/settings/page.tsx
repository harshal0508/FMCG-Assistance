import { prisma } from '@/lib/db/prisma';
import SettingsForm from '@/components/distributor/settings-form';

export const dynamic = 'force-dynamic';

export default async function DistributorSettingsPage() {
  const tenantId = 'tenant_shree_shyam_alwar';

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      owner_name: true,
      phone: true,
      email: true,
      upi_id: true,
      address: true,
      city: true,
      state: true,
      timezone: true,
      order_cutoff_time: true,
      enable_gst: true,
    },
  });

  if (!tenant) {
    return (
      <div className="p-6 text-center text-slate-500">
        Distributor account settings not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsForm initialSettings={tenant} />
    </div>
  );
}
