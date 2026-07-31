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
PROFILE="debug"
CARGO_PROFILE_ARGS=()

case "${1:-}" in
  "") ;;
  --release)
    PROFILE="release"
    CARGO_PROFILE_ARGS=(--release)
    ;;
  *)
    echo "Usage: $0 [--release]" >&2
    exit 2
    ;;
esac

RUST_PROFILE_DIR="$RUST_TARGET_DIR/$PROFILE"
RUST_LIBRARY="$RUST_PROFILE_DIR/libopenrisk_uniffi.dylib"
USER_HOME_DIR="${HOME:?HOME must be set}"

if [[ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk" ]]; then
  MACOS_SDK="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"
else
  MACOS_SDK="$(xcrun --sdk macosx --show-sdk-path)"
fi

if [[ "$APP_DIR" != "$TAURI_DIR/target/native-macos/OpenRisk.app" ]]; then
  echo "Refusing to clean unexpected app path: $APP_DIR" >&2
  exit 1
fi

rm -rf "$APP_DIR"

mkdir -p \
  "$GENERATED_DIR" \
  "$APP_CONTENTS/MacOS" \
  "$APP_CONTENTS/Frameworks" \
  "$SWIFT_MODULE_CACHE"

pushd "$TAURI_DIR" >/dev/null

if [[ "$PROFILE" == "release" ]]; then
  RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }--remap-path-prefix=$ROOT_DIR=/openrisk --remap-path-prefix=$USER_HOME_DIR=/build" \
    cargo build -p openrisk-uniffi "${CARGO_PROFILE_ARGS[@]}"
else
  cargo build -p openrisk-uniffi
fi

cargo run \
  -p openrisk-uniffi-bindgen \
  -- generate "$RUST_LIBRARY" \
  --language swift \
  --out-dir "$GENERATED_DIR" \
  --config "$ROOT_DIR/native-macos/uniffi-global.toml"

popd >/dev/null

BINDINGS_FILE="$GENERATED_DIR/OpenRiskCore.swift"
MODULE_MAP="$GENERATED_DIR/OpenRiskCoreFFI.modulemap"

SWIFT_COMPILER_ARGS=(-parse-as-library)
if [[ "$PROFILE" == "release" ]]; then
  SWIFT_COMPILER_ARGS+=(-O -whole-module-optimization)
fi
SWIFT_COMPILER_ARGS+=(
  -sdk "$MACOS_SDK"
  -target "$(uname -m)-apple-macosx14.0"
  -module-cache-path "$SWIFT_MODULE_CACHE"
  -o "$APP_CONTENTS/MacOS/OpenRiskMac"
  "$BINDINGS_FILE"
  "$ROOT_DIR"/native-macos/Sources/OpenRiskMac/*.swift
  -Xcc "-fmodule-map-file=$MODULE_MAP"
  -L "$RUST_PROFILE_DIR"
  -lopenrisk_uniffi
  -framework AppKit
  -framework SwiftUI
  -framework UniformTypeIdentifiers
  -Xlinker -rpath
  -Xlinker "@executable_path/../Frameworks"
)

xcrun swiftc "${SWIFT_COMPILER_ARGS[@]}"

cp "$RUST_LIBRARY" "$APP_CONTENTS/Frameworks/libopenrisk_uniffi.dylib"

LINKED_RUST_LIBRARY="$(
  otool -L "$APP_CONTENTS/MacOS/OpenRiskMac" |
    awk '/libopenrisk_uniffi\.dylib/ { print $1; exit }'
)"
install_name_tool \
  -change "$LINKED_RUST_LIBRARY" \
  "@rpath/libopenrisk_uniffi.dylib" \
  "$APP_CONTENTS/MacOS/OpenRiskMac"
install_name_tool \
  -id "@rpath/libopenrisk_uniffi.dylib" \
  "$APP_CONTENTS/Frameworks/libopenrisk_uniffi.dylib"

if [[ "$PROFILE" == "release" ]]; then
  strip -x "$APP_CONTENTS/MacOS/OpenRiskMac"
  strip -x "$APP_CONTENTS/Frameworks/libopenrisk_uniffi.dylib"
fi

sed "s/__APP_VERSION__/$APP_VERSION/g" \
  "$ROOT_DIR/native-macos/Info.plist.in" > "$APP_CONTENTS/Info.plist"
codesign --force --deep --sign - "$APP_DIR"

echo "Built $APP_DIR ($PROFILE, $(uname -m))"
