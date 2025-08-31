/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: 'rgb(var(--bg))',
                foreground: 'rgb(var(--fg))',
                card: 'rgb(var(--card))',
                border: 'rgb(var(--border))',
                ring: 'rgb(var(--ring))',
                muted: 'rgb(var(--muted))',
                destructive: 'rgb(var(--destructive))',
                success: 'rgb(var(--success))',
                info: 'rgb(var(--info))',
                warning: 'rgb(var(--warning))',
            },
        },
    },
    plugins: [],
};