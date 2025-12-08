// app/(app)/inventory/page.tsx
import { createServerComponentSupabase, createServerActionSupabase } from "@/lib/supabaseServer";
import Link from "next/link";
import { revalidatePath } from "next/cache";

import AddRow from "./ui/AddRow";
import InventoryList from "./ui/InventoryList";

import {
    getVialInventory,
    getCapsInventory,
    getKnownListsFiltered,
    deleteVialItemAction,
    deleteCapsuleItemAction,
    type VialRow,
    type CapsRow,
    type SaveVialPayload,
    type SaveCapsPayload,
} from "./actions";
import { forecastRemainingDoses, type Schedule } from "@/lib/forecast";

export const dynamic = "force-dynamic";

async function getUser() {
    const supabase = createServerComponentSupabase();
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data?.user ?? null };
}

export default async function InventoryPage() {
    const { supabase, user } = await getUser();
    if (!user) {
        return (
            <div className="mx-auto max-w-4xl p-4">
                <div className="rounded-xl border p-4">
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

    // Load inventory rows
    const [vialRows, capsRows, knownLists] = await Promise.all([
        getVialInventory(),
        getCapsInventory(),
        getKnownListsFiltered(),
    ]);
    const { peptidesForVials, peptidesForCapsules } = knownLists;

    // Get active protocol items for only the peptides we care about
    const peptideIds = [
        ...new Set([
            ...vialRows.map((r: VialRow) => r.peptide_id),
            ...capsRows.map((r: CapsRow) => r.peptide_id),
        ]),
    ];

    let protocolItemsByPeptide = new Map<
        number,
        {
            dose_mg_per_administration: number;
            schedule: Schedule;
            custom_days: number[] | null;
            cycle_on_weeks: number;
            cycle_off_weeks: number;
            every_n_days: number | null;
        }
    >();

    if (peptideIds.length > 0) {
        // Query active protocol + items for this user
        const { data: activeProto } = await supabase
            .from("protocols")
            .select("id")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .maybeSingle();

        if (activeProto?.id) {
            const { data: protoItems } = await supabase
                .from("protocol_items")
                .select("peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,titration_interval_days,titration_amount_mg")
                .eq("protocol_id", activeProto.id)
                .in("peptide_id", peptideIds);

            if (protoItems) {
                for (const pi of protoItems) {
                    protocolItemsByPeptide.set(pi.peptide_id, {
                        dose_mg_per_administration: Number(pi.dose_mg_per_administration || 0),
                        schedule: String(pi.schedule || "EVERYDAY") as Schedule,
                        custom_days: (pi.custom_days as number[] | null) ?? null,
                        cycle_on_weeks: Number(pi.cycle_on_weeks || 0),
                        cycle_off_weeks: Number(pi.cycle_off_weeks || 0),
                        every_n_days: (pi.every_n_days as number | null) ?? null,

                    });
                }
            }
        }
    }

    // ---------- Partial update server actions (no overwriting!) ----------
    const saveVial = async (p: SaveVialPayload) => {
        "use server";
        const sa = createServerActionSupabase();
        const { data: auth } = await sa.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Not signed in");

        const update: Record<string, number> = {};
        if (p.vials !== undefined) update.vials = Number(p.vials);
        if (p.mg_per_vial !== undefined) update.mg_per_vial = Number(p.mg_per_vial);
        if (p.bac_ml !== undefined) update.bac_ml = Number(p.bac_ml);
        if (p.half_life_hours !== undefined)
            update.half_life_hours = Number(p.half_life_hours);

        if (Object.keys(update).length === 0) return;

        const { error } = await sa
            .from("inventory_items")
            .update(update)
            .eq("id", p.id)
            .eq("user_id", uid);

        if (error) throw error;
        revalidatePath("/inventory");
        return;
    };

    const saveCapsule = async (p: SaveCapsPayload) => {
        "use server";
        const sa = createServerActionSupabase();
        const { data: auth } = await sa.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Not signed in");

        const update: Record<string, number> = {};
        if (p.bottles !== undefined) update.bottles = Number(p.bottles);
        if (p.caps_per_bottle !== undefined) update.caps_per_bottle = Number(p.caps_per_bottle);
        if (p.mg_per_cap !== undefined) update.mg_per_cap = Number(p.mg_per_cap);
        if (p.half_life_hours !== undefined)
            update.half_life_hours = Number(p.half_life_hours);

        if (Object.keys(update).length === 0) return;

        const { error } = await sa
            .from("inventory_capsules")
            .update(update)
            .eq("id", p.id)
            .eq("user_id", uid);

        if (error) throw error;
        revalidatePath("/inventory");
        return;
    };

    const deleteVial = async (id: number) => {
        "use server";
        const fd = new FormData();
        fd.set("id", String(id));
        await deleteVialItemAction(fd);
    };

    const deleteCapsule = async (id: number) => {
        "use server";
        const fd = new FormData();
        fd.set("id", String(id));
        await deleteCapsuleItemAction(fd);
    };
    // --------------------------------------------------------------------

    // Prepare serializable data for the client component, include forecasts
    const vialItems = vialRows
        .map((r) => {
            const proto = protocolItemsByPeptide.get(r.peptide_id);
            const { remainingDoses, reorderDateISO } = proto
                ? forecastRemainingDoses(
                    Number(r.vials || 0) * Number(r.mg_per_vial || 0),
                    proto.dose_mg_per_administration,
                    proto.schedule as Schedule,
                    proto.custom_days,
                    proto.cycle_on_weeks,
                    proto.cycle_off_weeks,
                    proto.every_n_days
                )
                : { remainingDoses: null, reorderDateISO: null };
            return {
                id: r.id,
                peptide_id: r.peptide_id,
                canonical_name: r.name,
                vials: r.vials,
                mg_per_vial: r.mg_per_vial,
                bac_ml: r.bac_ml,
                half_life_hours: r.half_life_hours,
                remainingDoses,
                reorderDateISO,
            };
        })
        .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

    const capItems = capsRows
        .map((r) => {
            const proto = protocolItemsByPeptide.get(r.peptide_id);
            const { remainingDoses, reorderDateISO } = proto
                ? forecastRemainingDoses(
                    Number(r.bottles || 0) *
                    Number(r.caps_per_bottle || 0) *
                    Number(r.mg_per_cap || 0),
                    proto.dose_mg_per_administration,
                    proto.schedule as Schedule,
                    proto.custom_days,
                    proto.cycle_on_weeks,
                    proto.cycle_off_weeks,
                    proto.every_n_days
                )
                : { remainingDoses: null, reorderDateISO: null };
            return {
                id: r.id,
                peptide_id: r.peptide_id,
                canonical_name: r.name,
                bottles: r.bottles,
                caps_per_bottle: r.caps_per_bottle,
                mg_per_cap: r.mg_per_cap,
                half_life_hours: r.half_life_hours,
                remainingDoses,
                reorderDateISO,
            };
        })
        .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

    return (
        <div className="mx-auto max-w-6xl p-4 space-y-8">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Inventory</h1>
            </header>

            {/* Adders row (client component) */}
            <AddRow
                peptidesForVials={peptidesForVials}
                peptidesForCapsules={peptidesForCapsules}
            />

            {/* Inventory cards (client component) */}
            <InventoryList
                vials={vialItems}
                capsules={capItems}
                onSaveVial={saveVial}
                onSaveCapsule={saveCapsule}
                onDeleteVial={deleteVial}
                onDeleteCapsule={deleteCapsule}
            />
        </div>
    );
}