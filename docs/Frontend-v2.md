# OpenRisk Frontend v2

## Goal

Replace the existing frontend with a small, deterministic desktop UI built
around the real OpenRisk investigation workflow. The Rust backend and generated
Tauri Specta bindings remain the source of truth.

## Product rules

1. Every backend write must be caused by an explicit user action.
2. Opening a workspace may read project settings and the scan list, but must not
   create, rename, archive, reorder, or run anything.
3. No autosave, background refresh, automatic retry, or automatic project open.
4. Important errors stay visible beside the action that caused them.
5. Plugin output keys and values are displayed as provided. The frontend must
   not rename, prettify, normalize, or sanitize `$props` or `$extra`.
6. A malformed plugin result may break its own result card, never the whole
   workspace.
7. The active Rust project session is the only project-session source of truth.

## Actors

### Investigator

Creates or opens a project, configures plugins, starts investigations, reviews
results, and exports reports.

### Auditor

Opens a project or read-only preview, finds an investigation, reviews its
inputs, plugin executions, results, errors, and logs, then exports evidence.

## Primary use cases

### P0

- Create a project.
- Open a project, including an encrypted project.
- Start a new investigation.
- Select one plugin and one or more of its named checks.
- Enter schema-driven inputs and see validation errors before execution.
- Run the investigation once.
- Review typed entities, plugin errors, logs, and raw fallback output.
- Search and open investigation history.
- Configure an installed plugin with an explicit Save action.

### P1

- Install plugins from the registry, a directory, or a ZIP archive.
- Enable or disable an installed plugin.
- Export one investigation or the complete project to PDF.
- Export a read-only preview project.
- Rename and password-protect a project.
- Archive an investigation.

### Out of scope for v2

- Project dashboard and statistic cards.
- Separate history page.
- URL-driven desktop navigation.
- Persisted empty drafts.
- Manual investigation ordering.
- In-memory favorites.
- Automatic registry loading.
- Custom theme profiles.

## Top-level UI

### Launcher

- Create Project
- Open Project
- Recent Projects
- Encrypted project unlock dialog

### Workspace

- Project header with a single Settings action
- Persistent investigation history sidebar
- Main area containing either the new-investigation form or one selected result

### Settings

- One Obsidian-style dialog with General, Community plugins, Security, and
  per-plugin sections.
- Normal mode presents compact, office-friendly report sections.
- Advanced mode exposes entity IDs, exact technical containers, raw output,
  and execution logs.

## Presentation standard

- Use one visual boundary per section. Nested data is separated by whitespace
  and row dividers, not nested rounded cards.
- Read-only values look like text. Inputs, selects, switches, and buttons are
  reserved for actions the user can actually perform.
- Use the existing 4/8px spacing scale. Standard controls are 36–40px high;
  history rows are approximately 60px high.
- Status is an icon plus text. Versions, metrics, dates, and plugin names are
  secondary text, not pills.
- Homogeneous arrays of objects are tables. Key/value arrays are definition
  rows. Plugin keys and values remain unchanged.
- A disclosure is shown only when it contains data. Normal mode limits
  disclosure to sources; technical containers and logs belong to Advanced
  mode.
- The workspace and settings dialog must not create page-level horizontal
  scrolling at an 800px-wide desktop window.

## Interaction contract

- `createProject`, `openProject`, and password unlock run only after a user
  submits the corresponding launcher action.
- Workspace initialization calls `loadSettings` and `listScans` once.
- Selecting an investigation calls `getScan`.
- Run calls `createScan(preview)` followed by `runScan` and `getScan`.
- Plugin registry loading requires an explicit Load Registry action.
- Plugin settings are persisted only by Save Settings.
- Buttons that start commands stay disabled until that command settles.
- Persisted status is never guessed or optimistically overwritten.

## Frontend stack

- Tauri 2
- React 19
- TypeScript strict mode
- Vite
- Tailwind CSS
- shadcn/ui primitives on Radix
- Lucide icons
- React Hook Form for schema-driven forms
- Zod for non-transforming runtime guards at untrusted plugin-output boundaries
- Vitest and React Testing Library

The frontend intentionally does not use a router, Redux, Zustand, XState,
TanStack Query, Axios, or a global event bus.

## Code boundaries

- `backend/` owns the `OpenRiskClient` port and Tauri implementation.
- `app/` owns the finite application/session state.
- `projects/` owns the launcher.
- `settings/` owns project, security, install, and plugin settings.
- `investigations/` owns form, history, execution, and result selection.
- `plugins/` owns install, enable, and configuration flows.
- `results/` owns defensive plugin-output rendering.
- `shared/` owns reusable presentational controls only.

Feature components receive an `OpenRiskClient`; they do not import generated
Tauri commands directly.

## Test contract

- No project opens automatically.
- Typing into a form makes no backend call.
- One Run click creates and runs exactly one scan.
- A second Run cannot start while the first is pending.
- Unknown and malformed output falls back without crashing.
- One failed plugin result does not hide successful results.
- Plugin settings are not written before Save Settings.
- The registry is not loaded before Load Registry.
- Read-only preview mode hides all mutating actions.
