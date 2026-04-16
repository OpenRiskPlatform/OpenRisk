#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "src-tauri");
const isWindows = process.platform === "win32";
const noNixFallback = process.argv.includes("--no-nix-fallback");

function commandExists(command) {
  const probe = isWindows
    ? spawnSync("where", [command], { stdio: "ignore" })
    : spawnSync("which", [command], { stdio: "ignore" });
  return probe.status === 0;
}

function run(command, args, options = {}) {
  const title = `${command} ${args.join(" ")}`;
  console.log(`[udeps] ${title}`);

  const result = spawnSync(command, args, {
    cwd: backendDir,
    stdio: "inherit",
    shell: isWindows,
    ...options,
  });

  if (typeof result.status === "number") return result.status;
  return 1;
}

if (!commandExists("rustup")) {
  if (!noNixFallback && commandExists("nix")) {
    console.log("[udeps] rustup not found, falling back to `nix develop`.");
    const fallback = spawnSync(
      "nix",
      ["develop", "-c", "node", "scripts/udeps-backend.mjs", "--no-nix-fallback"],
      {
        cwd: rootDir,
        stdio: "inherit",
        shell: isWindows,
      },
    );
    process.exit(typeof fallback.status === "number" ? fallback.status : 1);
  }

  console.error("[udeps] ERROR: rustup is required.");
  console.error("[udeps] Install from: https://rustup.rs/");
  process.exit(1);
}

// Ensure nightly toolchain exists.
if (run("rustup", ["toolchain", "install", "nightly", "--profile", "minimal"]) !== 0) {
  process.exit(1);
}

// Ensure cargo-udeps is installed for nightly cargo.
const hasUdeps = spawnSync("rustup", ["run", "nightly", "cargo", "udeps", "--version"], {
  cwd: backendDir,
  stdio: "ignore",
  shell: isWindows,
}).status === 0;

if (!hasUdeps) {
  if (run("rustup", ["run", "nightly", "cargo", "install", "cargo-udeps", "--locked"]) !== 0) {
    process.exit(1);
  }
}

// Force nightly rustc so cargo-udeps doesn't accidentally invoke stable rustc.
const rustcPathResult = spawnSync(
  "rustup",
  ["which", "--toolchain", "nightly", "rustc"],
  {
    cwd: backendDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  },
);

if (rustcPathResult.status !== 0) {
  console.error("[udeps] ERROR: failed to resolve nightly rustc path.");
  if (rustcPathResult.stderr) console.error(rustcPathResult.stderr.trim());
  process.exit(rustcPathResult.status ?? 1);
}

const nightlyRustc = rustcPathResult.stdout.trim();
if (!nightlyRustc) {
  console.error("[udeps] ERROR: nightly rustc path is empty.");
  process.exit(1);
}

const status = run(
  "rustup",
  ["run", "nightly", "cargo", "udeps", "--all-targets"],
  {
    env: {
      ...process.env,
      RUSTC: nightlyRustc,
    },
  },
);

process.exit(status);
