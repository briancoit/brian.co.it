import { renderToStringAsync } from "preact-render-to-string";
import { App } from "./App";

export default async function render(): Promise<string> {
 return await renderToStringAsync(<App />);
}
