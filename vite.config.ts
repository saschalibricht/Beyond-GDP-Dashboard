import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// public/data/*.json is written by the Python ETL and served as-is (fetched at runtime,
// never bundled), so a data update only needs a redeploy, not a code change.
export default defineConfig({
  plugins: [svelte()],
  build: { target: "es2022", sourcemap: false },
  test: { include: ["src/**/*.test.ts"] },
});
