import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { minify as minifyHtml } from "html-minifier-terser";
import { prerender } from "react-dom/static";

export async function prerenderSite(
  outDir: string,
  { minify }: { minify?: boolean } = {},
) {
  const indexHtmlFile = path.join(outDir, "index.html");

  // 1️⃣ Read the FINAL Vite-built HTML
  if (!fs.existsSync(indexHtmlFile)) {
    throw new Error("index.html not found in build output");
  }

  const html = fs.readFileSync(indexHtmlFile, "utf-8");
  const $ = load(html);

  // 2️⃣ Inline CSS to eliminate render-blocking requests
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

  // 3️⃣ Prerender React (handles lazy/Suspense)
  const { prelude } = await prerender(<App />);
  const reactHtml = await new Response(prelude).text();
  $("#app").append(reactHtml);

  // remove any dev only scripts
  $("script[data-dev-only]").remove();

  // 4️⃣ Minify if requested
  const output = minify
    ? await minifyHtml($.html(), {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
      })
    : $.html();

  // 5️⃣ Overwrite the built HTML
  fs.writeFileSync(indexHtmlFile, output);
}
