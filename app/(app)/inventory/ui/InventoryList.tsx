// app/(app)/inventory/ui/InventoryList.tsx
"use client";

import * as React from "react";
import AddOfferButton from "../AddOfferButton";

export type VialItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  remainingDoses: number | null;
  reorderDateISO: string | null;
};

export type CapsuleItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
  remainingDoses: number | null;
  reorderDateISO: string | null;
};

export type OfferVial = {
  id: number;
  vendor_id: number;
  vendor_name: string;
  price: number;
  bac_ml: number | null;
};

export type OfferCaps = {
  id: number;
  vendor_id: number;
  vendor_name: string;
  price: number;
  mg_per_cap: number | null;
  caps_per_bottle: number | null;
};

// NOTE: fields are now optional for partial updates
type SaveVialPayload = { id: number; vials?: number; mg_per_vial?: number; bac_ml?: number };
type SaveCapsPayload = { id: number; bottles?: number; caps_per_bottle?: number; mg_per_cap?: number };

export type InventoryListProps = {
  vials: VialItem[];
  capsules: CapsuleItem[];
  offersVials: Record<number, OfferVial[]>;
  offersCapsules: Record<number, OfferCaps[]>;
  onSaveVial?: (payload: SaveVialPayload) => Promise<void> | void;
  onSaveCapsule?: (payload: SaveCapsPayload) => Promise<void> | void;
  onDeleteVial?: (id: number) => Promise<void> | void;
  onDeleteCapsule?: (id: number) => Promise<void> | void;
  addOfferToCart: (formData: FormData) => Promise<any>;
};

export default function InventoryList({
  vials,
  capsules,
  offersVials,
  offersCapsules,
  onSaveVial,
  onSaveCapsule,
  onDeleteVial,
  onDeleteCapsule,
  addOfferToCart,
}: InventoryListProps) {
  const [vialEdits, setVialEdits] = React.useState<Record<number, SaveVialPayload>>({});
  const [capsEdits, setCapsEdits] = React.useState<Record<number, SaveCapsPayload>>({});
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());

  const currentVialValue = (item: VialItem, field: keyof Omit<VialItem, "id" | "peptide_id" | "canonical_name" | "remainingDoses" | "reorderDateISO">) =>
    (vialEdits[item.id] as any)?.[field] ?? (item as any)[field];

  const currentCapsValue = (item: CapsuleItem, field: keyof Omit<CapsuleItem, "id" | "peptide_id" | "canonical_name" | "remainingDoses" | "reorderDateISO">) =>
    (capsEdits[item.id] as any)?.[field] ?? (item as any)[field];

  const isVialDirty = (item: VialItem) => {
    const e = vialEdits[item.id];
    if (!e) return false;
    return (
      (e.vials !== undefined && Number(e.vials) !== Number(item.vials)) ||
      (e.mg_per_vial !== undefined && Number(e.mg_per_vial) !== Number(item.mg_per_vial)) ||
      (e.bac_ml !== undefined && Number(e.bac_ml) !== Number(item.bac_ml))
    );
  };

  const isCapsDirty = (item: CapsuleItem) => {
    const e = capsEdits[item.id];
    if (!e) return false;
    return (
      (e.bottles !== undefined && Number(e.bottles) !== Number(item.bottles)) ||
      (e.caps_per_bottle !== undefined && Number(e.caps_per_bottle) !== Number(item.caps_per_bottle)) ||
      (e.mg_per_cap !== undefined && Number(e.mg_per_cap) !== Number(item.mg_per_cap))
    );
  };

  const onChangeVial = (id: number, field: keyof SaveVialPayload, value: number) => {
    setVialEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id }), id, [field]: value },
    }));
  };

  const onChangeCaps = (id: number, field: keyof SaveCapsPayload, value: number) => {
    setCapsEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id }), id, [field]: value },
    }));
  };

  const clearVial = (id: number) =>
    setVialEdits((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });

  const clearCaps = (id: number) =>
    setCapsEdits((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });

  const handleSaveVial = async (item: VialItem) => {
    if (!onSaveVial) return;
    const edited = vialEdits[item.id];
    if (!edited) return;

    // send only changed fields
    const payload: SaveVialPayload = { id: item.id };
    if (edited.vials !== undefined && Number(edited.vials) !== Number(item.vials)) payload.vials = Number(edited.vials);
    if (edited.mg_per_vial !== undefined && Number(edited.mg_per_vial) !== Number(item.mg_per_vial)) payload.mg_per_vial = Number(edited.mg_per_vial);
    if (edited.bac_ml !== undefined && Number(edited.bac_ml) !== Number(item.bac_ml)) payload.bac_ml = Number(edited.bac_ml);

    if (Object.keys(payload).length === 1) return; // nothing changed

    const key = `vial-${item.id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onSaveVial(payload);
      clearVial(item.id);
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
    const edited = capsEdits[item.id];
    if (!edited) return;

    const payload: SaveCapsPayload = { id: item.id };
    if (edited.bottles !== undefined && Number(edited.bottles) !== Number(item.bottles)) payload.bottles = Number(edited.bottles);
    if (edited.caps_per_bottle !== undefined && Number(edited.caps_per_bottle) !== Number(item.caps_per_bottle)) payload.caps_per_bottle = Number(edited.caps_per_bottle);
    if (edited.mg_per_cap !== undefined && Number(edited.mg_per_cap) !== Number(item.mg_per_cap)) payload.mg_per_cap = Number(edited.mg_per_cap);

    if (Object.keys(payload).length === 1) return;

    const key = `cap-${item.id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onSaveCapsule(payload);
      clearCaps(item.id);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const handleDeleteVial = async (id: number) => {
    if (!onDeleteVial) return;
    const key = `vial-${id}`;
    setSavingIds((s) => new Set(s).add(key));
    try {
      await onDeleteVial(id);
      clearVial(id);
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
      clearCaps(id);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{children}</span>
  );

  return (
    <div className="space-y-8">
      {/* Vials */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Peptides (vials)</h2>
        {vials.length === 0 ? (
          <p className="text-sm text-gray-500">No peptides yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vials.map((item) => {
              const dirty = isVialDirty(item);
              const saving = savingIds.has(`vial-${item.id}`);
              const offers = offersVials[item.peptide_id] ?? [];
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

                  {/* Forecast row */}
                  <div className="flex gap-2 text-xs">
                    <Pill>
                      Remaining doses:{" "}
                      <span className="ml-1 font-semibold">
                        {item.remainingDoses ?? "—"}
                      </span>
                    </Pill>
                    <Pill>
                      Est. reorder:{" "}
                      <span className="ml-1 font-semibold">
                        {item.reorderDateISO ?? "—"}
                      </span>
                    </Pill>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm">
                      Vials
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(currentVialValue(item, "vials") as number) ? (currentVialValue(item, "vials") as number) : 0}
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
                        value={Number.isFinite(currentVialValue(item, "mg_per_vial") as number) ? (currentVialValue(item, "mg_per_vial") as number) : 0}
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
                        value={Number.isFinite(currentVialValue(item, "bac_ml") as number) ? (currentVialValue(item, "bac_ml") as number) : 0}
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
                        onClick={() => clearVial(item.id)}
                        className="rounded px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {offers.length > 0 && (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {offers.map((o) => (
                          <div key={o.id} className="rounded-md border p-2 text-xs space-y-1">
                            <div className="font-semibold truncate">{o.vendor_name}</div>
                            <div>Price: ${o.price.toFixed(2)}</div>
                            <div>mL per vial: {o.bac_ml ?? "—"}</div>
                            <AddOfferButton
                              action={addOfferToCart}
                              payload={{
                                vendor_id: o.vendor_id,
                                peptide_id: item.peptide_id,
                                kind: "vial",
                                quantity: 1,
                              }}
                              label="Add"
                              className="w-full rounded px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Capsules */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Capsules</h2>
        {capsules.length === 0 ? (
          <p className="text-sm text-gray-500">No capsules yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {capsules.map((item) => {
              const dirty = isCapsDirty(item);
              const saving = savingIds.has(`cap-${item.id}`);
              const offers = offersCapsules[item.peptide_id] ?? [];
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

                  {/* Forecast row */}
                  <div className="flex gap-2 text-xs">
                    <Pill>
                      Remaining doses:{" "}
                      <span className="ml-1 font-semibold">
                        {item.remainingDoses ?? "—"}
                      </span>
                    </Pill>
                    <Pill>
                      Est. reorder:{" "}
                      <span className="ml-1 font-semibold">
                        {item.reorderDateISO ?? "—"}
                      </span>
                    </Pill>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm">
                      Bottles
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(currentCapsValue(item, "bottles") as number) ? (currentCapsValue(item, "bottles") as number) : 0}
                        onChange={(e) => onChangeCaps(item.id, "bottles", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      Caps / bottle
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(currentCapsValue(item, "caps_per_bottle") as number) ? (currentCapsValue(item, "caps_per_bottle") as number) : 0}
                        onChange={(e) => onChangeCaps(item.id, "caps_per_bottle", Number(e.target.value))}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mg / cap
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={Number.isFinite(currentCapsValue(item, "mg_per_cap") as number) ? (currentCapsValue(item, "mg_per_cap") as number) : 0}
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
                        onClick={() => clearCaps(item.id)}
                        className="rounded px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {offers.length > 0 && (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {offers.map((o) => (
                          <div key={o.id} className="rounded-md border p-2 text-xs space-y-1">
                            <div className="font-semibold truncate">{o.vendor_name}</div>
                            <div>Price: ${o.price.toFixed(2)}</div>
                            <div>mg / cap: {o.mg_per_cap ?? "—"}</div>
                            <div>caps / bottle: {o.caps_per_bottle ?? "—"}</div>
                            <AddOfferButton
                              action={addOfferToCart}
                              payload={{
                                vendor_id: o.vendor_id,
                                peptide_id: item.peptide_id,
                                kind: "capsule",
                                quantity: 1,
                              }}
                              label="Add"
                              className="w-full rounded px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
