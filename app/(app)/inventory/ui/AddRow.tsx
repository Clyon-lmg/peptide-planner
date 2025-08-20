// app/(app)/inventory/ui/AddRow.tsx
import {
  getKnownListsFiltered,
  addPeptideByIdAction,
  addCapsuleByIdAction,
  addCustomAction,
} from "../actions";

/**
 * Server component rendering the "Add Peptide / Add Capsule / Add Custom" row.
 * - Uses inline server action wrappers that return Promise<void> for strict TS.
 * - Peptide/Capsule dropdowns are filtered to the correct known lists.
 * - "Add Custom" includes radio choice (peptide or capsule).
 */
export default async function AddRow() {
  const { peptidesForVials, peptidesForCapsules } = await getKnownListsFiltered();

  // ---- Inline server action wrappers (must return Promise<void>) ----
  const addPeptide = async (formData: FormData) => {
    "use server";
    await addPeptideByIdAction(formData);
  };

  const addCapsule = async (formData: FormData) => {
    "use server";
    await addCapsuleByIdAction(formData);
  };

  const addCustom = async (formData: FormData) => {
    "use server";
    await addCustomAction(formData);
  };
  // -------------------------------------------------------------------

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Add Peptide (filtered to vial-capable items) */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium mb-3">Add Peptide</h2>
        <form action={addPeptide} className="grid grid-cols-[1fr_auto] gap-3">
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
        <form action={addCapsule} className="grid grid-cols-[1fr_auto] gap-3">
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
        <form action={addCustom} className="space-y-3">
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
  );
}
