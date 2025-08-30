"use client"
import { useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import Card from "../layout/Card";
export default function SignInClient() {
    const [email, setEmail] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [loading, setLoading] = useState(false)
    async function sendLink(e: React.FormEvent) {
        e.preventDefault(); setLoading(true); setMsg(null);
        try {
            const supabase = getSupabaseBrowser();
            const { error } = await supabase.auth.signInWithOtp({
                email, options: { emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined }
            })
            if (error) throw error; setMsg("Check your email for a sign-in link.")
        } catch (err: any) { setMsg(err?.message || "Failed to send link") } finally { setLoading(false) }
    }
    return <Card className="max-w-md mx-auto mt-20">
        <div className="pp-h2">Sign in</div>
        <p className="pp-subtle mt-1">We’ll email you a magic link.</p>
        <form onSubmit={sendLink} className="mt-4 space-y-3">
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button disabled={loading} className="btn">{loading ? "Sending…" : "Send magic link"}</button>
        </form>
        {msg && <div className="mt-3 text-sm">{msg}</div>}
    </Card>
}