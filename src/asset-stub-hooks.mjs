/**
 * ESM loader hooks that stub out non-JS asset imports (CSS, SVG, images)
 * so tsx can import the full React app tree for SSR prerendering.
 *
 * - CSS/image files → export default {}
 * - SVG files → export default as a no-op component (for ?react / SVGR imports)
 */

const CSS_EXTENSIONS = /\.(css|png|jpe?g|gif|webp|avif|ico)(\?.*)?$/;
const SVG_EXTENSION = /\.svg(\?.*)?$/;

/** @type {import('node:module').LoadHook} */
export async function load(url, context, nextLoad) {
  if (CSS_EXTENSIONS.test(url)) {
    return {
      shortCircuit: true,
      format: "module",
      source: "export default {};",
    };
  }
  if (SVG_EXTENSION.test(url)) {
    // Return a no-op React component so SVGR-style ?react imports work
    return {
      shortCircuit: true,
      format: "module",
      source: "export default function SvgStub() { return null; };",
    };
  }
  return nextLoad(url, context);
}
