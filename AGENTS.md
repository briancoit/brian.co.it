# AGENTS.md — AI Assistant Context

## Project Overview

**brian.co.it** — Personal portfolio site for Brian Coit, Principal Software Engineer.

| Area            | Detail                                                    |
|-----------------|-----------------------------------------------------------|
| Framework       | React 19 (function components only)                       |
| Runtime alias   | **Preact** via Vite `resolve.alias` (react → preact/compat) |
| Bundler         | Vite 7 with SWC (`@vitejs/plugin-react-swc`)             |
| Language        | TypeScript (strict mode)                                  |
| 3D              | Three.js for space/starfield backgrounds                  |
| Styling         | Vanilla CSS — no Tailwind, no CSS-in-JS                   |
| Linter/Formatter| Biome (`biome check` / `biome format`)                    |
| Hosting         | Netlify with CSP headers and immutable asset caching      |
| SSR             | Custom Vite plugin prerenders HTML at build time (`static.tsx`) |
| Package manager | Yarn 4 (PnP mode, `.pnp.cjs` checked in)                 |

## File Structure

```
src/
├── App.tsx                          # Root component (hero + bento grid + contact)
├── main.tsx                         # Client entry — hydrates SSR or mounts fresh
├── static.tsx                       # Build-time SSR prerender plugin
├── types.d.ts                       # Global type declarations
├── reset.css                        # CSS reset (Josh Comeau style)
├── styles.css                       # All site styles (CSS custom properties)
└── components/
    ├── SpaceHeroCanvas.tsx           # Three.js hero starfield + nebula + shooting stars
    ├── SpaceContactCanvas.tsx        # Three.js contact section background (currently unused)
    ├── ContactForm/
    │   └── ContactForm.tsx           # Netlify-powered contact form
    └── EmploymentHistory/
        ├── EmploymentHistory.tsx     # Timeline of roles
        └── EmploymentHistoryItem.tsx # Single role entry + Time sub-component
```

## React Guidelines

1. **Function components only** — no class components.
2. **`React.memo`** — wrap pure/presentational components that:
   - Receive stable or static props, OR
   - Have no props and contain no side effects that benefit from re-creation.
   - **Do NOT memo** the root `App` component or lazy-loaded components with no props.
3. **Lazy loading** — use `React.lazy()` for heavy canvas/Three.js components.
4. **Refs for non-rendering state** — in animation loops, store values in `useRef` (not `useState`) to avoid triggering re-renders. See `SpaceHeroCanvas.tsx` for the canonical pattern.
5. **Inline styles** — acceptable for one-off layout styles on canvas wrappers. All reusable styles go in `styles.css`.
6. **No prop drilling** — the app is flat enough that context/state management libraries are unnecessary.

## Coding Conventions

- **Formatting**: Biome with spaces (2-space indent). Run `yarn format` to auto-fix.
- **Linting**: Biome. Run `yarn lint` to check.
- **Exports**: Named exports only (no default exports) — required by the lazy-loading pattern in `App.tsx`.
- **TypeScript**: Strict mode. Explicit return types on exported components (`React.JSX.Element`).
- **CSS**: Vanilla CSS with custom properties in `:root`. Mobile breakpoint at `768px`. Glassmorphism aesthetic.
- **No new dependencies** without discussion — the bundle is aggressively optimised.

## Performance Notes

- **Preact aliasing** — React API, Preact runtime (~3KB vs ~40KB).
- **Build optimisation** — Terser with 3 passes, `drop_console`, tree-shaking preset `recommended`, `moduleSideEffects: false`.
- **CSS inlining** — at build time, `<link>` stylesheets are inlined as `<style>` tags to eliminate render-blocking requests.
- **Hydration** — deferred via `requestIdleCallback` to avoid blocking the main thread.
- **Canvas visibility** — `IntersectionObserver` pauses `requestAnimationFrame` loops when off-screen.
- **Pixel ratio** — capped at `1.5` for performance.

## Commands

```bash
yarn dev       # Start Vite dev server (HMR)
yarn build     # Production build (includes SSR prerender)
yarn preview   # Preview production build locally
yarn lint      # Biome lint check
yarn format    # Biome auto-format
```

## Deployment

Deployed to **Netlify** via `netlify.toml`. Headers configured for:
- Immutable caching on `/assets/*`
- CSP (report-only), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy.
