#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "src-tauri");
const isWindows = process.platform === "win32";

function commandExists(command) {
  const probe = isWindows
    ? spawnSync("where", [command], { stdio: "ignore" })
    : spawnSync("which", [command], { stdio: "ignore" });
  return probe.status === 0;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

const hasCargo = commandExists("cargo");
const hasNix = commandExists("nix");
const EXPECTED_CARGO_TYPIFY_VERSION = "0.5.0";

function gitStatusSnapshot() {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  });

  if (result.status !== 0) {
    console.warn("[pre-commit] WARNING: failed to capture git status snapshot.");
    return null;
  }

  return result.stdout;
}

function run(command, args, { cwd = rootDir, nonBlocking = false, label } = {}) {
  const title = label ?? `${command} ${args.join(" ")}`;
  console.log(`[pre-commit] ${title}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.status !== 0) {
    if (nonBlocking) {
      console.warn(`[pre-commit] WARNING: ${title} failed (non-blocking).`);
      return false;
    }

    process.exit(result.status ?? 1);
  }

  return true;
}

function runBackend(commandParts, options = {}) {
  if (hasCargo) {
    return run(commandParts[0], commandParts.slice(1), {
      ...options,
      cwd: backendDir,
    });
  }

  if (hasNix) {
    const command = commandParts.map(shellEscape).join(" ");
    return run(
      "nix",
      ["develop", "-c", "bash", "-lc", `cd src-tauri && ${command}`],
      options,
    );
  }

  console.error(
    "[pre-commit] ERROR: neither cargo nor nix is available in PATH. Install Rust toolchain or use Nix dev shell.",
  );
  process.exit(1);
}

function backendBinaryAvailable(binary, args = ["--help"]) {
  if (hasCargo) {
    return spawnSync(binary, args, {
      cwd: backendDir,
      stdio: "ignore",
      shell: isWindows,
    }).status === 0;
  }

  if (hasNix) {
    const command = [binary, ...args].map(shellEscape).join(" ");
    return spawnSync(
      "nix",
      ["develop", "-c", "bash", "-lc", `cd src-tauri && ${command}`],
      { stdio: "ignore", shell: isWindows },
    ).status === 0;
  }

  return false;
}

function backendCommandOutput(commandParts) {
  if (hasCargo) {
    return spawnSync(commandParts[0], commandParts.slice(1), {
      cwd: backendDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
    });
  }

  if (hasNix) {
    const command = commandParts.map(shellEscape).join(" ");
    return spawnSync(
      "nix",
      ["develop", "-c", "bash", "-lc", `cd src-tauri && ${command}`],
      {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: isWindows,
      },
    );
  }

  return { status: 127, stdout: "", stderr: "" };
}

function checkTypifyGeneratedFile() {
  if (!backendBinaryAvailable("cargo-typify", ["typify", "--help"])) {
    console.error(
      "[pre-commit] ERROR: cargo-typify is required for generation checks. Install it (`cargo install cargo-typify --version 0.5.0`) or use the project Nix shell.",
    );
    process.exit(1);
  }

  const versionProbe = backendCommandOutput(["cargo-typify", "typify", "-V"]);
  if (versionProbe.status !== 0) {
    console.error("[pre-commit] ERROR: failed to detect cargo-typify version.");
    if (versionProbe.stderr) console.error(versionProbe.stderr);
    process.exit(versionProbe.status ?? 1);
  }

  const versionLine = (versionProbe.stdout || "").trim();
  if (!versionLine.includes(`cargo-typify ${EXPECTED_CARGO_TYPIFY_VERSION}`)) {
    console.error(
      `[pre-commit] ERROR: unsupported cargo-typify version: '${versionLine || "unknown"}'. Expected ${EXPECTED_CARGO_TYPIFY_VERSION}.`,
    );
    console.error(
      "[pre-commit] Install matching version: cargo install cargo-typify --version 0.5.0 --locked",
    );
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openrisk-typify-"));
  const generatedPath = path.join(tempDir, "plugin-manifest.schema.rs");
  const committedPath = path.join(backendDir, "schemas", "plugin-manifest.schema.rs");

  try {
    runBackend(
      [
        "cargo-typify",
        "typify",
        "--no-builder",
        "schemas/plugin-manifest.schema.json",
        "-o",
        generatedPath,
      ],
      { label: "cargo typify (check-only, temp output)" },
    );

    const committed = fs.readFileSync(committedPath, "utf8");
    const generated = fs.readFileSync(generatedPath, "utf8");

    if (committed !== generated) {
      console.error(
        "[pre-commit] ERROR: src-tauri/schemas/plugin-manifest.schema.rs is out of date.",
      );
      console.error(
        "[pre-commit] Run: cd src-tauri && cargo typify --no-builder schemas/plugin-manifest.schema.json -o schemas/plugin-manifest.schema.rs",
      );
      spawnSync(
        "git",
        ["--no-pager", "diff", "--no-index", "--", committedPath, generatedPath],
        { stdio: "inherit", shell: isWindows },
      );
      process.exit(1);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const statusBefore = gitStatusSnapshot();

function checkBindingsGeneratedFile() {
  const bindingsPath = path.join(rootDir, "src", "core", "backend", "bindings.ts");
  const hadOriginal = fs.existsSync(bindingsPath);
  const original = hadOriginal ? fs.readFileSync(bindingsPath) : null;

  runBackend(["cargo", "test", "export_bindings", "--", "--nocapture"], {
    label: "cargo test export_bindings (check-only)",
  });

  const diffProbe = spawnSync(
    "git",
    ["diff", "--name-only", "--", "src/core/backend/bindings.ts"],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
    },
  );

  if (diffProbe.status !== 0) {
    console.error("[pre-commit] ERROR: failed to inspect bindings.ts drift.");
    process.exit(1);
  }

  if (diffProbe.stdout.trim().length > 0) {
    console.error(
      "[pre-commit] ERROR: src/core/backend/bindings.ts is out of date.",
    );
    console.error(
      "[pre-commit] Run: cd src-tauri && cargo test export_bindings -- --nocapture and commit src/core/backend/bindings.ts",
    );
    run(
      "git",
      ["--no-pager", "diff", "--", "src/core/backend/bindings.ts"],
      { cwd: rootDir, label: "bindings.ts drift" },
    );

    if (hadOriginal && original !== null) {
      fs.writeFileSync(bindingsPath, original);
    } else {
      fs.rmSync(bindingsPath, { force: true });
    }

    process.exit(1);
  }
}

runBackend([
  "cargo",
  "clippy",
  "--all-targets",
  "--all-features",
  "--",
  "-D",
  "warnings",
]);
runBackend(["cargo", "fmt", "--all", "--", "--check"]);
checkTypifyGeneratedFile();
checkBindingsGeneratedFile();

run("node", ["scripts/udeps-backend.mjs"], {
  cwd: rootDir,
  label: "cargo udeps --all-targets (nightly)",
});

const statusAfter = gitStatusSnapshot();
if (statusBefore !== null && statusAfter !== null && statusBefore !== statusAfter) {
  console.error(
    "[pre-commit] ERROR: check commands modified tracked files. Checks must be non-mutating.",
  );
  run("git", ["status", "--short"], { cwd: rootDir, label: "git status (after checks)" });
  process.exit(1);
}
