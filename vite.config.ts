import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = "localhost";

export default defineConfig({
  plugins: [react()],

  // Important for Tauri
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Your path alias from React app
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
