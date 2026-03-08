/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        "primary-foreground": "#ffffff",
        background: "#0f172a",
        card: "#1e293b",
        border: "#334155",
        muted: "#94a3b8",
        "muted-foreground": "#64748b",
        foreground: "#f1f5f9",
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          600: "#059669",
          700: "#047857",
        },
      },
    },
  },
  plugins: [],
};
