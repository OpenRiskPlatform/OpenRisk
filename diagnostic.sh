#!/usr/bin/env bash
# Quick diagnostic script to check OpenRisk setup

echo "🔍 OpenRisk Diagnostic Check"
echo "=============================="
echo ""

echo "1. Checking directory structure..."
if [ -d "src-tauri/plugins/opensanctions" ]; then
    echo "   ✅ Plugin directory exists"
    if [ -f "src-tauri/plugins/opensanctions/plugin.json" ]; then
        echo "   ✅ plugin.json found"
    else
        echo "   ❌ plugin.json NOT found"
    fi
    if [ -f "src-tauri/plugins/opensanctions/index.ts" ]; then
        echo "   ✅ index.ts found"
    else
        echo "   ❌ index.ts NOT found"
    fi
else
    echo "   ❌ Plugin directory NOT found"
fi
echo ""

echo "2. Checking Rust build status..."
if [ -f "src-tauri/target/debug/openrisk" ] || [ -f "src-tauri/target/debug/openrisk.exe" ]; then
    echo "   ✅ Rust binary exists"
else
    echo "   ⚠️  Rust binary not found - may need to build"
fi
echo ""

echo "3. Checking Node modules..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ❌ node_modules NOT found - run: npm install"
fi
echo ""

echo "4. Checking required packages..."
if [ -d "node_modules/@tauri-apps" ]; then
    echo "   ✅ @tauri-apps packages installed"
else
    echo "   ❌ @tauri-apps packages NOT found"
fi
echo ""

echo "5. Plugin manifest check..."
if [ -f "src-tauri/plugins/opensanctions/plugin.json" ]; then
    echo "   Plugin name: $(cat src-tauri/plugins/opensanctions/plugin.json | grep '"name"' | head -1 | cut -d'"' -f4)"
    echo "   Settings count: $(cat src-tauri/plugins/opensanctions/plugin.json | grep '"name"' | wc -l)"
    echo "   Has dry_run setting: $(cat src-tauri/plugins/opensanctions/plugin.json | grep -c 'dry_run')"
fi
echo ""

echo "6. Recommended commands to run:"
echo ""
echo "   # Enter development environment:"
echo "   nix develop"
echo ""
echo "   # Build Rust backend:"
echo "   cargo build --manifest-path=src-tauri/Cargo.toml"
echo ""
echo "   # Run in Tauri mode (CORRECT WAY):"
echo "   npm run tauri dev"
echo ""
echo "   # ❌ DON'T run this (browser only, uses mock data):"
echo "   # npm run dev"
echo ""

echo "7. How to verify you're in Tauri mode:"
echo "   - Open DevTools Console (F12)"
echo "   - Look for: 'Using TauriBackendClient'"
echo "   - If you see 'Using MockBackendClient' → You're in browser mode!"
echo ""

echo "=============================="
echo "Diagnostic complete!"
