// app/(app)/inventory/ui/InventoryList.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/layout/Card";
import AddOfferButton from "../AddOfferButton";
import type { SaveVialPayload, SaveCapsPayload } from "../actions";

export type VialItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  half_life_hours: number;
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
  half_life_hours: number;
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

function parseNum(value: string, allowEmpty = true) {
  if (allowEmpty && value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

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
  const router = useRouter();

  const currentVialValue = (
    item: VialItem,
    field: keyof Omit<VialItem, "id" | "peptide_id" | "canonical_name" | "remainingDoses" | "reorderDateISO">
  ) => (vialEdits[item.id] as any)?.[field] ?? (item as any)[field];

  const currentCapsValue = (
    item: CapsuleItem,
    field: keyof Omit<CapsuleItem, "id" | "peptide_id" | "canonical_name" | "remainingDoses" | "reorderDateISO">
  ) => (capsEdits[item.id] as any)?.[field] ?? (item as any)[field];

  const isVialDirty = (item: VialItem) => {
    const e = vialEdits[item.id];
    if (!e) return false;
    return (
      (e.vials !== undefined && Number(e.vials) !== Number(item.vials)) ||
      (e.mg_per_vial !== undefined && Number(e.mg_per_vial) !== Number(item.mg_per_vial)) ||
      (e.bac_ml !== undefined && Number(e.bac_ml) !== Number(item.bac_ml)) ||
      (e.half_life_hours !== undefined && Number(e.half_life_hours) !== Number(item.half_life_hours))
    );
  };

  const isCapsDirty = (item: CapsuleItem) => {
    const e = capsEdits[item.id];
    if (!e) return false;
    return (
      (e.bottles !== undefined && Number(e.bottles) !== Number(item.bottles)) ||
      (e.caps_per_bottle !== undefined && Number(e.caps_per_bottle) !== Number(item.caps_per_bottle)) ||
      (e.mg_per_cap !== undefined && Number(e.mg_per_cap) !== Number(item.mg_per_cap)) ||
      (e.half_life_hours !== undefined && Number(e.half_life_hours) !== Number(item.half_life_hours))
    );
  };

  const onChangeVial = (id: number, field: keyof SaveVialPayload, value: number | undefined) => {
    setVialEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id }), id, ...(value === undefined ? {} : { [field]: value }) } as SaveVialPayload,
    }));
  };

  const onChangeCaps = (id: number, field: keyof SaveCapsPayload, value: number | undefined) => {
    setCapsEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { id }), id, ...(value === undefined ? {} : { [field]: value }) } as SaveCapsPayload,
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

  const saveWrapper = async (key: string, fn: () => Promise<void>) => {
    setSavingIds((s) => new Set(s).add(key));
    try {
      await fn();
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const handleSaveVial = async (item: VialItem) => {
    if (!onSaveVial) return;
    const edited = vialEdits[item.id];
    if (!edited) return;

    const payload: SaveVialPayload = { id: item.id };
    if (edited.vials !== undefined && Number(edited.vials) !== Number(item.vials)) payload.vials = Number(edited.vials);
    if (edited.mg_per_vial !== undefined && Number(edited.mg_per_vial) !== Number(item.mg_per_vial))
      payload.mg_per_vial = Number(edited.mg_per_vial);
    if (edited.bac_ml !== undefined && Number(edited.bac_ml) !== Number(item.bac_ml))
      payload.bac_ml = Number(edited.bac_ml);
    if (
      edited.half_life_hours !== undefined &&
      Number(edited.half_life_hours) !== Number(item.half_life_hours)
    )
      payload.half_life_hours = Number(edited.half_life_hours);

    if (Object.keys(payload).length === 1) return; // nothing changed

    await saveWrapper(`vial-${item.id}`, async () => {
      await onSaveVial(payload);
        clearVial(item.id);
        router.refresh();
    });
  };

  const handleSaveCaps = async (item: CapsuleItem) => {
    if (!onSaveCapsule) return;
    const edited = capsEdits[item.id];
    if (!edited) return;

    const payload: SaveCapsPayload = { id: item.id };
    if (edited.bottles !== undefined && Number(edited.bottles) !== Number(item.bottles))
      payload.bottles = Number(edited.bottles);
    if (edited.caps_per_bottle !== undefined && Number(edited.caps_per_bottle) !== Number(item.caps_per_bottle))
      payload.caps_per_bottle = Number(edited.caps_per_bottle);
    if (edited.mg_per_cap !== undefined && Number(edited.mg_per_cap) !== Number(item.mg_per_cap))
      payload.mg_per_cap = Number(edited.mg_per_cap);
    if (
      edited.half_life_hours !== undefined &&
      Number(edited.half_life_hours) !== Number(item.half_life_hours)
    )
      payload.half_life_hours = Number(edited.half_life_hours);

    if (Object.keys(payload).length === 1) return;

    await saveWrapper(`cap-${item.id}`, async () => {
      await onSaveCapsule(payload);
        clearCaps(item.id);
        router.refresh();
    });
  };

  const handleDeleteVial = async (id: number) => {
    if (!onDeleteVial) return;
    await saveWrapper(`vial-${id}`, async () => {
      await onDeleteVial(id);
        clearVial(id);
        router.refresh();
    });
  };

  const handleDeleteCaps = async (id: number) => {
    if (!onDeleteCapsule) return;
    await saveWrapper(`cap-${id}`, async () => {
      await onDeleteCapsule(id);
        clearCaps(id);
        router.refresh();
    });
  };

  const Pill = ({ children }: { children: React.ReactNode }) => (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {children}
    </span>
  );

  return (
    <div className="space-y-8">
      {/* Vials */}
      <section className="space-y-4">
              <h2 className="pp-h2">Peptides (vials)</h2>
              {vials.length === 0 ? (
                  <p className="pp-subtle">No peptides yet.</p>
              ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
                      {vials.map((item) => {
                          const dirty = isVialDirty(item);
                          const saving = savingIds.has(`vial-${item.id}`);
                          const offers = offersVials[item.peptide_id] ?? [];
                          return (
                              <Card
                                  key={item.id}
                                  className="shadow-sm space-y-4 min-w-0"
                              >
                                  <div className="flex items-start justify-between">
                                      <h3 className="font-semibold">{item.canonical_name}</h3>
                                      <button
                                          type="button"
                                          onClick={() => handleDeleteVial(item.id)}
                                          className="btn text-xs bg-destructive hover:bg-destructive/90 text-white disabled:opacity-60" disabled={saving}
                      title="Delete from inventory"
                    >
                      {saving ? "…" : "Delete"}
                    </button>
                  </div>

                  {/* Forecast row */}
                  <div className="flex gap-2 text-xs" aria-live="polite">
                    <Pill>
                      Remaining doses: <span className="ml-1 font-semibold">{item.remainingDoses ?? "—"}</span>
                    </Pill>
                    <Pill>
                      Est. reorder: <span className="ml-1 font-semibold">{item.reorderDateISO ?? "—"}</span>
                    </Pill>
                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 min-w-0">
                                      <label className="flex flex-col w-full min-w-0 text-sm">
                                          Vials
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(currentVialValue(item, "vials") ?? "")}
                        onChange={(e) => onChangeVial(item.id, "vials", parseNum(e.target.value))}
                        disabled={saving}
                                              maxLength={10}
                                              className="mt-1 input !max-w-[10ch]"
                                              aria-label={`Vials for ${item.canonical_name}`}
                                          />
                    </label>
                                      <label className="flex flex-col w-full min-w-0 text-sm">
                      mg / vial
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={String(currentVialValue(item, "mg_per_vial") ?? "")}
                        onChange={(e) => onChangeVial(item.id, "mg_per_vial", parseNum(e.target.value))}
                        disabled={saving}
                                              maxLength={10}
                                              className="mt-1 input !max-w-[10ch]"
                                              aria-label={`mg per vial for ${item.canonical_name}`}
                      />
                    </label>
                                      <label className="flex flex-col w-full min-w-0 text-sm">
                      mL BAC
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={String(currentVialValue(item, "bac_ml") ?? "")}
                        onChange={(e) => onChangeVial(item.id, "bac_ml", parseNum(e.target.value))}
                        disabled={saving}
                                              maxLength={10}
                                              className="mt-1 input !max-w-[10ch]"
                                              aria-label={`BAC mL for ${item.canonical_name}`}
                      />
                    </label>
                                      <label className="flex flex-col w-full min-w-0 text-sm">
                      Half-life (hrs)
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={String(currentVialValue(item, "half_life_hours") ?? "")}
                        onChange={(e) => onChangeVial(item.id, "half_life_hours", parseNum(e.target.value))}
                        disabled={saving}
                                              maxLength={10}
                                              className="mt-1 input !max-w-[10ch]"
                                              aria-label={`Half-life hours for ${item.canonical_name}`}
                        />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveVial(item)}
                      disabled={!dirty || saving}
                                          className="btn bg-info hover:bg-info/90 text-sm text-white disabled:opacity-50"
                      title="Save changes"
                      aria-busy={saving}
                      aria-label={`Save ${item.canonical_name}`}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => clearVial(item.id)}
                                              className="btn text-sm"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {offers.length > 0 && (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {offers.map((o) => (
                         <div
                            key={o.id}
                                className="pp-card p-2 text-xs space-y-1"
                          >
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
                                    className="w-full btn text-xs bg-success hover:bg-success/90 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                              </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Capsules */}
      <section className="space-y-4">
              <h2 className="pp-h2">Capsules</h2>
        {capsules.length === 0 ? (
                  <p className="pp-subtle">No capsules yet.</p>

        ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
            {capsules.map((item) => {
              const dirty = isCapsDirty(item);
              const saving = savingIds.has(`cap-${item.id}`);
              const offers = offersCapsules[item.peptide_id] ?? [];
              return (
                  <Card
                      key={item.id}
                      className="shadow-sm space-y-4 min-w-0"                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{item.canonical_name}</h3>
                    <button
                      type="button"
                      onClick={() => handleDeleteCaps(item.id)}
                              className="btn text-xs bg-destructive hover:bg-destructive/90 text-white disabled:opacity-60"
                      disabled={saving}
                      title="Delete from inventory"
                      aria-label={`Delete ${item.canonical_name}`}
                    >
                      {saving ? "…" : "Delete"}
                    </button>
                      </div>

                  <div className="flex gap-2 text-xs" aria-live="polite">
                    <Pill>
                      Remaining doses: <span className="ml-1 font-semibold">{item.remainingDoses ?? "—"}</span>
                    </Pill>
                    <Pill>
                      Est. reorder: <span className="ml-1 font-semibold">{item.reorderDateISO ?? "—"}</span>
                    </Pill>
                  </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 min-w-0">
                          <label className="flex flex-col w-full min-w-0 text-sm">
                              Bottles
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(currentCapsValue(item, "bottles") ?? "")}
                        onChange={(e) => onChangeCaps(item.id, "bottles", parseNum(e.target.value))}
                        disabled={saving}
                        className="mt-1 input"
                        aria-label={`Bottles for ${item.canonical_name}`}
                      />
                    </label>
                          <label className="flex flex-col w-full min-w-0 text-sm">
                      Caps / bottle
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(currentCapsValue(item, "caps_per_bottle") ?? "")}
                        onChange={(e) => onChangeCaps(item.id, "caps_per_bottle", parseNum(e.target.value))}
                        disabled={saving}
                        className="mt-1 input"
                        aria-label={`Caps per bottle for ${item.canonical_name}`}
                      />
                    </label>
                          <label className="flex flex-col w-full min-w-0 text-sm">
                      mg / cap
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={String(currentCapsValue(item, "mg_per_cap") ?? "")}
                        onChange={(e) => onChangeCaps(item.id, "mg_per_cap", parseNum(e.target.value))}
                        disabled={saving}
                        className="mt-1 input"
                        aria-label={`mg per cap for ${item.canonical_name}`}
                      />
                    </label>
                          <label className="flex flex-col w-full min-w-0 text-sm">
                              Half-life (hrs)
                              <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  inputMode="decimal"
                                  value={String(currentCapsValue(item, "half_life_hours") ?? "")}
                                  onChange={(e) => onChangeCaps(item.id, "half_life_hours", parseNum(e.target.value))}
                                  disabled={saving}
                                  className="mt-1 input"
                                  aria-label={`Half-life hours for ${item.canonical_name}`}
                              />
                          </label>
                      </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCaps(item)}
                      disabled={!dirty || saving}
                              className="btn bg-info hover:bg-info/90 text-sm text-white disabled:opacity-50"
                      title="Save changes"
                      aria-busy={saving}
                      aria-label={`Save ${item.canonical_name}`}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => clearCaps(item.id)}
                        className="btn text-sm"
                        title="Discard changes"
                      >
                        Discard
                      </button>
                    )}
                  </div>

                  {offers.length > 0 && (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {offers.map((o) => (
                          <div
                            key={o.id}
                                className="pp-card p-2 text-xs space-y-1"
                          >
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
                                    className="w-full btn text-xs bg-success hover:bg-success/90 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
