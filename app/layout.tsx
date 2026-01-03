import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Peptide Planner",
  description: "Track your research with precision.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Peptide Planner",
  },
};

// NEW: Mobile Viewport Settings
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents pinch-to-zoom
  viewportFit: "cover", // Allows content to go under the notch/home bar
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-background text-foreground antialiased`}>
        <Providers>
            {children}
            <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
