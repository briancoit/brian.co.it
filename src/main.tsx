import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const element = document.getElementById("app");

if (!element) {
  throw new Error("No root element found");
}

if (element.hasChildNodes()) {
  hydrateRoot(element, <App />);
} else {
  if (import.meta.env.DEV) {
    createRoot(element).render(<App />);
  }
}
