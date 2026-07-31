#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_DIR="$ROOT_DIR/src-tauri"
RUST_TARGET_DIR="$TAURI_DIR/target"
NATIVE_TARGET_DIR="$RUST_TARGET_DIR/native-macos"
GENERATED_DIR="$NATIVE_TARGET_DIR/generated"
APP_DIR="$NATIVE_TARGET_DIR/OpenRisk.app"
APP_CONTENTS="$APP_DIR/Contents"
APP_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
SWIFT_MODULE_CACHE="$NATIVE_TARGET_DIR/swift-module-cache"

if [[ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk" ]]; then
  MACOS_SDK="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"
else
  MACOS_SDK="$(xcrun --sdk macosx --show-sdk-path)"
fi

mkdir -p \
  "$GENERATED_DIR" \
  "$APP_CONTENTS/MacOS" \
  "$APP_CONTENTS/Frameworks" \
  "$SWIFT_MODULE_CACHE"

pushd "$TAURI_DIR" >/dev/null

cargo build --lib --features native-bindgen

cargo run \
  --features native-bindgen \
  --bin uniffi-bindgen \
  -- generate "$RUST_TARGET_DIR/debug/libopenrisk_lib.dylib" \
  --language swift \
  --out-dir "$GENERATED_DIR" \
  --config "$ROOT_DIR/native-macos/uniffi-global.toml"

popd >/dev/null

BINDINGS_FILE="$GENERATED_DIR/OpenRiskCore.swift"
MODULE_MAP="$GENERATED_DIR/OpenRiskCoreFFI.modulemap"
RUST_LIBRARY="$RUST_TARGET_DIR/debug/libopenrisk_lib.dylib"

xcrun swiftc \
  -parse-as-library \
  -sdk "$MACOS_SDK" \
  -target "$(uname -m)-apple-macosx14.0" \
  -module-cache-path "$SWIFT_MODULE_CACHE" \
  -o "$APP_CONTENTS/MacOS/OpenRiskMac" \
  "$BINDINGS_FILE" \
  "$ROOT_DIR"/native-macos/Sources/OpenRiskMac/*.swift \
  -Xcc "-fmodule-map-file=$MODULE_MAP" \
  -L "$RUST_TARGET_DIR/debug" \
  -lopenrisk_lib \
  -framework AppKit \
  -framework SwiftUI \
  -framework UniformTypeIdentifiers \
  -Xlinker -rpath \
  -Xlinker "@executable_path/../Frameworks"

cp "$RUST_LIBRARY" "$APP_CONTENTS/Frameworks/libopenrisk_lib.dylib"

LINKED_RUST_LIBRARY="$(
  otool -L "$APP_CONTENTS/MacOS/OpenRiskMac" |
    awk '/libopenrisk_lib\.dylib/ { print $1; exit }'
)"
install_name_tool \
  -change "$LINKED_RUST_LIBRARY" \
  "@rpath/libopenrisk_lib.dylib" \
  "$APP_CONTENTS/MacOS/OpenRiskMac"
install_name_tool \
  -id "@rpath/libopenrisk_lib.dylib" \
  "$APP_CONTENTS/Frameworks/libopenrisk_lib.dylib"

sed "s/__APP_VERSION__/$APP_VERSION/g" \
  "$ROOT_DIR/native-macos/Info.plist.in" > "$APP_CONTENTS/Info.plist"
codesign --force --deep --sign - "$APP_DIR"

echo "Built $APP_DIR"
