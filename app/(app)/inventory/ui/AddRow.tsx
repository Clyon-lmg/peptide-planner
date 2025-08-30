"use client";

// app/(app)/inventory/ui/AddRow.tsx
import * as React from "react";
import { useRouter } from "next/navigation";
import {
    addPeptideByIdAction,
    addCapsuleByIdAction,
    addCustomAction,
    type KnownItem,
} from "../actions";

type AddRowProps = {
    peptidesForVials: KnownItem[];
    peptidesForCapsules: KnownItem[];
};

/**
 * Client component rendering the "Add Peptide / Add Capsule / Add Custom" row.
 * Uses `useTransition` and `router.refresh()` to optimistically show progress
 * and optionally appends the added item to a local list for immediate feedback.
 */
export default function AddRow({
    peptidesForVials,
    peptidesForCapsules,
}: AddRowProps) {
    const router = useRouter();
    const [isPending, startTransition] = React.useTransition();
    const [addedItems, setAddedItems] = React.useState<string[]>([]);

    const handlePeptide = async (formData: FormData) => {
        const id = Number(formData.get("peptide_id"));
        const name = peptidesForVials.find((p) => p.id === id)?.canonical_name;
        startTransition(async () => {
            await addPeptideByIdAction(formData);
            if (name) setAddedItems((prev) => [...prev, name]);
            router.refresh();
        });
    };

    const handleCapsule = async (formData: FormData) => {
        const id = Number(formData.get("peptide_id"));
        const name = peptidesForCapsules.find((p) => p.id === id)?.canonical_name;
        startTransition(async () => {
            await addCapsuleByIdAction(formData);
            if (name) setAddedItems((prev) => [...prev, name]);
            router.refresh();
        });
    };

    const handleCustom = async (formData: FormData) => {
        const name = String(formData.get("name") || "Custom item");
        startTransition(async () => {
            await addCustomAction(formData);
            setAddedItems((prev) => [...prev, name]);
            router.refresh();
        });
    };

    return (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {/* Add Peptide (filtered to vial-capable items) */}
            <div className="rounded-xl border p-4">
                <h2 className="font-medium mb-3">Add Peptide</h2>
                <form action={handlePeptide} className="grid grid-cols-[1fr_auto] gap-3">
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
                        disabled={isPending}
                    >
                        {isPending ? "Adding..." : "Add"}
                    </button>
                </form>
            </div>

            {/* Add Capsule (filtered to capsule-capable items) */}
            <div className="rounded-xl border p-4">
                <h2 className="font-medium mb-3">Add Capsule</h2>
                <form action={handleCapsule} className="grid grid-cols-[1fr_auto] gap-3">
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
                        disabled={isPending}
                    >
                        {isPending ? "Adding..." : "Add"}
                    </button>
                </form>
            </div>

            {/* Add Custom (radio: peptide or capsule) */}
            <div className="rounded-xl border p-4">
                <h2 className="font-medium mb-3">Add Custom</h2>
                <form action={handleCustom} className="space-y-3">
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
                        disabled={isPending}
                    >
                        {isPending ? "Adding..." : "Add"}
                    </button>
                </form>
            </div>

            {addedItems.length > 0 && (
                <div className="sm:col-span-2 md:col-span-3 text-sm text-gray-600">
                    <h3 className="font-medium mb-1">Recently added</h3>
                    <ul className="list-disc list-inside">
                        {addedItems.map((name, idx) => (
                            <li key={idx}>{name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
