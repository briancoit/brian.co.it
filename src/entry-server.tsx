// src/entry-server.tsx

import { renderToStringAsync } from "preact-render-to-string";
import { App } from "./App"; // Your main React component

export default async function render() {
  const appHtml = await renderToStringAsync(<App />);
  return appHtml; // The string of HTML to be injected into index.html
}
