import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { minify as minifyHtml } from "html-minifier-terser";
import ReactDOMServer from "react-dom/server";
import type { PluginOption } from "vite";

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

      // 2️⃣ Preload the font
      // $("head").prepend(
      //   '<link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>',
      // );

      // 3️⃣ Inline CSS to eliminate render-blocking requests
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const cssPath = path.join(outDir, href);
        if (fs.existsSync(cssPath)) {
          const css = fs.readFileSync(cssPath, "utf-8");
          $(el).replaceWith(`<style>${css}</style>`);
          fs.unlinkSync(cssPath);
        }
      });

      const { App } = await import("./App");

      // 4️⃣ Render React and inject
      const reactHtml = ReactDOMServer.renderToString(<App />);
      $("#app").append(reactHtml);

      // remove any dev only scripts
      $("script[data-dev-only]").remove();

      // 5️⃣ Minify if requested
      const output = minify
        ? await minifyHtml($.html(), {
            collapseWhitespace: true,
            removeComments: true,
            minifyJS: true,
            minifyCSS: true,
          })
        : $.html();

      // 6️⃣ Overwrite the built HTML
      fs.writeFileSync(indexHtmlFile, output);
    },
  };
}
