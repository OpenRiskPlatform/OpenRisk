import { greet } from "./wasm/pkg/test_plugin.js";
import { test, value } from "./test.ts";

/**
 * OpenSanctions Plugin
 * Searches OpenSanctions API for entities (people, companies, vessels, etc.)
 */

interface PluginInputs {
  // From user form
  name?: string;
  [key: string]: any;

  // From settings (merged by backend)
  open_sanctions_url?: string;
  api_key?: string;
  dry_run?: boolean;
}

/**
 * Main plugin function - must be default export
 */
export default async function (inputs: PluginInputs) {
    const logs: string[] = [];
    const log = (message: string) => {
        logs.push(`[${new Date().toISOString()}] ${message}`);
        console.log(message);
    };

    // Initialize WASM backend
    // await init();

    log("Adversea Plugin initialized");
    log(value.toString());

    // Call Rust backend function
    const message = greet("Custom plugin!");
    test();

    log(message);
}
