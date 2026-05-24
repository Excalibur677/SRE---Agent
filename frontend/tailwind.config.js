/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 6px 1px rgba(99,102,241,0.4)" },
          "50%": { boxShadow: "0 0 18px 4px rgba(99,102,241,0.8)" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-out both",
        glow: "glow 2s ease-in-out infinite",
        breathe: "breathe 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
