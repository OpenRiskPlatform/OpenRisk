# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Toolchain requirements

- Node.js `22.22.2` (pinned in `.nvmrc` and Nix flake via `nodejs_22`)
- npm `10.9.7` (via `packageManager`)
- Rust `1.94.0`

Rust is pinned via `rust-toolchain.toml`, so if you use `rustup`, the correct compiler/tooling is selected automatically in this repo.

The Rust workspace in `src-tauri/Cargo.toml` also sets `rust-version = "1.94"` so Cargo fails early with a clear error when using an older compiler.

## App version

The packaged application version has one source of truth: the root `package.json`.
Tauri reads it through `src-tauri/tauri.conf.json`, so bundles and GitHub
releases use the same value.

Set an exact version:

```bash
npm run version:app -- 0.2.0
```

Or increment it using SemVer:

```bash
npm run version:app -- patch
npm run version:app -- minor
npm run version:app -- major
```

The command updates both `package.json` and `package-lock.json` without creating
a Git commit or tag. The workspace crate version in `src-tauri/Cargo.toml` is
internal and does not control the packaged application version.

### Manual releases

Releases are started only from **Actions → Manual release → Run workflow** on
the `main` branch. The optional `version` input accepts an exact stable SemVer
such as `2.1.0`. When it is empty, the workflow bumps the current minor version.

The workflow runs `npm run version:app`, commits the updated `package.json` and
`package-lock.json` to `main`, builds the Tauri bundles, and publishes the
`openrisk-v<version>` GitHub release. No release branch is used.

## Rust workspace

- `src-tauri/crates/openrisk-core` — shared business logic, persistence, and plugin runtime.
- `src-tauri/src` — thin Tauri commands and desktop bootstrap.

The React/Tauri application calls the shared `openrisk-core` use cases. Core
must not depend on Tauri or another UI adapter.

## Configurable builds

Use the cross-platform build wrapper on Windows, macOS, or Linux. The standard
build permits installing plugins and uses the checked-in OpenRisk logo in the
app, exported PDF reports, and OS packages:

```bash
npm run build:app
```

Plugin installation can be removed independently:

```bash
npm run build:app -- --disable-plugin-installation
```

Build behavior is read from the committed `build-config.json`. The default
configuration is:

```json
{
  "$schema": "./build-config.schema.json",
  "configVersion": 1,
  "features": [],
  "branding": null
}
```

The manual release workflow calls the same build wrapper, so every release uses
the feature and branding values committed with its release commit.

For a white-label build, set `branding` to a brand name, one PNG/SVG wordmark
shared by the app and PDF template, and a square PNG/SVG source for packaged
Windows, macOS, and Linux icons. Paths are resolved relative to the config file:

```json
{
  "$schema": "./build-config.schema.json",
  "configVersion": 1,
  "features": ["disable-plugin-installation"],
  "branding": {
    "name": "Example Brand",
    "logo": "assets/branding/example-logo.svg",
    "appIcon": "assets/branding/example-icon.svg"
  }
}
```

The script generates platform icons in a temporary directory; it does not
replace the checked-in OpenRisk icons. Custom branding enables the internal
`custom-branding` Cargo feature and embeds the selected wordmark into the PDF
binary at compile time.

Command-line values can augment or replace the committed configuration for a
local build:

```bash
npm run build:app -- --brand-name "Example Brand" --brand-logo path/to/logo.svg --app-icon path/to/icon.svg
npm run build:app -- --features feature-a,feature-b
npm run build:app -- --build-config path/to/another-build-config.json
```

Put raw Tauri build arguments after a second `--`, for example:

```bash
npm run build:app -- --disable-plugin-installation -- --target aarch64-apple-darwin
```

### Interrupted scan recovery

Plugin runs execute inside the app process. If the app is force-quit, the next
project open reconciles scans left in `Running` state. The behavior is
configured per project in
**Settings → Advanced → Interrupted investigations**:

- `fail` (default) — mark interrupted scans as `Failed`;
- `draft` — restore them as drafts so the user can explicitly run them again;
- `off` — disable startup reconciliation and leave them as `Running`.

Automatic retry is intentionally not a startup policy: plugins can perform paid
or externally visible operations, and a force-quit does not prove that those
operations were never executed.

## Continuous integration

A backend-only CI workflow is defined in `.github/workflows/backend-rust-checks.yml` under workflow name `Backend` and runs as named jobs:

- `lint` (cargo check + clippy `-D warnings`)
- `format` (cargo fmt check)
- `manifest-sync` (typify drift check)
- `client-sync` (export_bindings drift check)
- `dead-deps` (cargo udeps)

Checks run only when relevant backend files change. Compile-heavy checks are staged with `needs` and use a shared Rust cache key.

Frontend tests and the production build run in `.github/workflows/frontend-checks.yml`.
The repository does not install Git hooks or run checks during local commits.

### Optional: unused dependency scan

`cargo udeps` requires a nightly Rust toolchain. Use:

```bash
npm run udeps:backend
```

This is a cross-platform script (Windows/macOS/Linux) that runs `cargo udeps` on nightly via `rustup`, ensures `cargo-udeps` is installed, and pins `RUSTC` to nightly to avoid stable-toolchain `-Z` failures.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## TypeScript bindings

TypeScript bindings for all Tauri commands are auto-generated via [tauri-specta](https://github.com/specta-rs/tauri-specta) into `src/core/backend/bindings.ts`. **Do not edit this file manually.**

### Regenerate after changing Rust commands

```bash
cd src-tauri && cargo test -p openrisk-tauri export_bindings
```

This runs a Rust unit test that writes `src/core/backend/bindings.ts`. No app launch needed.

Bindings are also regenerated automatically every time the app starts in **debug mode** (`npm run tauri dev`).

### When to regenerate

- Adding, removing or renaming a `#[tauri::command]`
- Changing argument or return types of a command
- Adding `#[derive(specta::Type)]` to a new struct/enum used in commands

## Plugin Manifest Types

Plugin manifest contract is defined in `src-tauri/crates/openrisk-core/schemas/plugin-manifest.schema.json`.

- `src-tauri/crates/openrisk-core/schemas/plugin-manifest.schema.rs` is generated from that schema via `cargo typify`.
- `openrisk-core/src/plugin_manifest.rs` uses generated types and performs runtime JSON Schema validation.

### Regenerate generated Rust types after schema changes

```bash
cd src-tauri && cargo typify --no-builder crates/openrisk-core/schemas/plugin-manifest.schema.json -o crates/openrisk-core/schemas/plugin-manifest.schema.rs
```

Do not edit `src-tauri/crates/openrisk-core/schemas/plugin-manifest.schema.rs` manually.
