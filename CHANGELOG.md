# Changelog

## 1.2.0

- Renamed from *Mac Inventory* to **MacAtlas**; existing data is migrated on first launch.
- New pages: Storage, Versions & Duplicates, Subscriptions & Licenses, Take Settings Along, My Macs, Migration assistant.
- Security page now lists open network ports, system extensions and browser extensions.
- History charts (storage, items, updates, reclaimable space).
- CSV export, URL scheme (`macatlas://scan`, `report`, `csv`, `export`, `open/<page>`), change warnings, renewal reminders.
- Optional notarization in `build.sh`.
- Hardening: sandboxed renderer, strict CSP, blocked navigation, IPC callbacks no longer receive the event object.
- Fixes: major-version updates with a different number of version parts were not detected; migration page jumped back to Compare after a rescan; background scans switched away from an open snapshot; unhandled error when exporting a broken snapshot.
- Unit tests, static checks and CI with DMG builds and GitHub Releases.

## 1.1.0

- Settings page: language (German/English), appearance, open at login, menu bar, scheduled scans, notifications, data.
- Full English translation; scan can be cancelled; window size and position are remembered; single instance.

## 1.0.0

- Inventory of apps, Homebrew, App Store, npm, pip, gems, VS Code, Docker, fonts and Claude Code.
- Export/import and comparison of two Macs with install script and Brewfile.
- Updates, Clean Up, Security, Startup Items, History, Notes & tags, PDF report, menu bar icon.
