'use client';

import useSWR from 'swr';
import {
  deleteInventoryItem,
  getTopOffers,
  updateCapsuleFields,
  updateVialFields,
  addToCart,
} from '../actions';
import { useState } from 'react';

type Vial = {
  kind: 'vial';
  peptide_id: number;
  name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
};
type Cap = {
  kind: 'capsule';
  peptide_id: number;
  name: string;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
};
type Item = Vial | Cap;

async function fetchInventory(): Promise<Item[]> {
  const [vialsRes, capsRes] = await Promise.all([
    fetch('/api/inventory/vials').then((r) => r.json()),
    fetch('/api/inventory/capsules').then((r) => r.json()),
  ]);
  const items: Item[] = [
    ...vialsRes.map((r: any) => ({ kind: 'vial', ...r })),
    ...capsRes.map((r: any) => ({ kind: 'capsule', ...r })),
  ];

  // Stable order: name (case-insensitive), then kind (vial first), then peptide_id
  items.sort((a, b) => {
    const an = a.name?.toLowerCase() ?? '';
    const bn = b.name?.toLowerCase() ?? '';
    if (an !== bn) return an.localeCompare(bn);
    if (a.kind !== b.kind) return a.kind === 'vial' ? -1 : 1;
    return (a.peptide_id ?? 0) - (b.peptide_id ?? 0);
  });

  return items;
}

export function InventoryList() {
  const { data, error, isLoading, mutate } = useSWR('/inventory/all', fetchInventory, {
    // Avoid sudden reorders due to background revalidation race
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    keepPreviousData: true,
  });

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-red-600">Failed to load inventory</div>;
  const items: Item[] = data ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((it) => (
        <InventoryCard
          key={`${it.kind}-${it.peptide_id}`}
          item={it}
          onChanged={() => mutate()}
          onDeleted={() => mutate()}
        />
      ))}
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">No items yet. Add some above.</div>
      )}
    </div>
  );
}

function InventoryCard({
  item,
  onChanged,
  onDeleted,
}: {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 bg-card shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            {item.kind === 'vial' ? 'Peptide (vial)' : 'Capsule'}
          </div>
        </div>
        <button
          className="text-red-600 text-sm"
          onClick={async () => {
            await deleteInventoryItem(item.peptide_id, item.kind);
            onDeleted();
          }}
        >
          Delete
        </button>
      </div>

      {item.kind === 'vial' ? (
        <VialFields it={item as Vial} onChanged={onChanged} />
      ) : (
        <CapsuleFields it={item as Cap} onChanged={onChanged} />
      )}

      <BestPrices peptide_id={item.peptide_id} kind={item.kind} />
    </div>
  );
}

function VialFields({ it, onChanged }: { it: Vial; onChanged: () => void }) {
  const [vials, setVials] = useStateLocal(it.vials);
  const [mg, setMg] = useStateLocal(it.mg_per_vial);
  const [bac, setBac] = useStateLocal(it.bac_ml);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Field
        label="# Vials"
        value={vials}
        onChange={setVials}
        onBlur={async (v) => {
          await updateVialFields(it.peptide_id, { vials: v });
          onChanged();
        }}
      />
      <Field
        label="mg per vial"
        value={mg}
        onChange={setMg}
        onBlur={async (v) => {
          await updateVialFields(it.peptide_id, { mg_per_vial: v });
          onChanged();
        }}
      />
      <Field
        label="BAC (mL)"
        value={bac}
        onChange={setBac}
        onBlur={async (v) => {
          await updateVialFields(it.peptide_id, { bac_ml: v });
          onChanged();
        }}
      />
    </div>
  );
}

function CapsuleFields({ it, onChanged }: { it: Cap; onChanged: () => void }) {
  const [bottles, setBottles] = useStateLocal(it.bottles);
  const [caps, setCaps] = useStateLocal(it.caps_per_bottle);
  const [mgcap, setMgcap] = useStateLocal(it.mg_per_cap);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Field
        label="# Bottles"
        value={bottles}
        onChange={setBottles}
        onBlur={async (v) => {
          await updateCapsuleFields(it.peptide_id, { bottles: v });
          onChanged();
        }}
      />
      <Field
        label="Caps/bottle"
        value={caps}
        onChange={setCaps}
        onBlur={async (v) => {
          await updateCapsuleFields(it.peptide_id, { caps_per_bottle: v });
          onChanged();
        }}
      />
      <Field
        label="mg per cap"
        value={mgcap}
        onChange={setMgcap}
        onBlur={async (v) => {
          await updateCapsuleFields(it.peptide_id, { mg_per_cap: v });
          onChanged();
        }}
      />
    </div>
  );
}

function useStateLocal(initial: number) {
  const [v, setV] = useState<number>(initial ?? 0);
  return [v, (n: number) => setV(Number.isNaN(n) ? 0 : n)] as const;
}

function Field({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onBlur: (n: number) => void;
}) {
  return (
    <div>
      <div className="text-xs mb-1">{label}</div>
      <input
        type="number"
        className="w-full border rounded-lg p-2"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onBlur={() => onBlur(value)}
      />
    </div>
  );
}

function BestPrices({ peptide_id, kind }: { peptide_id: number; kind: 'vial' | 'capsule' }) {
  const { data, error, isLoading } = useSWR(
    ['offers', peptide_id, kind],
    () => getTopOffers(peptide_id, kind),
    { keepPreviousData: true }
  );
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading prices…</div>;
  if (error) return <div className="text-sm text-red-600">Failed to load prices</div>;
  const offers = data ?? [];
  if (offers.length === 0)
    return <div className="text-sm text-muted-foreground">No offers available.</div>;

  return (
    <div className="space-y-2">
      {offers.map((o: any) => {
        const total = typeof o.effective_price === 'number' ? o.effective_price : null;
        const unit = typeof o.unit_effective_price === 'number' ? o.unit_effective_price : null;

        const packInfo =
          kind === 'vial'
            ? o.mg_per_vial
              ? `${Number(o.mg_per_vial)} mg / vial`
              : ''
            : o.caps_per_bottle && o.mg_per_cap
            ? `${o.caps_per_bottle} caps • ${Number(o.mg_per_cap)} mg/cap`
            : o.caps_per_bottle
            ? `${o.caps_per_bottle} caps`
            : '';

        const rightLine =
          unit != null
            ? `$${unit.toFixed(4)} ${o.unit_label ?? (kind === 'vial' ? '/mg' : '/cap')}`
            : '—';

        return (
          <div key={o.id} className="rounded-lg border p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm">
                Vendor #{o.vendor_id} • {kind}
              </div>
              <div className="text-xs text-muted-foreground">
                {packInfo ? `${packInfo} • ` : ''}
                {total != null ? `Total: $${total.toFixed(2)}` : 'Total: —'}
                {o.coupon_code ? ` • coupon: ${o.coupon_code}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm whitespace-nowrap">{rightLine}</div>
              <button
                className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                onClick={async () => {
                  await addToCart({
                    peptide_id,
                    vendor_id: o.vendor_id,
                    offer_id: o.id,
                    kind,
                    quantity: 1,
                  });
                }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
