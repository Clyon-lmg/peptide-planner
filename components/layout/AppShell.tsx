"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Package, Notebook, Home, Activity } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"

const nav = [
    { href: "/today", label: "Today", icon: Home },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/inventory", label: "Inv", icon: Package },
    { href: "/protocols", label: "Plan", icon: Notebook },
    { href: "/weight", label: "Stats", icon: Activity },
]

export default function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
    const pathname = usePathname()

    // 🟢 NEW: Check if we are on the protocols page
    const isFullWidth = pathname?.startsWith('/protocols')

    return (
        <div className="min-h-[100dvh] flex flex-col lg:grid lg:grid-cols-[260px_1fr]">

            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:block sticky top-0 h-screen overflow-y-auto border-r border-border bg-card/50 backdrop-blur-xl p-5 flex flex-col">
                <div className="flex items-center gap-3 px-2 mb-8">
                    <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xl">
                        PP
                    </div>
                    <div className="font-bold text-lg tracking-tight">Peptide Planner</div>
                </div>

                <nav className="space-y-1">
                    {nav.map(n => {
                        const active = pathname?.startsWith(n.href)
                        const Icon = n.icon
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${active
                                        ? "bg-blue-500/10 text-blue-600"
                                        : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                                    }
                `}
                            >
                                <Icon className={`size-5 ${active ? "fill-current/20" : ""}`} strokeWidth={active ? 2.5 : 2} />
                                <span>{n.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto pt-6 border-t border-border space-y-4 px-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Appearance</span>
                        <ThemeToggle />
                    </div>

                    <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Signed in as</div>
                        <div className="text-sm truncate opacity-80 mb-2 font-mono">{userEmail}</div>
                        <form action="/api/auth/signout" method="post">
                            <button className="text-xs hover:underline opacity-60">Sign out</button>
                        </form>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-0">
                {/* 🟢 NEW: Conditionally apply padding/width based on route */}
                <main className={
                    isFullWidth 
                        ? "w-full animate-in fade-in duration-500" 
                        : "p-4 md:p-8 max-w-5xl w-full mx-auto animate-in fade-in duration-500"
                }>
                    {children}
                </main>
            </div>

            {/* --- MOBILE NAV --- */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border pb-safe pt-2">
                <div className="flex items-center justify-around px-2">
                    {nav.map(n => {
                        const active = pathname?.startsWith(n.href)
                        const Icon = n.icon
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={`
                  flex-1 flex flex-col items-center justify-center py-2 gap-1
                  transition-colors active:scale-95
                  ${active ? "text-blue-600" : "text-muted-foreground hover:text-foreground"}
                `}
                            >
                                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                                <span className="text-[10px] font-medium">{n.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>

        </div>
    )
}
