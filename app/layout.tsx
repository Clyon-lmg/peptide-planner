// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Peptide Planner",
  description: "Plan, track, and reorder peptides.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Header />
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
