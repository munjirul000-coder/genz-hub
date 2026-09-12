import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#fdfcfa",
        bg2: "#ffffff",
        bg3: "#f7f3ec",
        bg4: "#efe9dd",
        border: "#ece6d9",
        border2: "#ddd5c5",
        ink: "#0a0a0a",
        ink2: "#1a1a1a",
        muted: "#7a7670",
        muted2: "#a8a29a",
        gold: "#f59e0b",
        goldDark: "#a65c00",
        goldLight: "#fff3d6",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument)", "serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "22px",
        xl: "32px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(16,12,8,.04), 0 4px 12px rgba(16,12,8,.06)",
        md: "0 4px 16px rgba(16,12,8,.08), 0 12px 32px rgba(16,12,8,.08)",
        lg: "0 12px 32px rgba(16,12,8,.10), 0 32px 64px rgba(16,12,8,.12)",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "60%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
      },
      animation: {
        shimmer: "shimmer 3.5s ease-in-out infinite",
        pulseDot: "pulseDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
