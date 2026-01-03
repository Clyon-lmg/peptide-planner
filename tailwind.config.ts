import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      padding: {
        // Safe Area Utilities for Mobile
        'safe': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      height: {
        // 100% height that actually works on mobile browsers
        'screen-safe': '100dvh', 
      },
      // ... keep your existing colors/extensions if any ...
    },
  },
  plugins: [],
};
export default config;
