// app/(app)/inventory/ui/InventoryList.tsx
"use client";

import * as React from "react";

export type VialItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
};

export type CapsuleItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
};

type SaveVialPayload = Pick<VialItem, "id" | "vials" | "mg_per_vial" | "bac_ml">;
type SaveCapsPayload = Pick<CapsuleItem, "id" | "bottles" | "caps_per_bottle" | "mg_per_cap">;

export type InventoryListProps = {
  vials: VialItem[];
  capsules: CapsuleItem[];
  // Callbacks from the parent page (usually server actions wrapped client-side)
  onSaveVial?: (payload: SaveVialPayload) => Promise<void> | void;
  onSaveCapsule?: (payload: SaveCapsPayload) => Promise<void> | void;
  onDeleteVial?: (id: number) => Promise<void> | void;
  onDeleteCapsule?: (id: number) => Promise<void> | void;
  // Optional render props for embedded offers (3 across etc.)
  renderVialOffers?: (peptideId: number) => React.ReactNode;
  renderCapsuleOffers?: (peptideId: number) => React.ReactNode;
};

/**
 * InventoryList
 * - Client-side presentational component with local edit state per item
 * - Inline Save (blue), Delete (red)
 * - Optional offers section via render props
 * - Pure Tailwind, no external UI components
 */
export default function InventoryList({
  vials,
  capsules,
  onSaveVial,
  onSaveCapsule,
  onDeleteVial,
  onDeleteCapsule,
  renderVialOffers,
  renderCapsuleOffers,
}: InventoryListProps) {
  // Local edit state maps keyed by item.id
  const [vialEdits, setVialEdits] = React.useState<Record<number, SaveVialPayload>>({});
  const [capsEdits, setCapsEdits] = React.useState<Record<number, SaveCapsPayload>>({});
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set()); // e.g., "vial-12", "cap-7"

  // Helpers to get current editable values, falling back to item props
  const getVialEdit = (item: VialItem): SaveVialPayload => {
    return (
      vialEdits[item.id] ?? {
        id: item.id,
        vials: Number(item.vials ?? 0),
        mg_per_vial: Number(item.mg_per_vial ?? 0),
        bac_ml: Number(item.bac_ml ?? 0),
      }
    );
  };
  const getCapsEdit = (item: CapsuleItem): SaveCapsPayload => {
    return (
      capsEdits[item.id] ?? {
        id: item.id,
        bottles: Number(item.bottles ?? 0),
        caps_per_bottle: Number(item.caps_per_bottle ?? 0),
        mg_per_cap: Number(item.mg_per_cap ?? 0),
      }
    );
  };

  // Dirty checks
  const isVialDirty = (item: VialItem) => {
    const e = vialEdits[item.id];
    if (!e) return false;
    return (
      Number(e.vials) !== Number(item.vials) ||
      Number(e.mg_per_vial) !== Number(item.mg_per_vial) ||
      Number(e.bac_ml) !== Number(item.bac_ml)
    );
    };
  const isCapsDirty = (item: CapsuleItem) => {
    const e = capsEdits[item.id];
    if (!e) return false;
    return (
      Number(e.bottles) !== Number(item.bottles) ||
      Number(e.caps_per_bottle) !== Number(item.caps_per_bottle) ||
      Number(e.mg_per_cap) !== Number(item.mg_per_cap)
    );
  };

  // Input change handlers
  const onChangeVial = (id: number, field: keyof SaveVialPayload, value: number) => {
    setVialEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id, vials: 0, mg_per_vial: 0, bac_ml: 0 }), [field]: value },
    }));
  };
  const onChangeCaps = (id: number, field: keyof SaveCapsPayload, value: number) => {
    setCapsEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id, bottles: 0, caps_per_bottle: 0, mg_per_cap: 0 }), [field]: value },
    }));
  };

  // Save handlers
  const handleSaveVial = async (item: VialItem) => {
    if (!onSaveVial) return;
    const payload = getVialEdit(item);
    const key = `vial-${item.id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onSaveVial(payload);
      // After successful save, clear dirty state by syncing to latest item props:
      setVialEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const handleSaveCaps = async (item: CapsuleItem) => {
    if (!onSaveCapsule) return;
    const payload = getCapsEdit(item);
    const key = `cap-${item.id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onSaveCapsule(payload);
      setCapsEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  // Reset handlers (discard edits)
  const resetVial = (id: number) =>
    setVialEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const resetCaps = (id: number) =>
    setCapsEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  // Delete handlers
  const handleDeleteVial = async (id: number) => {
    if (!onDeleteVial) return;
    const key = `vial-${id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onDeleteVial(id);
      // Clean any local state for this row
      resetVial(id);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const handleDeleteCaps = async (id: number) => {
    if (!onDeleteCapsule) return;
    const key = `cap-${id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onDeleteCapsule(id);
      resetCaps(id);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Vial items */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Peptides (vials)</h2>
        {vials.length === 0 ? (
          <p className="text-sm text-gray-500">No peptides yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vials.map((item) => {
              const edit = getVialEdit(item);
              const dirty = isVialDirty(item);
              const saving = savingIds.has(`vial-${item.id}`);
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{item.canonical_name}</h3>
                    <button
                      type="button"
                      onClick={() => handleDeleteVial(item.id)}
                      className="text-xs rounded px-2 py-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                      disabled={saving}
                      title="Delete from inventory"
                    >
                      {saving ? "…" : "Delete"}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm">
                      Vials
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(edit.vials) ? edit.vials : 0}
                        onChange={(e) => onChangeVial(item.id, "vials", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mg / vial
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={Number.isFinite(edit.mg_per_vial) ? edit.mg_per_vial : 0}
                        onChange={(e) => onChangeVial(item.id, "mg_per_vial", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mL BAC
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={Number.isFinite(edit.bac_ml) ? edit.bac_ml : 0}
                        onChange={(e) => onChangeVial(item.id, "bac_ml", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveVial(item)}
                      disabled={!dirty || saving}
                      className="rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      title="Save changes"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => resetVial(item.id)}
                        className="rounded px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {typeof renderVialOffers === "function" ? (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {renderVialOffers(item.peptide_id)}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Capsule items */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Capsules</h2>
        {capsules.length === 0 ? (
          <p className="text-sm text-gray-500">No capsules yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {capsules.map((item) => {
              const edit = getCapsEdit(item);
              const dirty = isCapsDirty(item);
              const saving = savingIds.has(`cap-${item.id}`);
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{item.canonical_name}</h3>
                    <button
                      type="button"
                      onClick={() => handleDeleteCaps(item.id)}
                      className="text-xs rounded px-2 py-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                      disabled={saving}
                      title="Delete from inventory"
                    >
                      {saving ? "…" : "Delete"}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm">
                      Bottles
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(edit.bottles) ? edit.bottles : 0}
                        onChange={(e) => onChangeCaps(item.id, "bottles", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      Caps / bottle
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(edit.caps_per_bottle) ? edit.caps_per_bottle : 0}
                        onChange={(e) =>
                          onChangeCaps(item.id, "caps_per_bottle", Number(e.target.value))
                        }
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mg / cap
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={Number.isFinite(edit.mg_per_cap) ? edit.mg_per_cap : 0}
                        onChange={(e) => onChangeCaps(item.id, "mg_per_cap", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCaps(item)}
                      disabled={!dirty || saving}
                      className="rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      title="Save changes"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => resetCaps(item.id)}
                        className="rounded px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {typeof renderCapsuleOffers === "function" ? (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {renderCapsuleOffers(item.peptide_id)}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
