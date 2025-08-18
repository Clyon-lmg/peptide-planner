'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate as swrMutate } from 'swr';
import {
  addInventoryVial,
  addInventoryCapsule,
  addInventoryCustom,
  getKnownPeptides,
  getKnownCapsules,
} from '../actions';

type Option = { peptide_id: number; canonical_name: string };

export function AddRow() {
  const router = useRouter();

  const [peptides, setPeptides] = useState<Option[]>([]);
  const [capsules, setCapsules] = useState<Option[]>([]);

  const [selPep, setSelPep] = useState<number | ''>('');
  const [selCap, setSelCap] = useState<number | ''>('');

  const [customName, setCustomName] = useState('');
  const [customKind, setCustomKind] = useState<'vial' | 'capsule'>('vial');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([getKnownPeptides(), getKnownCapsules()]);
        if (!active) return;
        setPeptides(p ?? []);
        setCapsules(c ?? []);
      } catch {
        // ignore load errors (empty dropdowns)
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function refreshLists() {
    // Revalidate SWR cache without a full page refresh
    await swrMutate('/inventory/all');
    // Optional: router.refresh() helps if any RSC parts rely on cache tags
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Add Peptide */}
      <div className="rounded-2xl border p-4 bg-card shadow-sm">
        <div className="font-medium mb-2">Add Peptide</div>
        <select
          className="w-full border rounded-lg p-2"
          value={selPep}
          onChange={(e) => setSelPep(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select a known peptide…</option>
          {peptides.map((p) => (
            <option key={p.peptide_id} value={p.peptide_id}>
              {p.canonical_name}
            </option>
          ))}
        </select>
        <button
          className="mt-3 w-full rounded-lg border px-3 py-2 hover:bg-accent"
          disabled={!selPep || loading}
          onClick={async () => {
            if (!selPep) return;
            setLoading(true);
            try {
              await addInventoryVial(Number(selPep));
              setSelPep('');
              await refreshLists();
            } finally {
              setLoading(false);
            }
          }}
        >
          Add
        </button>
      </div>

      {/* Add Capsule */}
      <div className="rounded-2xl border p-4 bg-card shadow-sm">
        <div className="font-medium mb-2">Add Capsule</div>
        <select
          className="w-full border rounded-lg p-2"
          value={selCap}
          onChange={(e) => setSelCap(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select a known capsule…</option>
          {capsules.map((c) => (
            <option key={c.peptide_id} value={c.peptide_id}>
              {c.canonical_name}
            </option>
          ))}
        </select>
        <button
          className="mt-3 w-full rounded-lg border px-3 py-2 hover:bg-accent"
          disabled={!selCap || loading}
          onClick={async () => {
            if (!selCap) return;
            setLoading(true);
            try {
              await addInventoryCapsule(Number(selCap));
              setSelCap('');
              await refreshLists();
            } finally {
              setLoading(false);
            }
          }}
        >
          Add
        </button>
      </div>

      {/* Add Custom */}
      <div className="rounded-2xl border p-4 bg-card shadow-sm">
        <div className="font-medium mb-2">Add Custom</div>
        <input
          className="w-full border rounded-lg p-2"
          placeholder="Display name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="kind"
              checked={customKind === 'vial'}
              onChange={() => setCustomKind('vial')}
            />
            Peptide (vial)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="kind"
              checked={customKind === 'capsule'}
              onChange={() => setCustomKind('capsule')}
            />
            Capsule
          </label>
        </div>
        <button
          className="mt-3 w-full rounded-lg border px-3 py-2 hover:bg-accent"
          disabled={!customName.trim() || loading}
          onClick={async () => {
            setLoading(true);
            try {
              await addInventoryCustom(customName.trim(), customKind);
              setCustomName('');
              await refreshLists();
            } finally {
              setLoading(false);
            }
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
