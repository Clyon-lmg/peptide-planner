/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            spacing: {
                4: "1rem",              // enables `p-4`
            },
            borderRadius: {
                "2xl": "1rem",          // enables `rounded-2xl`
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