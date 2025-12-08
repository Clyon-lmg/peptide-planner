'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { ThemeToggle } from '@/components/ThemeToggle';

const supabase = getSupabaseBrowser();

export default function Header() {
    const [email, setEmail] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const refresh = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setEmail(session?.user?.email ?? null);
        setAuthReady(true);
    };

    useEffect(() => {
        refresh();
        const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
            refresh();
        });
        return () => {
            sub.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const NavItems = () => (
        <>
            <Link href="/today" className="hover:underline">Today</Link>
            <Link href="/calendar" className="hover:underline">Calendar</Link>
            <Link href="/protocol" className="hover:underline">Protocol</Link>
            <Link href="/inventory" className="hover:underline">Inventory</Link>
            <Link href="/suggestions" className="hover:underline">
                Suggestions <span className="ml-1 text-[10px] uppercase">Beta</span>
            </Link>
            <ThemeToggle />
            {authReady ? (
                email ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded border border-border">
                            {email}
                        </span>
                        <button onClick={signOut} className="px-2 py-1 rounded border border-border">
                            Sign out
                        </button>
                    </div>
                ) : (
                    <Link href="/login" className="ml-2 underline">Sign in</Link>
                )
            ) : (
                <span className="text-xs text-muted">Checking session…</span>
            )}
            <span className="text-xs opacity-60">For research purposes only</span>
        </>
    );

    return (
        <header className="w-full border-b border-border">
            <div className="mx-auto max-w-6xl p-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="font-semibold">Peptide Planner</Link>
                    <button
                        className="md:hidden"
                        aria-label="Toggle navigation"
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <nav className="hidden md:flex items-center gap-3 text-sm">
                        <NavItems />
                    </nav>
                </div>
                <nav className={`mt-2 flex-col gap-3 text-sm ${menuOpen ? 'flex' : 'hidden'} md:hidden`}>
                    <NavItems />
                </nav>
            </div>
        </header>
    );
}