import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
export const dynamic = "force-dynamic"
export default async function OrdersPage(){
  const supabase=createServerComponentClient({ cookies })
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) return <div className="pp-card">Please sign in.</div>
  const { data: orders, error } = await supabase.from("orders").select("id, vendor, status, total, created_at").eq("user_id", user.id).order("id", { ascending:false })
  if(error) return <div className="pp-card">Error: {error.message}</div>
  return <div className="grid gap-6">
    <div className="pp-card">
      <div className="pp-h2">Create Order</div>
      <form action={async(fd)=>{ "use server"; const a=await import("./server");
        await a.createOrder(String(fd.get('vendor')||'Unknown'), String(fd.get('status')||'PENDING'), Number(fd.get('total')||0))
      }} className="grid md:grid-cols-4 gap-2 mt-3">
        <input className="input" name="vendor" placeholder="Vendor"/>
        <select className="input" name="status"><option>PENDING</option><option>PAID</option><option>SHIPPED</option><option>DELIVERED</option></select>
        <input className="input" name="total" type="number" step="0.01" placeholder="Total"/>
        <button className="btn">Create</button>
      </form>
    </div>
    <div className="grid-cards">
      {(orders??[]).map((o:any)=><div key={o.id} className="pp-card">
        <div className="text-lg font-semibold">Order #{o.id}</div>
        <div className="pp-subtle mt-1">{o.vendor} — {o.status}</div>
        <div className="pp-subtle">Total: ${Number(o.total??0).toFixed(2)}</div>
        <div className="flex gap-2 mt-3">
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateOrderStatus(o.id, "PAID") }}><button className="btn">Mark Paid</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateOrderStatus(o.id, "SHIPPED") }}><button className="btn">Mark Shipped</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.updateOrderStatus(o.id, "DELIVERED") }}><button className="btn">Mark Delivered</button></form>
          <form action={async()=>{ "use server"; const a=await import("./server"); await a.deleteOrder(o.id) }}><button className="btn">Delete</button></form>
        </div>
      </div>)}
    </div>
  </div>
}
