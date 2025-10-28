# OpenRisk - Implementation Complete! 🎉

## What's Been Implemented

### Backend (Rust + Tauri + Rustyscript)
- ✅ Plugin system with directory structure (`src-tauri/plugins/`)
- ✅ `execute_plugin` command that:
  - Reads plugin code from `plugins/{plugin_id}/index.ts`
  - Reads plugin manifest from `plugins/{plugin_id}/plugin.json`
  - Merges settings with inputs
  - Executes plugin using rustyscript
  - Returns JSON results

### Frontend (React + TypeScript)
- ✅ Auto-detection of Tauri environment
- ✅ `TauriBackendClient` implementation using Tauri IPC
- ✅ `ReportPage` with:
  - Search form for OpenSanctions
  - Loading states
  - Error handling
  - **Dual view modes:**
    - Table view: Smart display of OpenSanctions entities
    - JSON view: Raw JSON data inspection

### OpenSanctions Plugin
- ✅ Full TypeScript implementation at `src-tauri/plugins/opensanctions/`
- ✅ Integrates with OpenSanctions Search API
- ✅ Receives settings: `api_key`, `open_sanctions_url`, `dry_run`
- ✅ Returns structured entity data with:
  - Names, aliases
  - Birth dates
  - Countries
  - Topics (sanctions, PEP status, etc.)
  - Datasets

## How to Run

### Development Mode

1. **Enter Nix Development Environment:**
   ```bash
   nix develop
   ```

2. **Install Node Dependencies:**
   ```bash
   npm install
   ```

3. **Run Tauri Dev Server:**
   ```bash
   npm run tauri dev
   ```

   This will:
   - Build the Rust backend
   - Start the Vite dev server
   - Launch the Tauri window with hot reload

### Configure OpenSanctions

1. Click the **Settings** button (top-right)
2. Navigate to **Plugins** → **Open Sanctions**
3. Enter your **API Key** (get one from https://www.opensanctions.org/account/)
4. Optionally change the API URL
5. Save settings

### Run a Search

1. Navigate to the **Report** page (click "Go to Report")
2. Enter a name to search (e.g., "Vladimir Putin")
3. Click **Run Analysis**
4. View results in:
   - **Table View**: Structured display with badges for topics
   - **JSON View**: Raw API response for debugging

## Project Structure

```
src-tauri/
  plugins/
    opensanctions/
      plugin.json      # Plugin manifest
      index.ts         # Plugin implementation
  src/
    lib.rs            # Rust backend with execute_plugin command

src/
  pages/
    ReportPage.tsx    # Main analysis page with form & results
  core/
    backend/
      TauriBackendClient.ts  # Tauri IPC client
  hooks/
    useBackendClient.tsx     # Auto-detects Tauri environment
```

## API Flow

```
User Input (Name)
    ↓
ReportPage.tsx calls backendClient.executePlugin()
    ↓
TauriBackendClient invokes Tauri command "execute_plugin"
    ↓
Rust backend (lib.rs):
  - Reads plugins/opensanctions/index.ts
  - Reads plugins/opensanctions/plugin.json
  - Merges settings (from UI) + inputs (from form)
  - Executes plugin via rustyscript
    ↓
Plugin (index.ts):
  - Makes HTTP request to OpenSanctions API
  - Returns structured entity data
    ↓
Results displayed in ReportPage with dual view modes
```

## Key Features

### Settings Integration
- Plugins receive settings configured in the UI
- Settings are merged with form inputs before execution
- Settings persist across plugin runs

### Flexible Output Format
- Plugins return raw JSON (not pre-formatted)
- UI intelligently displays data based on structure
- **Table View**: For OpenSanctions entity data
- **JSON View**: For debugging and complex structures

### Error Handling
- Network errors displayed in UI
- API authentication failures shown clearly
- Plugin execution errors caught and displayed

## Next Steps / Future Enhancements

- [ ] Add more plugins (Credit Check, Fraud Detection, etc.)
- [ ] Plugin marketplace/discovery
- [ ] Result caching
- [ ] Export results (CSV, PDF)
- [ ] Advanced filters in table view
- [ ] Pagination for large result sets
- [ ] Real-time progress updates during execution

## Troubleshooting

### "No API key provided"
- Make sure you've configured the API key in Settings → Plugins → Open Sanctions

### Compilation errors
- Run `nix develop` to enter the dev environment
- Ensure all dependencies are installed: `npm install`

### Plugin not found
- Check that `src-tauri/plugins/opensanctions/` exists
- Verify `plugin.json` and `index.ts` are present

---

**Status:** ✅ Fully Implemented and Working!
