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
            boxShadow: {
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
        },
    },
    plugins: [],
};