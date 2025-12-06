import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "assets/build",
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: process.env.TARGET === 'rescue'
        ? { rescue: path.resolve(__dirname, "assets/src/rescue/index.tsx") }
        : { admin: path.resolve(__dirname, "assets/src/admin/index.tsx") },
      output: {
        format: 'iife',
        entryFileNames: "js/[name].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name ? assetInfo.name.split(".").pop() : "";
          if (ext === "css") {
            return "css/[name].[ext]";
          }
          return "assets/[name].[ext]";
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "assets/src")
    }
  }
});
