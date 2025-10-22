import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    outDir: "dist",
    lib: {
      entry: "./index.ts",
      name: "TestPlugin",
      formats: ["es"],
    },
    rollupOptions: {
      // Keep WASM import paths relative
      output: {
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
