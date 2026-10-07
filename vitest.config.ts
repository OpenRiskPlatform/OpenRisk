import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { brandingPlugin } from "./branding-vite";

export default defineConfig({
  plugins: [react(), brandingPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "scripts/**/*.test.mjs"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
  },
});
