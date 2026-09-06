#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriCli = path.join(
  rootDir,
  "node_modules",
  "@tauri-apps",
  "cli",
  "tauri.js",
);

const usage = `Build OpenRisk with optional, independent feature flags.

Usage:
  npm run build:app
  npm run build:app -- --disable-plugin-installation
  npm run build:app -- --brand-name <name> --brand-logo <png-or-svg> --app-icon <square-png-or-svg>
  npm run build:app -- --build-config <path>
  npm run build:app -- [options] -- [extra tauri build arguments]

Options:
  --disable-plugin-installation  Remove plugin installation from UI and backend.
  --brand-name <name>            Accessible/PDF name for a custom brand.
  --brand-logo <path>            Wordmark used by both the app UI and PDFs.
  --app-icon <path>              Square source used to generate packaged OS icons.
  --build-config <path>          Build config (default: build-config.json).
  --features <a,b>               Additional Cargo features.
  -h, --help                     Show this help.

OpenRisk branding and the checked-in OpenRisk OS icons are used when no custom
branding arguments are supplied. All three custom branding arguments are
required together. The committed build config is also used by release builds.`;

function fail(message) {
  console.error(`[build-app] ERROR: ${message}`);
  process.exitCode = 1;
}

function takeValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function resolveAsset(configuredPath, label) {
  const resolved = path.resolve(rootDir, configuredPath);
  if (!existsSync(resolved)) {
    throw new Error(`${label} does not exist: ${resolved}`);
  }

  const extension = path.extname(resolved).toLowerCase();
  if (extension !== ".png" && extension !== ".svg") {
    throw new Error(`${label} must be a PNG or SVG file: ${resolved}`);
  }
  return resolved;
}

function expectObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertKnownKeys(value, allowedKeys, label) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${label} contains an unknown property: ${key}`);
    }
  }
}

function loadBuildConfig(configuredPath) {
  const configPath = path.resolve(rootDir, configuredPath);
  if (!existsSync(configPath)) {
    throw new Error(`Build config does not exist: ${configPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not parse build config ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const config = expectObject(parsed, "Build config");
  assertKnownKeys(
    config,
    new Set(["$schema", "configVersion", "features", "branding"]),
    "Build config",
  );
  if (config.configVersion !== 1) {
    throw new Error("Build config must use configVersion 1.");
  }
  if (!Array.isArray(config.features)) {
    throw new Error("Build config features must be an array.");
  }

  const features = config.features.map((feature) => {
    if (typeof feature !== "string" || !/^[A-Za-z0-9_-]+$/.test(feature)) {
      throw new Error(`Invalid Cargo feature in build config: ${String(feature)}`);
    }
    return feature;
  });

  if (config.branding === null) {
    return { features, branding: null };
  }

  const branding = expectObject(config.branding, "Build config branding");
  assertKnownKeys(
    branding,
    new Set(["name", "logo", "appIcon"]),
    "Build config branding",
  );
  for (const key of ["name", "logo", "appIcon"]) {
    if (typeof branding[key] !== "string" || !branding[key].trim()) {
      throw new Error(`Build config branding.${key} must be a non-empty string.`);
    }
  }

  const configDirectory = path.dirname(configPath);
  return {
    features,
    branding: {
      name: branding.name,
      logo: path.resolve(configDirectory, branding.logo),
      appIcon: path.resolve(configDirectory, branding.appIcon),
    },
  };
}

function parseArguments(args) {
  const options = {
    brandName: undefined,
    brandLogo: undefined,
    appIcon: undefined,
    buildConfig: process.env.OPENRISK_BUILD_CONFIG || "build-config.json",
    features: new Set(),
    tauriArgs: [],
  };

  if (args[0] === "build") {
    options.tauriArgs = args.slice(args[1] === "--" ? 2 : 1);
    return options;
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      options.tauriArgs = args.slice(index + 1);
      break;
    }
    if (argument === "-h" || argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--disable-plugin-installation") {
      options.features.add("disable-plugin-installation");
      continue;
    }
    if (argument === "--brand-name") {
      options.brandName = takeValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--brand-logo") {
      options.brandLogo = takeValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--app-icon") {
      options.appIcon = takeValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--build-config") {
      options.buildConfig = takeValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--features") {
      const value = takeValue(args, index, argument);
      for (const feature of value.split(",").map((item) => item.trim())) {
        if (feature) options.features.add(feature);
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}. Put Tauri arguments after --.`);
  }

  return options;
}

function runTauri(args, environment = process.env) {
  console.log(`[build-app] tauri ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tauriCli, ...args], {
      cwd: rootDir,
      env: environment,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal ${signal}.`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with status ${code ?? "unknown"}.`));
      }
    });
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  const buildConfig = loadBuildConfig(options.buildConfig);
  for (const feature of buildConfig.features) {
    options.features.add(feature);
  }

  const commandLineBranding = [
    options.brandName,
    options.brandLogo,
    options.appIcon,
  ];
  if (
    commandLineBranding.some(Boolean) &&
    commandLineBranding.some((value) => !value)
  ) {
    throw new Error(
      "--brand-name, --brand-logo, and --app-icon must be supplied together.",
    );
  }
  if (!commandLineBranding.some(Boolean) && buildConfig.branding) {
    options.brandName = buildConfig.branding.name;
    options.brandLogo = buildConfig.branding.logo;
    options.appIcon = buildConfig.branding.appIcon;
  }

  const brandingValues = [options.brandName, options.brandLogo, options.appIcon];
  const customBranding =
    brandingValues.some(Boolean) || options.features.has("custom-branding");
  if (customBranding && brandingValues.some((value) => !value)) {
    throw new Error(
      "--brand-name, --brand-logo, and --app-icon are all required for custom branding.",
    );
  }

  if (!customBranding) {
    const buildArgs = ["build"];
    if (options.features.size > 0) {
      buildArgs.push("--features", [...options.features].sort().join(","));
    }
    buildArgs.push(...options.tauriArgs);
    await runTauri(buildArgs);
    return;
  }

  const brandName = options.brandName.trim();
  if (!brandName) {
    throw new Error("--brand-name cannot be empty.");
  }
  if (/\r|\n/.test(brandName)) {
    throw new Error("--brand-name cannot contain line breaks.");
  }
  const brandLogo = resolveAsset(options.brandLogo, "Brand logo");
  const appIcon = resolveAsset(options.appIcon, "App icon");
  options.features.add("custom-branding");

  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "openrisk-build-"));
  try {
    const iconsDirectory = path.join(temporaryDirectory, "icons");
    await runTauri([
      "icon",
      appIcon,
      "--output",
      iconsDirectory,
    ]);

    const temporaryConfig = path.join(temporaryDirectory, "branding.conf.json");
    writeFileSync(
      temporaryConfig,
      `${JSON.stringify(
        {
          bundle: {
            icon: [
              path.join(iconsDirectory, "32x32.png"),
              path.join(iconsDirectory, "128x128.png"),
              path.join(iconsDirectory, "128x128@2x.png"),
              path.join(iconsDirectory, "icon.icns"),
              path.join(iconsDirectory, "icon.ico"),
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const environment = {
      ...process.env,
      OPENRISK_CUSTOM_BRANDING: "1",
      OPENRISK_BRAND_NAME: brandName,
      OPENRISK_BRAND_LOGO: brandLogo,
    };
    const buildArgs = [
      "build",
      "--features",
      [...options.features].sort().join(","),
      "--config",
      temporaryConfig,
      ...options.tauriArgs,
    ];
    await runTauri(buildArgs, environment);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
