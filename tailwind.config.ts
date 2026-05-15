import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#f5f1e8",
        ember: "#f26a2e",
        moss: "#1f5c4b",
        sand: "#d8b788"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      },
      boxShadow: {
        card: "0 20px 60px rgba(17, 17, 17, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
