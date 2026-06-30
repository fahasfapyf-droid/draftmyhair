import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        brand: {
          canvas: "var(--brand-canvas)",
          surface: "var(--brand-surface)",
          ink: "var(--brand-ink)",
          muted: "var(--brand-muted)",
          border: "var(--brand-border)",
        },
      },

      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },

      borderRadius: {
        editorial: "20px",
      },

      letterSpacing: {
        editorial: "-0.03em",
      },

      boxShadow: {
        editorial:
          "0 24px 60px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04)",

        "editorial-hover":
          "0 30px 70px rgba(0,0,0,0.12), 0 12px 30px rgba(0,0,0,0.06)",
      },

      transitionTimingFunction: {
        editorial: "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },

  plugins: [],
};

export default config;