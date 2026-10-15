# Custom releases

Every direct subdirectory here is a release variant. The manual release
workflow always builds the default OpenRisk app, then every variant for
Windows, Linux, and Apple Silicon macOS. There is no separate list to maintain.

```text
build-config.json                   # Default OpenRisk; keep unchanged
custom-releases/
  cybertrust/
    build-config.json
    cybertrust-logo.png
    cybertrust-icon.svg
  another-customer/
    build-config.json
    logo.svg
    icon.png
```

To add a variant, copy an existing directory, choose a unique lowercase
directory name, and update its `build-config.json`:

```json
{
  "$schema": "../../build-config.schema.json",
  "configVersion": 1,
  "features": ["disable-plugin-marketplace"],
  "availablePlugins": ["adversea"],
  "application": {
    "productName": "Example",
    "identifier": "edu.openrisk.example",
    "binaryName": "example"
  },
  "branding": {
    "name": "Example",
    "logo": "logo.svg",
    "appIcon": "icon.png"
  }
}
```

All three application identity fields must be unique across releases,
including OpenRisk. They control installer/app names, application data identity,
and executable names, allowing variants to coexist. Logos and icons must be
PNG/SVG files within the variant's directory. Asset paths are relative to the
config, including relative image references inside SVGs. Keep square icon
sources and any SVG dependencies beside the config. Do not commit API tokens
or plugin settings; `availablePlugins` only lists installable plugins.

Directory `example` creates tag `example-v<VERSION>` and a release named
`Example v<VERSION>`. The default retains `openrisk-v<VERSION>` and is the only
release marked Latest. All variants share the same version and source commit.

Preview and validate discovery without building or publishing:

```bash
node scripts/release-plan.mjs
node --test scripts/release-plan.test.mjs
```

Build just one variant locally:

```bash
npm run build:app -- --build-config custom-releases/cybertrust/build-config.json
# Optional development build (not a dev-server session):
npm run build:app -- --build-config custom-releases/cybertrust/build-config.json -- --debug --no-bundle
```

Run **Manual release** from `main` after merging these files. It validates all
configs before bumping the version, then builds each variant in isolated jobs.
Missing configs/assets, duplicate identities, and invalid directory names fail
validation. Empty directories are errors; remove a variant's entire directory
to stop releasing it. A README file at this level is ignored.

All releases remain drafts unless **every** variant/platform build succeeds.
If a build fails, rerun failed jobs in the same workflow run to reuse its
version and commit for transient failures. If the fix changes code, merge it
and start a new release with a higher version: reruns still build the old
commit. Starting a new run bumps the version again. Publication
uses separate API calls, so a publication-stage failure can leave some variants
published; rerun the failed publishing jobs. Publishing requires the existing
workflow token permissions and permission to push the version commit to main.

With three platforms, GitHub's 256-job matrix limit permits at most 84 custom
variants plus OpenRisk. No code-signing or notarization setup is added here.
