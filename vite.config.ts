import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import { reactPrerenderPlugin } from "./src/static";

export default defineConfig(({ command }) => ({
  build: {
    minify: true,
    cssCodeSplit: false,
    rollupOptions: {
      treeshake: {
        preset: "recommended",
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        // Remove manual chunking to see if Vite can optimize better
      }
    }
  },
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  plugins: [
    analyzer({ enabled: process.env.ANALYZE === "true" }),
    react(),
    command === "build" ? reactPrerenderPlugin({ minify: true }) : undefined,
  ],
}));
