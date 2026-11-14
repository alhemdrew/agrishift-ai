import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f1f8f4",
          100: "#dcefe3",
          200: "#b9dfc9",
          300: "#8cc9a7",
          400: "#56ad82",
          500: "#2f8d62",
          600: "#1f7050",
          700: "#185a42",
          800: "#144836",
          900: "#0f3a2b",
          950: "#082318",
        },
        accent: {
          400: "#fbbf4f",
          500: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
