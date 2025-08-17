import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
export const dynamic = "force-dynamic"
export default async function CartPage(){
  const supabase=createServerComponentClient({ cookies })
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) return <div className="pp-card">Please sign in.</div>
  const { data: items, error } = await supabase.from("cart_items").select("id, peptide_id, qty, price, peptides:peptide_id(canonical_name)").eq("user_id", user.id).order("id")
  if(error) return <div className="pp-card">Error: {error.message}</div>
  const total = (items??[]).reduce((s:any, it:any)=> s + Number(it.qty??0)*Number(it.price??0), 0)
  return <div className="grid gap-6">
    <div className="pp-card">
      <div className="pp-h2">Add to Cart</div>
      <form action={async(fd)=>{ "use server"; const a=await import("./server");
        await a.addCartItem(Number(fd.get('peptide_id')), Number(fd.get('qty')), Number(fd.get('price')))
      }} className="grid md:grid-cols-4 gap-2 mt-3">
        <select className="input" name="peptide_id">{/* Peptides list */}{await (async()=>{ const { data:p }=await supabase.from("peptides").select("id,canonical_name").order("canonical_name"); return (p??[]).map((x:any)=>(<option key={x.id} value={x.id}>{x.canonical_name}</option>)) })()}</select>
        <input className="input" name="qty" type="number" placeholder="Qty" step="1"/>
        <input className="input" name="price" type="number" placeholder="Price" step="0.01"/>
        <button className="btn">Add</button>
      </form>
    </div>
    <div className="grid-cards">
      {(items??[]).map((it:any)=><div key={it.id} className="pp-card">
        <div className="text-lg font-semibold">{it.peptides?.canonical_name ?? `#${it.peptide_id}`}</div>
        <div className="pp-subtle mt-1">Qty: {it.qty} · Price: ${Number(it.price??0).toFixed(2)}</div>
        <div className="flex gap-2 mt-3">
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateCartQty(it.id, (it.qty??0)+1) }}><button className="btn">+1</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateCartQty(it.id, Math.max(0,(it.qty??0)-1)) }}><button className="btn">-1</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.deleteCartItem(it.id) }}><button className="btn">Remove</button></form>
        </div>
      </div>)}
    </div>
    <div className="pp-card"><div className="pp-h2">Total: ${total.toFixed(2)}</div></div>
  </div>
}
