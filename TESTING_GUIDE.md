# 🔧 Final Fixes Applied - Testing Guide

## What Was Fixed

### ✅ 1. Removed Mock Plugins
**Before:** App showed 4 mock plugins (Open Sanctions, Credit Check, Identity Verify, Fraud Detection)
**After:** Only shows plugins from `src-tauri/plugins/` directory

**Changes:**
- Removed `MOCK_PLUGINS` import from PluginRegistry
- Set `availablePlugins` to empty array
- Plugins now load ONLY from backend

### ✅ 2. Added Detailed Logging
**Changes:**
- Added extensive console logging in PluginRegistry
- Shows when plugins are loaded, how many, and their IDs
- Helps debug why plugins aren't appearing

### ✅ 3. Rebuilt Rust Backend
The `list_plugins` command has been compiled and is ready to use.

### ⚠️ 4. Mock Data Issue - IMPORTANT

**You're seeing this response:**
```json
{
  "pluginId": "opensanctions",
  "results": [{ "name": "cicak", "riskScore": 52, ... }]
}
```

**This is MockBackendClient data, NOT real OpenSanctions API response!**

## 🎯 Why You're Seeing Mock Data

The app has TWO backend clients:
1. **MockBackendClient** - Returns fake data (used in browser)
2. **TauriBackendClient** - Calls real Rust backend → real plugin → real API

**The detection logic:**
```typescript
// In useBackendClient.tsx
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

if (isTauri()) {
  return new TauriBackendClient();  // Real backend
} else {
  return new MockBackendClient();   // Mock data
}
```

## ✅ Solution: Run in Tauri Mode

```bash
# DON'T run this (browser only, uses mock):
npm run dev

# DO run this (Tauri app, uses real backend):
nix develop
npm run tauri dev
```

## 🧪 Complete Testing Guide

### Step 1: Verify You're in Tauri Mode

1. Run `npm run tauri dev`
2. Open Browser DevTools Console (F12)
3. Look for these logs:
   ```
   Using TauriBackendClient
   [PluginRegistry] Calling list_plugins...
   [PluginRegistry] Got plugins JSON: [...]
   [PluginRegistry] Loaded 1 plugins from backend
   ```

If you see `Using MockBackendClient` → **YOU'RE NOT IN TAURI MODE!**

### Step 2: Verify Plugins Are Loaded

1. Open Settings → Plugins
2. Should see ONLY: "Open Sanctions by OpenRiskPlatform"
3. If you see 4 plugins → refresh/restart
4. Check console for: `[PluginRegistry] Registered plugin: opensanctions`

### Step 3: Check Plugin Settings

1. In Settings → Plugins → Open Sanctions
2. Should see these settings (matching plugin.json):
   - ✅ Open Sanctions URL (string)
   - ✅ API Key (string)
   - ✅ Dry Run (boolean/toggle)

3. Enter your API key and save

### Step 4: Test Plugin Execution

1. Navigate to Report page
2. Enter a name (e.g., "Putin")
3. Click "Run Analysis"
4. **Check console logs:**
   ```
   [TauriBackendClient] Executing plugin: opensanctions
   [TauriBackendClient] Settings: { api_key: "...", open_sanctions_url: "...", dry_run: false }
   [OpenSanctions Plugin] Received inputs: ...
   [OpenSanctions Plugin] API Key: os_api_...
   [OpenSanctions Plugin] Request URL: https://api.opensanctions.org/search/default?q=Putin...
   [OpenSanctions Plugin] Response status: 200
   [OpenSanctions Plugin] Success! Found XX results
   ```

5. **Check response in JSON view** - should see:
   ```json
   {
     "success": true,
     "query": "Putin",
     "total": { "value": 20, "relation": "eq" },
     "results": [
       {
         "id": "Q7747",
         "schema": "Person",
         "caption": "Vladimir Putin",
         "properties": {
           "name": ["Vladimir Vladimirovich Putin"],
           "birthDate": ["1952-10-07"],
           "country": ["ru"],
           "topics": ["role.pep", "sanction"]
         }
       }
     ],
     "logs": ["...", "..."]
   }
   ```

6. **Click "Logs" button** to see execution logs

### Step 5: Verify Dry Run Setting

1. Go back to Settings → Plugins → Open Sanctions
2. Enable "Dry Run"
3. Go to Report page
4. Search for any name
5. **Should see response:**
   ```json
   {
     "message": "Dry run mode - no actual API call made",
     "query": "...",
     "inputs": {...},
     "logs": [...]
   }
   ```

## 🐛 Troubleshooting

### Issue: Still seeing mock data with riskScore

**Symptoms:**
```json
{
  "pluginId": "opensanctions",
  "results": [{ "name": "cicak", "riskScore": 52 }]
}
```

**Solution:**
1. Close the app completely
2. Run `npm run tauri dev` (NOT `npm run dev`)
3. Check console for "Using TauriBackendClient"
4. If still showing MockBackendClient, check if `window.__TAURI__` exists:
   ```javascript
   // In browser console
   console.log('__TAURI__' in window);  // Should be true
   ```

### Issue: Plugins not loading

**Symptoms:**
- Settings shows 0 or 4 plugins
- Console shows: "Failed to load plugins from backend"

**Solution:**
1. Check `src-tauri/plugins/opensanctions/` exists
2. Check `plugin.json` is valid JSON
3. Restart Tauri app
4. Check console for errors

### Issue: Logs not showing

**Symptoms:**
- No "Logs" button appears
- Logs array is empty

**Solution:**
1. Make sure you rebuilt Rust: `cargo build --manifest-path=src-tauri/Cargo.toml`
2. Check that plugin returns `logs` array in response
3. Verify plugin code has `logs.push(...)` statements

### Issue: API returns error

**Symptoms:**
```
Error: API request failed (401): No API key provided
```

**Solution:**
1. Make sure API key is entered in Settings
2. Check console for: `[TauriBackendClient] Settings: { api_key: "..." }`
3. Verify API key starts with `os_api_`
4. Get a valid key from https://www.opensanctions.org/account/

## 📊 Expected Real API Response Structure

When working correctly, you should see:

```typescript
{
  success: true,
  query: "search term",
  total: {
    value: number,    // How many results
    relation: "eq"    // Exact or estimate
  },
  results: [          // Array of entities
    {
      id: string,
      schema: "Person" | "Company" | "Vessel",
      caption: string,  // Display name
      properties: {
        name: string[],
        alias: string[],
        birthDate: string[],
        country: string[],  // Country codes
        topics: string[],   // ["role.pep", "sanction"]
        // ... many other fields
      },
      datasets: string[],  // Which sanctions lists
      target: boolean
    }
  ],
  facets: {
    countries: { "ru": 5, "us": 3 },
    topics: { "role.pep": 8 },
    datasets: { "us_ofac_sdn": 2 }
  },
  logs: [
    "[timestamp] Plugin log message",
    ...
  ]
}
```

## 🔄 Quick Restart Checklist

If things aren't working:

1. ☑️ Close all browser windows and Tauri app
2. ☑️ Run `nix develop`
3. ☑️ Run `npm run tauri dev`
4. ☑️ Check console for "Using TauriBackendClient"
5. ☑️ Check console for "[PluginRegistry] Loaded 1 plugins from backend"
6. ☑️ Open Settings → Verify only 1 plugin shows
7. ☑️ Enter API key if needed
8. ☑️ Try search and check console logs

---

**Everything is ready! Just make sure you run `npm run tauri dev` not `npm run dev`!** 🚀
