import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const beforeRoot =
  process.env.OPENRISK_EVIDENCE_BEFORE ?? "/tmp/openrisk-evidence-before";
const afterRoot =
  process.env.OPENRISK_EVIDENCE_AFTER ?? "/tmp/openrisk-evidence-after";
const outputRoot = path.join(repositoryRoot, "evidence/teacher-report/generated");

function viteCommand(port: number): string {
  return [
    "npm run routes:generate",
    `./node_modules/.bin/vite --host 127.0.0.1 --port ${port} --strictPort`,
  ].join(" && ");
}

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "historical.spec.ts",
  outputDir: path.join(outputRoot, "playwright-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(outputRoot, "playwright-html"),
        open: "never",
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "Europe/Bratislava",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    video: {
      mode: "on",
      size: { width: 1440, height: 900 },
    },
  },
  projects: [
    {
      name: "before",
      use: {
        baseURL: "http://127.0.0.1:1422",
      },
    },
    {
      name: "after",
      use: {
        baseURL: "http://127.0.0.1:1423",
      },
    },
  ],
  webServer: [
    {
      command: viteCommand(1422),
      cwd: beforeRoot,
      url: "http://127.0.0.1:1422",
      reuseExisting: false,
      timeout: 120_000,
    },
    {
      command: viteCommand(1423),
      cwd: afterRoot,
      url: "http://127.0.0.1:1423",
      reuseExisting: false,
      timeout: 120_000,
    },
  ],
});
