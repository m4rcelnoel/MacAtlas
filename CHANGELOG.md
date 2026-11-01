# Changelog

German version: [CHANGELOG.de.md](CHANGELOG.de.md) – shown in MacAtlas under Settings → *What's New*.

## 1.3.1

- First published release of the 1.3 changes below (the 1.3.0 build was stopped by a failing UI test and never released).

## 1.3.0

- Checkbox selection on Compare, Migration, Updates and Storage: the install, update and cleanup scripts only contain ticked entries. Each group has *All*/*None*, and the selection is remembered.
- Detail panel: click any entry to see its update, install/update/uninstall commands with copy buttons, note and all known facts.
- Lists can be filtered (with update, Homebrew, App Store, no package source, with note, Intel only, unused), sorted by name, size, last use or source, and searched within the list.
- Updates, cleanups and migration steps run inside MacAtlas instead of a Terminal window: live output, progress, cancel, an error summary and an automatic rescan. sudo uses the macOS password dialog. *In Terminal* remains as an option.
- Quick Open (⌘K): jump to any page, entry or action.
- Sidebar sections can be collapsed; ↑/↓ moves through lists (the detail panel follows) and the sidebar; better VoiceOver labels and visible focus.
- First launch shows a short three-step introduction and warns when the Command Line Tools are missing.
- The scan progress counts what it finds as it goes.
- Drop an exported scan onto the window to open it.
- New package sources: Rust (`cargo install`), Go tools, pipx, uv tools, Composer, mise, asdf and MacPorts – including the install script for a new Mac.
- MacAtlas updates itself: a daily check of GitHub Releases, then download, signature check, replace and restart from Settings.
- Test button for notifications in Settings.
- Packages that ship with the system – gems of macOS' Ruby, Ruby's own default gems, the Python packages of the Command Line Tools – are tagged *System*: still listed, but never offered as updates, put into install scripts or counted as missing in Compare. Permission errors get an explanation.
- MacAtlas now scans the Ruby you actually use (Homebrew, rbenv, asdf, mise …) instead of only the first `gem` in PATH, and runs its updates with that Ruby.
- Settings → *What's New* shows this changelog in English or German; it also opens once after an update.
- Fix: pip packages whose name is as long as the column were read with their version in the name.
- New app and menu bar icon.
- UI tests with Playwright in CI; releases can update a Homebrew tap automatically.

## 1.2.1

- Settings → About shows the app icon, version and "Made by buddster" with links to buddster.de, the source code and GitHub issues; the macOS About panel credits buddster too.
- Release builds retry stapling and ticket validation when Apple's ticket service drops the connection.
- README: rewritten install section with a direct download link, requirements, updating and uninstalling.

## 1.2.0

- Renamed from *Mac Inventory* to **MacAtlas**; existing data is migrated on first launch.
- New pages: Storage, Versions & Duplicates, Subscriptions & Licenses, Take Settings Along, My Macs, Migration assistant.
- Security page now lists open network ports, system extensions and browser extensions.
- History charts (storage, items, updates, reclaimable space).
- CSV export, URL scheme (`macatlas://scan`, `report`, `csv`, `export`, `open/<page>`), change warnings, renewal reminders.
- Releases are signed with Developer ID and notarized (locally via `build.sh`, in CI via repository secrets).
- Hardening: sandboxed renderer, strict CSP, blocked navigation, IPC callbacks no longer receive the event object.
- Fixes: major-version updates with a different number of version parts were not detected; migration page jumped back to Compare after a rescan; background scans switched away from an open snapshot; unhandled error when exporting a broken snapshot; quoting bug in the first-aid script of the DMG.
- Unit tests, static checks and CI with DMG builds and GitHub Releases.

## 1.1.0

- Settings page: language (German/English), appearance, open at login, menu bar, scheduled scans, notifications, data.
- Full English translation; scan can be cancelled; window size and position are remembered; single instance.

## 1.0.0

- Inventory of apps, Homebrew, App Store, npm, pip, gems, VS Code, Docker, fonts and Claude Code.
- Export/import and comparison of two Macs with install script and Brewfile.
- Updates, Clean Up, Security, Startup Items, History, Notes & tags, PDF report, menu bar icon.
