import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("No root element #app found");
}

if (rootElement.hasChildNodes()) {
  const hydrate = () => hydrateRoot(rootElement, <App />);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(hydrate);
  } else {
    setTimeout(hydrate, 1);
  }
} else {
  createRoot(rootElement).render(<App />);
}
