"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Mail, ArrowRight, Check } from "lucide-react";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Ensure this matches your folder structure for the callback
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  // --- SUCCESS STATE (Link Sent) ---
  if (sent) {
    return (
        <div className="flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 py-4">
            <div className="relative">
                <div className="size-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2 shadow-sm ring-4 ring-emerald-50 dark:ring-emerald-900/10">
                    <Mail className="size-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 size-7 bg-background rounded-full flex items-center justify-center p-0.5">
                    <div className="size-full bg-emerald-500 rounded-full flex items-center justify-center text-white">
                        <Check className="size-4" strokeWidth={3} />
                    </div>
                </div>
            </div>
            
            <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight">Link Sent!</h3>
                <p className="text-muted-foreground text-sm max-w-[260px] mx-auto leading-relaxed">
                    We've sent a magic sign-in link to <br/>
                    <span className="font-semibold text-foreground">{email}</span>
                </p>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl text-xs text-muted-foreground w-full border border-border/50">
                <p>Click the link in your email to sign in.</p>
                <p className="mt-1 opacity-70">Make sure to check your spam folder.</p>
            </div>

            <button 
                onClick={() => setSent(false)} 
                className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors"
            >
                Use a different email address
            </button>
        </div>
    )
  }

  // --- FORM STATE ---
  return (
    <form onSubmit={handleLogin} className="space-y-4 w-full">
      <div className="space-y-2">
        <label htmlFor="email" className="sr-only">Email</label>
        <input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            className="input h-12 px-4 bg-background w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {loading ? (
           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
           <>
             Send Magic Link <ArrowRight className="w-4 h-4 opacity-70" />
           </>
        )}
      </button>
    </form>
  );
}