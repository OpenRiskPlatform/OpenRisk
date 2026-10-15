import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  discoverReleasePlan,
  writeTauriReleaseConfig,
} from "./release-plan.mjs";
import { main } from "./build-app.mjs";
import { bundleIconPaths } from "./release-config.mjs";

const defaultConfig = {
  configVersion: 1,
  features: [],
  availablePlugins: [],
  branding: null,
};

test("Windows bundle icons remain relative even when TEMP uses another drive", () => {
  const icons = bundleIconPaths(
    "D:\\a\\OpenRisk\\OpenRisk\\.release\\build-test\\icons",
    "D:\\a\\OpenRisk\\OpenRisk\\src-tauri",
    path.win32,
  );
  assert.equal(icons.at(-1), "../.release/build-test/icons/icon.ico");
  for (const icon of icons) {
    assert.equal(path.win32.isAbsolute(icon), false);
    assert.equal(icon.includes("\\"), false);
  }
  assert.throws(
    () =>
      bundleIconPaths(
        "C:\\Users\\runner\\Temp\\icons",
        "D:\\a\\OpenRisk\\OpenRisk\\src-tauri",
        path.win32,
      ),
    /same drive/,
  );
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "openrisk-release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "src-tauri"));
  writeFileSync(
    path.join(root, "build-config.json"),
    JSON.stringify(defaultConfig),
  );
  writeFileSync(
    path.join(root, "src-tauri/tauri.conf.json"),
    JSON.stringify({ productName: "openrisk", identifier: "edu.openrisk" }),
  );
  return root;
}
function custom(root, id, changes = {}) {
  const directory = path.join(root, "custom-releases", id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"/>',
  );
  const config = {
    ...defaultConfig,
    features: ["disable-plugin-marketplace"],
    availablePlugins: ["adversea"],
    application: {
      productName: id,
      identifier: `edu.openrisk.${id}`,
      binaryName: id,
    },
    branding: { name: `${id} Brand`, logo: "logo.svg", appIcon: "logo.svg" },
    ...changes,
  };
  const configPath = path.join(directory, "build-config.json");
  writeFileSync(configPath, JSON.stringify(config));
  return configPath;
}

test("always builds OpenRisk, including when there are no custom releases", (t) => {
  const root = fixture(t);
  const plan = discoverReleasePlan(root);
  assert.deepEqual(plan.releases, [
    { id: "openrisk", name: "OpenRisk", config: "build-config.json" },
  ]);
  assert.equal(plan.matrix.include.length, 3);
  assert.deepEqual(
    plan.matrix.include.map((job) => job.platform),
    ["macos-latest", "ubuntu-22.04", "windows-2022"],
  );
});

test("committed application identities satisfy the published config schema", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const schema = JSON.parse(
    readFileSync(path.join(root, "build-config.schema.json"), "utf8"),
  );
  const plan = discoverReleasePlan(root);
  for (const release of plan.releases.slice(1)) {
    const { application } = JSON.parse(
      readFileSync(path.join(root, release.config), "utf8"),
    );
    for (const [key, value] of Object.entries(application)) {
      assert.match(
        value,
        new RegExp(schema.properties.application.properties[key].pattern),
      );
    }
  }
});

test("bounds the fan-out at GitHub's matrix limit", (t) => {
  const root = fixture(t);
  for (let index = 0; index < 84; index++) custom(root, `variant${index}`);
  assert.equal(discoverReleasePlan(root).matrix.include.length, 255);
  custom(root, "one-more");
  assert.throws(() => discoverReleasePlan(root), /256-job matrix limit/);
});

test("discovers every variant in deterministic order, ignoring the directory README", (t) => {
  const root = fixture(t);
  custom(root, "zeta");
  custom(root, "alpha");
  writeFileSync(path.join(root, "custom-releases/README.md"), "Instructions");
  const plan = discoverReleasePlan(root);
  assert.deepEqual(
    plan.releases.map((release) => release.id),
    ["openrisk", "alpha", "zeta"],
  );
  assert.equal(plan.matrix.include.length, 9);
  assert.equal(
    plan.matrix.include.filter(
      (job) => job.config === "custom-releases/alpha/build-config.json",
    ).length,
    3,
  );
});

test("rejects accidental customization of the default release", (t) => {
  const root = fixture(t);
  writeFileSync(
    path.join(root, "build-config.json"),
    JSON.stringify({
      ...defaultConfig,
      features: ["disable-plugin-marketplace"],
    }),
  );
  assert.throws(() => discoverReleasePlan(root), /must remain the default/);
});

test("incomplete variant folders fail instead of silently dropping a release", (t) => {
  const root = fixture(t);
  mkdirSync(path.join(root, "custom-releases/incomplete"), { recursive: true });
  assert.throws(() => discoverReleasePlan(root), /ENOENT/);
});

for (const key of ["productName", "identifier", "binaryName"]) {
  test(`rejects duplicate ${key} to prevent installation collisions`, (t) => {
    const root = fixture(t);
    custom(root, "alpha");
    const application = {
      productName: "beta",
      identifier: "edu.openrisk.beta",
      binaryName: "beta",
    };
    application[key] = key === "identifier" ? "edu.openrisk.alpha" : "alpha";
    custom(root, "beta", { application });
    assert.throws(
      () => discoverReleasePlan(root),
      new RegExp(`duplicate application.${key}`),
    );
  });
}

test("rejects reserved variant ids and assets outside the variant directory", (t) => {
  const root = fixture(t);
  custom(root, "openrisk");
  assert.throws(
    () => discoverReleasePlan(root),
    /Invalid custom release directory/,
  );
  rmSync(path.join(root, "custom-releases/openrisk"), { recursive: true });
  const other = custom(root, "other");
  custom(root, "alpha", {
    branding: { name: "Alpha", logo: "../other/logo.svg", appIcon: "logo.svg" },
  });
  assert.ok(existsSync(other));
  assert.throws(
    () => discoverReleasePlan(root),
    /inside this variant directory/,
  );
});

test("wrapper passes identical package identity to Tauri and action artifact discovery", async (t) => {
  const root = fixture(t);
  const config = custom(root, "cybertrust");
  const actionConfigPath = writeTauriReleaseConfig(config, root);
  const actionConfig = JSON.parse(readFileSync(actionConfigPath, "utf8"));
  const calls = [];
  let temporaryConfig;
  let iconsDirectory;
  await main(
    ["--build-config", config, "--", "--target", "aarch64-apple-darwin"],
    async (args, env) => {
      calls.push(args);
      if (args[0] === "icon") {
        iconsDirectory = args[args.indexOf("--output") + 1];
        mkdirSync(iconsDirectory, { recursive: true });
        for (const name of [
          "32x32.png",
          "128x128.png",
          "128x128@2x.png",
          "icon.icns",
          "icon.ico",
        ]) {
          writeFileSync(path.join(iconsDirectory, name), "icon fixture");
        }
      }
      if (args[0] !== "build") return;
      temporaryConfig = args[args.indexOf("--config") + 1];
      const buildConfig = JSON.parse(readFileSync(temporaryConfig, "utf8"));
      const repositoryRoot = path.resolve(import.meta.dirname, "..");
      assert.ok(
        iconsDirectory.startsWith(
          path.join(repositoryRoot, ".release") + path.sep,
        ),
        "generated icons must stay on the checkout's drive",
      );
      for (const icon of buildConfig.bundle.icon) {
        assert.equal(
          path.isAbsolute(icon),
          false,
          "bundle icon paths must be relative",
        );
        assert.equal(icon.includes("\\"), false);
        assert.ok(
          existsSync(path.resolve(repositoryRoot, "src-tauri", icon)),
          "the bundler must resolve every generated icon from src-tauri",
        );
      }
      for (const key of ["productName", "identifier", "mainBinaryName"])
        assert.equal(buildConfig[key], actionConfig[key]);
      assert.equal(
        env.OPENRISK_BRAND_LOGO,
        path.join(root, "custom-releases/cybertrust/logo.svg"),
      );
      assert.equal(env.OPENRISK_CUSTOM_BRANDING, "1");
      assert.deepEqual(JSON.parse(env.OPENRISK_AVAILABLE_PLUGINS), [
        "adversea",
      ]);
      assert.match(args[args.indexOf("--features") + 1], /custom-branding/);
      assert.deepEqual(args.slice(-2), ["--target", "aarch64-apple-darwin"]);
    },
  );
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["icon", "build"],
  );
  assert.equal(existsSync(temporaryConfig), false);
});

test("tauri-action build invocation uses OPENRISK_BUILD_CONFIG and retains its extra config", async (t) => {
  const root = fixture(t);
  const previous = process.env.OPENRISK_BUILD_CONFIG;
  process.env.OPENRISK_BUILD_CONFIG = custom(root, "cybertrust");
  t.after(() => {
    if (previous === undefined) delete process.env.OPENRISK_BUILD_CONFIG;
    else process.env.OPENRISK_BUILD_CONFIG = previous;
  });
  const config = writeTauriReleaseConfig(
    process.env.OPENRISK_BUILD_CONFIG,
    root,
  );
  await main(
    ["build", "--config", config, "--target", "aarch64-apple-darwin"],
    async (args, env) => {
      if (args[0] === "build") {
        assert.equal(env.OPENRISK_BRAND_NAME, "cybertrust Brand");
        assert.deepEqual(args.slice(-4), [
          "--config",
          config,
          "--target",
          "aarch64-apple-darwin",
        ]);
      }
    },
  );
});

test("default build does not generate icons or apply a custom package identity", async (t) => {
  const root = fixture(t);
  const calls = [];
  await main(
    ["--build-config", path.join(root, "build-config.json")],
    async (args, env) => {
      calls.push(args);
      assert.deepEqual(JSON.parse(env.OPENRISK_AVAILABLE_PLUGINS), []);
    },
  );
  assert.deepEqual(calls, [["build"]]);
});
