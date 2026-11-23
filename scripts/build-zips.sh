#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
rm -rf "$DIST" && mkdir -p "$DIST"

# 1. Chrome / Edge / Brave / Arc MV3 ZIP
cd "$ROOT"
zip -qr "$DIST/save-image-as-png-jpg-chrome-edge.zip"   manifest.json background.js popup.html popup.css popup.js enhancephoto-bridge.js _locales icons

# 2. Firefox MV3 ZIP
TMP="$(mktemp -d)"
cp -r background.js popup.html popup.css popup.js enhancephoto-bridge.js _locales icons "$TMP/"
cp manifest.firefox.json "$TMP/manifest.json"
(cd "$TMP" && zip -qr "$DIST/save-image-as-png-jpg-firefox.zip" .)
rm -rf "$TMP"

ls -lh "$DIST"
