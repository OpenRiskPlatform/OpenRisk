#!/usr/bin/env node
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBuildConfig } from "./build-app.mjs";
import { applicationTauriConfig } from "./release-config.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const platforms = [
  { platform: "macos-latest", args: "--target aarch64-apple-darwin" },
  { platform: "ubuntu-22.04", args: "" },
  { platform: "windows-2022", args: "" },
];

export function discoverReleasePlan(root = repositoryRoot) {
  const defaultConfig = loadBuildConfig("build-config.json", root);
  if (
    defaultConfig.branding !== null ||
    defaultConfig.application !== undefined ||
    defaultConfig.features.length ||
    defaultConfig.availablePlugins.length
  ) {
    throw new Error(
      "build-config.json must remain the default OpenRisk configuration; put customizations in custom-releases/<id>/build-config.json.",
    );
  }
  const baseTauri = JSON.parse(
    readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const identities = new Map([
    ["productName", new Set([baseTauri.productName.toLowerCase()])],
    ["identifier", new Set([baseTauri.identifier.toLowerCase()])],
    [
      "binaryName",
      new Set([(baseTauri.mainBinaryName || "openrisk").toLowerCase()]),
    ],
  ]);
  const releases = [
    { id: "openrisk", name: "OpenRisk", config: "build-config.json" },
  ];
  const directory = path.join(root, "custom-releases");
  const entries = existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name, "en"),
      )
    : [];
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw new Error(
        `Custom release entries cannot be symlinks: ${entry.name}`,
      );
    if (!entry.isDirectory()) continue; // Allows a README beside variant folders.
    const id = entry.name;
    if (!/^[a-z][a-z0-9-]*$/.test(id) || id === "openrisk") {
      throw new Error(
        `Invalid custom release directory: ${id}. Use a lowercase slug other than openrisk.`,
      );
    }
    const config = `custom-releases/${id}/build-config.json`;
    const directoryPath = realpathSync(path.join(directory, id));
    const configPath = realpathSync(path.join(root, config));
    if (!configPath.startsWith(directoryPath + path.sep))
      throw new Error(`${config} must be inside its variant directory.`);
    const build = loadBuildConfig(config, root);
    if (!build.application || !build.branding)
      throw new Error(`${config} requires application identity and branding.`);
    if (/[\r\n\x00-\x1f]/.test(build.branding.name))
      throw new Error(`${config}: invalid brand name.`);
    for (const [key, used] of identities) {
      const value = build.application[key].toLowerCase();
      if (used.has(value))
        throw new Error(
          `${config}: duplicate application.${key}: ${build.application[key]}`,
        );
      used.add(value);
    }
    for (const key of ["logo", "appIcon"]) {
      const asset = realpathSync(build.branding[key]);
      if (
        !asset.startsWith(directoryPath + path.sep) ||
        !statSync(asset).isFile() ||
        !/\.(png|svg)$/i.test(asset)
      ) {
        throw new Error(
          `${config}: branding.${key} must be a PNG/SVG file inside this variant directory.`,
        );
      }
    }
    releases.push({ id, name: build.branding.name, config });
  }
  const include = releases.flatMap((release) =>
    platforms.map((platform) => ({ ...release, ...platform })),
  );
  if (include.length > 256)
    throw new Error(
      "Too many variants for GitHub's 256-job matrix limit (maximum 84 custom releases plus OpenRisk).",
    );
  return { releases, matrix: { include } };
}

function output(name, value) {
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export function writeTauriReleaseConfig(configPath, root = repositoryRoot) {
  const config = applicationTauriConfig(loadBuildConfig(configPath, root));
  const destination = path.join(root, ".release", "tauri.conf.json");
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(config, null, 2) + "\n");
  return destination.replaceAll("\\", "/");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "--tauri-config") {
      if (!process.env.OPENRISK_BUILD_CONFIG)
        throw new Error("OPENRISK_BUILD_CONFIG is required.");
      output(
        "path",
        writeTauriReleaseConfig(process.env.OPENRISK_BUILD_CONFIG),
      );
    } else {
      const plan = discoverReleasePlan();
      if (process.argv[2] === "--github-output") {
        output("releases", JSON.stringify(plan.releases));
        output("matrix", JSON.stringify(plan.matrix));
      } else if (process.argv.length === 2) {
        console.log(JSON.stringify(plan, null, 2));
      } else
        throw new Error(
          "Usage: node scripts/release-plan.mjs [--github-output|--tauri-config]",
        );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
