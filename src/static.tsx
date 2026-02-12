import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { minify as minifyHtml } from "html-minifier-terser";
import ReactDOMServer from "react-dom/server";
import type { PluginOption } from "vite";
import { App } from "./App";

export function reactPrerenderPlugin({
  minify,
}: {
  minify?: boolean;
}): PluginOption {
  return {
    name: "vite-plugin-react-prerender",
    apply: "build",
    async writeBundle(options) {
      const outDir = options.dir || "dist";
      const indexHtmlFile = path.join(outDir, "index.html");

      // 1️⃣ Read the FINAL Vite-built HTML
      if (!fs.existsSync(indexHtmlFile)) {
        this.error("index.html not found in build output");
        return;
      }

      const html = fs.readFileSync(indexHtmlFile, "utf-8");
      const $ = load(html);

      // 2️⃣ Render React and inject
      const reactHtml = ReactDOMServer.renderToString(<App />);
      $("#app").append(reactHtml);

      // 3️⃣ Minify if requested
      const output = minify
        ? await minifyHtml($.html(), {
            collapseWhitespace: true,
            removeComments: true,
            minifyJS: true,
            minifyCSS: true,
          })
        : $.html();

      // 4️⃣ Overwrite the built HTML
      fs.writeFileSync(indexHtmlFile, output);
    },
  };
}
