// app/providers.tsx
"use client";

import * as React from "react";
import { Toaster } from "sonner";

/**
 * Global app providers without next-themes.
 * If you later want dark/light theming, either:
 *   1) install next-themes:  npm i next-themes @types/next-themes
 *   2) or roll your own ThemeContext here.
 */
type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
      {/* Global toast portal */}
      <Toaster richColors position="top-right" />
    </>
  );
}
