# OpenRisk native macOS POC

This target is an incremental SwiftUI client over the same Rust project
persistence and plugin runtime used by the Tauri application.

The proof of concept supports the complete primary workflow:

- open an existing `.orproj` project, including password-protected projects;
- browse, archive, restore, rename, and drag investigations to reorder them;
- create an immediately persisted `Untitled` draft;
- choose an enabled plugin and one or more entrypoints;
- render inputs from plugin manifest metadata and auto-save draft changes;
- run an investigation in the background without blocking the rest of the app;
- display real plugin results in entrypoint tabs with sources and logs.

Build it from the repository root:

```bash
npm run native:macos
```

The application bundle is generated inside the existing ignored Cargo target
directory:

```text
src-tauri/target/native-macos/OpenRisk.app
```

The React/Tauri application remains the production client for every platform
while native functionality is added in vertical slices. Plugin installation,
plugin settings, security settings, and specialized result renderers remain in
the production client for now.
