import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import { reactPrerenderPlugin } from "./src/static";

export default defineConfig(({ command }) => ({
  build: { minify: true },
  plugins: [
    analyzer(),
    react(),
    command === "build" ? reactPrerenderPlugin({ minify: true }) : undefined,
  ],
}));
