#!/usr/bin/env bash
set -e
APP="/Applications/MacAtlas.app"
if [ ! -d "$APP" ]; then
  echo "MacAtlas.app wurde noch nicht nach /Applications kopiert."
  echo "Zieh die App aus dem DMG-Fenster erst in „Applications"."
  read -p "Drücke Enter zum Schließen …"
  exit 1
fi
echo "Entferne Gatekeeper-Quarantäne für $APP …"
xattr -dr com.apple.quarantine "$APP" || true
echo "Fertig. Du kannst MacAtlas jetzt per Doppelklick starten."
read -p "Drücke Enter zum Schließen …"
