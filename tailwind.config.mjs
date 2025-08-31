/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: 'rgb(var(--background) / <alpha-value>)',
                foreground: 'rgb(var(--foreground) / <alpha-value>)',
                card: 'rgb(var(--card) / <alpha-value>)',
                border: 'rgb(var(--border) / <alpha-value>)',
                ring: 'rgb(var(--ring) / <alpha-value>)',
                muted: 'rgb(var(--muted) / <alpha-value>)',
                destructive: 'rgb(var(--destructive) / <alpha-value>)',
                success: 'rgb(var(--success) / <alpha-value>)',
                info: 'rgb(var(--info) / <alpha-value>)',
                warning: 'rgb(var(--warning) / <alpha-value>)',
            },
        },
    },
    plugins: [],
};