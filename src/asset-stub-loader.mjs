/**
 * Register hook: run via --import to register the asset stub loader hooks.
 * This uses module.register() which is the standard Node.js way to add
 * custom loader hooks that chain properly with Yarn PnP's loader.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./asset-stub-hooks.mjs", pathToFileURL(import.meta.dirname + "/"));
