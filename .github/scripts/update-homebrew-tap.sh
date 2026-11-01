#!/usr/bin/env bash
# Writes Casks/macatlas.rb for a release into the m4rcelnoel/homebrew-tap repository.
#   update-homebrew-tap.sh <version> <path to MacAtlas.dmg>
# Needs HOMEBREW_TAP_TOKEN (fine-grained token with "Contents: write" on the tap repository).
set -euo pipefail
VERSION="${1:?version}"
DMG="${2:?dmg}"
TAP_REPO="${TAP_REPO:-m4rcelnoel/homebrew-tap}"
SHA=$(shasum -a 256 "$DMG" | cut -d' ' -f1)
WORK=$(mktemp -d)
git clone --depth 1 "https://x-access-token:${HOMEBREW_TAP_TOKEN:?}@github.com/${TAP_REPO}.git" "$WORK/tap"
mkdir -p "$WORK/tap/Casks"
cat > "$WORK/tap/Casks/macatlas.rb" <<CASK
cask "macatlas" do
  version "${VERSION}"
  sha256 "${SHA}"

  url "https://github.com/m4rcelnoel/MacAtlas/releases/download/v#{version}/MacAtlas.dmg"
  name "MacAtlas"
  desc "Inventory of everything installed on your Mac"
  homepage "https://github.com/m4rcelnoel/MacAtlas"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on arch: :arm64

  app "MacAtlas.app"

  zap trash: [
    "~/Library/Application Support/MacAtlas",
    "~/Library/Preferences/de.marcelnoel.macatlas.plist",
    "~/Library/Saved Application State/de.marcelnoel.macatlas.savedState",
  ]
end
CASK
cd "$WORK/tap"
git config user.name "m4rcelnoel"
git config user.email "9214347+m4rcelnoel@users.noreply.github.com"
git add Casks/macatlas.rb
if git diff --cached --quiet; then echo "Cask already up to date"; exit 0; fi
git commit -q -m "macatlas ${VERSION}"
git push -q origin HEAD
echo "Updated ${TAP_REPO}: macatlas ${VERSION}"
