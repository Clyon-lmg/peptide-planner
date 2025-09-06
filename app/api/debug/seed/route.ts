import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

async function seed() {
  const supabase = createServerActionSupabase();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) {
    return NextResponse.json(
      { ok: false, error: uerr?.message ?? "Not authenticated" },
      { status: 401 }
    );
  }
  const uid = user.id as string;

  try {
    // Clear existing user data to keep seed idempotent
    await supabase.from("doses").delete().eq("user_id", uid);
    await supabase.from("inventory_items").delete().eq("user_id", uid);
    await supabase.from("inventory_capsules").delete().eq("user_id", uid);

    const { data: oldLists } = await supabase
      .from("injection_site_lists")
      .select("id")
      .eq("user_id", uid);
    const listIds = (oldLists ?? []).map((l: any) => l.id);
    if (listIds.length) {
      await supabase.from("injection_sites").delete().in("list_id", listIds);
      await supabase.from("injection_site_lists").delete().in("id", listIds);
    }

    const { data: oldProt } = await supabase
      .from("protocols")
      .select("id")
      .eq("user_id", uid);
    const protIds = (oldProt ?? []).map((p: any) => p.id);
    if (protIds.length) {
      await supabase.from("protocol_items").delete().in("protocol_id", protIds);
      await supabase.from("protocols").delete().in("id", protIds);
    }

    // Fetch two peptides to work with
    const { data: peptides, error: pErr } = await supabase
      .from("peptides")
      .select("id")
      .limit(2);
    if (pErr) throw pErr;
    if (!peptides || peptides.length < 2) {
      throw new Error("Not enough peptides available to seed");
    }
    const p1 = Number(peptides[0].id);
    const p2 = Number(peptides[1].id);

    const today = new Date().toISOString().slice(0, 10);

    // Injection site list
    const { data: list, error: listErr } = await supabase
      .from("injection_site_lists")
      .insert({ name: "Demo Sites" })
      .select("id")
      .single();
    if (listErr) throw listErr;
    const siteListId = Number(list.id);

    const { error: siteErr } = await supabase.from("injection_sites").insert([
      { list_id: siteListId, name: "Left Arm", position: 1 },
      { list_id: siteListId, name: "Right Arm", position: 2 },
    ]);
    if (siteErr) throw siteErr;

    // Protocol
    const { data: proto, error: protoErr } = await supabase
      .from("protocols")
      .insert({
        user_id: uid,
        name: "Demo Protocol",
        start_date: today,
        is_active: true,
      })
      .select("id")
      .single();
    if (protoErr) throw protoErr;
    const protocolId = Number(proto.id);

    // Protocol items
    const { error: itemsErr } = await supabase.from("protocol_items").insert([
      {
        protocol_id: protocolId,
        peptide_id: p1,
        dose_mg_per_administration: 10,
        schedule: "EVERYDAY",
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
        every_n_days: null,
        titration_interval_days: null,
        titration_amount_mg: null,
        color: "#f87171",
        site_list_id: siteListId,
      },
      {
        protocol_id: protocolId,
        peptide_id: p2,
        dose_mg_per_administration: 5,
        schedule: "WEEKDAYS",
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
        every_n_days: null,
        titration_interval_days: null,
        titration_amount_mg: null,
        color: "#60a5fa",
        site_list_id: null,
      },
    ]);
    if (itemsErr) throw itemsErr;
    // Inventory
    const { error: vialErr } = await supabase.from("inventory_items").insert({
      user_id: uid,
      peptide_id: p1,
      vials: 2,
      mg_per_vial: 10,
      bac_ml: 2,
    });
    if (vialErr) throw vialErr;

    const { error: capErr } = await supabase.from("inventory_capsules").insert({
      user_id: uid,
      peptide_id: p2,
      bottles: 1,
      caps_per_bottle: 30,
      mg_per_cap: 5,
    });
    if (capErr) throw capErr;

    // Doses for next 7 days
    const doseRows: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      doseRows.push({
        user_id: uid,
        protocol_id: protocolId,
        peptide_id: p1,
        dose_mg: 10,
        date: iso,
        date_for: iso,
        status: "PENDING",
      });
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        doseRows.push({
          user_id: uid,
          protocol_id: protocolId,
          peptide_id: p2,
          dose_mg: 5,
          date: iso,
          date_for: iso,
          status: "PENDING",
        });
      }
    }
    if (doseRows.length) {
      const { error: doseErr } = await supabase.from("doses").insert(doseRows);
      if (doseErr) throw doseErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return seed();
}

export async function POST() {
  return seed();
}
