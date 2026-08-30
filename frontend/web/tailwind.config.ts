/**
 * Tailwind v4 uses CSS-first configuration (the @theme block in style.css).
 * This file exists solely to satisfy the shadcn CLI's requirement for a
 * `tailwind.config.ts` — it imports the CSS so the CLI can discover
 * the theme tokens, then returns an empty config.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx}",
  ],
  // All design tokens live in src/style.css @theme block.
};

export default config;