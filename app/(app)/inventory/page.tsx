// app/(app)/inventory/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import AddOfferButton from "./AddOfferButton";
import {
  getKnownListsFiltered,
  getVialInventory,
  getCapsInventory,
  getOffersForVials,
  getOffersForCaps,
  addPeptideByIdAction,
  addCapsuleByIdAction,
  addCustomAction,
  addOfferToCartAction,
  updateVialItemAction,
  updateCapsuleItemAction,
  deleteVialItemAction,
  deleteCapsuleItemAction,
  type VialRow,
  type CapsRow,
  type OfferVial,
  type OfferCaps,
} from "./actions";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

export default async function InventoryPage() {
  const { user } = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border p-6">
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-2 text-sm">
            You’re not signed in.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to manage inventory.
          </p>
        </div>
      </div>
    );
  }

  const [{ peptidesForVials, peptidesForCapsules }, vialRows, capsRows] =
    await Promise.all([getKnownListsFiltered(), getVialInventory(), getCapsInventory()]);

  // offers per item (top 3 each)
  const vialOfferMap = await getOffersForVials(vialRows.map((r) => r.peptide_id));
  const capsOfferMap = await getOffersForCaps(capsRows.map((r) => r.peptide_id));

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Link href="/cart" className="text-sm underline">
          Go to Cart
        </Link>
      </header>

      {/* Adders row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Add Peptide (filtered to vial-capable items) */}
        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Add Peptide</h2>
          <form
            action={addPeptideByIdAction}
            className="grid grid-cols-[1fr_auto] gap-3"
          >
            <select
              name="peptide_id"
              className="rounded border px-2 py-2 w-full max-w-full"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select peptide…
              </option>
              {peptidesForVials.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonical_name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
              type="submit"
            >
              Add
            </button>
          </form>
        </div>

        {/* Add Capsule (filtered to capsule-capable items) */}
        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Add Capsule</h2>
          <form
            action={addCapsuleByIdAction}
            className="grid grid-cols-[1fr_auto] gap-3"
          >
            <select
              name="peptide_id"
              className="rounded border px-2 py-2 w-full max-w-full"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select capsule…
              </option>
              {peptidesForCapsules.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonical_name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
              type="submit"
            >
              Add
            </button>
          </form>
        </div>

        {/* Add Custom (radio: peptide or capsule) */}
        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Add Custom</h2>
          <form action={addCustomAction} className="space-y-3">
            <label className="block text-sm">
              Name
              <input
                name="name"
                type="text"
                placeholder="e.g., BPC-157"
                className="mt-1 w-full rounded border px-2 py-2"
                required
              />
            </label>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="kind" value="peptide" defaultChecked />
                Peptide (vial)
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="kind" value="capsule" />
                Capsule
              </label>
            </div>
            <button
              className="rounded-lg px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
              type="submit"
            >
              Add
            </button>
          </form>
        </div>
      </section>

      {/* Vial Inventory */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Peptides (vials)</h2>
        {vialRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No peptides yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vialRows.map((row) => {
              const offers = (vialOfferMap.get(row.peptide_id) ?? []) as OfferVial[];
              return (
                <div key={row.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{row.name}</h3>
                    <form action={deleteVialItemAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        className="text-xs rounded px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                        title="Delete from inventory"
                        type="submit"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  {/* Editable fields */}
                  <form action={updateVialItemAction} className="grid grid-cols-3 gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <label className="text-sm">
                      Vials
                      <input
                        name="vials"
                        type="number"
                        min={0}
                        defaultValue={row.vials}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mg / vial
                      <input
                        name="mg_per_vial"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={row.mg_per_vial}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mL BAC
                      <input
                        name="bac_ml"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={row.bac_ml}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <div className="col-span-3">
                      <button
                        className="rounded-lg px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                        type="submit"
                      >
                        Save
                      </button>
                    </div>
                  </form>

                  {/* Offers embedded (compact, 3 across, no qty input) */}
                  {offers.length > 0 && (
                    <div className="mt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {offers.map((o) => (
                          <div
                            key={o.id}
                            className="rounded-md border p-2 text-xs space-y-1"
                          >
                            <div className="font-semibold truncate">{o.vendor_name}</div>
                            <div>Price: ${o.price.toFixed(2)}</div>
                            <div>mL per vial: {o.bac_ml ?? "—"}</div>

                            {/* Client button to call server action & toast on success */}
                            <AddOfferButton
                              action={addOfferToCartAction}
                              payload={{
                                vendor_id: o.vendor_id,
                                peptide_id: row.peptide_id,
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

      {/* Capsule Inventory */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Capsules</h2>
        {capsRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No capsules yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {capsRows.map((row) => {
              const offers = (capsOfferMap.get(row.peptide_id) ?? []) as OfferCaps[];
              return (
                <div key={row.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{row.name}</h3>
                    <form action={deleteCapsuleItemAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        className="text-xs rounded px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                        title="Delete from inventory"
                        type="submit"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  {/* Editable fields */}
                  <form action={updateCapsuleItemAction} className="grid grid-cols-3 gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <label className="text-sm">
                      Bottles
                      <input
                        name="bottles"
                        type="number"
                        min={0}
                        defaultValue={row.bottles}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      Caps / bottle
                      <input
                        name="caps_per_bottle"
                        type="number"
                        min={0}
                        defaultValue={row.caps_per_bottle}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="text-sm">
                      mg / cap
                      <input
                        name="mg_per_cap"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={row.mg_per_cap}
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <div className="col-span-3">
                      <button
                        className="rounded-lg px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                        type="submit"
                      >
                        Save
                      </button>
                    </div>
                  </form>

                  {/* Offers embedded (compact, 3 across, no qty input) */}
                  {offers.length > 0 && (
                    <div className="mt-1">
                      <div className="text-sm font-medium mb-1">Offers</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {offers.map((o) => (
                          <div
                            key={o.id}
                            className="rounded-md border p-2 text-xs space-y-1"
                          >
                            <div className="font-semibold truncate">{o.vendor_name}</div>
                            <div>Price: ${o.price.toFixed(2)}</div>
                            <div>mg / cap: {o.mg_per_cap ?? "—"}</div>
                            <div>caps / bottle: {o.caps_per_bottle ?? "—"}</div>

                            <AddOfferButton
                              action={addOfferToCartAction}
                              payload={{
                                vendor_id: o.vendor_id,
                                peptide_id: row.peptide_id,
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
