/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        screens: {
            sm: "640px",
            md: "768px",
            lg: "1024px",
            xl: "1280px",
            "2xl": "1536px",
        },
        extend: {
            spacing: {
                0: "0px",               // enables `p-0`
                1: "0.25rem",           // enables `p-1`
                2: "0.5rem",            // enables `p-2`
                3: "0.75rem",           // enables `p-3`
                4: "1rem",              // enables `p-4`
                5: "1.25rem",           // enables `p-5`
                6: "1.5rem",            // enables `p-6`
                8: "2rem",              // enables `p-8`
                9: "2.25rem",           // enables `p-9`
                10: "2.5rem",           // enables `p-10`
                20: "5rem",             // enables `p-20`
                24: "6rem",             // enables `p-24`
            },
            borderRadius: {
                sm: "0.125rem",          // enables `rounded-sm`
                DEFAULT: "0.25rem",      // enables `rounded`
                md: "0.375rem",          // enables `rounded-md`
                lg: "0.5rem",            // enables `rounded-lg`
                xl: "0.75rem",           // enables `rounded-xl`
                "2xl": "1rem",          // enables `rounded-2xl`
                full: "9999px",          // enables `rounded-full`
            },
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
            borderColor: {
                DEFAULT: "rgb(var(--border) / <alpha-value>)",
                border: "rgb(var(--border) / <alpha-value>)",
            },
            fontSize: {
                sm: "0.875rem",         // enables `text-sm`
                lg: "1.125rem",         // enables `text-lg`
                "2xl": "1.5rem",        // enables `text-2xl`
            },
            boxShadow: {
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            },
            fontWeight: {
                medium: '500',
                semibold: '600',
                bold: '700',
            },
            fontFamily: {
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
            },
        },
    },
    plugins: [],
};