import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig({
  build: {
    minify: "terser",
    sourcemap: true,
    target: "es2020",
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: "index.html",
        ssr: "./src/entry-server.tsx",
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
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log"],
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
