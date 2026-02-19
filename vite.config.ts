import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import { reactPrerenderPlugin } from "./src/static";

export default defineConfig(({ command }) => ({
  build: {
    minify: "terser",
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      treeshake: {
        preset: "recommended",
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        annotations: true,
      },
    },
    terserOptions: {
    compress: {
      passes: 3,
      drop_console: true,
      drop_debugger: true,
      pure_funcs: ["console.log"],
    },
    mangle: true,
    format: { comments: false },
  },
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
