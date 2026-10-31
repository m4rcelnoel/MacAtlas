MacAtlas — Installation
=======================

1. Drag "MacAtlas.app" into the "Applications" folder.

2. FIRST LAUNCH: right-click the app → "Open" (not a double-click),
   then confirm "Open" in the dialog. After that it starts normally.

   If macOS says the app "is damaged": double-click the included file
   "Erste Hilfe wenn Mac es blockiert.command" (removes the quarantine flag).

3. The app starts empty. Click "Scan Mac". The scan takes 30–60 s and
   collects hardware, all apps and packages, updates, storage, security
   and background services. No administrator rights are needed.

4. Moving to a new Mac:
   - Old Mac: Export (⌘E) and save a settings package under
     "Take Settings Along".
   - New Mac: import the file (⌘I) → the "Migration" page walks you through
     Homebrew, apps, App Store, developer packages and VS Code. Unzip the
     settings package and double-click "Wiederherstellen.command".
   Or with iCloud Drive: turn on "Share scans with other Macs" in Settings –
   all your Macs show up under "My Macs".

5. Settings (⌘,): language German/English, light/dark, open at login,
   menu bar, automatic scans, notifications.

Optional on the target Mac:
   - Homebrew       https://brew.sh
   - mas            brew install mas
   - docker         Docker Desktop
   - code           VS Code CLI in PATH
   - python3        comes with the Xcode Command Line Tools (required)

Questions, bugs, ideas: https://github.com/m4rcelnoel/MacAtlas/issues
