import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { minify as minifyHtml } from "html-minifier-terser";
import { build } from "vite";

async function run() {
  // 1. Build client
  await Promise.all([
    build({
      configFile: "vite.config.ts",
    }),
    build({
      configFile: "vite.config.ts",
      build: {
        ssr: "src/entry-server.tsx",
        outDir: "dist-ssr",
      },
    }),
  ]);

  // 3. Import SSR entry
  // @ts-expect-error
  const { default: render } = await import("../dist-ssr/entry-server.js");

  const html = await render();

  const t = await test(html);

  const filePath = "dist/index.html";

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, t);
}

async function test(input: string) {
  const indexHtmlFile = path.join("dist", "index.html");

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
    const cssPath = path.join("dist", href);
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, "utf-8");
      $(el).replaceWith(`<style>${css}</style>`);
      fs.unlinkSync(cssPath);
    }
  });

  $("#app").append(input);

  // remove any dev only scripts
  $("script[data-dev-only]").remove();

  // 4️⃣ Minify if requested
  const output = await minifyHtml($.html(), {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: true,
    minifyCSS: true,
  });

  return output;
}

run();
