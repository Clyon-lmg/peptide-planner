'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('client@test.local');
    const [password, setPassword] = useState('qwerty123');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        // If already signed-in, bounce to Today
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) window.location.href = '/today';
        });
    }, []);

    const signIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({
            email, password
        });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        // Force a client redirect so every page refetch runs with a live session
        window.location.href = '/today';
    };

    return (
        <div className="mx-auto max-w-md mt-12 rounded border border-neutral-200 dark:border-neutral-800 p-6">
            <h1 className="text-lg font-semibold mb-4">Sign in</h1>
            <form onSubmit={signIn} className="space-y-3">
                <div>
                    <label className="block text-sm mb-1">Email</label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                    />
                </div>
                <div>
                    <label className="block text-sm mb-1">Password</label>
                    <input
                        type="password"
                        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                    />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <button
                    type="submit"
                    disabled={busy}
                    className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700"
                >
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <div className="mt-4 text-xs text-neutral-500">
              
            </div>

            <div className="mt-4">
                <Link href="/" className="text-sm underline">Back to Home</Link>
            </div>
        </div>
    );
}
