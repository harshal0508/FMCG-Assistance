import CsvImporter from '@/components/distributor/csv-importer';

export const dynamic = 'force-dynamic';

export default function InventoryImportPage() {
  return (
    <div className="space-y-6">
      <CsvImporter />
    </div>
  );
}
