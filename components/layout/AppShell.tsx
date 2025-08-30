"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Calendar, Package, Notebook, Home, ShoppingCart, ClipboardList } from "lucide-react"
const nav = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/protocol", label: "Protocol", icon: Notebook },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  ]
export default function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const pathname = usePathname()
  
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block" style={{ background:"rgb(var(--card))", borderRight:"1px solid rgb(var(--border))" }}>
        <div className="p-5 space-y-8">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background:"color-mix(in oklab, rgb(var(--ring)) 15%, transparent)" }}>
              <span style={{ color:"rgb(var(--ring))", fontWeight:700 }}>PP</span>
            </div><div className="text-lg">Peptide Planner</div>
          </div>
          <nav className="space-y-1">
            {nav.map(n=>{
              const active = pathname?.startsWith(n.href)
              const Icon = n.icon as any
              return <Link key={n.href} href={n.href}
                className={"flex items-center gap-3 px-3 py-2 rounded-xl transition-colors " + (active ? "" : "hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]")}
                style={active?{ background:"color-mix(in oklab, rgb(var(--ring)) 10%, transparent)", color:"rgb(var(--ring))"}:{}}
              ><Icon className="size-4"/><span>{n.label}</span></Link>
            })}
          </nav>
<p className="text-xs opacity-70">For research purposes only</p>
        </div>
        </aside>
      <main className="p-5 md:p-8">
        <header className="flex items-center justify-between mb-6">
          <h1 className="pp-h1">{titleFromPath(pathname)}</h1>
          <div className="text-sm opacity-80 flex items-center gap-2">
            {userEmail ? <span>{userEmail}</span> : <Link href="/sign-in">Sign in</Link>}
            {userEmail && <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>}
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
function titleFromPath(path?: string | null){ if(!path) return "Dashboard"; const seg=(path.split("/")[1]||"dashboard"); return seg[0].toUpperCase()+seg.slice(1) }
