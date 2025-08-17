import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
export const dynamic = "force-dynamic"
async function PeptideOptions(){
  const supabase=createServerComponentClient({ cookies })
  const { data:opts } = await supabase.from("peptides").select("id, canonical_name").order("canonical_name")
  return <>{(opts??[]).map((p:any)=><option key={p.id} value={p.id}>{p.canonical_name}</option>)}</>
}
export default async function InventoryPage(){
  const supabase=createServerComponentClient({ cookies })
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) return <div className="pp-card">Please sign in.</div>
  const { data: vials } = await supabase.from("inventory_items").select("id, peptide_id, vials, mg_per_vial, bac_ml, peptides:peptide_id(canonical_name)").eq("user_id", user.id).order("id")
  const { data: caps }  = await supabase.from("inventory_capsules").select("id, peptide_id, bottles, caps_per_bottle, mg_per_cap, peptides:peptide_id(canonical_name)").eq("user_id", user.id).order("id")
  return <div className="grid gap-6">
    <div className="pp-card">
      <div className="pp-h2">Add Vial Inventory</div>
      <form action={async(formData)=>{ "use server"; const a=await import("./server");
        await a.addVialItem(Number(formData.get("peptide_id")), Number(formData.get("vials")), Number(formData.get("mg_per_vial")), Number(formData.get("bac_ml")))
      }} className="grid md:grid-cols-5 gap-2 mt-3">
        <select name="peptide_id" className="input"><PeptideOptions /></select>
        <input className="input" name="vials" type="number" step="1" placeholder="Vials"/>
        <input className="input" name="mg_per_vial" type="number" step="0.01" placeholder="mg/vial"/>
        <input className="input" name="bac_ml" type="number" step="0.01" placeholder="BAC ml"/>
        <button className="btn">Add</button>
      </form>
    </div>
    <div className="pp-card">
      <div className="pp-h2">Add Capsule Inventory</div>
      <form action={async(formData)=>{ "use server"; const a=await import("./server");
        await a.addCapsItem(Number(formData.get("peptide_id")), Number(formData.get("bottles")), Number(formData.get("caps_per_bottle")), Number(formData.get("mg_per_cap")))
      }} className="grid md:grid-cols-5 gap-2 mt-3">
        <select name="peptide_id" className="input"><PeptideOptions /></select>
        <input className="input" name="bottles" type="number" step="1" placeholder="Bottles"/>
        <input className="input" name="caps_per_bottle" type="number" step="1" placeholder="Caps/bottle"/>
        <input className="input" name="mg_per_cap" type="number" step="0.01" placeholder="mg/cap"/>
        <button className="btn">Add</button>
      </form>
    </div>
    <div className="grid-cards">
      {(vials??[]).map((inv:any)=><div key={`vial-${inv.id}`} className="pp-card">
        <div className="text-lg font-semibold">{inv.peptides?.canonical_name ?? `#${inv.peptide_id}`}</div>
        <div className="pp-subtle mt-1">Vials: {inv.vials ?? 0}</div>
        <div className="pp-subtle">mg/vial: {Number(inv.mg_per_vial??0)}</div>
        <div className="pp-subtle">BAC ml: {Number(inv.bac_ml??0)}</div>
        <div className="flex gap-2 mt-3">
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateVialQty(inv.id, (inv.vials??0)+1) }}><button className="btn">+1 vial</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateVialQty(inv.id, Math.max(0,(inv.vials??0)-1)) }}><button className="btn">-1 vial</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.deleteVial(inv.id) }}><button className="btn">Delete</button></form>
        </div>
      </div>)}
      {(caps??[]).map((inv:any)=><div key={`cap-${inv.id}`} className="pp-card">
        <div className="text-lg font-semibold">{inv.peptides?.canonical_name ?? `#${inv.peptide_id}`}</div>
        <div className="pp-subtle mt-1">Bottles: {inv.bottles ?? 0}</div>
        <div className="pp-subtle">Caps/bottle: {inv.caps_per_bottle ?? 0}</div>
        <div className="pp-subtle">mg/cap: {Number(inv.mg_per_cap??0)}</div>
        <div className="flex gap-2 mt-3">
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.deleteCaps(inv.id) }}><button className="btn">Delete</button></form>
        </div>
      </div>)}
    </div>
  </div>
}
