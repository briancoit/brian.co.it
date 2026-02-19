# brian.co.it

Personal portfolio site for **Brian Coit** — Principal Software Engineer.

## Tech Stack

React 19 · Preact (runtime alias) · TypeScript · Vite 7 · Three.js · Vanilla CSS · Biome · Netlify

## Local Development

```bash
# Prerequisites: Node.js (see .nvmrc), Yarn 4
yarn install
yarn dev        # http://localhost:5173
```

## Build & Deploy

```bash
yarn build      # Production build with SSR prerendering
yarn preview    # Preview the production build locally
```

Deployed automatically to [Netlify](https://brian.co.it) on push.

## Project Structure

```
src/
├── App.tsx                  # Root component
├── main.tsx                 # Client entry (hydration)
├── static.tsx               # Build-time SSR prerender
├── styles.css               # Site styles
├── reset.css                # CSS reset
└── components/
    ├── SpaceHeroCanvas.tsx   # Three.js starfield hero
    ├── ContactForm/          # Netlify contact form
    └── EmploymentHistory/    # Work timeline
```

## Scripts

| Command        | Description                  |
|----------------|------------------------------|
| `yarn dev`     | Start dev server with HMR    |
| `yarn build`   | Production build + SSR       |
| `yarn preview` | Preview production build     |
| `yarn lint`    | Run Biome linter             |
| `yarn format`  | Auto-format with Biome       |

See [AGENTS.md](./AGENTS.md) for detailed AI assistant context.
