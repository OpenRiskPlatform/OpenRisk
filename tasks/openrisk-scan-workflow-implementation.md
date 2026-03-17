# OpenRisk Scan Workflow Implementation

## Context
- Goal: define and implement the target app flow for project + scans UI/UX and backend persistence.
- Constraint: ignore advanced plugin framework logic for now; plugin execution is direct execution of one TypeScript file from DB text with default async export.
- Current stage: architecture/discovery + alignment questions.

## Confirmed Happy Path (from product request)
1. User opens app and sees Open/Create project actions.
2. User opens existing project or creates new one.
3. System opens sqlite project and keeps one reusable connection for this project session.
4. UI left panel shows scans list; selecting scan shows status and ability to open results.
5. Scan lifecycle:
   - Draft: select plugins, collect inputs, start scan.
   - Running: background execution.
   - Completed: full result shown.
   - Failed: error state shown.
  - Scan is immutable after launch: rerun is forbidden for the same scan.
  - Inputs + plugin settings are fixed snapshot of this scan run.
   - No partial output shown while running.
6. Data model rendering:
   - Frontend renders plugin output only in DataModel format from docs/DataModel.md.
   - Components are needed for typed values, entity cards, and plugin result container.

## What exists now
- Entry flow with Create/Open exists.
- Project DB schema exists and now includes schema versioning + migrations table.
- Theme is persisted in ProjectSettings.
- Plugin execution exists (rustyscript runtime) and currently executes plugin directly.
- Current pages are Entry/Project/Report, but no scan-focused workspace UI yet.

## Gaps vs happy path
- No reusable per-project sqlite connection manager in app service layer.
- No scan CRUD/service APIs exposed to frontend.
- No scan list sidebar UI and scan detail/result pages.
- Scan statuses in DB are Draft/Running/Finished (need Completed/Failed contract).
- No orchestration that records run lifecycle (Draft -> Running -> Completed|Failed).
- No immutable-scan guard (currently no explicit restriction to block rerun of same scan).
- No DataModel typed React renderer components.
- Report page currently renders OpenSanctions-like shape, not DataModel 0.0.2 entity contract.

## Proposed implementation tracks

### Track A: Backend (Rust/Tauri)
- Add project session service with one reusable sqlite connection per opened project.
- Introduce scan APIs:
  - list_scans(projectDir)
  - create_scan(projectDir, payload)
  - update_scan_draft(projectDir, scanId, selectedPlugins, inputs)
  - run_scan(projectDir, scanId)
  - get_scan(projectDir, scanId)
  - get_scan_results(projectDir, scanId)
- Normalize status enum to Draft/Running/Completed/Failed.
- Persist scan result per plugin in ScanPluginResult, storing canonical DataModel JSON.
- Add immutable scan rule in backend: only Draft can transition to Running once.
- Store frozen inputs and frozen plugin settings snapshot at launch.
- Keep plugin execution direct and synchronous for now, but persist lifecycle transitions.

### Track B: Frontend (React)
- New project workspace layout:
  - Left: scan list with status badges.
  - Right: selected scan detail.
- Draft view:
  - plugin selection
  - dynamic inputs from selected plugin manifests
  - Run button
- Running view:
  - immutable progress state, no partial data rendering.
- Completed view:
  - DataModel renderer components for plugin results.
- Failed view:
  - error summary + create new draft scan (prefill optional), no rerun on same scan.

### Track C: DataModel Components
- Add generic renderer set:
  - TypedValueView
  - SourceListView
  - EntityPropsView
  - EntityExtraView
  - EntityCardView
  - PluginResultView
- Strictly support DataModel.md contract (typed values + entity.* contract).

## Proposed milestones
1. Schema/service baseline for scans + status normalization.
2. Tauri commands + backend client methods for scans.
3. Workspace UI with left scans list and scan detail.
4. DataModel rendering components and integration into Completed state.
5. End-to-end happy path validation through MCP and sqlite script checks.

## Confirmed decisions
- Scan cannot be rerun once launched.
- Each scan represents concrete immutable snapshot: selected plugins + input values + plugin settings at launch time.
- Failed state: for now keep simple failed view only, no clone/retry helper action.
- One scan contains all selected plugins and their results in a single run snapshot.
- Migrate statuses in DB to Draft/Running/Completed/Failed, including Finished -> Completed.
- DataModel rendering includes person-specific card for entity.person.

## Questions to resolve before implementation
- Should status migration map old Finished -> Completed in-place, or support both during transition?
- For Draft scan, do we allow plugin list and settings edits only before first launch? (assumed yes)
- For DataModel rendering, do we need entity type-specific cards beyond entity.person now?
- For left sidebar sorting: newest first by updated_at (needs timestamp columns) or manual order?

## Progress log
- [x] Read docs/DataModel.md, docs/C4.md, docs/Entity.md, architecture.md.
- [x] Inspected current frontend pages and backend plugin/project services.
- [x] Created this task file.
- [x] Captured decision: scan rerun forbidden; scan run is immutable snapshot.
- [x] Captured decision: failed view simple (no retry helper action yet).
- [x] Captured decision: single scan contains all selected plugins.
- [x] Captured decision: status migration Finished -> Completed.
- [x] Captured decision: implement person-specific renderer for entity.person.
- [x] Implemented DataModel renderer components with person-specific card in frontend.
- [x] Added demo plugin `persondemo` to validate DataModel person rendering.
- [x] Validated in running app via MCP: Model View shows person card fields (Position, Age, Birth Date, Document ID, Sources).
- [x] Added editable plugin settings by schema and save-to-project-db backend command.
- [x] Added minimal scan creation/list backend commands and connected frontend create/list flow.
- [x] Moved project info to Settings `Info` tab and removed clickable logo behavior.
- [x] Added in-app header navigation controls (Back/Forward + Project/Report buttons).
- [ ] Awaiting remaining answers to questions above for final architecture lock.
- [ ] Begin implementation after agreement.
