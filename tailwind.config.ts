import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          dark: "#0b0e14",
          card: "#121824",
          border: "rgba(255, 255, 255, 0.08)",
          highlight: "rgba(255, 255, 255, 0.16)",
        },
        brand: {
          gold: "#ffd700",
          neonGreen: "#10b981",
          electricBlue: "#06b6d4",
          flame: "#f97316",
          cosmic: "#8b5cf6",
          ruble: "#38bdf8",
        },
      },
      animation: {
        "conveyor-move": "conveyorScroll 2s linear infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "fever-pulse": "feverPulse 1s ease-in-out infinite",
        "coin-spin": "coinSpin 1.2s cubic-bezier(0.23, 1, 0.32, 1) infinite",
      },
      keyframes: {
        conveyorScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-48px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        feverPulse: {
          "0%, 100%": { boxShadow: "0 0 25px rgba(234, 88, 12, 0.6), inset 0 0 20px rgba(234, 88, 12, 0.4)" },
          "50%": { boxShadow: "0 0 45px rgba(245, 158, 11, 0.9), inset 0 0 35px rgba(245, 158, 11, 0.6)" },
        },
        coinSpin: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
