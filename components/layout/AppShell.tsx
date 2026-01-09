"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Home,
  Calendar,
  Activity,
  LogOut,
  FlaskConical,
  Pill,
  ClipboardList
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppShell({ 
  children, 
  userEmail 
}: { 
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const isFullWidth = pathname?.startsWith('/protocols');

  const navigation = [
    { name: "Today", href: "/today", icon: Home },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Protocols", href: "/protocols", icon: ClipboardList },
    { name: "Inventory", href: "/inventory", icon: FlaskConical },
    { name: "Stats", href: "/stats", icon: Activity },
    { name: "Consultations", href: "/consultations", icon: Pill },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/sign-in");
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:relative lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Peptide Planner
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 shrink-0 space-y-4">
           <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Appearance</span>
                <ThemeToggle />
            </div>

            {userEmail && (
              <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Signed in as</div>
                  <div className="text-sm truncate opacity-80 font-mono" title={userEmail}>
                    {userEmail}
                  </div>
              </div>
            )}

          <button
            onClick={handleSignOut}
            className="flex w-full items-center px-3 py-2.5 text-sm font-medium text-muted-foreground rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex h-16 items-center gap-4 border-b border-border bg-card px-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-lg font-semibold">Peptide Planner</span>
        </div>

        <main className={`flex-1 overflow-y-auto bg-background/50 ${
             isFullWidth ? "" : "p-4 md:p-8"
        }`}>
           <div className={isFullWidth ? "w-full" : "max-w-5xl mx-auto"}>
              {children}
           </div>
        </main>
      </div>
    </div>
  );
}
