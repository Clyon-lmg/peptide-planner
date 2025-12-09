'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Header() {
    return (
        <header className="lg:hidden w-full border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
            <div className="px-4 h-14 flex items-center justify-between">
                <Link href="/today" className="font-bold text-lg tracking-tight flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        PP
                    </div>
                    <span>Peptide Planner</span>
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}