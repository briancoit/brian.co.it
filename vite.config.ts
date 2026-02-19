import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import svgr from "vite-plugin-svgr";
export default defineConfig(({ command }) => ({
  build: {
    minify: "terser",
    sourcemap: true,
    target: "es2020",
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
    command === "build"
      ? {
          name: "deferred-prerender",
          apply: "build",
          async writeBundle(...args) {
            const mod = "./src/static";
            const { reactPrerenderPlugin } = await import(mod);
            const plugin = reactPrerenderPlugin({ minify: true });
            await plugin.writeBundle.apply(this, args);
          },
        }
      : undefined,
  ],
}));
