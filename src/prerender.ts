import { prerenderSite } from "./static";

await prerenderSite("dist", { minify: true });
console.log("✓ Prerendered dist/index.html");
