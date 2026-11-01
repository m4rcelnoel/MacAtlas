MacAtlas — Installation
=======================

1. Drag "MacAtlas.app" into the "Applications" folder.

2. Double-click MacAtlas. The app is notarized by Apple and opens without
   a warning. Only for self-built versions without a Developer ID:
   right-click → "Open", or run "Erste Hilfe wenn Mac es blockiert.command".

3. The first launch shows a short introduction. Click "Scan Mac". The scan
   takes 30–60 s and collects hardware, all apps and packages, updates,
   storage, security and background services. No administrator rights
   are needed.

4. Keeping things up to date: on "Updates" tick what you want and click
   "Run …" – the updates run inside MacAtlas with live output. If a package
   needs your administrator password, macOS asks with its own dialog.

5. Moving to a new Mac:
   - Old Mac: Export (⌘E) and save a settings package under
     "Take Settings Along".
   - New Mac: import the file (⌘I, or drop it onto the window) → the
     "Migration" page walks you through Homebrew, apps, App Store,
     developer packages and VS Code. Unzip the settings package and
     double-click "Wiederherstellen.command".
   Or with iCloud Drive: turn on "Share scans with other Macs" in Settings –
   all your Macs show up under "My Macs".

6. Settings (⌘,): language German/English, light/dark, open at login,
   menu bar, automatic scans, notifications, MacAtlas updates and
   "What's New".

MacAtlas checks for new versions once a day and updates itself from
Settings → "MacAtlas Updates" (can be turned off).

Shortcuts: ⌘K Quick Open · ⌘F Search · ↑/↓ move through lists · ⌘R Scan

Optional on the target Mac:
   - Homebrew       https://brew.sh
   - mas            brew install mas
   - docker         Docker Desktop
   - code           VS Code CLI in PATH
   - python3        comes with the Xcode Command Line Tools (required)

Questions, bugs, ideas: https://github.com/m4rcelnoel/MacAtlas/issues
