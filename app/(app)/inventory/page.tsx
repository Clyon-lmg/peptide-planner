import { Suspense } from 'react';
import { AddRow } from './ui/AddRow';
import { InventoryList } from './ui/InventoryList';

export default function InventoryPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <Suspense fallback={<div>Loading…</div>}>
        <AddRow />
      </Suspense>
      <Suspense fallback={<div>Loading inventory…</div>}>
        <InventoryList />
      </Suspense>
    </div>
  );
}
