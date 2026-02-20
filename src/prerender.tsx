import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { minify as minifyHtml } from "html-minifier-terser";
import { renderToStringAsync } from "preact-render-to-string";

// Paths
const indexHtmlFile = path.join("dist", "index.html"); // Your index.html template
const ssrBundleFile = path.join("dist", "ssr.js"); // SSR bundle

// Check if files exist
if (!fs.existsSync(ssrBundleFile)) {
  console.error("❌ SSR bundle not found — run vite build --ssr first");
  process.exit(1);
}

if (!fs.existsSync(indexHtmlFile)) {
  console.error("❌ dist/index.html not found — run vite build first");
  process.exit(1);
}

// Dynamically import the SSR bundle
async function prerender() {
  const ssrBundle = await import(ssrBundleFile); // Dynamically import the SSR bundle
  const { default: renderApp } = ssrBundle; // Assuming `renderApp` is exported from the SSR bundle

  // Read the index.html file (HTML template)
  const html = fs.readFileSync(indexHtmlFile, "utf-8");
  const $ = load(html);

  // Render the app using the SSR bundle
  const appHtml = await renderToStringAsync(renderApp());

  // Inject the SSR-rendered HTML into the root div (#app)
  $("#app").html(appHtml);

  // Optionally, minify the final HTML
  const minifiedHtml = $.html();

  // Write the final prerendered HTML back to dist/index.html
  fs.writeFileSync(indexHtmlFile, await transformHtml(minifiedHtml));

  console.info("✓ Prerendered SSR content into dist/index.html");
}

// Run the prerender function
prerender().catch((error) => {
  console.error("❌ Prerendering failed:", error);
});

export async function transformHtml(html: string) {
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
