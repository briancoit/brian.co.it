import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  build: {
    minify: "terser",
    sourcemap: true,
    target: "es2020",
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: "index.html",
      },
      treeshake: {
        preset: "recommended",
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        annotations: true,
      },
    },
    terserOptions: {
      ecma: 2020,
      compress: {
        ecma: 2020,
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
        pure_getters: true,
        toplevel: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_undefined: true,
      },
      mangle: {
        toplevel: true,
      },
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
    svgr(),
    react(),
  ],
});
