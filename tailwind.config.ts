import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // --- MOBILE POLISH START ---
            padding: {
                // Safe Area Utilities for Mobile (Notch/Home Bar)
                'safe': 'env(safe-area-inset-bottom)',
                'safe-top': 'env(safe-area-inset-top)',
            },
            height: {
                // 100% height that actually works on mobile browsers (avoids address bar jumping)
                'screen-safe': '100dvh', 
            },
            // --- MOBILE POLISH END ---

            colors: {
                background: "rgb(var(--background) / <alpha-value>)",
                foreground: "rgb(var(--foreground) / <alpha-value>)",
                card: "rgb(var(--card) / <alpha-value>)",
                border: "rgb(var(--border) / <alpha-value>)",
                ring: "rgb(var(--ring) / <alpha-value>)",
                muted: "rgb(var(--muted) / <alpha-value>)",
                destructive: "rgb(var(--destructive) / <alpha-value>)",
                success: "rgb(var(--success) / <alpha-value>)",
                info: "rgb(var(--info) / <alpha-value>)",
                warning: "rgb(var(--warning) / <alpha-value>)",
            },
            borderRadius: {
                lg: "0.5rem",
                md: "calc(0.5rem - 2px)",
                sm: "calc(0.5rem - 4px)",
            },
        },
    },
    plugins: [],
};
export default config;
