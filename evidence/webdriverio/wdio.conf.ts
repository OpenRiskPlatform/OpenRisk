import path from "node:path";
import type { Options } from "@wdio/types";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const appBinaryPath = path.join(
  repositoryRoot,
  "src-tauri/target-wdio/debug/openrisk",
);
const generatedRoot = path.join(
  repositoryRoot,
  "evidence/teacher-report/generated/application",
);

export const config: Options.Testrunner = {
  runner: "local",
  specs: [path.join(import.meta.dirname, "application.spec.ts")],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: appBinaryPath,
      },
    } as WebdriverIO.Capabilities,
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath,
        driverProvider: "embedded",
        embeddedPort: 4445,
        startTimeout: 60_000,
        statusPollTimeout: 10_000,
        captureBackendLogs: false,
        captureFrontendLogs: false,
        logDir: path.join(generatedRoot, "logs"),
        logLevel: "info",
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  logLevel: "warn",
  waitforTimeout: 15_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 1,
  mochaOpts: {
    ui: "bdd",
    timeout: 90_000,
  },
};
