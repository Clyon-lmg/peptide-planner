'use server';

import { createServerActionSupabase } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { ensurePeptideAndInventory } from "@/app/(app)/inventory/actions";

export type ImportItem = {
    name: string;
    kind: 'peptide' | 'capsule';
    dose: number;
    schedule: string;
    every_n_days?: number;
    custom_days?: number[];
};

export async function createImportedProtocolAction(name: string, items: ImportItem[]) {
    const supabase = createServerActionSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: proto, error: protoErr } = await supabase
        .from('protocols')
        .insert({
            user_id: user.id,
            name: name || "Imported Protocol",
            is_active: false,
            start_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

    if (protoErr) throw new Error(protoErr.message);

    for (const item of items) {
        const { peptideId } = await ensurePeptideAndInventory(item.name, item.kind);

        await supabase.from('protocol_items').insert({
            protocol_id: proto.id,
            peptide_id: peptideId,
            dose_mg_per_administration: item.dose,
            schedule: item.schedule,
            every_n_days: item.every_n_days,
            custom_days: item.custom_days,
            color: "#60a5fa",
            time_of_day: "08:00"
        });
    }

    revalidatePath('/protocols');
    return proto;
}

// 🟢 NEW: Delete Action
export async function deleteProtocolAction(id: number) {
    const supabase = createServerActionSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
        .from('protocols')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Security: Ensure ownership

    if (error) throw new Error(error.message);

    revalidatePath('/protocols');
}
