# OpenRisk native macOS POC

This target is an incremental SwiftUI client over `openrisk-core`, the same
Rust project persistence and plugin runtime used by the Tauri application.
Its native boundary lives in the separate `openrisk-uniffi` adapter crate, so
the Swift client does not link the Tauri runtime.

The native client supports the current desktop workflow:

- create and open `.orproj` projects, including password-protected projects;
- reopen or forget recent projects;
- browse, archive, restore, rename, and drag investigations to reorder them;
- create an immediately persisted `Untitled` draft;
- choose an enabled plugin and one or more entrypoints;
- render inputs from plugin manifest metadata and auto-save draft changes;
- run an investigation in the background without blocking the rest of the app;
- display real plugin results in entrypoint tabs with sources and logs;
- manage project appearance and advanced mode;
- enable, configure, install, update, and refresh plugin metrics;
- manage project encryption and export read-only previews.

The Swift code is split by responsibility:

- `OpenRiskAppModel.swift` contains observable state only;
- `OpenRiskProjectActions.swift`, `OpenRiskScanActions.swift`, and
  `OpenRiskSettingsActions.swift` contain UI use-case orchestration;
- investigation, settings, plugin, security, and result views live in separate
  feature files;
- result decoding and common components are isolated from the main results
  screen.

The UniFFI adapter follows the same split in `src-tauri/crates/openrisk-uniffi`:
records, client operations, and errors are separate modules. Business logic
continues to live exclusively in `openrisk-core`.

Build it from the repository root:

```bash
npm run native:macos
```

Use the optimized, stripped build used by GitHub Actions for a distributable
bundle:

```bash
npm run native:macos -- --release
```

The application bundle is generated inside the existing ignored Cargo target
directory:

```text
src-tauri/target/native-macos/OpenRisk.app
```

The React/Tauri client remains available for other platforms. Both clients use
the same Rust core and the same project file format.
