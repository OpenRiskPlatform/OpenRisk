# Fixes Applied

## 1. Plugins Load Dynamically in Settings ✅

**Problem:** Plugins were only loading once on initial mount
**Solution:** Removed the `loadedFromBackend` flag so plugins are reloaded every time `loadPluginsFromBackend()` is called

**Files Modified:**
- `src/core/plugin-system/PluginRegistry.ts` - Removed caching flag

## 2. Persistent Settings Storage ✅

**Problem:** Settings were lost on app restart (in-memory only)
**Solution:** Created `TauriSettingsStore` that persists settings to disk using Tauri Store plugin

**Files Created:**
- `src/core/settings/TauriSettingsStore.ts` - New persistent settings implementation

**Files Modified:**
- `src-tauri/Cargo.toml` - Added `tauri-plugin-store = "2"`
- `src-tauri/src/lib.rs` - Added `.plugin(tauri_plugin_store::Builder::new().build())`
- `package.json` - Added `"@tauri-apps/plugin-store": "^2"`
- `src/core/settings/SettingsContext.tsx` - Auto-selects TauriSettingsStore when in Tauri, falls back to InMemorySettingsStore otherwise

**How it works:**
- Settings are saved to `settings.json` in the Tauri app data directory
- Automatically persists between app restarts
- Global settings and plugin settings are both saved
- Async methods for save operations

## 3. Correct OpenSanctions API ✅

**Problem:** Using `/search` endpoint which is for general search
**Solution:** Switched to `/match` endpoint which is designed for entity matching and compliance checks

**Files Modified:**
- `src-tauri/plugins/opensanctions/index.ts`

**Changes:**
- Now uses `POST /match/default` instead of `GET /search/default`
- Sends structured entity data with schema (Person, Company, etc.)
- Returns match scores and confidence levels
- Better suited for compliance and risk assessment

**API Request Format:**
```json
{
  "queries": {
    "entity1": {
      "schema": "Person",
      "properties": {
        "name": ["John Doe"],
        "birthDate": ["1980"]
      }
    }
  }
}
```

## 4. Fail App if Invoke Doesn't Work ✅

**Problem:** Silent fallback to MockBackendClient made it unclear when backend wasn't working
**Solution:** Always use TauriBackendClient - if `invoke` doesn't work, it will throw errors

**Files Modified:**
- `src/hooks/useBackendClient.tsx` - Removed `isTauri()` check, always uses TauriBackendClient
- `src/core/plugin-system/PluginRegistry.ts` - Removed `isTauri()` check, always tries to load from backend

**Why this is better:**
- Errors are immediately visible in console
- No ambiguity about which backend is running
- Forces proper Tauri setup (`cargo tauri dev`)
- Makes debugging easier

## Next Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build Rust backend:**
   ```bash
   cargo build --manifest-path=src-tauri/Cargo.toml
   ```

3. **Run in Tauri mode:**
   ```bash
   cargo tauri dev
   ```

4. **Test the fixes:**
   - Settings should persist between restarts
   - Plugins should refresh when you navigate to settings
   - OpenSanctions API should return match scores
   - Console should show clear errors if backend isn't working

## Settings Storage Location

Settings are stored at:
- **Linux:** `~/.local/share/com.openrisk.app/settings.json`
- **macOS:** `~/Library/Application Support/com.openrisk.app/settings.json`
- **Windows:** `%APPDATA%\com.openrisk.app\settings.json`
