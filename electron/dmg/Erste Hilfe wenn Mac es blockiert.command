#!/usr/bin/env bash
# Removes the Gatekeeper quarantine flag from MacAtlas.app (ad-hoc signed builds).
set -e
APP="/Applications/MacAtlas.app"
if [ ! -d "$APP" ]; then
  echo "MacAtlas.app ist noch nicht in /Applications – zieh die App zuerst aus dem DMG-Fenster in 'Applications'."
  echo "MacAtlas.app is not in /Applications yet – drag it from the DMG window into 'Applications' first."
  read -r -p "Enter …"
  exit 1
fi
echo "Entferne Quarantäne / Removing quarantine: $APP"
xattr -dr com.apple.quarantine "$APP" || true
echo "Fertig – MacAtlas startet jetzt per Doppelklick. / Done – MacAtlas now opens with a double-click."
read -r -p "Enter …"
