#!/usr/bin/env bash
# Builds MacAtlas.app, signs it, installs it to /Applications and creates the DMG.
#   ./build.sh               → everything
#   ./build.sh --no-install  → app + DMG only (used by CI)
#
# Signing:
#   Default: ad hoc (free; on other Macs: right-click → Open on first launch).
#   With an Apple Developer account (Developer ID + notarization, no warning on other Macs):
#     MACATLAS_SIGN_ID="Developer ID Application: First Last (TEAMID)" \
#     MACATLAS_NOTARY_PROFILE="macatlas-notary" ./build.sh
#   Create the notary profile once with:
#     xcrun notarytool store-credentials macatlas-notary --apple-id <mail> --team-id <TEAMID>
#   Or (CI) with an App Store Connect API key instead of a profile:
#     MACATLAS_NOTARY_KEY=/path/AuthKey_XXXX.p8 MACATLAS_NOTARY_KEY_ID=XXXX MACATLAS_NOTARY_ISSUER=<uuid>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="MacAtlas"
OLD_APP="Mac Inventory"   # previous app name – removed when installing
INSTALL=1
[ "${1:-}" = "--no-install" ] && INSTALL=0
SIGN_ID="${MACATLAS_SIGN_ID:-}"
NOTARY_PROFILE="${MACATLAS_NOTARY_PROFILE:-}"
NOTARY_KEY="${MACATLAS_NOTARY_KEY:-}"
# notarytool authentication: keychain profile (local) or API key (CI)
NOTARY_AUTH=()
if [ -n "$NOTARY_PROFILE" ]; then
  NOTARY_AUTH=(--keychain-profile "$NOTARY_PROFILE")
elif [ -n "$NOTARY_KEY" ]; then
  NOTARY_AUTH=(--key "$NOTARY_KEY" --key-id "${MACATLAS_NOTARY_KEY_ID:?}" --issuer "${MACATLAS_NOTARY_ISSUER:?}")
fi
# Stapling fetches the ticket from Apple's CDN; retry because it occasionally drops the connection
staple() {
  for attempt in 1 2 3 4 5; do
    xcrun stapler staple "$1" && return 0
    echo "Stapling failed (attempt $attempt), retrying in 15 s …"; sleep 15
  done
  return 1
}
notarize() { xcrun notarytool submit "$1" "${NOTARY_AUTH[@]}" --wait && staple "$2"; }

cd "$ROOT/electron"
[ -d node_modules ] || npm install --no-audit --no-fund
[ -f icon.icns ] || { python3 "$ROOT/make_icon.py" && cp "$ROOT/build/icon.icns" icon.icns; }

# Settings → About → "What's new" reads the changelog from inside the app
cp "$ROOT/CHANGELOG.md" "$ROOT/electron/CHANGELOG.md"

echo "→ Packaging"
rm -rf "dist/$APP_NAME-darwin-arm64"
npx electron-packager . "$APP_NAME" --platform=darwin --arch=arm64 --out=dist --overwrite \
  --app-bundle-id=de.marcelnoel.macatlas --icon=icon.icns \
  --protocol=macatlas --protocol-name="MacAtlas" \
  --ignore="^/dist($|/)" --ignore="^/dmg($|/)" --ignore="^/test(-ui)?($|/)" --ignore="^/entitlements\.plist$" >/dev/null
APP="$ROOT/electron/dist/$APP_NAME-darwin-arm64/$APP_NAME.app"

if [ -n "$SIGN_ID" ]; then
  echo "→ Signing (Developer ID, hardened runtime)"
  # Sign inside-out: --deep misses Electron's dylibs in Libraries/ and the crashpad handler,
  # which notarization rejects. Order: loose Mach-O files → frameworks → helper apps → app.
  sign() { codesign --force --timestamp --options runtime --entitlements "$ROOT/electron/entitlements.plist" --sign "$SIGN_ID" "$1"; }
  while IFS= read -r -d '' f; do
    if file -b "$f" | grep -q "Mach-O"; then sign "$f"; fi
  done < <(find "$APP/Contents/Frameworks" -type f ! -path "*/_CodeSignature/*" -print0)
  while IFS= read -r -d '' f; do sign "$f"; done < <(find "$APP/Contents/Frameworks" -maxdepth 1 -name "*.framework" -print0)
  while IFS= read -r -d '' f; do sign "$f"; done < <(find "$APP/Contents/Frameworks" -maxdepth 1 -name "*.app" -print0)
  sign "$APP"
else
  echo "→ Signing (ad hoc)"
  codesign --force --deep --sign - "$APP"
fi
codesign --verify --deep --strict "$APP"

if [ -n "$SIGN_ID" ] && [ ${#NOTARY_AUTH[@]} -gt 0 ]; then
  echo "→ Notarizing (takes a few minutes)"
  ZIP="$(mktemp -d)/$APP_NAME.zip"
  ditto -c -k --keepParent "$APP" "$ZIP"
  notarize "$ZIP" "$APP"
fi

if [ "$INSTALL" = 1 ]; then
  echo "→ Installing to /Applications"
  pkill -f "$APP_NAME.app/Contents/MacOS" 2>/dev/null || true
  pkill -f "$OLD_APP.app/Contents/MacOS" 2>/dev/null || true
  sleep 1
  rm -rf "/Applications/$APP_NAME.app" "/Applications/$OLD_APP.app"
  cp -R "$APP" /Applications/
  xattr -dr com.apple.quarantine "/Applications/$APP_NAME.app" 2>/dev/null || true
fi

echo "→ DMG"
mkdir -p "$ROOT/build"
rm -f "$ROOT/build/$OLD_APP.dmg"
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
cp "$ROOT/electron/dmg/"* "$STAGE/"
chmod +x "$STAGE/"*.command
DMG="$ROOT/build/$APP_NAME.dmg"
rm -f "$DMG"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO -fs HFS+ \
  -imagekey zlib-level=9 "$DMG" >/dev/null 2>&1
rm -rf "$STAGE"
if [ -n "$SIGN_ID" ]; then
  codesign --force --timestamp --sign "$SIGN_ID" "$DMG"
  if [ ${#NOTARY_AUTH[@]} -gt 0 ]; then notarize "$DMG" "$DMG"; fi
else
  codesign --force --sign - "$DMG"
fi

echo "✓ Done: $DMG ($(du -h "$DMG" | cut -f1))"
