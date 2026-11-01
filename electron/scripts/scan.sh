#!/usr/bin/env bash
# MacAtlas Scanner — regenerates data/ files and inventory.json
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Work directory: writable location where data/ and inventory.json land.
# Defaults to the script directory (dev); the Electron app sets it to a
# user-data folder so the read-only bundle isn't touched.
WORKDIR="${MI_WORKDIR:-$SCRIPT_DIR}"
mkdir -p "$WORKDIR/data" "$WORKDIR/data/icons"
cd "$WORKDIR"

# Run a command, killing it after N seconds (network lookups must not hang the scan)
with_timeout() {
  local secs=$1; shift
  "$@" & local pid=$!
  ( sleep "$secs"; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 & local watcher=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill "$watcher" 2>/dev/null || true
  return $rc
}

# Report a running count to the app ("+ key|n"); the progress page shows them live
found() {  # key file [line pattern] [header lines to skip]
  local n; n=$(grep -c "${3:-.}" "$2" 2>/dev/null) || true
  n=$(( ${n:-0} - ${4:-0} )); echo "+ $1|$(( n < 0 ? 0 : n ))"
}

echo "→ System info"
: > data/system.txt
echo "hostname|$(scutil --get ComputerName 2>/dev/null || hostname -s)" >> data/system.txt
echo "local_hostname|$(scutil --get LocalHostName 2>/dev/null || hostname -s)" >> data/system.txt
echo "user|$(whoami)" >> data/system.txt
echo "os_name|$(sw_vers -productName 2>/dev/null || echo macOS)" >> data/system.txt
echo "os_version|$(sw_vers -productVersion 2>/dev/null || echo '')" >> data/system.txt
echo "os_build|$(sw_vers -buildVersion 2>/dev/null || echo '')" >> data/system.txt
echo "arch|$(uname -m)" >> data/system.txt
echo "model_id|$(sysctl -n hw.model 2>/dev/null || echo '')" >> data/system.txt
echo "cpu|$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo '')" >> data/system.txt
echo "cores|$(sysctl -n hw.ncpu 2>/dev/null || echo '')" >> data/system.txt
echo "physical_cores|$(sysctl -n hw.physicalcpu 2>/dev/null || echo '')" >> data/system.txt
echo "ram_bytes|$(sysctl -n hw.memsize 2>/dev/null || echo 0)" >> data/system.txt
echo "perf_cores|$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || echo '')" >> data/system.txt
echo "eff_cores|$(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null || echo '')" >> data/system.txt
echo "boot_time|$(sysctl -n kern.boottime 2>/dev/null | awk '{print $4}' | tr -d ',' || echo '')" >> data/system.txt
echo "timezone|$(date +%Z)" >> data/system.txt
echo "shell|${SHELL:-}" >> data/system.txt
# Marketing name, e.g. "MacBook Pro (14-inch, 2021)" (Apple Silicon device tree)
echo "marketing_name|$(ioreg -l 2>/dev/null | awk -F'"' '/"product-name" = </ {print $4; exit}' | tr -d '\000<>')" >> data/system.txt
# Full hardware details (model, GPU, displays, battery, storage, memory)
system_profiler SPHardwareDataType SPDisplaysDataType SPPowerDataType SPStorageDataType SPMemoryDataType -json \
  > data/hardware.json 2>/dev/null || true
# Device image as shown in "About This Mac"
osascript -l JavaScript -e '
ObjC.import("AppKit");
var img = $.NSImage.imageNamed($.NSImageNameComputer);
img.setSize($.NSMakeSize(256,256));
var rep = $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation);
var png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
png.writeToFileAtomically("'"$WORKDIR"'/data/device.png", true);' >/dev/null 2>&1 || true
[ -f data/device.png ] && sips -z 384 384 data/device.png >/dev/null 2>&1 || true

echo "→ Applications"
ls -1 /Applications/ 2>/dev/null | grep -i '\.app$' | sed 's/\.app$//' > data/applications.txt
ls -1 ~/Applications/ 2>/dev/null | grep -i '\.app$' | sed 's/\.app$//' > data/user_applications.txt
ls -1 /System/Applications/ 2>/dev/null | grep -i '\.app$' | sed 's/\.app$//' > data/system_applications.txt
found apps data/applications.txt

echo "→ Homebrew"
if command -v brew >/dev/null 2>&1; then
  brew list --versions --formula > data/brew_formulae_versions.txt 2>/dev/null || true
  brew list --versions --cask > data/brew_casks_versions.txt 2>/dev/null || true
  brew info --json=v2 --installed > data/brew_info.json 2>/dev/null || true
  brew leaves --installed-on-request > data/brew_leaves.txt 2>/dev/null || true
  found brew_formulae data/brew_formulae_versions.txt
  found brew_casks data/brew_casks_versions.txt
  # Refresh full cask catalog weekly (18 MB) so apps installed outside brew can still be matched
  if [ ! -f data/all_casks.json ] || [ $(find data/all_casks.json -mtime +7 | wc -l) -gt 0 ]; then
    curl -sL -o data/all_casks.json https://formulae.brew.sh/api/cask.json || true
  fi
fi

echo "→ Binaries (brew bin / usr local)"
ls -1 /opt/homebrew/bin/ 2>/dev/null > data/brew_binaries.txt || true
ls -1 /usr/local/bin/ 2>/dev/null > data/usr_local_binaries.txt || true
found brew_bin data/brew_binaries.txt

echo "→ npm / pip / gem"
npm list -g --depth=0 2>/dev/null | tail -n +2 | grep -v '^$' > data/npm_global.txt || true
pip3 list 2>/dev/null > data/pip_packages.txt || true
found pip data/pip_packages.txt . 2
gem list --local 2>/dev/null > data/ruby_gems.txt || true
# Where gems go: /Library/Ruby/… = the Ruby that ships with macOS (read-only without sudo)
gem env gemdir 2>/dev/null > data/gem_dir.txt || : > data/gem_dir.txt
found npm data/npm_global.txt
found gem data/ruby_gems.txt

echo "→ More package managers"
# Each tool is optional; missing ones leave an empty file
cargo install --list 2>/dev/null > data/cargo_install.txt || : > data/cargo_install.txt
: > data/go_bins.txt
if command -v go >/dev/null 2>&1; then
  gobin="$(go env GOBIN 2>/dev/null)"; [ -n "$gobin" ] || gobin="$(go env GOPATH 2>/dev/null)/bin"
  for f in "$gobin"/*; do
    [ -f "$f" ] || continue
    # "name|package path|module version" from the build info embedded in the binary
    go version -m "$f" 2>/dev/null | awk -v n="$(basename "$f")" -F'\t' '$2=="path"{p=$3} $2=="mod"{v=$4} END{if(p!="") print n"|"p"|"v}' >> data/go_bins.txt || true
  done
fi
pipx list --short 2>/dev/null > data/pipx.txt || : > data/pipx.txt
uv tool list 2>/dev/null | grep -v '^-' > data/uv_tools.txt || : > data/uv_tools.txt
with_timeout 30 composer global show --format=json 2>/dev/null > data/composer.json || : > data/composer.json
mise ls --json 2>/dev/null > data/mise.json || : > data/mise.json
: > data/asdf.txt
for d in "${ASDF_DATA_DIR:-$HOME/.asdf}/installs/"*/*; do
  [ -d "$d" ] && echo "$(basename "$(dirname "$d")")|$(basename "$d")" >> data/asdf.txt
done
port -q installed requested 2>/dev/null > data/macports.txt || : > data/macports.txt
found cargo data/cargo_install.txt '^[^ ]'
found go data/go_bins.txt
found pipx data/pipx.txt

echo "→ Editors"
code --list-extensions 2>/dev/null > data/vscode_extensions.txt || true
cursor --list-extensions 2>/dev/null > data/cursor_extensions.txt || true
found vscode data/vscode_extensions.txt

echo "→ Mac App Store"
mas list 2>/dev/null > data/mas_apps.txt || true
found mas data/mas_apps.txt

echo "→ Docker"
docker images --format "{{.Repository}}:{{.Tag}}|{{.Size}}" 2>/dev/null > data/docker_images.txt || true
docker ps -a --format "{{.Names}}|{{.Image}}|{{.Status}}" 2>/dev/null > data/docker_containers.txt || true
found docker_images data/docker_images.txt

echo "→ Fonts"
find ~/Library/Fonts /Library/Fonts /System/Library/Fonts -maxdepth 3 \( -name "*.ttf" -o -name "*.otf" -o -name "*.ttc" \) 2>/dev/null | while read f; do basename "$f"; done | sort -u > data/fonts.txt || true
found fonts data/fonts.txt

echo "→ Claude Code"
ls -1 ~/.claude/skills/ 2>/dev/null > data/claude_skills.txt || true
cat ~/.claude/plugins/installed_plugins.json 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [print(k) for k in d.get('plugins',{}).keys()]" \
  > data/claude_plugins.txt 2>/dev/null || true
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [print(k) for k in d.get('mcpServers',{}).keys()]" \
  > data/mcp_servers.txt 2>/dev/null || true

echo "→ Updates"
: > data/updates_checked.txt
if command -v brew >/dev/null 2>&1; then
  # Refresh Homebrew's package index so "outdated" compares against current releases
  if [ "${MI_BREW_UPDATE:-1}" = "1" ]; then
    with_timeout 90 brew update --quiet >/dev/null 2>&1 || true
  fi
  brew outdated --json=v2 > data/brew_outdated.json 2>/dev/null || true
fi
mas outdated > data/mas_outdated.txt 2>/dev/null || true
npm outdated -g --json > data/npm_outdated.json 2>/dev/null || true
with_timeout 60 pip3 list --outdated --format=json > data/pip_outdated.json 2>/dev/null || true
with_timeout 60 gem outdated > data/gem_outdated.txt 2>/dev/null || true
date +%Y-%m-%dT%H:%M:%S > data/updates_checked.txt

echo "→ Security + autostart"
{
  echo "filevault|$(fdesetup status 2>/dev/null | head -1)"
  echo "firewall|$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)"
  echo "stealth|$(/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null)"
  echo "sip|$(csrutil status 2>/dev/null)"
  echo "gatekeeper|$(spctl --status 2>/dev/null)"
  echo "screenlock|$(sysadminctl -screenLock status 2>&1 | grep -o 'screenLock.*' | tail -1)"
} > data/security.txt
# Software update settings + pending macOS updates (readable without admin rights)
cp /Library/Preferences/com.apple.SoftwareUpdate.plist data/softwareupdate.plist 2>/dev/null || true
# Launch agents/daemons = background services that start automatically
: > data/launchd.txt
for dir in "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons; do
  for f in "$dir"/*.plist; do [ -f "$f" ] && echo "$f" >> data/launchd.txt; done
done
launchctl list 2>/dev/null | awk 'NR>1 {print $1"|"$2"|"$3}' > data/launchctl_list.txt || true

echo "→ Storage"
# Sizes of regenerable caches and developer leftovers ("key|kilobytes")
: > data/storage.txt
measure() {  # key path…  (runs du in the background, max 60 s)
  local key=$1; shift
  ( kb=$(with_timeout 60 du -skc "$@" 2>/dev/null | tail -1 | cut -f1) || true; echo "$key|${kb:-}" >> data/storage.txt ) &
}
measure xcode_derived "$HOME/Library/Developer/Xcode/DerivedData"
measure xcode_archives "$HOME/Library/Developer/Xcode/Archives"
measure xcode_devicesupport "$HOME/Library/Developer/Xcode/"*DeviceSupport
measure simulators "$HOME/Library/Developer/CoreSimulator/Devices"
measure sim_caches "$HOME/Library/Developer/CoreSimulator/Caches"
measure user_caches "$HOME/Library/Caches"
measure npm_cache "$HOME/.npm"
measure pip_cache "$HOME/Library/Caches/pip"
measure yarn_cache "$HOME/Library/Caches/Yarn"
measure pnpm_store "$HOME/Library/pnpm/store"
measure gradle_cache "$HOME/.gradle/caches"
measure cocoapods_cache "$HOME/Library/Caches/CocoaPods"
measure logs "$HOME/Library/Logs"
measure trash "$HOME/.Trash"
measure downloads "$HOME/Downloads"
wait
# Largest folders inside ~/Library/Caches
du -sk "$HOME/Library/Caches/"* 2>/dev/null | sort -rn | head -12 > data/caches_top.txt || true
if command -v brew >/dev/null 2>&1; then
  brew cleanup -n 2>/dev/null | grep -o 'free approximately [0-9.,]*[KMGT]*B' | tail -1 > data/brew_cleanup.txt || true
fi
docker system df --format '{{json .}}' > data/docker_df.txt 2>/dev/null || true
xcrun simctl list devices unavailable 2>/dev/null | grep -c "(unavailable" > data/sim_unavailable.txt || true

echo "→ Versions"
# Several installs of the same runtime (PATH order, version managers, Homebrew)
: > data/versions.txt
for tool in python3 node ruby java go php git pip3; do
  for p in $(which -a "$tool" 2>/dev/null | awk '!seen[$0]++'); do
    # Stubs like /usr/bin/java fail when nothing is installed – that must not stop the scan
    case "$tool" in
      java) v=$("$p" -version 2>&1 | head -1) || v="" ;;
      go) v=$("$p" version 2>/dev/null) || v="" ;;
      *) v=$("$p" --version 2>&1 | head -1) || v="" ;;
    esac
    case "$v" in *"Unable to locate"*|*"No Java runtime"*|"") continue ;; esac
    echo "path|$tool|$p|$v" >> data/versions.txt
  done
done
for d in "$HOME/.nvm/versions/node/"* "$HOME/.pyenv/versions/"* "$HOME/.rbenv/versions/"* "$HOME/.volta/tools/image/node/"* \
         /Library/Frameworks/Python.framework/Versions/* "$HOME/miniconda3" "$HOME/anaconda3" "$HOME/miniforge3"; do
  if [ -d "$d" ]; then echo "dir||$d|" >> data/versions.txt; fi
done
/usr/libexec/java_home -V 2>&1 | grep -E '^\s+[0-9]' | sed 's/^/jdk||/' >> data/versions.txt || true
ls -d /Applications/Xcode*.app 2>/dev/null | sed 's/^/xcode||/' >> data/versions.txt || true
if command -v brew >/dev/null 2>&1; then
  brew autoremove --dry-run 2>/dev/null | grep -v '^==>' > data/brew_orphans.txt || true
fi

echo "→ Network + extensions"
lsof +c 0 -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1"|"$2"|"$9}' | sort -u > data/ports.txt || true
systemextensionsctl list 2>/dev/null > data/sysext.txt || true
kmutil showloaded --list-only 2>/dev/null | grep -v com.apple > data/kexts.txt || true
pluginkit -mAvvv -p com.apple.Safari.web-extension 2>/dev/null > data/safari_ext.txt || true
pluginkit -mAvvv -p com.apple.Safari.extension 2>/dev/null >> data/safari_ext.txt || true

echo "→ Dotfiles"
# Which settings files exist (contents are only read when exporting the settings package)
: > data/dotfiles.txt
for f in .zshrc .zprofile .zshenv .bashrc .bash_profile .profile .gitconfig .gitignore_global .ssh/config .vimrc .tmux.conf \
         .config/starship.toml .config/git/config .npmrc .editorconfig \
         "Library/Application Support/Code/User/settings.json" "Library/Application Support/Code/User/keybindings.json" \
         "Library/Application Support/Cursor/User/settings.json" "Library/Application Support/Cursor/User/keybindings.json"; do
  if [ -f "$HOME/$f" ]; then echo "$f|$(stat -f %z "$HOME/$f")" >> data/dotfiles.txt; fi
done

echo "→ App details + icons"
: > data/apps_detailed.txt
: > data/apps_meta.txt
for app in /Applications/*.app; do
  [ -d "$app" ] || continue
  name=$(basename "$app" .app)
  info="$app/Contents/Info.plist"
  [ -f "$info" ] || continue
  version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$info" 2>/dev/null || echo "")
  bundle_id=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$info" 2>/dev/null || echo "")
  icon_name=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "$info" 2>/dev/null || echo "AppIcon")
  icon_name=${icon_name%.icns}
  # Architecture of the main executable: arm64 / universal / intel
  exe=$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "$info" 2>/dev/null || echo "")
  archs=$(lipo -archs "$app/Contents/MacOS/$exe" 2>/dev/null || echo "")
  case "$archs" in
    *arm64*x86_64*|*x86_64*arm64*) arch=universal ;;
    *arm64*) arch=arm64 ;;
    *x86_64*) arch=intel ;;
    *) arch="" ;;
  esac
  # Signature: first authority (Developer ID / App Store / Apple), "adhoc" or empty
  sig=$(codesign -dvv "$app" 2>&1 || true)
  signer=$(printf '%s\n' "$sig" | awk -F= '/^Authority=/{print $2; exit}')
  [ -z "$signer" ] && printf '%s\n' "$sig" | grep -q '^Signature=adhoc' && signer=adhoc
  echo "${name}|${version}|${bundle_id}|${icon_name}|${arch}|${signer}" >> data/apps_detailed.txt
  # Size + last use from Spotlight (du as fallback when Spotlight has no size)
  md=$(mdls -name kMDItemPhysicalSize -name kMDItemLastUsedDate -name kMDItemUseCount "$app" 2>/dev/null || true)
  size=$(printf '%s\n' "$md" | awk -F' = ' '/^kMDItemPhysicalSize/{print $2}')
  case "$size" in ''|*null*) size=$(( $(du -sk "$app" 2>/dev/null | cut -f1) * 1024 )) ;; esac
  used=$(printf '%s\n' "$md" | awk -F' = ' '/^kMDItemLastUsedDate/{print $2}')
  case "$used" in *null*) used="" ;; esac
  count=$(printf '%s\n' "$md" | awk -F' = ' '/^kMDItemUseCount/{print $2}')
  case "$count" in *null*) count="" ;; esac
  echo "${name}|${size}|${used}|${count}" >> data/apps_meta.txt
  icon_file="$app/Contents/Resources/${icon_name}.icns"
  if [ -f "$icon_file" ]; then
    safe_name=$(echo "$name" | tr '/' '_' | tr ' ' '_')
    out="data/icons/${safe_name}.png"
    if [ ! -f "$out" ]; then
      sips -s format png "$icon_file" --out "$out" -z 128 128 >/dev/null 2>&1 || true
    fi
  fi
done

echo "→ Building inventory.json"
MI_WORKDIR="$WORKDIR" python3 "$SCRIPT_DIR/build_inventory.py"

echo "Done. Wrote $WORKDIR/inventory.json"
