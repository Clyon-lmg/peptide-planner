// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Peptide Planner",
  description: "Plan, track, and reorder peptides.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Your header/AppShell can render here (e.g., ThemeToggle, NavCartButton) */}
        {children}
        {/* Toasts overlay everything nicely at the end of body */}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
