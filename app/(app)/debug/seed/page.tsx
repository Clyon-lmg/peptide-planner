"use client"
import { useState } from "react"
import Card from "@/components/layout/Card";
export default function SeedPage(){
  const [msg,setMsg]=useState<string|null>(null)
  async function run(method:"POST"|"GET"="POST"){
    setMsg("Seeding…")
    try{ const res=await fetch("/api/debug/seed",{ method, cache:"no-store" }); const json=await res.json()
      setMsg(json.ok? "Seed complete. Check /today, /inventory, /calendar." : `Error: ${json.error||"unknown"}`)
    }catch(e:any){ setMsg(`Request failed: ${e?.message||e}`) }
  }
    return <Card>
    <div className="pp-h2">Seed Demo Data</div>
    <div className="mt-4 flex gap-3">
      <button onClick={()=>run("POST")} className="btn">Run Seed (POST)</button>
      <button onClick={()=>run("GET")} className="btn">Run Seed (GET)</button>
    </div>
    {msg && <div className="mt-3">{msg}</div>}
  </Card>
}
