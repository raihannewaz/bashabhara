import type { Config } from "tailwindcss";

const c = (v: string) => `hsl(var(--${v}))`;
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: c("border"), input: c("input"), background: c("background"), foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        card: { DEFAULT: c("card"), foreground: c("foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
      },
    },
  },
  plugins: [],
};
export default config;
