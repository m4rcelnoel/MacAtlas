const { app, BrowserWindow, Menu, Tray, Notification, nativeImage, nativeTheme, screen, ipcMain, shell, dialog, systemPreferences } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const core = require("./lib/core");
const { safeHost, buildBrewfile, buildCsv, redact, compactInventory, nextRenewal, isoDate } = core;

// Formerly "Mac Inventory": move the old data folder so history, notes and
// settings survive the rename. Must run before anything touches userData.
app.setName("MacAtlas");
{
  const appData = app.getPath("appData");
  const newDir = path.join(appData, "MacAtlas"), oldDir = path.join(appData, "mac-inventory");
  try { if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir); } catch {}
  app.setPath("userData", newDir);
}

// Only one instance (login item + menu bar icon would otherwise start a second)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let win, tray;
// The window may be closed while the app keeps running in the menu bar
const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };
let pendingNav = null;  // page to open once the renderer has loaded

// ── Settings ──────────────────────────────────────────────────────────
const settingsFile = path.join(app.getPath("userData"), "settings.json");
const DEFAULTS = {
  language: "system",   // system | de | en
  theme: "system",      // system | light | dark
  autoScan: "off",      // off | daily | weekly
  showTray: true,
  trayCount: true,
  notify: true,
  brewUpdate: true,     // run `brew update` before checking for updates
  embedIcons: true,     // app icons inside inventory.json / exports
  historyMax: 100,
  warnChanges: true,    // notify when a background scan finds new apps/services or weaker security
  remindRenewals: true, // notify 7 days before a subscription renews (from notes)
  syncEnabled: false,   // share each scan with other Macs via a (iCloud) folder
  syncDir: null,
  reminded: {},
  lastUpdateCount: null,
  bounds: null,
};
let settings = { ...DEFAULTS };
try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, "utf8")) }; } catch {}
const saveSettings = () => fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

const lang = () => settings.language === "system"
  ? (app.getPreferredSystemLanguages?.()[0] || app.getLocale() || "en").toLowerCase().startsWith("de") ? "de" : "en"
  : settings.language;
const locale = () => (lang() === "de" ? "de-DE" : "en-US");

const STRINGS = {
  de: {
    inventory: "Inventar", rescan: "Neu scannen", exportFile: "Als Datei exportieren …", exportBrewfile: "Als Brewfile exportieren …",
    report: "Bericht als PDF sichern …", import: "Snapshot von anderem Mac importieren …", backToOwn: "Zu eigenem Scan zurück",
    autoScan: "Automatisch scannen", off: "Aus", daily: "Täglich", weekly: "Wöchentlich", openAtLogin: "Bei Anmeldung starten",
    showScanFolder: "Scan-Ordner im Finder zeigen", showSnapFolder: "Snapshot-Ordner im Finder zeigen", settings: "Einstellungen …",
    updatesAvail: "{n} Updates verfügbar …", allCurrent: "Alles aktuell", notScanned: "Noch nicht gescannt",
    lastScan: "Letzter Scan: {d}", noScan: "Kein Scan vorhanden", scanning: "Scan läuft …", scanNow: "Jetzt scannen",
    open: "MacAtlas öffnen", quit: "Beenden", tipScanning: "MacAtlas – scannt …", tipUpdates: "MacAtlas – {n} Updates verfügbar",
    notifyOne: "1 neues Update gefunden – insgesamt {n}.", notifyMany: "{m} neue Updates gefunden – insgesamt {n}.",
    nothingToExport: "Noch nichts zu exportieren. Scanne zuerst deinen Mac.", exportTitle: "MacAtlas-Daten exportieren",
    exported: "Exportiert nach {p}", importTitle: "MacAtlas-Daten importieren", snapLoaded: "Snapshot von {h} geladen",
    unknown: "unbekannt", importFailed: "Import fehlgeschlagen", invalidFile: "Datei ist kein gültiges MacAtlas-JSON.",
    brewfileTitle: "Brewfile exportieren", brewfileSaved: "Brewfile mit {n} Einträgen gesichert",
    scriptTitle: "Installationsskript sichern", shellScript: "Shell-Skript", pdfTitle: "Bericht als PDF sichern",
    scanCancelled: "Scan abgebrochen", exitCode: "Exit-Code {c}",
    clearHistory: "Verlauf löschen?", clearHistoryDetail: "Alle {n} gespeicherten Scans werden entfernt. Der aktuelle Scan bleibt erhalten.",
    clearNotes: "Alle Notizen löschen?", clearNotesDetail: "{n} Notizen und Tags werden entfernt. Das lässt sich nicht rückgängig machen.",
    delete: "Löschen", cancel: "Abbrechen",
    about: "Über MacAtlas", services: "Dienste", hide: "MacAtlas ausblenden", hideOthers: "Andere ausblenden",
    showAll: "Alle einblenden", quitApp: "MacAtlas beenden", edit: "Bearbeiten", undo: "Widerrufen", redo: "Wiederholen",
    cut: "Ausschneiden", copy: "Kopieren", paste: "Einsetzen", selectAll: "Alles auswählen", view: "Darstellung",
    reload: "Neu laden", zoomIn: "Vergrößern", zoomOut: "Verkleinern", zoomReset: "Originalgröße", fullscreen: "Vollbildmodus",
    window: "Fenster", minimize: "Im Dock ablegen", zoom: "Zoomen", close: "Fenster schließen", front: "Alle nach vorne bringen",
    exportCsv: "Als CSV exportieren (Excel/Numbers) …", csvTitle: "Als CSV exportieren",
    dotTitle: "Einstellungspaket sichern", dotName: "Einstellungen", dotRedacted: "{n} geheime Werte entfernt",
    dotReadme: "MacAtlas – Einstellungspaket\n============================\n\nEnthaltene Dateien:\n{files}\n\nmacOS-Einstellungen (Dock, Finder, Bildschirmfotos, Trackpad):\n{defaults}\n\nWiederherstellen auf dem neuen Mac:\n  Doppelklick auf „Wiederherstellen.command\" (beim ersten Mal Rechtsklick → Öffnen).\n  Vorhandene Dateien werden vorher gesichert.\n\nWerte, die wie Passwörter oder Tokens aussahen, wurden durch <ENTFERNT-REMOVED> ersetzt\nund müssen von Hand neu eingetragen werden. SSH-Schlüssel sind bewusst nicht enthalten.\n",
    syncChoose: "Ordner zum Teilen mit anderen Macs wählen", autoSaved: "Gesichert: {p}",
    chgTitle: "MacAtlas: Änderungen erkannt", chgApp: "1 neues Programm: {x}", chgApps: "{n} neue Programme: {x}",
    chgAgents: "{n} neue Hintergrunddienste", chgSecurity: "Schutz schwächer: {x}", chgPorts: "{n} neu geöffnete Ports",
    renewTitle: "Abo-Verlängerung", renewSoon: "{x} verlängert sich in {n} Tagen ({d})", renewToday: "{x} verlängert sich heute ({d})",
    bfHeader: "Brewfile – erstellt von MacAtlas", bfSource: "Quelle: {h}, Scan vom {d}", bfInstall: "Installieren mit:  brew bundle --file=Brewfile",
  },
  en: {
    inventory: "Inventory", rescan: "Scan Again", exportFile: "Export as File …", exportBrewfile: "Export as Brewfile …",
    report: "Save Report as PDF …", import: "Import Snapshot from Another Mac …", backToOwn: "Back to This Mac",
    autoScan: "Scan Automatically", off: "Off", daily: "Daily", weekly: "Weekly", openAtLogin: "Open at Login",
    showScanFolder: "Show Scan Folder in Finder", showSnapFolder: "Show Snapshot Folder in Finder", settings: "Settings …",
    updatesAvail: "{n} updates available …", allCurrent: "Everything up to date", notScanned: "Not scanned yet",
    lastScan: "Last scan: {d}", noScan: "No scan yet", scanning: "Scanning …", scanNow: "Scan Now",
    open: "Open MacAtlas", quit: "Quit", tipScanning: "MacAtlas – scanning …", tipUpdates: "MacAtlas – {n} updates available",
    notifyOne: "1 new update found – {n} in total.", notifyMany: "{m} new updates found – {n} in total.",
    nothingToExport: "Nothing to export yet. Scan your Mac first.", exportTitle: "Export MacAtlas",
    exported: "Exported to {p}", importTitle: "Import MacAtlas", snapLoaded: "Loaded snapshot from {h}",
    unknown: "unknown", importFailed: "Import failed", invalidFile: "This file is not a valid MacAtlas JSON.",
    brewfileTitle: "Export Brewfile", brewfileSaved: "Saved Brewfile with {n} entries",
    scriptTitle: "Save Install Script", shellScript: "Shell script", pdfTitle: "Save Report as PDF",
    scanCancelled: "Scan cancelled", exitCode: "Exit code {c}",
    clearHistory: "Clear history?", clearHistoryDetail: "All {n} saved scans will be removed. The current scan is kept.",
    clearNotes: "Delete all notes?", clearNotesDetail: "{n} notes and tags will be removed. This cannot be undone.",
    delete: "Delete", cancel: "Cancel",
    about: "About MacAtlas", services: "Services", hide: "Hide MacAtlas", hideOthers: "Hide Others",
    showAll: "Show All", quitApp: "Quit MacAtlas", edit: "Edit", undo: "Undo", redo: "Redo",
    cut: "Cut", copy: "Copy", paste: "Paste", selectAll: "Select All", view: "View",
    reload: "Reload", zoomIn: "Zoom In", zoomOut: "Zoom Out", zoomReset: "Actual Size", fullscreen: "Enter Full Screen",
    window: "Window", minimize: "Minimize", zoom: "Zoom", close: "Close Window", front: "Bring All to Front",
    exportCsv: "Export as CSV (Excel/Numbers) …", csvTitle: "Export as CSV",
    dotTitle: "Save Settings Package", dotName: "Settings", dotRedacted: "{n} secret values removed",
    dotReadme: "MacAtlas – settings package\n===========================\n\nIncluded files:\n{files}\n\nmacOS settings (Dock, Finder, screenshots, trackpad):\n{defaults}\n\nRestore on the new Mac:\n  Double-click “Wiederherstellen.command” (first time: right-click → Open).\n  Existing files are backed up first.\n\nValues that looked like passwords or tokens were replaced with <ENTFERNT-REMOVED>\nand need to be re-entered by hand. SSH keys are intentionally not included.\n",
    syncChoose: "Choose folder to share with other Macs", autoSaved: "Saved: {p}",
    chgTitle: "MacAtlas: changes detected", chgApp: "1 new app: {x}", chgApps: "{n} new apps: {x}",
    chgAgents: "{n} new background services", chgSecurity: "Weaker protection: {x}", chgPorts: "{n} newly opened ports",
    renewTitle: "Subscription renewal", renewSoon: "{x} renews in {n} days ({d})", renewToday: "{x} renews today ({d})",
    bfHeader: "Brewfile – created by MacAtlas", bfSource: "Source: {h}, scanned {d}", bfInstall: "Install with:  brew bundle --file=Brewfile",
  },
};
const tr = (key, vars = {}) => String(STRINGS[lang()][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// ── Paths ─────────────────────────────────────────────────────────────
// Notes + tags per entry, keyed "<category>:<name>"
const notesFile = path.join(app.getPath("userData"), "notes.json");
const readNotes = () => { try { return JSON.parse(fs.readFileSync(notesFile, "utf8")); } catch { return {}; } };

// Writable workdir for scan output (icons + data + inventory.json)
const workDir = path.join(app.getPath("userData"), "scan");
fs.mkdirSync(path.join(workDir, "data", "icons"), { recursive: true });
const snapshotsDir = path.join(app.getPath("userData"), "snapshots");
fs.mkdirSync(snapshotsDir, { recursive: true });
// Compact copy of every own scan (names + versions only) for the timeline
const historyDir = path.join(app.getPath("userData"), "history");
fs.mkdirSync(historyDir, { recursive: true });

// Bundled scripts (read-only inside MacAtlas.app/Contents/Resources/app/scripts)
const scriptsDir = path.join(__dirname, "scripts");
const scanScript = path.join(scriptsDir, "scan.sh");

// A loaded snapshot's path (null = showing own scan)
let activeSnapshot = null;

// ── Window ────────────────────────────────────────────────────────────
function savedBounds() {
  const b = settings.bounds;
  if (!b || !b.width || !b.height) return { width: 1240, height: 820 };
  // Only restore if the window would still be visible on a connected display
  const area = screen.getDisplayMatching(b).workArea;
  const visible = b.x < area.x + area.width - 80 && b.x + b.width > area.x + 80 && b.y >= area.y - 20 && b.y < area.y + area.height - 80;
  return visible ? b : { width: b.width, height: b.height };
}

function createWindow() {
  win = new BrowserWindow({
    ...savedBounds(),
    minWidth: 520,
    minHeight: 420,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: "sidebar",
    visualEffectState: "followWindow",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The UI never navigates or opens windows itself; links go through shell.openExternal
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("focus", () => send("window:focus", true));
  win.on("blur", () => send("window:focus", false));
  let t;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (win && !win.isDestroyed() && !win.isMinimized()) { settings.bounds = win.getBounds(); saveSettings(); } }, 400); };
  win.on("resize", remember);
  win.on("move", remember);
  win.on("closed", () => { win = null; });
  win.webContents.on("did-finish-load", () => {
    if (pendingNav) { send("nav:go", pendingNav); pendingNav = null; }
  });
  Menu.setApplicationMenu(buildMenu());
}

function showWindow(page) {
  if (!win) {
    pendingNav = page || null;
    createWindow();
  } else {
    if (win.isMinimized()) win.restore();
    win.show();
    if (page) send("nav:go", page);
  }
  app.focus({ steal: true });
}

app.on("second-instance", () => showWindow());

ipcMain.handle("theme:accent", () => {
  try { return "#" + systemPreferences.getAccentColor().slice(0, 6); } catch { return null; }
});
systemPreferences.on?.("accent-color-changed", (_e, color) => {
  send("theme:accent", "#" + String(color).slice(0, 6));
});

// ── Menus ─────────────────────────────────────────────────────────────
const AUTO_MS = { daily: 864e5, weekly: 7 * 864e5 };
function autoScanMenu() {
  return ["off", "daily", "weekly"].map((k) => ({
    label: tr(k), type: "radio", checked: settings.autoScan === k,
    click: () => applySettings({ autoScan: k }),
  }));
}
function loginItemEntry() {
  return {
    label: tr("openAtLogin"), type: "checkbox",
    checked: app.getLoginItemSettings().openAtLogin,
    click: (item) => applySettings({ openAtLogin: item.checked }),
  };
}
function refreshMenus() {
  Menu.setApplicationMenu(buildMenu());
  updateTray();
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "MacAtlas",
      submenu: [
        { label: tr("about"), role: "about" },
        { type: "separator" },
        { label: tr("settings"), accelerator: "CmdOrCtrl+,", click: () => showWindow("settings") },
        { type: "separator" },
        { label: tr("services"), role: "services" },
        { type: "separator" },
        { label: tr("hide"), role: "hide" }, { label: tr("hideOthers"), role: "hideOthers" }, { label: tr("showAll"), role: "unhide" },
        { type: "separator" },
        { label: tr("quitApp"), role: "quit" },
      ],
    },
    {
      label: tr("edit"),
      submenu: [
        { label: tr("undo"), role: "undo" }, { label: tr("redo"), role: "redo" },
        { type: "separator" },
        { label: tr("cut"), role: "cut" }, { label: tr("copy"), role: "copy" }, { label: tr("paste"), role: "paste" },
        { label: tr("selectAll"), role: "selectAll" },
      ],
    },
    {
      label: tr("inventory"),
      submenu: [
        { label: tr("rescan"), accelerator: "CmdOrCtrl+R", click: () => runScan() },
        { type: "separator" },
        { label: tr("exportFile"), accelerator: "CmdOrCtrl+E", click: () => exportInventory() },
        { label: tr("exportBrewfile"), accelerator: "CmdOrCtrl+Shift+E", click: () => exportBrewfile() },
        { label: tr("exportCsv"), click: () => exportCsv() },
        { label: tr("report"), accelerator: "CmdOrCtrl+P", click: () => { showWindow(); send("report:request"); } },
        { label: tr("import"), accelerator: "CmdOrCtrl+I", click: () => importInventory() },
        { label: tr("backToOwn"), click: () => switchToOwn() },
        { type: "separator" },
        { label: tr("autoScan"), submenu: autoScanMenu() },
        loginItemEntry(),
        { type: "separator" },
        { label: tr("showScanFolder"), click: () => shell.openPath(workDir) },
        { label: tr("showSnapFolder"), click: () => shell.openPath(snapshotsDir) },
      ],
    },
    {
      label: tr("view"),
      submenu: [
        { label: tr("reload"), role: "reload" },
        { type: "separator" },
        { label: tr("zoomReset"), role: "resetZoom" }, { label: tr("zoomIn"), role: "zoomIn" }, { label: tr("zoomOut"), role: "zoomOut" },
        { type: "separator" },
        { label: tr("fullscreen"), role: "togglefullscreen" },
      ],
    },
    {
      label: tr("window"), role: "window",
      submenu: [
        { label: tr("minimize"), role: "minimize" }, { label: tr("zoom"), role: "zoom" },
        { label: tr("close"), role: "close" },
        { type: "separator" },
        { label: tr("front"), role: "front" },
      ],
    },
  ]);
}

// ── Scan ──────────────────────────────────────────────────────────────
// Apps launched from Finder get a minimal PATH; ask the user's login shell for
// the real one so pip/npm/gem resolve to the same tools as in Terminal.
let loginPath = null;
function getLoginPath() {
  if (loginPath !== null) return loginPath;
  try {
    const sh = process.env.SHELL || "/bin/zsh";
    const out = require("child_process").execFileSync(sh, ["-ilc", 'printf "__MI__%s__MI__" "$PATH"'], { timeout: 5000, encoding: "utf8" });
    const m = out.match(/__MI__(.*)__MI__/);
    loginPath = m ? m[1] : "";
  } catch { loginPath = ""; }
  return loginPath;
}

let scanning = false, scanChild = null, scanCancelled = false;
const totalSteps = (() => {
  try { return (fs.readFileSync(scanScript, "utf8").match(/^echo "→/gm) || []).length; } catch { return 12; }
})();

function runScan(opts = {}) {
  if (scanning) return;
  scanning = true;
  scanCancelled = false;
  updateTray();
  send("scan:started", { total: totalSteps });
  const env = {
    ...process.env, MI_WORKDIR: workDir,
    MI_EMBED_ICONS: settings.embedIcons ? "1" : "0",
    MI_BREW_UPDATE: settings.brewUpdate ? "1" : "0",
  };
  env.PATH = [
    getLoginPath(), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin",
    env.PATH || "",
  ].filter(Boolean).join(":");
  // Own process group, so cancelling also stops brew/pip/gem started by the script
  const child = spawn("/bin/bash", [scanScript], { cwd: workDir, env, detached: true });
  scanChild = child;
  let step = 0, stderr = "", buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("→")) {
        step += 1;
        send("scan:progress", { step, total: totalSteps, label: line.slice(1).trim() });
      }
    }
  });
  child.stderr.on("data", (c) => { stderr = (stderr + c.toString()).slice(-4000); });
  child.on("close", (code) => {
    scanning = false;
    scanChild = null;
    if (scanCancelled || code !== 0) {
      updateTray();
      send("scan:done", scanCancelled
        ? { ok: false, cancelled: true, error: tr("scanCancelled") }
        : { ok: false, error: stderr.slice(-1500) || tr("exitCode", { c: code }) });
      return;
    }
    if (!opts.keepSnapshot) activeSnapshot = null;   // migration assistant keeps the old Mac's snapshot open
    const data = readOwnInventory();
    const prevScan = readHistory().slice(-1)[0] || null;
    try { saveHistory(data); } catch (e) { console.error("history:", e); }
    afterScan(data, opts);
    try { warnAboutChanges(prevScan, data, opts); } catch (e) { console.error("warn:", e); }
    try { syncScan(data); } catch (e) { console.error("sync:", e); }
    send("scan:done", { ok: true });
  });
}

function cancelScan() {
  if (!scanChild) return false;
  scanCancelled = true;
  try { process.kill(-scanChild.pid, "SIGTERM"); } catch { try { scanChild.kill("SIGTERM"); } catch {} }
  return true;
}
ipcMain.handle("scan:cancel", () => cancelScan());

function updateCount(data) {
  return data && data.updates ? data.updates.items.length : null;
}

// Menu bar badge + notification when a background scan finds new updates
function afterScan(data, opts) {
  const n = updateCount(data);
  const prev = settings.lastUpdateCount;
  settings.lastUpdateCount = n;
  saveSettings();
  updateTray();
  if (opts.auto && settings.notify && n && (prev == null || n > prev) && Notification.isSupported()) {
    const more = prev == null ? n : n - prev;
    const note = new Notification({
      title: "MacAtlas",
      body: more === 1 ? tr("notifyOne", { n }) : tr("notifyMany", { m: more, n }),
    });
    note.on("click", () => showWindow("updates"));
    note.show();
  }
}

// Notification when a background scan sees something worth a look:
// new apps, new background services, weaker security, newly exposed ports.
function warnAboutChanges(prev, data, opts) {
  if (!prev || !data || !settings.warnChanges || !Notification.isSupported()) return;
  if (!opts.auto && win && win.isFocused()) return;   // the user is looking at the result anyway
  const { newApps, newAgents, weaker, newPorts } = core.significantChanges(prev, compactInventory(data));
  const parts = [];
  if (newApps.length) parts.push(tr(newApps.length === 1 ? "chgApp" : "chgApps", { n: newApps.length, x: newApps.slice(0, 3).join(", ") }));
  if (newAgents.length) parts.push(tr("chgAgents", { n: newAgents.length }));
  if (weaker.length) parts.push(tr("chgSecurity", { x: weaker.join(", ") }));
  if (newPorts.length) parts.push(tr("chgPorts", { n: newPorts.length }));
  if (!parts.length) return;
  const note = new Notification({ title: tr("chgTitle"), body: parts.join(" · ") });
  note.on("click", () => showWindow(weaker.length ? "security" : newAgents.length ? "autostart" : "history"));
  note.show();
}

// ── Several Macs: each scan is copied into a shared (iCloud) folder ────
function defaultSyncDir() {
  const icloud = path.join(os.homedir(), "Library/Mobile Documents/com~apple~CloudDocs");
  return fs.existsSync(icloud) ? path.join(icloud, "MacAtlas") : path.join(app.getPath("documents"), "MacAtlas", "Macs");
}
const syncDir = () => settings.syncDir || defaultSyncDir();

function syncScan(data) {
  if (!settings.syncEnabled || !data) return;
  fs.mkdirSync(syncDir(), { recursive: true });
  const notes = readNotes();
  const out = { ...data, ...(Object.keys(notes).length ? { notes } : {}) };
  fs.writeFileSync(path.join(syncDir(), `${safeHost(data.system?.hostname)}.macatlas.json`), JSON.stringify(out));
}

function listMacs() {
  const dir = syncDir();
  if (!fs.existsSync(dir)) return { dir, macs: [] };
  const own = readOwnInventory();
  const macs = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".macatlas.json"))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const s = d.system || {};
      macs.push({
        file: f, hostname: s.hostname, model: s.marketing_name || s.model_name, chip: s.chip, ram_gb: s.ram_gb,
        os: [s.os_marketing, s.os_version].filter(Boolean).join(" "), generated_at: d.generated_at,
        total: d.total_count, updates: d.updates ? d.updates.items.length : null,
        security: d.security ? { ok: d.security.checks.filter((c) => c.ok).length, total: d.security.checks.length } : null,
        storage: s.storage || null, device_image: s.device_image || null,
        self: own && s.hostname === own.system?.hostname,
      });
    } catch {}
  }
  macs.sort((a, b) => (b.self - a.self) || String(a.hostname).localeCompare(String(b.hostname)));
  return { dir, macs };
}
ipcMain.handle("macs:list", () => listMacs());
ipcMain.handle("macs:open", (_e, file) => {
  const p = path.join(syncDir(), path.basename(String(file || "")));
  if (!p.endsWith(".macatlas.json") || !fs.existsSync(p)) return false;
  try { readSnapshot(p); } catch (e) { dialog.showErrorBox(tr("importFailed"), e.message); return false; }
  activeSnapshot = p;
  send("inventory:changed");
  return true;
});
ipcMain.handle("sync:now", () => { syncScan(readOwnInventory()); return listMacs(); });
ipcMain.handle("sync:choose", async () => {
  const r = await dialog.showOpenDialog(win, { title: tr("syncChoose"), properties: ["openDirectory", "createDirectory"], defaultPath: syncDir() });
  if (r.canceled || !r.filePaths.length) return publicSettings();
  settings.syncDir = r.filePaths[0];
  saveSettings();
  return publicSettings();
});
ipcMain.handle("sync:open", () => { fs.mkdirSync(syncDir(), { recursive: true }); shell.openPath(syncDir()); });

// ── Subscription renewals (price/cycle/date stored with notes) ─────────
function checkRenewals() {
  if (!settings.remindRenewals || !Notification.isSupported()) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let changed = false;
  for (const [key, n] of Object.entries(readNotes())) {
    if (!n.renews) continue;
    const d = nextRenewal(n.renews, n.cycle);
    if (!d) continue;
    const days = Math.round((d - today) / 864e5);
    const stamp = isoDate(d);
    if (days < 0 || days > 7 || settings.reminded[key] === stamp) continue;
    const name = key.slice(key.indexOf(":") + 1);
    const price = n.price ? ` (${Number(n.price).toLocaleString(locale(), { style: "currency", currency: n.currency || "EUR" })})` : "";
    const note = new Notification({
      title: tr("renewTitle"),
      body: tr(days === 0 ? "renewToday" : "renewSoon", { x: name, d: d.toLocaleDateString(locale(), { dateStyle: "medium" }), n: days }) + price,
    });
    note.on("click", () => showWindow("licenses"));
    note.show();
    settings.reminded[key] = stamp;
    changed = true;
  }
  if (changed) saveSettings();
}

// ── Menu bar icon ─────────────────────────────────────────────────────
function updateTray() {
  if (!tray) return;
  const n = settings.lastUpdateCount;
  tray.setTitle(scanning ? " …" : n && settings.trayCount ? ` ${n}` : "", { fontType: "monospacedDigit" });
  tray.setToolTip(scanning ? tr("tipScanning") : n ? tr("tipUpdates", { n }) : "MacAtlas");
  const own = readOwnInventory();
  const last = own && own.generated_at ? new Date(own.generated_at).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" }) : null;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: n ? tr("updatesAvail", { n }) : n === 0 ? tr("allCurrent") : tr("notScanned"), enabled: !!n, click: () => showWindow("updates") },
    { label: last ? tr("lastScan", { d: last }) : tr("noScan"), enabled: false },
    { type: "separator" },
    { label: scanning ? tr("scanning") : tr("scanNow"), enabled: !scanning, click: () => runScan() },
    { label: tr("open"), click: () => showWindow() },
    { label: tr("settings"), click: () => showWindow("settings") },
    { type: "separator" },
    { label: tr("autoScan"), submenu: autoScanMenu() },
    loginItemEntry(),
    { type: "separator" },
    { label: tr("quit"), role: "quit" },
  ]));
}

function setTrayVisible(on) {
  if (on && !tray) {
    const img = nativeImage.createFromPath(path.join(__dirname, "trayTemplate.png"));
    img.setTemplateImage(true);
    tray = new Tray(img);
    if (settings.lastUpdateCount == null) settings.lastUpdateCount = updateCount(readOwnInventory());
    updateTray();
  } else if (!on && tray) {
    tray.destroy();
    tray = null;
  }
}

// Background scan when the last own scan is older than the chosen interval
function checkAutoScan() {
  const ms = AUTO_MS[settings.autoScan];
  if (!ms || scanning) return;
  const own = readOwnInventory();
  const age = own && own.generated_at ? Date.now() - new Date(own.generated_at).getTime() : Infinity;
  if (age >= ms) runScan({ auto: true, keepSnapshot: true });
}

// ── Settings IPC ──────────────────────────────────────────────────────
function publicSettings() {
  const { bounds: _b, lastUpdateCount: _u, reminded: _r, ...rest } = settings;
  return {
    ...rest,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    resolvedLanguage: lang(),
    version: app.getVersion(),
    electron: process.versions.electron,
    historyCount: fs.readdirSync(historyDir).filter((f) => f.endsWith(".json")).length,
    notesCount: Object.keys(readNotes()).length,
    dataDir: app.getPath("userData"),
    syncDirResolved: syncDir(),
    exportDir: autoDir(""),
  };
}

const VALID = {
  language: ["system", "de", "en"], theme: ["system", "light", "dark"], autoScan: ["off", "daily", "weekly"],
  historyMax: [25, 50, 100, 200, 500],
};
const BOOLS = ["showTray", "trayCount", "notify", "brewUpdate", "embedIcons", "warnChanges", "remindRenewals", "syncEnabled"];

function applySettings(patch) {
  if (!patch || typeof patch !== "object") return publicSettings();
  for (const [k, v] of Object.entries(patch)) {
    if (VALID[k] && VALID[k].includes(v)) settings[k] = v;
    else if (BOOLS.includes(k) && typeof v === "boolean") settings[k] = v;
  }
  if (typeof patch.openAtLogin === "boolean") app.setLoginItemSettings({ openAtLogin: patch.openAtLogin });
  saveSettings();
  nativeTheme.themeSource = settings.theme;
  setTrayVisible(settings.showTray);
  if ("historyMax" in patch) pruneHistory();
  if ("autoScan" in patch) checkAutoScan();
  if (patch.syncEnabled === true) { try { syncScan(readOwnInventory()); } catch (e) { console.error("sync:", e); } }
  if (patch.remindRenewals === true) checkRenewals();
  refreshMenus();
  const pub = publicSettings();
  send("settings:changed", pub);
  return pub;
}

ipcMain.handle("settings:get", () => publicSettings());
ipcMain.handle("settings:set", (_e, patch) => applySettings(patch));
ipcMain.handle("data:open", () => shell.openPath(app.getPath("userData")));

ipcMain.handle("history:clear", async () => {
  const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json"));
  if (!files.length) return false;
  const r = await dialog.showMessageBox(win, {
    type: "warning", message: tr("clearHistory"), detail: tr("clearHistoryDetail", { n: files.length }),
    buttons: [tr("delete"), tr("cancel")], defaultId: 1, cancelId: 1,
  });
  if (r.response !== 0) return false;
  for (const f of files) fs.unlinkSync(path.join(historyDir, f));
  const own = readOwnInventory();
  if (own) saveHistory(own);
  return true;
});

ipcMain.handle("notes:clear", async () => {
  const n = Object.keys(readNotes()).length;
  if (!n) return false;
  const r = await dialog.showMessageBox(win, {
    type: "warning", message: tr("clearNotes"), detail: tr("clearNotesDetail", { n }),
    buttons: [tr("delete"), tr("cancel")], defaultId: 1, cancelId: 1,
  });
  if (r.response !== 0) return false;
  fs.writeFileSync(notesFile, "{}");
  return true;
});

// ── History ───────────────────────────────────────────────────────────
function pruneHistory() {
  const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - settings.historyMax))) fs.unlinkSync(path.join(historyDir, f));
}

function saveHistory(data) {
  if (!data || !data.generated_at) return;
  const name = data.generated_at.replace(/[^0-9T]/g, "") + ".json";
  fs.writeFileSync(path.join(historyDir, name), JSON.stringify(compactInventory(data)));
  pruneHistory();
}

function readHistory() {
  const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json")).sort();
  // First start after the update: seed the timeline with the existing scan
  if (!files.length) {
    const own = readOwnInventory();
    if (own) { saveHistory(own); return readHistory(); }
  }
  const out = [];
  for (const f of files) {
    try { out.push(JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8"))); } catch {}
  }
  return out;
}

ipcMain.handle("history:list", () => readHistory());

// Writes a generated .command file and opens it, which runs it in Terminal
ipcMain.handle("script:run", async (_e, { content, name }) => {
  if (typeof content !== "string" || !content.startsWith("#!/usr/bin/env bash")) return false;
  const runDir = path.join(app.getPath("userData"), "run");
  fs.mkdirSync(runDir, { recursive: true });
  const file = path.join(runDir, String(name || "script.command").replace(/[\/:]/g, "-"));
  fs.writeFileSync(file, content, { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  const err = await shell.openPath(file);
  return !err;
});

// ── Inventory files ───────────────────────────────────────────────────
// inventory.json is ~2 MB; parse it again only when the file changed
let ownCache = { mtime: 0, data: null };
function readOwnInventory() {
  const file = path.join(workDir, "inventory.json");
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (mtime !== ownCache.mtime) ownCache = { mtime, data: JSON.parse(fs.readFileSync(file, "utf8")) };
    return ownCache.data;
  } catch {
    return null;
  }
}

function readSnapshot(file) {
  const txt = fs.readFileSync(file, "utf8");
  const data = JSON.parse(txt);
  if (!data || !Array.isArray(data.categories)) {
    throw new Error(tr("invalidFile"));
  }
  return data;
}

ipcMain.handle("inventory:read", async () => {
  if (activeSnapshot) {
    try {
      const data = readSnapshot(activeSnapshot);
      return { data, own: readOwnInventory(), source: "snapshot", path: activeSnapshot };
    } catch (e) {
      activeSnapshot = null;
      return { data: null, source: "error", error: e.message };
    }
  }
  const data = readOwnInventory();
  return { data, source: "own", path: path.join(workDir, "inventory.json") };
});

ipcMain.handle("inventory:rescan", (_e, opts) => runScan({ keepSnapshot: !!opts?.keepSnapshot }));

async function exportInventory() {
  if (!win) showWindow();
  let data;
  try { data = activeSnapshot ? readSnapshot(activeSnapshot) : readOwnInventory(); } catch (e) { dialog.showErrorBox(tr("importFailed"), e.message); return; }
  // Notes travel with the export so they can be viewed on the other Mac
  if (data && !activeSnapshot) {
    const notes = readNotes();
    if (Object.keys(notes).length) data = { ...data, notes };   // don't mutate the cached inventory
  }
  if (!data) {
    dialog.showMessageBox(win, { type: "info", message: tr("nothingToExport") });
    return;
  }
  const sys = data.system || {};
  const host = (sys.hostname || os.hostname()).replace(/[^\w\s.-]/g, "").trim() || "Mac";
  const date = (data.generated_at || new Date().toISOString()).slice(0, 10);
  const defaultName = `MacAtlas – ${host} – ${date}.json`;
  const result = await dialog.showSaveDialog(win, {
    title: tr("exportTitle"),
    defaultPath: path.join(app.getPath("downloads"), defaultName),
    filters: [{ name: "MacAtlas", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
  send("toast", { msg: tr("exported", { p: result.filePath }), ms: 4000 });
  shell.showItemInFolder(result.filePath);
}

async function importInventory() {
  if (!win) showWindow();
  const result = await dialog.showOpenDialog(win, {
    title: tr("importTitle"),
    properties: ["openFile"],
    filters: [{ name: "MacAtlas", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths.length) return;
  const src = result.filePaths[0];
  try {
    const data = readSnapshot(src);
    const host = ((data.system && data.system.hostname) || "import").replace(/[^\w.-]/g, "_");
    const date = (data.generated_at || new Date().toISOString()).slice(0, 10);
    const dest = path.join(snapshotsDir, `${host}-${date}.json`);
    fs.copyFileSync(src, dest);
    activeSnapshot = dest;
    send("inventory:changed");
    send("toast", { msg: tr("snapLoaded", { h: data.system?.hostname || tr("unknown") }), ms: 3500 });
  } catch (e) {
    dialog.showErrorBox(tr("importFailed"), e.message);
  }
}

function switchToOwn() {
  activeSnapshot = null;
  if (win) send("inventory:changed");
}

ipcMain.handle("inventory:export", () => exportInventory());

async function exportBrewfile() {
  if (!win) showWindow();
  let data;
  try { data = activeSnapshot ? readSnapshot(activeSnapshot) : readOwnInventory(); } catch { data = null; }
  if (!data) {
    dialog.showMessageBox(win, { type: "info", message: tr("nothingToExport") });
    return false;
  }
  const bf = buildBrewfile(data, [
    tr("bfHeader"),
    tr("bfSource", { h: data.system?.hostname || "Mac", d: String(data.generated_at || "").slice(0, 10) }),
    tr("bfInstall"),
  ]);
  const result = await dialog.showSaveDialog(win, {
    title: tr("brewfileTitle"),
    defaultPath: path.join(app.getPath("downloads"), "Brewfile"),
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, bf.text);
  send("toast", { msg: tr("brewfileSaved", { n: bf.count }), ms: 3500 });
  shell.showItemInFolder(result.filePath);
  return true;
}
ipcMain.handle("brewfile:export", () => exportBrewfile());

// ── CSV (opens in Excel / Numbers) ─────────────────────────────────────
async function exportCsv() {
  if (!win) showWindow();
  let data;
  try { data = activeSnapshot ? readSnapshot(activeSnapshot) : readOwnInventory(); } catch { data = null; }
  if (!data) { dialog.showMessageBox(win, { type: "info", message: tr("nothingToExport") }); return false; }
  const host = safeHost(data.system?.hostname);
  const r = await dialog.showSaveDialog(win, {
    title: tr("csvTitle"),
    defaultPath: path.join(app.getPath("downloads"), `MacAtlas – ${host} – ${String(data.generated_at || "").slice(0, 10)}.csv`),
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, buildCsv(data, activeSnapshot ? (data.notes || {}) : readNotes(), lang()));
  send("toast", { msg: tr("exported", { p: r.filePath }), ms: 4000 });
  shell.showItemInFolder(r.filePath);
  return true;
}
ipcMain.handle("csv:export", () => exportCsv());

// ── Settings package (dotfiles, editor settings, Dock/Finder) ──────────
const DOTFILES = [".zshrc", ".zprofile", ".zshenv", ".bashrc", ".bash_profile", ".profile", ".gitconfig", ".gitignore_global",
  ".ssh/config", ".vimrc", ".tmux.conf", ".config/starship.toml", ".config/git/config", ".npmrc", ".editorconfig",
  "Library/Application Support/Code/User/settings.json", "Library/Application Support/Code/User/keybindings.json",
  "Library/Application Support/Cursor/User/settings.json", "Library/Application Support/Cursor/User/keybindings.json"];
const DEFAULTS_DOMAINS = ["com.apple.dock", "com.apple.finder", "com.apple.screencapture", "com.apple.AppleMultitouchTrackpad"];
ipcMain.handle("dotfiles:export", async () => {
  if (!win) showWindow();
  const host = safeHost(readOwnInventory()?.system?.hostname || os.hostname());
  const r = await dialog.showSaveDialog(win, {
    title: tr("dotTitle"),
    defaultPath: path.join(app.getPath("downloads"), `MacAtlas ${tr("dotName")} – ${host} – ${new Date().toISOString().slice(0, 10)}.zip`),
    filters: [{ name: "ZIP", extensions: ["zip"] }],
  });
  if (r.canceled || !r.filePath) return null;
  const tmp = fs.mkdtempSync(path.join(app.getPath("temp"), "macatlas-dot-"));
  const root = path.join(tmp, "MacAtlas-Einstellungen");
  const report = { files: [], redacted: 0, defaults: [] };
  for (const rel of DOTFILES) {
    const src = path.join(os.homedir(), rel);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile() || fs.statSync(src).size > 2e6) continue;
    const { text, count } = redact(fs.readFileSync(src, "utf8"));
    const dest = path.join(root, "files", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text, { mode: 0o600 });
    report.files.push({ path: "~/" + rel, redacted: count });
    report.redacted += count;
  }
  fs.mkdirSync(path.join(root, "defaults"), { recursive: true });
  for (const dom of DEFAULTS_DOMAINS) {
    try {
      require("child_process").execFileSync("/usr/bin/defaults", ["export", dom, path.join(root, "defaults", dom + ".plist")], { timeout: 10000 });
      report.defaults.push(dom);
    } catch {}
  }
  fs.writeFileSync(path.join(root, "Wiederherstellen.command"), restoreScript(report), { mode: 0o755 });
  fs.writeFileSync(path.join(root, lang() === "de" ? "LIESMICH.txt" : "README.txt"), tr("dotReadme", {
    files: report.files.map((f) => `  ${f.path}${f.redacted ? `  (${tr("dotRedacted", { n: f.redacted })})` : ""}`).join("\n"),
    defaults: report.defaults.map((d) => "  " + d).join("\n"),
  }));
  fs.rmSync(r.filePath, { force: true });
  require("child_process").execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", root, r.filePath]);
  fs.rmSync(tmp, { recursive: true, force: true });
  shell.showItemInFolder(r.filePath);
  return report;
});

function restoreScript(report) {
  const de = lang() === "de";
  const files = report.files.map((f) => f.path.slice(2));
  return `#!/usr/bin/env bash
# MacAtlas – ${de ? "Einstellungen wiederherstellen" : "restore settings"}
# ${de ? "Vorhandene Dateien werden vorher als *.vor-macatlas gesichert." : "Existing files are backed up as *.before-macatlas first."}
cd "$(dirname "$0")"
echo "${de ? "Folgende Dateien werden in deinen Benutzerordner kopiert:" : "These files will be copied into your home folder:"}"
${files.map((f) => `echo "  ~/${f}"`).join("\n")}
read -r -p "${de ? "Fortfahren? [j/N] " : "Continue? [y/N] "}" ok
case "$ok" in j|J|y|Y) ;; *) echo "${de ? "Abgebrochen." : "Cancelled."}"; exit 0 ;; esac
SUFFIX="${de ? "vor-macatlas" : "before-macatlas"}-$(date +%Y%m%d-%H%M%S)"
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  src="files/$rel"; dst="$HOME/$rel"
  [ -f "$src" ] || continue
  mkdir -p "$(dirname "$dst")"
  [ -e "$dst" ] && cp -p "$dst" "$dst.$SUFFIX"
  cp "$src" "$dst"
  echo "  ✓ ~/$rel"
done <<'EOF'
${files.join("\n")}
EOF
[ -f "files/.ssh/config" ] && chmod 600 "$HOME/.ssh/config"
for f in defaults/*.plist; do
  [ -f "$f" ] || continue
  dom=$(basename "$f" .plist)
  defaults import "$dom" "$f" && echo "  ✓ $dom"
done
killall Dock Finder SystemUIServer 2>/dev/null || true
echo ""
echo "${de ? "Fertig. Werte mit <ENTFERNT-REMOVED> (Tokens, Passwörter) bitte von Hand neu eintragen." : "Done. Please re-enter values marked <ENTFERNT-REMOVED> (tokens, passwords) by hand."}"
`;
}

// ── Shortcuts / URL scheme: macatlas://scan, //report, //export, //csv, //open/<page>
const AUTO_PAGES = new Set(["overview", "updates", "cleanup", "storage", "versions", "security", "autostart", "history", "notes", "licenses", "macs", "dotfiles", "settings"]);
function autoDir(kind) {
  const base = path.join(app.getPath("documents"), "MacAtlas");
  return kind ? path.join(base, kind) : base;
}
let pendingUrls = [];
function handleUrl(url) {
  if (!app.isReady()) { pendingUrls.push(url); return; }
  const parsed = core.parseAppUrl(url);
  if (!parsed) return;
  const { action, arg } = parsed;
  const data = () => readOwnInventory();
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`; };
  const host = () => safeHost(data()?.system?.hostname);
  const done = (file) => {
    if (Notification.isSupported()) {
      const n = new Notification({ title: "MacAtlas", body: tr("autoSaved", { p: path.basename(file) }) });
      n.on("click", () => shell.showItemInFolder(file));
      n.show();
    }
  };
  if (action === "scan") return runScan({ auto: true, keepSnapshot: true });
  if (action === "open") return showWindow(AUTO_PAGES.has(arg) ? arg : undefined);
  if (action === "export" || action === "csv") {
    const d = data();
    if (!d) return;
    const dir = autoDir(lang() === "de" ? "Exporte" : "Exports");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `MacAtlas – ${host()} – ${stamp()}.${action === "csv" ? "csv" : "json"}`);
    fs.writeFileSync(file, action === "csv" ? buildCsv(d, readNotes(), lang()) : JSON.stringify({ ...d, notes: readNotes() }, null, 2));
    return done(file);
  }
  if (action === "report") {
    // The report HTML is built by the renderer; it answers with report:pdfAuto
    if (!win) createWindow();
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", () => send("report:auto"));
    else send("report:auto");
  }
}
app.on("open-url", (e, url) => { e.preventDefault(); handleUrl(url); });

ipcMain.handle("report:pdfAuto", async (_e, { html }) => {
  if (typeof html !== "string") return false;
  const dir = autoDir(lang() === "de" ? "Berichte" : "Reports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `MacAtlas – ${safeHost(readOwnInventory()?.system?.hostname)} – ${new Date().toISOString().slice(0, 10)}.pdf`);
  await renderPdf(html, file);
  if (Notification.isSupported()) {
    const n = new Notification({ title: "MacAtlas", body: tr("autoSaved", { p: path.basename(file) }) });
    n.on("click", () => shell.showItemInFolder(file));
    n.show();
  }
  return true;
});
ipcMain.handle("autodir:open", (_e, kind) => {
  const dir = autoDir(["Berichte", "Reports", "Exporte", "Exports"].includes(kind) ? kind : "");
  fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
});

// Opens a System Settings pane, e.g. "com.apple.Software-Update-Settings.extension"
ipcMain.handle("settings:open", async (_e, pane) => {
  if (typeof pane !== "string" || !/^[A-Za-z0-9.-]+$/.test(pane)) return false;
  await shell.openExternal("x-apple.systempreferences:" + pane);
  return true;
});

// Reveal a launchd plist in Finder (only inside the LaunchAgents/Daemons folders)
ipcMain.handle("path:reveal", async (_e, p) => {
  if (typeof p !== "string") return false;
  const dirs = [path.join(os.homedir(), "Library/LaunchAgents"), "/Library/LaunchAgents", "/Library/LaunchDaemons"];
  const real = path.resolve(p);
  if (!dirs.includes(path.dirname(real)) || !fs.existsSync(real)) return false;
  shell.showItemInFolder(real);
  return true;
});

ipcMain.handle("script:save", async (_e, { content, name }) => {
  if (typeof content !== "string") return false;
  const result = await dialog.showSaveDialog(win, {
    title: tr("scriptTitle"),
    defaultPath: path.join(app.getPath("downloads"), String(name || "install.sh").replace(/[\/:]/g, "-")),
    filters: [{ name: tr("shellScript"), extensions: ["sh", "command"] }],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, content, { mode: 0o755 });
  shell.showItemInFolder(result.filePath);
  return true;
});
ipcMain.handle("inventory:import", () => importInventory());
ipcMain.handle("inventory:switchToOwn", () => switchToOwn());

ipcMain.handle("url:open", async (_e, url) => {
  if (typeof url !== "string") return false;
  if (!/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});

ipcMain.handle("item:reveal", async (_e, name) => {
  if (typeof name !== "string" || !name || name.includes("/") || name.startsWith(".")) return false;
  const appPath = `/Applications/${name}.app`;
  if (fs.existsSync(appPath)) {
    shell.showItemInFolder(appPath);
    return true;
  }
  return false;
});

ipcMain.handle("notes:get", () => {
  const notes = readNotes();
  for (const n of Object.values(notes)) {
    const d = n.renews ? nextRenewal(n.renews, n.cycle) : null;
    if (d) n.next = isoDate(d);
  }
  return notes;
});
ipcMain.handle("notes:set", (_e, key, value) => {
  if (typeof key !== "string" || key.length > 400) return false;
  const notes = readNotes();
  const note = String(value?.note || "").slice(0, 4000).trim();
  const tags = [...new Set((Array.isArray(value?.tags) ? value.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
  // Optional subscription / license data
  const price = Number(value?.price);
  const lic = {};
  if (isFinite(price) && price > 0 && price < 1e6) lic.price = Math.round(price * 100) / 100;
  if (["EUR", "USD", "CHF", "GBP"].includes(value?.currency)) lic.currency = value.currency;
  if (["once", "monthly", "yearly"].includes(value?.cycle)) lic.cycle = value.cycle;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value?.renews || "")) lic.renews = value.renews;
  if (!note && !tags.length && !lic.price && !lic.renews) delete notes[key];
  else notes[key] = { note, tags, ...lic, updated: new Date().toISOString() };
  fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
  return true;
});

// PDF report: the renderer builds escaped HTML, we print it in a hidden
// window with JavaScript disabled and save the result.
async function renderPdf(html, file) {
  const tmp = path.join(app.getPath("temp"), `macatlas-report-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const pw = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false, sandbox: true } });
  try {
    await pw.loadFile(tmp);
    const pdf = await pw.webContents.printToPDF({
      pageSize: "A4", printBackground: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: '<div style="font:8px -apple-system,sans-serif;color:#888;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margins: { top: 0.5, bottom: 0.6, left: 0.5, right: 0.5 },
    });
    fs.writeFileSync(file, pdf);
  } finally {
    pw.destroy();
    fs.rmSync(tmp, { force: true });
  }
}

ipcMain.handle("report:pdf", async (_e, { html, name }) => {
  if (typeof html !== "string") return false;
  const result = await dialog.showSaveDialog(win, {
    title: tr("pdfTitle"),
    defaultPath: path.join(app.getPath("downloads"), String(name || "MacAtlas.pdf").replace(/[\/:]/g, "-")),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return false;
  await renderPdf(html, result.filePath);
  shell.openPath(result.filePath);
  return true;
});

app.whenReady().then(() => {
  if (!gotLock) return;
  nativeTheme.themeSource = settings.theme;
  app.setAboutPanelOptions({ applicationName: "MacAtlas", applicationVersion: app.getVersion(), copyright: "© m4rcelnoel · github.com/m4rcelnoel/MacAtlas" });
  createWindow();
  setTrayVisible(settings.showTray);
  // First check shortly after launch, then every 30 minutes
  setTimeout(() => { checkAutoScan(); checkRenewals(); }, 60 * 1000);
  setInterval(() => { checkAutoScan(); checkRenewals(); }, 30 * 60 * 1000);
  for (const u of pendingUrls.splice(0)) handleUrl(u);
  app.on("activate", () => showWindow());
});

app.on("before-quit", () => cancelScan());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
