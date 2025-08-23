'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Header() {
    const [cartCount, setCartCount] = useState<number>(0);
    const [email, setEmail] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const refresh = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setEmail(session?.user?.email ?? null);

        // Count cart rows for current user
        const { count, error } = await supabase
            .from('cart_items')
            .select('id', { count: 'exact', head: true });
        if (!error) setCartCount(count ?? 0);

        setAuthReady(true);
    };

    useEffect(() => {
        // Initial load
        refresh();

        // Listen for any auth changes (sign-in/sign-out/token refresh)
        const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
            refresh();
        });
        return () => {
            sub.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        // Force a client-side redirect to login
        window.location.href = '/login';
    };

    return (
        <header className="w-full border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto max-w-6xl flex items-center justify-between p-4">
                <Link href="/" className="font-semibold">Peptide Planner</Link>
                <nav className="flex items-center gap-3 text-sm">
                    <Link href="/today" className="hover:underline">Today</Link>
                    <Link href="/calendar" className="hover:underline">Calendar</Link>
                    <Link href="/protocol" className="hover:underline">Protocol</Link>
                    <Link href="/inventory" className="hover:underline">Inventory</Link>
                    <Link href="/cart" className="relative hover:underline">
                        Cart
                        {cartCount > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs rounded-full border border-neutral-300 dark:border-neutral-700">
                                {cartCount}
                            </span>
                        )}
                    </Link>
                    <ThemeToggle />
                    {/* User badge + Sign in/out */}
                    {authReady ? (
                        email ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700">
                                    {email}
                                </span>
                                <button onClick={signOut} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700">
                                    Sign out
                                </button>
                            </div>
                        ) : (
                            <Link href="/login" className="ml-2 underline">Sign in</Link>
                        )
                    ) : (
                        <span className="text-xs text-neutral-500">Checking session…</span>
                    )}
                    <span className="text-xs opacity-60">For research purposes only</span>

                </nav>
            </div>
        </header>
    );
}
