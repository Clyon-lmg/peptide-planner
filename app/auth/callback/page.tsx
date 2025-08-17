"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
export default function AuthCallbackPage(){
  const router=useRouter(); const params=useSearchParams()
  useEffect(()=>{ const supabase=createClientComponentClient(); (async()=>{
    try{
      const { data: sess } = await supabase.auth.getSession(); if(sess.session){ router.replace("/today"); return }
      const code=params.get("code"); if(code){ const { error }=await supabase.auth.exchangeCodeForSession(window.location.href); if(error) throw error; await fetch("/api/auth/refresh",{method:"POST"}); router.replace("/today"); return }
      const token_hash=params.get("token_hash")||params.get("token"); const t=params.get("type"); const type=(t==="magiclink"||t==="signup"||t==="recovery"||t==="invite")?t:null
      const email=params.get("email")||undefined; if(token_hash&&type){ const { error }=await supabase.auth.verifyOtp({ type, token_hash, email }); if(error) throw error; await fetch("/api/auth/refresh",{method:"POST"}); router.replace("/today"); return }
      const hash=window.location.hash.startsWith("#")?window.location.hash.slice(1):""; if(hash){ const frag=new URLSearchParams(hash); const access_token=frag.get("access_token"); const refresh_token=frag.get("refresh_token"); if(access_token&&refresh_token){ await supabase.auth.setSession({ access_token, refresh_token }); await fetch("/api/auth/refresh",{method:"POST"}); router.replace("/today"); return } }
      router.replace("/sign-in?error=No%20auth%20params%20found")
    }catch(err:any){ router.replace(`/sign-in?error=${encodeURIComponent(err?.message||"Auth%20failed")}`) }
  })() },[router,params]); return null }
