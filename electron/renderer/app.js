// ── Browser fallback (dev preview only) ────────────────────────────
if (!window.inventory) {
  document.body.classList.add("browser");
  const noop = () => {};
  const devSettings = () => { try { return JSON.parse(localStorage.getItem("mi-dev-settings") || "{}"); } catch { return {}; } };
  const DEV_DEFAULTS = { language: "system", theme: "system", autoScan: "off", showTray: true, trayCount: true, notify: true, brewUpdate: true, embedIcons: true, historyMax: 100, openAtLogin: false };
  const pub = () => {
    const s = { ...DEV_DEFAULTS, ...devSettings() };
    return { ...s, resolvedLanguage: s.language === "system" ? (navigator.language.startsWith("de") ? "de" : "en") : s.language, version: "dev", electron: "–", historyCount: 0, notesCount: 0, dataDir: "~/Library/Application Support/MacAtlas" };
  };
  let settingsCb = noop;
  window.inventory = {
    read: async () => {
      try {
        const own = await (await fetch("../../inventory.json")).json();
        if (location.search.includes("snapshot")) {
          const snap = await (await fetch("../../snapshot-test.json")).json();
          return { data: snap, own, source: "snapshot" };
        }
        return { data: own, source: "own" };
      } catch { return { data: null, source: "own" }; }
    },
    saveScript: async () => true, runScript: async () => true,
    exportBrewfile: async () => true, openSettings: async () => true, revealPath: async () => true,
    notes: async () => { try { return JSON.parse(localStorage.getItem("mi-dev-notes") || "{}"); } catch { return {}; } },
    setNote: async (k, v) => { const n = JSON.parse(localStorage.getItem("mi-dev-notes") || "{}"); if (!v.note && !v.tags.length) delete n[k]; else n[k] = { ...v, updated: new Date().toISOString() }; localStorage.setItem("mi-dev-notes", JSON.stringify(n)); return true; },
    savePdf: async (html) => { const w = window.open("", "_blank"); w.document.write(html); w.document.close(); return true; },
    getSettings: async () => pub(),
    setSettings: async (patch) => { localStorage.setItem("mi-dev-settings", JSON.stringify({ ...devSettings(), ...patch })); const p = pub(); settingsCb(p); return p; },
    onSettings: (cb) => { settingsCb = cb; },
    cancelScan: async () => true, clearHistory: async () => false, clearNotes: async () => false, openDataDir: noop,
    exportCsv: noop, exportDotfiles: async () => null, listMacs: async () => ({ dir: "~/iCloud/MacAtlas", macs: [] }), openMac: noop,
    syncNow: async () => ({ dir: "", macs: [] }), chooseSyncDir: async () => pub(), openSyncDir: noop, openAutoDir: noop,
    savePdfAuto: noop, onReportAuto: noop,
    onNav: noop, onReportRequest: noop,
    history: async () => { try { return await (await fetch("../../history-test.json")).json(); } catch { return []; } },
    rescan: noop, export: noop, import: noop, switchToOwn: noop, reveal: noop,
    openUrl: (u) => window.open(u, "_blank"), accent: async () => null,
    onAccent: noop, onFocus: noop, onScanStarted: noop, onScanProgress: noop,
    onScanDone: noop, onInventoryChanged: noop, onToast: noop,
  };
}

// ── Language ───────────────────────────────────────────────────────
// Source strings are German; I18N_EN (i18n.js) maps them to English.
let LANG = "de";
let nf = new Intl.NumberFormat("de-DE");
const LOC = () => (LANG === "en" ? "en-US" : "de-DE");
function t(s, vars) {
  let r = (LANG === "en" && I18N_EN[s]) || s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return r;
}
// Plural helper: pl(3, "{n} Scan", "{n} Scans")
const pl = (n, one, many, vars = {}) => t(n === 1 ? one : many, { n: nf.format(n), ...vars });
function setLanguage(lang) {
  LANG = lang === "en" ? "en" : "de";
  nf = new Intl.NumberFormat(LOC());
  document.documentElement.lang = LANG;
  applyStatic();
}
function applyStatic() {
  $("q").placeholder = t("Suchen");
  $("qClear").setAttribute("aria-label", t("Suche löschen"));
  $("sbToggle").title = t("Seitenleiste");
  $("viewSeg").title = t("Darstellung");
  document.querySelector('[data-v="list"]').title = t("Liste");
  document.querySelector('[data-v="grid"]').title = t("Symbole");
  $("scanBtn").title = t("Mac neu scannen (⌘R)");
  $("importBtn").title = t("Snapshot importieren (⌘I)");
  $("exportBtn").title = t("Exportieren (⌘E)");
  $("snapBack").textContent = t("Eigener Mac");
  $("gearBtn").title = t("Einstellungen (⌘,)");
}

// ── Icons ──────────────────────────────────────────────────────────
const P = {
  overview: '<rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2.5 19h19"/>',
  apps: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
  mas: '<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  brew_formulae: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>',
  brew_casks: '<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>',
  npm: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12v9M12 12l8-4.5M12 12L4 7.5"/>',
  pip: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  gem: '<path d="M7 4h10l4 5.5L12 20 3 9.5z"/><path d="M3 9.5h18M12 20L8.5 9.5 12 4l3.5 5.5z"/>',
  vscode: '<path d="M10 4.5a2 2 0 1 1 4 0V6h4v4h-1.5a2 2 0 1 0 0 4H18v4h-4v-1.5a2 2 0 1 0-4 0V18H6v-4h1.5a2 2 0 1 0 0-4H6V6h4z"/>',
  claude_mcp: '<rect x="4" y="4" width="16" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.8"/><path d="M8 7.25h.01M8 16.75h.01"/>',
  claude_plugins: '<path d="M9 3v5M15 3v5M6 8h12v3.5a6 6 0 0 1-12 0zM12 17.5V21"/>',
  claude_skills: '<path d="M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  docker_images: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  docker_containers: '<rect x="3" y="6" width="18" height="12" rx="1.8"/><path d="M7.5 6v12M12 6v12M16.5 6v12"/>',
  fonts: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  system_apps: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  user_apps: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  brew_bin: '<path d="M14 4.5l5.5 5.5-2.8 2.8-5.5-5.5zM11.2 7.3L4 14.5 7.5 18l7.2-7.2"/>',
  usr_local_bin: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  disk: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M7 14.5h.01M10 14.5h7"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><path d="M6 10.5v3"/>',
  display: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  memory: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 10.5v3M11 10.5v3M15 10.5v3M7 17v2M12 17v2M17 17v2"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  link: '<path d="M7.5 16.5l9-9M9.5 7.5h7v7"/>',
  finder: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  scan: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
  import: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 14.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5"/>',
  compare: '<path d="M7 4v16M17 4v16"/><path d="M3.5 8.5L7 5l3.5 3.5M13.5 15.5L17 19l3.5-3.5"/>',
  minus: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8M12 8v8"/>',
  equal: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 10h7M8.5 14h7"/>',
  script: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 13l2 2-2 2M13 17h2.5"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  updates: '<circle cx="12" cy="12" r="8.5"/><path d="M12 16.5v-9M8 11.5l4-4 4 4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5V8h3.5"/><path d="M12 8v4.5l3 1.8"/>',
  cleanup: '<path d="M5 7h14M10 7V5h4v2M6.5 7l1 12.5h9l1-12.5"/><path d="M10.5 11v5M13.5 11v5"/>',
  intel: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M10 10h4v4h-4z"/>',
  size: '<path d="M4 18V6M9 18v-8M14 18V9M19 18v-4"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="M12 9v4M12 16h.01"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>',
  security: '<path d="M12 3.5l7 2.5v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  autostart: '<path d="M12 3.5v7"/><path d="M7.2 6.5a7.5 7.5 0 1 0 9.6 0"/>',
  macos: '<rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2.5 19h19"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  brewfile: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M10 12.5h5M10 16h5"/>',
  note: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  notes: '<path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14.5l-3.5-2-3.5 2-3.5-2-3.5 2V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8.5 8.5h7M8.5 12h7"/>',
  pdf: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5"/><path d="M9.5 16.5v-4h1.3a1.2 1.2 0 0 1 0 2.4H9.5M14 12.5v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  appearance: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  power: '<path d="M12 3.5v7"/><path d="M7.2 6.5a7.5 7.5 0 1 0 9.6 0"/>',
  menubar: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18M15 6.25h3"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 15.5l-5-5-9 8.5"/>',
};
const svg = (k, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24">${P[k] || P.dot}</svg>`;

const COLORS = {
  overview: "#8e8e93", apps: "#0a84ff", mas: "#5e5ce6", brew_formulae: "#ff9f0a", brew_casks: "#a2845e",
  npm: "#ff453a", pip: "#30b0c7", gem: "#ff375f", vscode: "#007aff", claude_mcp: "#d97757",
  claude_plugins: "#c96442", claude_skills: "#bf5af2", docker_images: "#0db7ed", docker_containers: "#1d63ed",
  fonts: "#8e8e93", system_apps: "#636366", user_apps: "#34c759", brew_bin: "#ac8e68", usr_local_bin: "#64a0d8",
  compare: "#ff9f0a", minus: "#ff453a", plus: "#34c759", equal: "#8e8e93", script: "#5e5ce6",
  chip: "#5e5ce6", disk: "#8e8e93", battery: "#34c759", display: "#0a84ff", clock: "#ff9f0a", memory: "#30b0c7",
  updates: "#0a84ff", history: "#5e5ce6", cleanup: "#ff9f0a", intel: "#ff453a", size: "#30b0c7", shield: "#8e8e93", terminal: "#3a3a3c",
  notes: "#ffcc00", pdf: "#ff453a", note: "#ff9f0a",
  security: "#34c759", autostart: "#ff375f", macos: "#636366", gear: "#8e8e93", warn: "#ff9f0a", brewfile: "#ff9f0a",
  settings: "#8e8e93", globe: "#0a84ff", appearance: "#1c1c1e", power: "#34c759", menubar: "#5e5ce6", bell: "#ff3b30",
  folder: "#0a84ff", info: "#8e8e93", photo: "#ff9f0a",
};
const tileBg = (k) => { const c = COLORS[k] || "#8e8e93"; return `background:linear-gradient(180deg, color-mix(in srgb, ${c} 82%, white), ${c})`; };

const SECTIONS = [
  ["Programme", ["apps", "mas", "brew_casks", "user_apps", "system_apps"]],
  ["Entwicklung", ["brew_formulae", "npm", "pip", "gem", "vscode", "docker_images", "docker_containers"]],
  ["Claude", ["claude_mcp", "claude_plugins", "claude_skills"]],
  ["System", ["fonts", "brew_bin", "usr_local_bin"]],
];
const SHORT_LABELS = {
  apps: "Programme", mas: "Mac App Store", brew_formulae: "Homebrew", brew_casks: "Homebrew Casks", npm: "npm (global)",
  pip: "Python (pip)", gem: "Ruby Gems", vscode: "VS Code", claude_mcp: "MCP-Server",
  claude_plugins: "Plugins", claude_skills: "Skills", docker_images: "Docker Images", docker_containers: "Docker Container",
  fonts: "Schriftarten", system_apps: "System-Apps", user_apps: "Benutzer-Apps",
  brew_bin: "Homebrew bin", usr_local_bin: "/usr/local/bin",
};
const DESC = {
  apps: "Programme in /Applications – mit Homebrew-, App-Store- oder Download-Quelle",
  mas: "Über den Mac App Store installiert",
  brew_formulae: "Befehlszeilen-Tools über Homebrew",
  brew_casks: "Programme über Homebrew Cask",
  npm: "Global installierte Node-Pakete",
  pip: "Python-Pakete (pip3)",
  gem: "Installierte Ruby Gems",
  vscode: "Erweiterungen in Visual Studio Code",
  claude_mcp: "MCP-Server aus der Claude-Desktop-Konfiguration",
  claude_plugins: "In Claude Code installierte Plugins",
  claude_skills: "Lokale Skills in ~/.claude/skills",
  docker_images: "Lokal vorhandene Docker-Images",
  docker_containers: "Docker-Container (laufend und gestoppt)",
  fonts: "Schriften in ~/Library/Fonts, /Library/Fonts und /System/Library/Fonts",
  system_apps: "Mit macOS ausgelieferte Apps",
  user_apps: "Programme in ~/Applications",
  brew_bin: "Alle Befehle in /opt/homebrew/bin",
  usr_local_bin: "Alle Befehle in /usr/local/bin",
};
const STEP = {
  "System info": "Systeminformationen", "Applications": "Programme", "Homebrew": "Homebrew",
  "Binaries (brew bin / usr local)": "Befehlszeilen-Tools", "npm / pip / gem": "Paketmanager",
  "Editors": "Editor-Erweiterungen", "Mac App Store": "Mac App Store", "Docker": "Docker",
  "Fonts": "Schriften", "Claude Code": "Claude Code", "Updates": "Nach Updates suchen",
  "Security + autostart": "Sicherheit & Autostart", "Storage": "Speicherplatz", "Versions": "Versionen",
  "Network + extensions": "Netzwerk & Erweiterungen", "Dotfiles": "Einstellungsdateien", "App details + icons": "App-Details & Symbole",
  "Building inventory.json": "Inventar wird erstellt",
};
const stepLabel = (p) => `${t(STEP[p.label] || p.label)} · ${t("{a} von {b}", { a: p.step, b: p.total })}`;

// Texts produced by the scanner (German) → shown in the current language
const SEC_TEXT = {
  filevault: ["FileVault", "Verschlüsselt die Festplatte – bei Verlust des Macs sind die Daten geschützt."],
  firewall: ["Firewall", "Blockiert eingehende Verbindungen zu nicht freigegebenen Programmen. In fremden WLANs empfohlen."],
  sip: ["Systemintegritätsschutz (SIP)", "Schützt macOS-Systemdateien vor Veränderung. Sollte immer aktiv sein."],
  gatekeeper: ["Gatekeeper", "Prüft beim Öffnen, ob ein Programm signiert und von Apple geprüft ist."],
  screenlock: ["Passwort nach Ruhezustand", "Wie schnell nach Bildschirmschoner oder Ruhezustand das Passwort verlangt wird."],
  autoupdate: ["Automatische Updates", "Installiert macOS-Updates und Sicherheitskorrekturen automatisch."],
};
const secLabel = (c) => t(SEC_TEXT[c.id]?.[0] || c.label);
const secHint = (c) => t(SEC_TEXT[c.id]?.[1] || c.hint);
const secValue = (v) => {
  let m;
  if ((m = String(v).match(/^nach (\d+) Min\.$/))) return t("nach {n} Min.", { n: m[1] });
  if ((m = String(v).match(/^nach (\d+) s$/))) return t("nach {n} s", { n: m[1] });
  return String(v).split(" · ").map((x) => t(x)).join(" · ");
};
const installDesc = (d) => {
  if (!d) return "";
  if (d.startsWith("Homebrew Cask:")) return d;
  return t(d);
};
const displayType = (s) => String(s || "").replace(/^Integriert/, t("Integriert"));

// ── State ──────────────────────────────────────────────────────────
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const state = {
  data: null, source: "own", q: "", scanning: false, settings: null,
  sel: store.get("mi-sel", "overview"),
  view: store.get("mi-view", "list"),
};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cats = () => state.data?.categories || [];
const catById = (id) => cats().find((c) => c.id === id);
const label = (c) => t(SHORT_LABELS[c.id] || c.label);

function hl(text, q) {
  const s = esc(text);
  if (!q) return s;
  const re = new RegExp("(" + esc(q).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + ")", "ig");
  return s.replace(re, '<mark style="background:color-mix(in srgb,var(--accent) 28%,transparent);color:inherit;border-radius:3px">$1</mark>');
}
function match(it, q, cat) {
  const n = q.toLowerCase();
  const note = cat ? noteOf(cat, it) : null;
  return [it.name, it.version, it.bundle_id, it.install_cmd, it.install_desc, note?.note, ...(note?.tags || []).flatMap((x) => [x, tagLabel(x)])]
    .some((v) => v && String(v).toLowerCase().includes(n));
}
const noteKey = (cat, it) => `${cat.id}:${it.name}`;
const noteOf = (cat, it) => (state.notes || {})[noteKey(cat, it)] || null;
// Preset tags are stored in German and displayed translated
const PRESET_TAGS = ["Gekauft", "Lizenz", "Arbeit", "Privat", "Wichtig", "Kann weg"];
const tagLabel = (x) => (PRESET_TAGS.includes(x) ? t(x) : x);
function tagPills(note) {
  return (note?.tags || []).map((x) => `<span class="pill ${x === "Kann weg" ? "red" : x === "Wichtig" ? "orange" : x === "Gekauft" || x === "Lizenz" ? "green" : "blue"}">${esc(tagLabel(x))}</span>`).join("");
}
function toast(html, ms = 2200) {
  const el = $("toast");
  el.innerHTML = html; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), ms);
}
function fmtUptime(s) {
  if (!s) return "–";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return pl(d, "{n} Tag", "{n} Tage") + ", " + t("{n} Std.", { n: h });
  if (h) return t("{h} Std., {m} Min.", { h, m });
  return t("{n} Min.", { n: m });
}
function fmtDate(iso) { try { return new Date(iso).toLocaleString(LOC(), { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } }
function relTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(diff)) return "";
  if (diff < 60) return t("gerade eben");
  if (diff < 3600) return t("vor {n} Min.", { n: Math.round(diff / 60) });
  if (diff < 86400) return t("vor {n} Std.", { n: Math.round(diff / 3600) });
  return pl(Math.round(diff / 86400), "vor {n} Tag", "vor {n} Tagen");
}
function fmtBytes(b) {
  if (!b) return "";
  if (b >= 1e9) return `${(b / 1e9).toLocaleString(LOC(), { maximumFractionDigits: 1 })} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
function lastUsedText(a) {
  if (!a.last_used) return t("keine Nutzungsdaten");
  const d = daysSince(a.last_used);
  if (d < 1) return t("heute benutzt");
  if (d < 2) return t("gestern benutzt");
  if (d < 60) return t("vor {n} Tagen benutzt", { n: Math.round(d) });
  if (d < 730) return t("vor {n} Monaten benutzt", { n: Math.round(d / 30) });
  return t("vor {n} Jahren benutzt", { n: Math.round(d / 365) });
}
const ARCH = { arm64: "Apple Silicon", universal: "Universal", intel: "Nur Intel" };
const ownMode = () => state.source === "own" && !!state.data;

// ── Sidebar ────────────────────────────────────────────────────────
function navItem(id, text, count, iconKey) {
  const sel = !state.q && state.sel === id ? " sel" : "";
  return `<button class="nav-item${sel}" data-nav="${id}">
    <span class="tile" style="${tileBg(iconKey || id)}">${svg(iconKey || id)}</span>
    <span class="lbl">${esc(text)}</span>${count != null ? `<span class="cnt">${nf.format(count)}</span>` : ""}
  </button>`;
}
function renderNav() {
  const nav = $("nav");
  $("gearBtn").classList.toggle("sel", state.sel === "settings" && !state.q);
  if (!state.data) { nav.innerHTML = ""; $("sbFoot").innerHTML = ""; return; }
  const known = new Set(SECTIONS.flatMap((s) => s[1]));
  let html = navItem("overview", t("Übersicht"), null, "overview");
  if (state.source === "snapshot") {
    const cmp = compareData();
    html += navItem("compare", t("Vergleich"), cmp ? cmp.missingTotal : null, "compare");
    const ms = state.own ? migrationSteps() : null;
    html += navItem("migrate", t("Umzug"), ms ? ms.filter((x) => x.open).length || null : null, "import");
    if (Object.keys(state.notes || {}).length) html += navItem("notes", t("Notizen"), Object.keys(state.notes).length, "notes");
  } else {
    const cl = cleanupData();
    html += `<div class="nav-sec">${t("Wartung")}</div>`
      + navItem("updates", t("Updates"), state.data.updates ? state.data.updates.items.length : null, "updates")
      + navItem("cleanup", t("Aufräumen"), cl ? cl.flagged : null, "cleanup")
      + navItem("storage", t("Speicherplatz"), null, "size")
      + navItem("versions", t("Versionen"), versionsFlagged() || null, "history")
      + navItem("security", t("Sicherheit"), state.data.security ? state.data.security.checks.filter((c) => !c.ok).length || null : null, "security")
      + navItem("autostart", t("Autostart"), state.data.autostart ? state.data.autostart.length : null, "autostart")
      + navItem("history", t("Verlauf"), state.history?.length || null, "history");
    html += `<div class="nav-sec">${t("Persönlich")}</div>`
      + navItem("notes", t("Notizen"), Object.keys(state.notes || {}).length || null, "notes")
      + navItem("licenses", t("Abos & Lizenzen"), licenseEntries().length || null, "pdf")
      + navItem("dotfiles", t("Einstellungen mitnehmen"), null, "settings")
      + navItem("macs", t("Meine Macs"), state.settings?.syncEnabled ? (state.macs?.macs.length || null) : null, "macos");
  }
  for (const [title, ids] of SECTIONS) {
    const items = ids.map(catById).filter((c) => c && c.count);
    if (!items.length) continue;
    html += `<div class="nav-sec">${t(title)}</div>` + items.map((c) => navItem(c.id, label(c), c.count)).join("");
  }
  const rest = cats().filter((c) => !known.has(c.id) && c.count);
  if (rest.length) html += `<div class="nav-sec">${t("Weitere")}</div>` + rest.map((c) => navItem(c.id, label(c), c.count)).join("");
  nav.innerHTML = html;
  const s = state.data.system || {};
  $("sbFoot").innerHTML = state.source === "snapshot"
    ? `${t("Snapshot von {h}", { h: `<b>${esc(s.hostname || t("unbekannt"))}</b>` })}<br>${fmtDate(state.data.generated_at)}`
    : t("{n} Einträge · gescannt {when}", { n: `<b>${nf.format(state.data.total_count)}</b>`, when: relTime(state.data.generated_at) });
}

// ── Rows / tiles ───────────────────────────────────────────────────
function iconHtml(it, cat, big) {
  if (it.icon) return `<div class="${big ? "ticon" : "ricon"}"><img loading="lazy" src="${esc(it.icon)}" alt=""></div>`;
  return `<div class="${big ? "ticon" : "ricon"} glyph" style="${tileBg(cat.id)}">${svg(cat.id)}</div>`;
}
function actionsHtml(it, cat) {
  let a = "";
  const unsafe = state.source === "snapshot" && it.install_cmd && !/^[A-Za-z0-9@._\/+: -]+$/.test(it.install_cmd);
  if (it.install_cmd && !unsafe) a += `<button class="act" data-copy="${esc(it.install_cmd)}" title="${t("Befehl kopieren")}">${svg("copy")}</button>`;
  if (it.install_url) a += `<button class="act" data-url="${esc(it.install_url)}" title="${esc(installDesc(it.install_desc) || t("Website öffnen"))}">${svg("link")}</button>`;
  if (cat.id === "apps" && state.source === "own") a += `<button class="act" data-reveal="${esc(it.name)}" title="${t("Im Finder zeigen")}">${svg("finder")}</button>`;
  if (state.source === "own") a += `<button class="act${noteOf(cat, it) ? " has-note" : ""}" data-note="${esc(noteKey(cat, it))}" title="${t("Notiz & Tags")}">${svg("note")}</button>`;
  return a ? `<div class="ractions">${a}</div>` : "";
}
function subline(it, cat) {
  const parts = [];
  if (it.version) parts.push(esc(it.version));
  if (cat.id === "apps") {
    if (it.size_bytes) parts.push(fmtBytes(it.size_bytes));
    if (it.arch === "intel") parts.push(t("Nur Intel"));
  }
  if (cat.id === "docker_containers" && it.bundle_id) parts.push(esc(it.bundle_id));
  else if (it.install_desc && !/^Homebrew Cask:|^Websuche$|^Mac App Store$/.test(it.install_desc)) parts.push(esc(installDesc(it.install_desc)));
  return parts.join(" · ");
}
// opts.pick = { ctx, group } adds a selection checkbox (compare / migration lists)
const openKey = (cat, it) => esc(`${cat.id}|${it.name}`);
function rowHtml(it, cat, q, opts = {}) {
  const sub = subline(it, cat);
  const note = noteOf(cat, it);
  const src = it.install_cmd ? it.install_cmd.split(" ")[0] : "";
  const cmd = it.install_cmd ? `<div class="rcmd"><span class="badge ${esc(src)}">${esc(src)}</span><code>${esc(it.install_cmd)}</code></div>` : "";
  const upd = updateFor(cat, it);
  const pick = opts.pick ? pickBox(opts.pick.ctx, opts.pick.group, pickKey(cat, it), it) : "";
  return `<div class="row clickable${state.inspect?.key === `${cat.id}|${it.name}` ? " current" : ""}" data-open="${openKey(cat, it)}" title="${esc(it.bundle_id || it.name)}">
    ${pick}${iconHtml(it, cat)}
    <div class="rmain"><div class="rname">${hl(it.name, q)}${upd ? `<span class="pill blue">${t("Update")}</span>` : ""}${tagPills(note)}</div>${sub ? `<div class="rsub">${sub}</div>` : ""}${note?.note ? `<div class="rnote">${hl(note.note.split("\n")[0], q)}</div>` : ""}</div>
    ${cmd}${actionsHtml(it, cat)}
  </div>`;
}
function tileHtml(it, cat, q, opts = {}) {
  const pick = opts.pick ? pickBox(opts.pick.ctx, opts.pick.group, pickKey(cat, it), it, "tile-pick") : "";
  return `<div class="tilecard clickable" data-open="${openKey(cat, it)}" title="${esc(it.install_cmd || it.bundle_id || it.name)}">
    ${pick}${iconHtml(it, cat, true)}
    <div class="tname">${hl(it.name, q)}</div><div class="tver">${esc(it.version || "")}</div>
    ${actionsHtml(it, cat)}
  </div>`;
}
function itemsHtml(items, cat, q, opts = {}) {
  if (state.view === "grid") return `<div class="tiles">${items.map((it) => tileHtml(it, cat, q, opts)).join("")}</div>`;
  return `<div class="group">${items.map((it) => rowHtml(it, cat, q, opts)).join("")}</div>`;
}

// ── Selection: checkboxes decide what goes into generated scripts ──
// Only deviations from the default are stored, so new entries follow the default.
const PICK_DEFAULT = {
  compare: () => true,
  updates: (it) => !it.pinned,
  storage: (r) => !!r.safe,   // risky cleanups have to be ticked on purpose
};
const pickKey = (cat, it) => `${cat.id}:${it.name}`;
function pickOverrides(ctx) {
  if (!state.picks) state.picks = {};
  if (!state.picks[ctx]) {
    try { state.picks[ctx] = JSON.parse(store.get("mi-pick-" + ctx, "{}")) || {}; } catch { state.picks[ctx] = {}; }
  }
  return state.picks[ctx];
}
function isPicked(ctx, key, item) {
  const o = pickOverrides(ctx);
  return key in o ? o[key] : PICK_DEFAULT[ctx](item);
}
function setPicked(ctx, entries, on) {
  const o = pickOverrides(ctx);
  for (const { key, item } of entries) {
    if (on === PICK_DEFAULT[ctx](item)) delete o[key];
    else o[key] = on;
  }
  store.set("mi-pick-" + ctx, JSON.stringify(o));
}
// Filled while a page renders, so "All/None" knows which entries a group contains
function registerPick(ctx, group, key, item) {
  const reg = (state.pickRegistry[ctx] ||= {});
  (reg[group] ||= []).push({ key, item });
}
function pickBox(ctx, group, key, item, cls = "") {
  registerPick(ctx, group, key, item);
  return `<label class="pick ${cls}" title="${t("Für das Skript auswählen")}"><input type="checkbox" data-pick="${ctx}" data-key="${esc(key)}"${isPicked(ctx, key, item) ? " checked" : ""}></label>`;
}
function pickGroupButtons(ctx, group) {
  return `<span class="pick-all"><button data-pickall="${ctx}|${esc(group)}|1">${t("Alle")}</button><button data-pickall="${ctx}|${esc(group)}|0">${t("Keine")}</button></span>`;
}
function pickEntries(ctx, group) {
  const reg = state.pickRegistry[ctx] || {};
  return group === "*" ? Object.values(reg).flat() : reg[group] || [];
}
function pickSummary(ctx) {
  const all = pickEntries(ctx, "*");
  const n = all.filter((e) => isPicked(ctx, e.key, e.item)).length;
  return `<div class="pick-summary"><b>${t("{a} von {b} ausgewählt", { a: nf.format(n), b: nf.format(all.length) })}</b>${pickGroupButtons(ctx, "*")}</div>`;
}

// ── Detail panel ────────────────────────────────────────────────────
const UPDATE_SOURCES_FOR = { apps: ["app", "cask", "mas"], brew_formulae: ["brew"], brew_casks: ["cask"], mas: ["mas"], npm: ["npm"], pip: ["pip"], gem: ["gem"] };
function updateFor(cat, it) {
  const sources = UPDATE_SOURCES_FOR[cat.id];
  if (!sources || state.source !== "own" || !state.data?.updates) return null;
  if (!state.updateIndex || state.updateIndex.data !== state.data) {
    const map = new Map();
    for (const u of state.data.updates.items) map.set(`${u.source}:${u.name.toLowerCase()}`, u);
    state.updateIndex = { data: state.data, map };
  }
  const names = [it.name, it.cask].filter(Boolean).map((n) => n.toLowerCase());
  for (const s of sources) for (const n of names) { const u = state.updateIndex.map.get(`${s}:${n}`); if (u) return u; }
  return null;
}
function findItem(key) {
  const i = key.indexOf("|");
  const cat = catById(key.slice(0, i));
  const it = cat?.items.find((x) => x.name === key.slice(i + 1));
  return cat && it ? { cat, it } : null;
}
function inspectorHtml(cat, it) {
  const note = noteOf(cat, it), upd = updateFor(cat, it);
  const own = state.source === "own";
  const unsafeCmd = state.source === "snapshot" && it.install_cmd && !/^[A-Za-z0-9@._\/+: -]+$/.test(it.install_cmd);
  const uninstall = own && it.brew_managed && it.cask && SAFE.test(it.cask) ? `brew uninstall --cask ${it.cask}`
    : own && cat.id === "brew_formulae" && SAFE.test(it.name) ? `brew uninstall ${it.name}`
    : own && cat.id === "brew_casks" && SAFE.test(it.name) ? `brew uninstall --cask ${it.name}` : "";
  const cmdRow = (title, cmd) => `<div class="insp-cmd"><span>${title}</span><div><code>${esc(cmd)}</code>
    <button class="act" data-copy="${esc(cmd)}" title="${t("Befehl kopieren")}">${svg("copy")}</button></div></div>`;
  const facts = [
    [t("Version"), it.version],
    [t("Kategorie"), label(cat)],
    [t("Quelle"), installDesc(it.install_desc)],
    ["Bundle-ID", cat.id === "docker_containers" ? "" : it.bundle_id],
    [t("Image"), cat.id === "docker_containers" ? it.bundle_id : ""],
    [t("Größe"), fmtBytes(it.size_bytes)],
    [t("Zuletzt benutzt"), it.last_used ? `${fmtDate(it.last_used)} · ${lastUsedText(it)}` : ""],
    [t("Geöffnet"), it.use_count ? pl(it.use_count, "{n}-mal", "{n}-mal") : ""],
    [t("Architektur"), ARCH[it.arch] ? t(ARCH[it.arch]) : ""],
    [t("Signatur"), it.signer === "adhoc" ? t("ad hoc signiert") : "signer" in it && !it.signer ? t("nicht signiert") : it.signer],
    ["Homebrew", it.cask ? `${it.cask}${it.brew_managed ? "" : " · " + t("nicht über Homebrew installiert")}` : it.tap || ""],
    [t("Abhängigkeit"), "leaf" in it ? (it.leaf ? t("selbst installiert") : t("als Abhängigkeit installiert")) : ""],
  ].filter(([, v]) => v);
  return `<div class="insp-head">
      ${it.icon ? `<img src="${esc(it.icon)}" alt="">` : `<div class="ricon glyph" style="${tileBg(cat.id)}">${svg(cat.id)}</div>`}
      <div><b>${esc(it.name)}</b><span>${esc(label(cat))}${it.version ? " · " + esc(it.version) : ""}</span></div>
      <button class="act insp-close" data-do="closeinspector" title="${t("Schließen")}">✕</button>
    </div>
    ${upd ? `<div class="insp-update">${svg("updates")}<div><b>${t("Update verfügbar")}</b>
      <span>${esc(upd.current || "?")} → ${esc(upd.latest)}${upd.auto ? " · " + t("aktualisiert sich selbst") : ""}</span></div></div>` : ""}
    <div class="insp-actions">
      ${it.install_url ? `<button class="btn" data-url="${esc(it.install_url)}">${svg("link")} ${t("Website")}</button>` : ""}
      ${cat.id === "apps" && own ? `<button class="btn" data-reveal="${esc(it.name)}">${svg("finder")} Finder</button>` : ""}
      ${own ? `<button class="btn" data-note="${esc(noteKey(cat, it))}">${svg("note")} ${note ? t("Notiz bearbeiten") : t("Notiz hinzufügen")}</button>` : ""}
    </div>
    ${it.install_cmd && !unsafeCmd ? cmdRow(t("Installieren"), it.install_cmd) : ""}
    ${upd?.cmd ? cmdRow(t("Aktualisieren"), upd.cmd) : ""}
    ${uninstall ? cmdRow(t("Deinstallieren"), uninstall) : ""}
    ${note ? `<div class="insp-note">${tagPills(note)}${note.note ? `<p>${esc(note.note)}</p>` : ""}</div>` : ""}
    <div class="group insp-facts">${facts.map(([k, v]) => kv(esc(k), esc(v))).join("")}</div>`;
}
function openInspector(key) {
  const found = findItem(key);
  if (!found) return;
  state.inspect = { key };
  let el = $("inspector");
  if (!el) {
    el = document.createElement("aside");
    el.id = "inspector";
    el.className = "inspector";
    el.setAttribute("role", "dialog");
    document.body.appendChild(el);
  }
  el.innerHTML = inspectorHtml(found.cat, found.it);
  requestAnimationFrame(() => el.classList.add("open"));
  document.querySelectorAll(".row.current").forEach((r) => r.classList.remove("current"));
  document.querySelectorAll(`[data-open="${CSS.escape(key)}"]`).forEach((r) => r.classList.add("current"));
}
function closeInspector() {
  state.inspect = null;
  $("inspector")?.classList.remove("open");
  document.querySelectorAll(".row.current").forEach((r) => r.classList.remove("current"));
}
function refreshInspector() {
  if (!state.inspect) return;
  const found = findItem(state.inspect.key);
  if (found && $("inspector")) $("inspector").innerHTML = inspectorHtml(found.cat, found.it);
  else closeInspector();
}

// ── Sort & filter for category lists ───────────────────────────────
const LIST_FILTERS = {
  all: { label: "Alle", test: () => true },
  update: { label: "Mit Update", test: (it, cat) => !!updateFor(cat, it) },
  brew: { label: "Homebrew", test: (it) => /^brew /.test(it.install_cmd || "") },
  mas: { label: "App Store", test: (it) => /^mas /.test(it.install_cmd || "") },
  nosource: { label: "Ohne Paketquelle", test: (it) => !it.install_cmd },
  note: { label: "Mit Notiz", test: (it, cat) => !!noteOf(cat, it) },
  intel: { label: "Nur Intel", test: (it) => it.arch === "intel" },
  unused: { label: "Lange nicht benutzt", test: (it) => it.last_used && daysSince(it.last_used) > 180 },
};
const LIST_SORTS = {
  name: { label: "Name (A–Z)", cmp: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) },
  name_desc: { label: "Name (Z–A)", cmp: (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }) },
  size: { label: "Größe", cmp: (a, b) => (b.size_bytes || 0) - (a.size_bytes || 0), needs: (it) => it.size_bytes },
  last_used: { label: "Zuletzt benutzt", cmp: (a, b) => String(b.last_used || "").localeCompare(String(a.last_used || "")), needs: (it) => it.last_used },
  source: { label: "Quelle", cmp: (a, b) => String(a.install_cmd || "~").localeCompare(String(b.install_cmd || "~")) || a.name.localeCompare(b.name), needs: (it) => it.install_cmd },
};
function listOpts(catId) {
  let o = {};
  try { o = JSON.parse(store.get("mi-list-" + catId, "{}")) || {}; } catch {}
  return { sort: LIST_SORTS[o.sort] ? o.sort : "name", filter: LIST_FILTERS[o.filter] ? o.filter : "all", text: (state.listText || {})[catId] || "" };
}
function setListOpt(catId, key, value) {
  const o = listOpts(catId);
  o[key] = value;
  store.set("mi-list-" + catId, JSON.stringify({ sort: o.sort, filter: o.filter }));
}
function filteredItems(cat) {
  const o = listOpts(cat.id);
  const f = LIST_FILTERS[o.filter];
  let items = cat.items.filter((it) => f.test(it, cat));
  if (o.text) items = items.filter((it) => match(it, o.text, cat));
  return [...items].sort(LIST_SORTS[o.sort].cmp);
}
function listToolsHtml(cat) {
  const o = listOpts(cat.id);
  const filters = Object.entries(LIST_FILTERS)
    .map(([key, f]) => [key, f, key === "all" ? cat.items.length : cat.items.filter((it) => f.test(it, cat)).length])
    .filter(([key, , n]) => key === "all" || n > 0);
  const sorts = Object.entries(LIST_SORTS).filter(([, s]) => !s.needs || cat.items.some(s.needs));
  return `<div class="list-tools">
    <div class="list-search">${svg("finder")}<input type="search" data-listq="${cat.id}" value="${esc(o.text)}" placeholder="${t("In Liste filtern")}" spellcheck="false"></div>
    <div class="chips">${filters.length > 1 ? filters.map(([key, f, n]) =>
      `<button class="chip${o.filter === key ? " on" : ""}" data-listfilter="${cat.id}|${key}">${t(f.label)} <span>${nf.format(n)}</span></button>`).join("") : ""}</div>
    <select class="select" data-listsort="${cat.id}" title="${t("Sortieren")}">${sorts.map(([key, s]) =>
      `<option value="${key}"${o.sort === key ? " selected" : ""}>${t(s.label)}</option>`).join("")}</select>
  </div>`;
}
function listBodyHtml(cat) {
  const items = filteredItems(cat);
  const o = listOpts(cat.id);
  return items.length ? itemsHtml(items, cat, o.text)
    : `<div class="noresults"><b>${t("Keine Treffer")}</b>${t("Kein Eintrag passt zum Filter.")}</div>`;
}
const statCard = (icon, big, text, sub) => `<div class="card"><div class="ch"><span class="tile" style="${tileBg(icon)}">${svg(icon)}</span>${text}</div><div class="big">${big}</div>${sub ? `<div class="muted">${sub}</div>` : ""}</div>`;
const pageHead = (icon, title, desc, extra = "") => `<div class="cat-head"><span class="tile" style="${tileBg(icon)}">${svg(icon)}</span>
  <div style="flex:1;min-width:0"><h2>${title}</h2><p>${desc}</p></div>${extra}</div>`;
const oldScan = (title) => `<div class="noresults"><b>${title}</b>${t("Dieser Scan stammt von einer älteren Version.")}<br><br>
  <button class="btn primary" data-do="scan">${svg("scan")} ${t("Neu scannen")}</button></div>`;

// ── Pages ──────────────────────────────────────────────────────────
function pageEmpty() {
  return `<div class="center"><div class="empty">
    <div class="glyph">${svg("overview")}</div>
    <h2>${t("Willkommen bei MacAtlas")}</h2>
    <p>${t("Erfasse alle Programme, Homebrew-Pakete, Entwickler-Tools, Schriften und die Hardware dieses Macs — mit Installationsbefehl für jedes Programm. Oder öffne einen Snapshot von einem anderen Mac.")}</p>
    <div class="btns">
      <button class="btn primary" data-do="scan">${svg("scan")} ${t("Mac scannen")}</button>
      <button class="btn" data-do="import">${svg("import")} ${t("Snapshot öffnen …")}</button>
    </div>
  </div></div>`;
}
function pageScanning(p) {
  const pct = p && p.total ? Math.round((p.step / p.total) * 100) : 4;
  const step = p && p.label ? stepLabel(p) : t("Wird vorbereitet …");
  return `<div class="center"><div class="empty">
    <div class="spin"></div>
    <h2>${t("Mac wird gescannt …")}</h2>
    <p style="margin-bottom:0">${t("Das dauert je nach Anzahl der Programme 10–40 Sekunden.")}</p>
    <div class="progress"><span id="progBar" style="width:${pct}%"></span></div>
    <div class="step" id="progStep">${esc(step)}</div>
    <div class="btns" style="margin-top:18px"><button class="btn" data-do="cancelscan">${t("Abbrechen")}</button></div>
  </div></div>`;
}
function kv(k, v) { return v ? `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>` : ""; }
function pageOverview() {
  const s = state.data.system || {};
  const marketing = s.marketing_name || "";
  const m = marketing.match(/^(.*?)\s*\((.*)\)\s*$/);
  const title = (m ? m[1] : marketing) || s.model_name || "Mac";
  const subtitle = m ? m[2] : (s.model_id && s.model_id !== title ? s.model_id : "");
  const os = [s.os_name || "macOS", s.os_marketing, s.os_version].filter(Boolean).join(" ") + (s.os_build ? ` (${s.os_build})` : "");
  const ram = s.ram_gb ? `${s.ram_gb} GB${s.memory_type ? " " + esc(s.memory_type) : ""}` : "";
  let cores = "";
  if (s.cpu_cores) cores = `${s.cpu_cores} CPU` + (s.perf_cores && s.eff_cores ? ` (${s.perf_cores}P + ${s.eff_cores}E)` : "");
  if (s.gpu_cores) cores += `${cores ? " · " : ""}${s.gpu_cores} GPU`;

  const cards = [];
  const st = s.storage;
  if (st && st.total_gb) {
    const pct = Math.round((st.used_gb / st.total_gb) * 100);
    cards.push(`<div class="card"><div class="ch"><span class="tile" style="${tileBg("disk")}">${svg("disk")}</span>${esc(st.name || t("Festplatte"))}</div>
      <div class="big">${nf.format(st.free_gb)} GB <span class="muted" style="font-size:13px;font-weight:500">${t("verfügbar")}</span></div>
      <div class="bar ${pct > 90 ? "crit" : pct > 80 ? "warn" : ""}"><span style="width:${pct}%"></span></div>
      <div class="muted">${t("{u} GB von {t} GB belegt", { u: nf.format(st.used_gb), t: nf.format(st.total_gb) })}${st.device ? " · " + esc(st.device) : ""}</div></div>`);
  }
  if (s.ram_gb) {
    cards.push(`<div class="card"><div class="ch"><span class="tile" style="${tileBg("memory")}">${svg("memory")}</span>${t("Arbeitsspeicher")}</div>
      <div class="big">${s.ram_gb} GB</div><div class="muted">${esc([s.memory_type, s.memory_vendor].filter(Boolean).join(" · ") || "Unified Memory")}</div></div>`);
  }
  const b = s.battery;
  if (b) {
    const cap = parseInt(b.max_capacity) || null;
    const health = t({ Good: "Normal", Fair: "Ausreichend", Poor: "Schwach", "Service Recommended": "Service empfohlen" }[b.health] || b.health || "");
    cards.push(`<div class="card"><div class="ch"><span class="tile" style="${tileBg("battery")}">${svg("battery")}</span>${t("Batterie")}</div>
      <div class="big">${cap != null ? cap + " %" : "–"} <span class="muted" style="font-size:13px;font-weight:500">${t("max. Kapazität")}</span></div>
      ${cap != null ? `<div class="bar ${cap < 80 ? "warn" : ""}"><span style="width:${cap}%"></span></div>` : ""}
      <div class="muted">${esc(health)}${b.cycles != null ? " · " + t("{n} Ladezyklen", { n: nf.format(b.cycles) }) : ""}${b.charge != null ? " · " + t("{n} % geladen", { n: b.charge }) + (b.charging ? " " + t("(lädt)") : "") : ""}</div></div>`);
  }
  for (const d of s.displays || []) {
    const res = (d.resolution || "").replace(/\s*@\s*/, " · ").replace(/\.00Hz/, " Hz").replace(/ x /, " × ");
    cards.push(`<div class="card"><div class="ch"><span class="tile" style="${tileBg("display")}">${svg("display")}</span>${esc(d.name === "Color LCD" ? t("Integriertes Display") : d.name)}</div>
      <div class="big" style="font-size:17px">${esc(res || "–")}</div><div class="muted">${esc([displayType(d.type), d.main ? t("Hauptdisplay") : ""].filter(Boolean).join(" · "))}</div></div>`);
  }
  if (s.uptime_seconds) {
    cards.push(`<div class="card"><div class="ch"><span class="tile" style="${tileBg("clock")}">${svg("clock")}</span>${t("Betriebszeit")}</div>
      <div class="big" style="font-size:17px">${fmtUptime(s.uptime_seconds)}</div><div class="muted">${t("Gestartet {d}", { d: esc(fmtDate(s.boot_time_iso)) })}</div></div>`);
  }

  const catCards = cats().filter((c) => c.count).map((c) => `<button class="cat-card" data-nav="${c.id}">
    <span class="tile" style="${tileBg(c.id)}">${svg(c.id)}</span>
    <span class="t"><div>${esc(label(c))}</div><div>${nf.format(c.count)}</div></span></button>`).join("");

  return `<div class="page">
    <div class="hero">
      ${s.device_image ? `<img src="${esc(s.device_image)}" alt="">` : `<div class="ph">${svg("overview")}</div>`}
      <h2>${esc(title)}</h2><div class="sub">${esc(subtitle)}</div>
    </div>
    <div class="group">
      ${kv("Chip", esc(s.chip || s.cpu || ""))}
      ${kv(t("Arbeitsspeicher"), ram)}
      ${kv(t("Kerne"), esc(cores))}
      ${kv(t("Seriennummer"), esc(s.serial || ""))}
      ${kv("macOS", esc(os))}
    </div>
    <div class="group-title">Hardware</div>
    <div class="ov-grid">${cards.join("")}</div>
    ${maintenanceCards()}
    <div class="group-title">Software</div>
    <div class="cat-grid">${catCards}</div>
    <div class="group-title">Details</div>
    <div class="group">
      ${kv(t("Gerätename"), esc(s.hostname || ""))}
      ${kv(t("Modell-ID"), esc([s.model_id, s.model_number].filter(Boolean).join(" · ")))}
      ${kv(t("Architektur"), esc(s.arch || ""))}
      ${kv(t("Benutzer"), esc(s.user || ""))}
      ${kv("Shell", esc(s.shell || ""))}
      ${kv(t("Zeitzone"), esc(s.timezone || ""))}
      ${kv(t("Gescannt"), esc(fmtDate(state.data.generated_at)))}
    </div>
    <div class="btns" style="margin-top:22px">
      <button class="btn" data-do="report">${svg("pdf")} ${t("Bericht als PDF …")}</button>
      <button class="btn" data-do="brewfile">${svg("brewfile")} Brewfile …</button>
      <button class="btn" data-do="csv">${svg("script")} ${t("CSV für Excel …")}</button>
    </div>
  </div>`;
}
const BREWFILE_CATS = new Set(["brew_formulae", "brew_casks", "mas", "vscode"]);
function pageCategory(cat) {
  const bf = BREWFILE_CATS.has(cat.id) ? `<button class="btn" data-do="brewfile" title="${t("Homebrew, App Store und VS Code als Brewfile für brew bundle")}">${svg("brewfile")} Brewfile</button>` : "";
  return `<div class="page">
    ${pageHead(cat.id, esc(label(cat)), esc(t(DESC[cat.id] || cat.description || "")), bf)}
    ${cat.items.length ? `${listToolsHtml(cat)}<div id="listBody">${listBodyHtml(cat)}</div>` : `<div class="noresults"><b>${t("Keine Einträge")}</b>${t("In dieser Kategorie wurde nichts gefunden.")}</div>`}
  </div>`;
}
function pageSearch(q) {
  let total = 0;
  const blocks = cats().map((c) => {
    const items = c.items.filter((it) => match(it, q, c));
    total += items.length;
    if (!items.length) return "";
    return `<div class="group-title">${svg(c.id, "i")} ${esc(label(c))}<span class="n">${items.length}</span></div>${itemsHtml(items, c, q)}`;
  }).join("");
  setTitle(t("Suche"), total ? pl(total, "{n} Treffer für „{q}\"", "{n} Treffer für „{q}\"", { q }) : t("Keine Treffer für „{q}\"", { q }));
  return `<div class="page" style="padding-top:2px">${blocks || `<div class="noresults"><b>${t("Keine Treffer")}</b>${t("Für „{q}\" wurde nichts gefunden.", { q: esc(q) })}</div>`}</div>`;
}

// ── Compare snapshot ↔ this Mac ────────────────────────────────────
const COMPARE_CATS = ["apps", "mas", "brew_casks", "brew_formulae", "npm", "pip", "gem", "vscode", "docker_images"];
const PIP_BASE = new Set(["pip", "setuptools", "wheel"]);
const SAFE = /^[A-Za-z0-9@._\/+:-]+$/;   // imported files are untrusted: only plain package tokens go into the script

function compareData() {
  if (!state.own || !state.data) return null;
  const ownCat = (id) => state.own.categories.find((c) => c.id === id);
  const res = [];
  let missingTotal = 0, onlyHere = 0, common = 0;
  for (const id of COMPARE_CATS) {
    const theirs = catById(id);
    if (!theirs) continue;
    const mine = ownCat(id)?.items || [];
    const mineKeys = new Set(mine.map((it) => it.name.toLowerCase()));
    const theirKeys = new Set(theirs.items.map((it) => it.name.toLowerCase()));
    const relevant = theirs.items.filter((it) => !(id === "pip" && PIP_BASE.has(it.name.toLowerCase())));
    let missing = relevant.filter((it) => !mineKeys.has(it.name.toLowerCase()));
    let deps = 0;
    if (id === "brew_formulae" && missing.some((it) => "leaf" in it)) {
      deps = missing.filter((it) => !it.leaf).length;
      missing = missing.filter((it) => it.leaf);
    }
    const extra = mine.filter((it) => !theirKeys.has(it.name.toLowerCase()));
    common += relevant.length - missing.length - deps;
    missingTotal += missing.length;
    onlyHere += extra.length;
    res.push({ cat: theirs, missing, deps, extra });
  }
  return { res, missingTotal, onlyHere, common };
}

function buildScript(cmp, only) {
  const want = (k) => !only || only.has(k);
  const s = state.data.system || {}, me = state.own?.system || {};
  const g = { formulae: new Set(), casks: new Set(), mas: new Map(), npm: new Set(), pip: new Set(), gem: new Set(), code: new Set(), docker: new Set() };
  const manual = [];
  for (const { cat, missing } of cmp.res) {
    for (const it of missing) {
      if (!isPicked("compare", pickKey(cat, it), it)) continue;
      const c = it.install_cmd || "";
      let m;
      if ((m = c.match(/^brew install --cask (\S+)$/))) g.casks.add(m[1]);
      else if ((m = c.match(/^brew install (\S+)$/))) g.formulae.add(m[1]);
      else if ((m = c.match(/^mas install (\d+)$/))) g.mas.set(m[1], it.name);
      else if ((m = c.match(/^npm install -g (\S+)$/))) g.npm.add(m[1]);
      else if ((m = c.match(/^pip3 install (\S+)$/))) g.pip.add(m[1]);
      else if ((m = c.match(/^gem install (\S+)$/))) g.gem.add(m[1]);
      else if ((m = c.match(/^code --install-extension (\S+)$/))) g.code.add(m[1]);
      else if ((m = c.match(/^docker pull (\S+)$/))) g.docker.add(m[1]);
      else if (cat.id === "apps") manual.push(it);
    }
  }
  const safe = (set) => [...set].filter((x) => SAFE.test(x)).sort();
  // Translated text inside the script stays free of quotes/backticks/$ by construction
  const block = (title, cmd, items) => items.length
    ? `\necho "==> ${t(title)} (${items.length})"\n${cmd} \\\n  ${items.join(" \\\n  ")}\n` : "";
  const oneEach = (title, prefix, items) => items.length
    ? `\necho "==> ${t(title)} (${items.length})"\n${items.map((x) => `${prefix} ${x}`).join("\n")}\n` : "";
  const clean = (v) => String(v || "").replace(/[\r\n]/g, " ");

  const formulae = safe(g.formulae), casks = safe(g.casks);
  const mas = [...g.mas].filter(([id]) => /^\d+$/.test(id));
  let out = `#!/usr/bin/env bash
# MacAtlas – ${t("Installationsskript")}
# ${t("Quelle:")}   ${clean(s.hostname)} (${clean(s.marketing_name || s.model_name)}), ${t("Snapshot vom {d}", { d: clean(fmtDate(state.data.generated_at)) })}
# ${t("Ziel:")}     ${clean(me.hostname || t("dieser Mac"))}
# ${t("Erstellt:")} ${clean(fmtDate(new Date().toISOString()))}
#
# ${t("Bitte vor dem Ausführen prüfen und nicht Gewünschtes entfernen.")}
# ${t("Einzelne Fehler brechen das Skript nicht ab.")}
set -u
`;
  if ((want("brew") && (formulae.length || casks.length)) || (want("mas") && mas.length)) {
    out += `
if ! command -v brew >/dev/null 2>&1; then
  echo "${t("Homebrew fehlt. Bitte zuerst installieren: https://brew.sh")}"
  exit 1
fi
`;
  }
  if (want("brew")) out += block("Homebrew-Formeln", "brew install", formulae);
  if (want("brew")) out += block("Homebrew-Casks", "brew install --cask", casks);
  if (mas.length && want("mas")) {
    out += `\necho "==> Mac App Store (${mas.length}) – ${t("Anmeldung im App Store nötig")}"\ncommand -v mas >/dev/null 2>&1 || brew install mas\n`;
    out += mas.map(([id, name]) => `mas install ${id}   # ${clean(name).replace(/#/g, "")}`).join("\n") + "\n";
  }
  if (want("dev")) out += block("npm (global)", "npm install -g", safe(g.npm));
  if (want("dev")) out += block("Python-Pakete", "pip3 install", safe(g.pip));
  if (want("dev")) out += block("Ruby Gems", "gem install", safe(g.gem));
  if (want("code")) out += oneEach("VS-Code-Erweiterungen", "code --install-extension", safe(g.code));
  const docker = only ? [] : safe(g.docker);
  if (docker.length) out += `\n# ${t("Docker-Images: nur öffentliche Images lassen sich laden – bei Bedarf einkommentieren")}\n${docker.map((x) => `# docker pull ${x}`).join("\n")}\n`;
  if (manual.length && !only) out += `\n# ${t("Manuell zu installieren (keine Paketquelle gefunden):")}\n${manual.map((it) => `#   ${clean(it.name)}${it.install_url ? "  →  " + clean(it.install_url) : ""}`).join("\n")}\n`;
  out += `\necho "${t("Fertig.")}"\n`;
  return out;
}

function pageCompare() {
  const s = state.data.system || {};
  const host = esc(s.hostname || t("dem anderen Mac"));
  const head = pageHead("compare", t("Vergleich mit diesem Mac"), t("Was auf {h} installiert ist und hier fehlt", { h: `<b>${host}</b>` }));
  if (!state.own) {
    return `<div class="page">${head}<div class="group"><div class="kv"><span class="k">${t("Dieser Mac wurde noch nicht gescannt.")}</span>
      <button class="btn primary" data-do="scan">${svg("scan")} ${t("Diesen Mac scannen")}</button></div></div></div>`;
  }
  const cmp = compareData();
  // lists first: rendering them registers the checkboxes the summary counts
  const lists = cmp.res.filter((r) => r.missing.length).map(({ cat, missing, deps }) =>
    `<div class="group-title">${svg(cat.id, "i")} ${esc(label(cat))}<span class="n">${t("{n} fehlen", { n: missing.length })}${deps ? " · " + t("+{n} Abhängigkeiten kommen automatisch mit", { n: deps }) : ""}</span>${pickGroupButtons("compare", cat.id)}</div>${itemsHtml(missing, cat, "", { pick: { ctx: "compare", group: cat.id } })}`
  ).join("");
  const scriptLines = buildScript(cmp);
  state.script = scriptLines;

  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard("minus", nf.format(cmp.missingTotal), t("Fehlt auf diesem Mac"))}
      ${statCard("plus", nf.format(cmp.onlyHere), t("Nur auf diesem Mac"))}
      ${statCard("equal", nf.format(cmp.common), t("Auf beiden Macs"))}
    </div>
    ${cmp.missingTotal ? `<div class="card script-card">
      <div class="ch"><span class="tile" style="${tileBg("script")}">${svg("script")}</span>${t("Installationsskript")}</div>
      <div class="muted">${t("Installiert die ausgewählten Einträge per Homebrew, App Store, npm, pip, gem und VS Code. Häkchen entfernen, was du nicht brauchst.")}</div>
      ${pickSummary("compare")}
      <div class="btns" style="justify-content:flex-start;margin-top:6px">
        <button class="btn primary" data-do="savescript">${svg("script")} ${t("Skript sichern …")}</button>
        <button class="btn" data-do="copyscript">${svg("copy")} ${t("Kopieren")}</button>
        <button class="btn" data-do="brewfile" title="${t("Kompletter Homebrew-/App-Store-/VS-Code-Stand des anderen Macs für brew bundle")}">${svg("brewfile")} ${t("Als Brewfile …")}</button>
      </div>
      <details><summary>${t("Vorschau")}</summary><pre>${esc(scriptLines)}</pre></details>
    </div>` : `<div class="noresults"><b>${t("Nichts fehlt")}</b>${t("Alles von {h} ist auch auf diesem Mac installiert.", { h: host })}</div>`}
    ${lists}
  </div>`;
}

// ── Maintenance: updates, cleanup, security, autostart, history ────
function maintenanceCards() {
  if (!ownMode()) return "";
  const u = state.data.updates, cl = cleanupData(), h = state.history || [], sec = state.data.security;
  const card = (id, title, text) => `<button class="cat-card" data-nav="${id}">
    <span class="tile" style="${tileBg(id)}">${svg(id)}</span><span class="t"><div>${title}</div><div>${text}</div></span></button>`;
  const bad = sec ? sec.checks.filter((c) => !c.ok).length : 0;
  return `<div class="group-title">${t("Wartung")}</div><div class="cat-grid">
    ${card("updates", t("Updates"), u ? (u.items.length ? t("{n} verfügbar", { n: nf.format(u.items.length) }) : t("Alles aktuell")) : t("Noch nicht geprüft"))}
    ${card("cleanup", t("Aufräumen"), cl ? `${pl(cl.flagged, "{n} Hinweis", "{n} Hinweise")} · ${fmtBytes(cl.total)}` : t("Neu scannen"))}
    ${(() => { const r = storageRows(); if (!r) return ""; const b = r.filter((x) => x.safe && x.bytes).reduce((a, x) => a + x.bytes, 0); return card("size", t("Speicherplatz"), b ? t("{s} sicher freigebbar", { s: fmtBytes(b) }) : t("Nichts aufzuräumen")); })()}
    ${state.data.versions ? card("history", t("Versionen"), versionsFlagged() ? pl(versionsFlagged(), "{n} Hinweis", "{n} Hinweise") : t("Nichts doppelt")) : ""}
    ${card("security", t("Sicherheit"), sec ? (bad ? pl(bad, "{n} Hinweis", "{n} Hinweise") : t("Alles in Ordnung")) : t("Neu scannen"))}
    ${card("autostart", t("Autostart"), state.data.autostart ? t("{n} Hintergrunddienste", { n: nf.format(state.data.autostart.length) }) : t("Neu scannen"))}
    ${card("history", t("Verlauf"), h.length ? pl(h.length, "{n} Scan", "{n} Scans") : "–")}
  </div>`;
}

const UPD_SOURCES = [
  ["macos", "macOS & Apple-Software", "macos"], ["brew", "Homebrew-Formeln", "brew_formulae"], ["cask", "Homebrew-Casks", "brew_casks"],
  ["mas", "Mac App Store", "mas"], ["app", "Programme", "apps"], ["npm", "npm (global)", "npm"],
  ["pip", "Python-Pakete", "pip"], ["gem", "Ruby Gems", "gem"],
];

function updateScript(items) {
  const pick = (src, re) => items.filter((i) => i.source === src && isPicked("updates", `${i.source}:${i.name}`, i))
    .map((i) => (i.cmd || "").match(re)?.[1]).filter((x) => x && SAFE.test(x));
  const brew = pick("brew", /^brew upgrade (\S+)$/), casks = pick("cask", /^brew upgrade --cask (\S+)$/);
  const mas = pick("mas", /^mas upgrade (\d+)$/), npm = pick("npm", /^npm install -g (\S+)$/);
  const pip = pick("pip", /^pip3 install -U (\S+)$/), gem = pick("gem", /^gem update (\S+)$/);
  const block = (title, cmd, list) => list.length
    ? `\necho "==> ${t(title)} (${list.length})"\n${cmd} \\\n  ${list.join(" \\\n  ")}\n` : "";
  let out = `#!/usr/bin/env bash
# MacAtlas – Updates
# ${t("Erstellt:")} ${fmtDate(new Date().toISOString())}
# ${t("Einzelne Fehler brechen das Skript nicht ab.")}
set -u
`;
  out += block("Homebrew-Formeln", "brew upgrade", brew);
  out += block("Homebrew-Casks", "brew upgrade --cask", casks);
  if (mas.length) out += `\necho "==> Mac App Store (${mas.length})"\nmas upgrade ${mas.join(" ")}\n`;
  out += block("npm (global)", "npm install -g", npm);
  out += block("Python-Pakete", "pip3 install -U", pip);
  out += block("Ruby Gems", "gem update", gem);
  out += `\necho ""\necho "${t("Fertig. Danach in MacAtlas neu scannen (⌘R).")}"\n`;
  return { text: out, count: brew.length + casks.length + mas.length + npm.length + pip.length + gem.length };
}

function updateRow(it, catId, pickable) {
  const box = pickable && it.cmd ? pickBox("updates", it.source, `${it.source}:${it.name}`, it) : pickable ? `<span class="pick pick-none"></span>` : "";
  const icon = it.icon ? `<div class="ricon"><img loading="lazy" src="${esc(it.icon)}" alt=""></div>`
    : `<div class="ricon glyph" style="${tileBg(catId)}">${svg(catId)}</div>`;
  const pills = (it.dep ? `<span class="pill">${t("Abhängigkeit")}</span>` : "")
    + (it.pinned ? `<span class="pill orange">${t("fixiert")}</span>` : "")
    + (it.auto ? `<span class="pill blue">${t("aktualisiert sich selbst")}</span>` : "");
  const cmd = it.cmd ? `<div class="rcmd"><code>${esc(it.cmd)}</code></div>` : "";
  let a = "";
  if (it.cmd && SAFE.test(it.cmd.split(" ").pop())) a += `<button class="act" data-copy="${esc(it.cmd)}" title="${t("Befehl kopieren")}">${svg("copy")}</button>`;
  if (it.source === "macos") a += `<button class="act" data-settings="com.apple.Software-Update-Settings.extension" title="${t("Softwareupdate öffnen")}">${svg("gear")}</button>`;
  else if (it.url) a += `<button class="act" data-url="${esc(it.url)}" title="${t("Website öffnen")}">${svg("link")}</button>`;
  const ver = it.current ? `${esc(it.current)}<span class="ver-arrow">→</span><span class="ver-new">${esc(it.latest)}</span>`
    : t("{v} verfügbar", { v: `<span class="ver-new">${t("Version {v}", { v: esc(it.latest) })}</span>` });
  return `<div class="row">
    ${box}${icon}
    <div class="rmain"><div class="rname">${esc(it.name)}${pills}</div>
      <div class="rsub">${ver}</div></div>
    ${cmd}${a ? `<div class="ractions">${a}</div>` : ""}
  </div>`;
}

function pageUpdates() {
  const u = state.data.updates;
  const head = pageHead("updates", t("Updates"), u ? t("Geprüft {when} · Homebrew, App Store, npm, pip, Gems und Programme", { when: esc(relTime(u.checked_at)) }) : t("Veraltete Programme und Pakete"));
  if (!u) return `<div class="page">${head}${oldScan(t("Noch nicht geprüft"))}</div>`;
  if (!u.items.length) {
    return `<div class="page">${head}<div class="noresults"><b>${t("Alles aktuell")}</b>${t("Es wurden keine Updates gefunden.")}</div></div>`;
  }
  const manual = u.items.filter((i) => !i.cmd).length;
  const groups = UPD_SOURCES.map(([src, title, catId]) => {
    const list = u.items.filter((i) => i.source === src);
    if (!list.length) return "";
    const hint = src === "macos" ? `<div class="hint">${t("Installation über Systemeinstellungen → Allgemein → Softwareupdate.")}</div>`
      : src === "app" ? `<div class="hint">${t("Nicht über Homebrew installiert – Version laut Homebrew-Katalog. Update in der App selbst (meist im Menü „Nach Updates suchen\") oder von der Website.")}</div>`
      : src === "brew" && list.some((i) => i.dep) ? `<div class="hint">${t("„Abhängigkeit\" = wurde automatisch mitinstalliert.")}</div>` : "";
    const scriptable = list.some((i) => i.cmd);
    return `<div class="group-title">${svg(catId, "i")} ${t(title)}<span class="n">${list.length}</span>${scriptable ? pickGroupButtons("updates", src) : ""}</div>${hint}<div class="group">${list.map((i) => updateRow(i, catId, scriptable)).join("")}</div>`;
  }).join("");
  const scr = updateScript(u.items);
  state.updateScript = scr.text;
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard("updates", nf.format(u.items.length), t("Updates verfügbar"))}
      ${statCard("terminal", nf.format(scr.count), t("Per Skript aktualisierbar"))}
      ${statCard("apps", nf.format(manual), t("Manuell zu aktualisieren"))}
    </div>
    ${u.items.some((i) => i.cmd) ? `<div class="card script-card">
      <div class="ch"><span class="tile" style="${tileBg("terminal")}">${svg("terminal")}</span>${t("Ausgewählte aktualisieren")}</div>
      <div class="muted">${t("Aktualisiert die ausgewählten Pakete per Homebrew, App Store, npm, pip und gem in einem Terminal-Fenster.")}</div>
      ${pickSummary("updates")}
      <div class="btns" style="justify-content:flex-start;margin-top:6px">
        <button class="btn primary" data-do="runupdates"${scr.count ? "" : " disabled"}>${svg("terminal")} ${t("Im Terminal ausführen")}</button>
        <button class="btn" data-do="saveupdates"${scr.count ? "" : " disabled"}>${svg("script")} ${t("Skript sichern …")}</button>
        <button class="btn" data-do="copyupdates">${svg("copy")} ${t("Kopieren")}</button>
      </div>
      <details><summary>${t("Vorschau")}</summary><pre>${esc(scr.text)}</pre></details>
    </div>` : ""}
    ${groups}
  </div>`;
}

function cleanupData() {
  const apps = catById("apps")?.items || [];
  if (!apps.some((a) => "size_bytes" in a || "arch" in a)) return null;
  const total = apps.reduce((s, a) => s + (a.size_bytes || 0), 0);
  const intel = apps.filter((a) => a.arch === "intel");
  const unused = apps.filter((a) => a.last_used && daysSince(a.last_used) > 180 && a.bundle_id !== "com.apple.Safari")
    .sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0));
  const unsigned = apps.filter((a) => "signer" in a && (!a.signer || a.signer === "adhoc"));
  const largest = [...apps].filter((a) => a.size_bytes).sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 15);
  const flagged = new Set([...intel, ...unused].map((a) => a.name)).size;
  return { apps, total, intel, unused, unsigned, largest, flagged, unusedBytes: unused.reduce((s, a) => s + (a.size_bytes || 0), 0) };
}

function cleanupRow(a, max) {
  const cat = catById("apps");
  const sub = [a.version, max ? "" : fmtBytes(a.size_bytes), lastUsedText(a), ARCH[a.arch] ? t(ARCH[a.arch]) : ""].filter(Boolean).map(esc).join(" · ");
  const sig = a.signer === "adhoc" ? t("ad hoc signiert") : "signer" in a && !a.signer ? t("nicht signiert") : "";
  let acts = `<button class="act" data-reveal="${esc(a.name)}" title="${t("Im Finder zeigen")}">${svg("finder")}</button>`;
  const un = a.brew_managed && a.cask && SAFE.test(a.cask) ? `brew uninstall --cask ${a.cask}` : "";
  if (un) acts += `<button class="act" data-copy="${esc(un)}" title="${t("Deinstallationsbefehl kopieren")}">${svg("copy")}</button>`;
  if (a.install_url) acts += `<button class="act" data-url="${esc(a.install_url)}" title="${t("Website öffnen")}">${svg("link")}</button>`;
  const bar = max ? `<div class="sizebar">${fmtBytes(a.size_bytes)}<div class="bar"><span style="width:${Math.max(2, Math.round((a.size_bytes / max) * 100))}%"></span></div></div>` : "";
  return `<div class="row" title="${esc(a.bundle_id || a.name)}">
    ${iconHtml(a, cat)}
    <div class="rmain"><div class="rname">${esc(a.name)}${a.arch === "intel" ? `<span class="pill red">Intel</span>` : ""}${sig ? `<span class="pill orange">${sig}</span>` : ""}</div><div class="rsub">${sub}</div></div>
    ${bar}<div class="ractions">${acts}</div>
  </div>`;
}

function pageCleanup() {
  const head = pageHead("cleanup", t("Aufräumen"), t("Programme in /Applications nach Größe, Nutzung und Architektur"));
  const cl = cleanupData();
  if (!cl) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const section = (icon, title, hint, list, withBar) => list.length
    ? `<div class="group-title">${svg(icon, "i")} ${title}<span class="n">${list.length}</span></div>${hint ? `<div class="hint">${hint}</div>` : ""}
       <div class="group">${list.map((a) => cleanupRow(a, withBar ? cl.largest[0].size_bytes : 0)).join("")}</div>` : "";
  const noData = cl.apps.filter((a) => !a.last_used).length;
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard("size", fmtBytes(cl.total), t("Programme gesamt"), t("{n} Programme in /Applications", { n: nf.format(cl.apps.length) }))}
      ${statCard("clock", nf.format(cl.unused.length), t("Über 6 Monate unbenutzt"), cl.unused.length ? t("{s} freizugeben", { s: fmtBytes(cl.unusedBytes) }) : t("Alles in Gebrauch"))}
      ${statCard("intel", nf.format(cl.intel.length), t("Nur für Intel"), cl.intel.length ? t("Laufen über Rosetta") : t("Alles läuft nativ"))}
    </div>
    ${section("intel", t("Nur für Intel"), t("Diese Programme laufen auf Apple Silicon nur über die Übersetzungsschicht Rosetta 2 – langsamer, und Apple baut die Unterstützung schrittweise ab. Suche nach einer neueren Version oder einer Alternative."), cl.intel)}
    ${section("clock", t("Über 6 Monate nicht benutzt"), t("Nach Größe sortiert. Zum Entfernen im Finder in den Papierkorb ziehen; Homebrew-Programme besser mit dem kopierten Befehl deinstallieren."), cl.unused)}
    ${section("size", t("Größte Programme"), "", cl.largest, true)}
    ${section("shield", t("Ohne Entwickler-Signatur"), t("Kein Developer-ID- oder App-Store-Zertifikat. Das ist bei Open-Source-Tools häufig, sollte aber eine bekannte Quelle haben."), cl.unsigned)}
    ${noData ? `<div class="foot-note">${pl(noData, "Für {n} Programm liefert Spotlight keine Nutzungsdaten – es ist oben nicht berücksichtigt.", "Für {n} Programme liefert Spotlight keine Nutzungsdaten – sie sind oben nicht berücksichtigt.")}</div>` : ""}
  </div>`;
}

function pageSecurity() {
  const sec = state.data.security;
  const head = pageHead("security", t("Sicherheit"), t("Schutzfunktionen von macOS auf diesem Mac"));
  if (!sec) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const ok = sec.checks.filter((c) => c.ok).length;
  const rows = sec.checks.map((c) => `<div class="row">
    <div class="ricon glyph" style="${tileBg(c.ok ? "security" : "warn")}">${svg(c.ok ? "check" : "warn")}</div>
    <div class="rmain"><div class="rname">${esc(secLabel(c))}</div><div class="rsub" style="white-space:normal">${esc(secHint(c))}</div></div>
    <span class="pill ${c.ok ? "green" : "orange"}" style="margin:0">${esc(secValue(c.value))}</span>
    ${c.settings ? `<div class="ractions" style="opacity:1"><button class="act" data-settings="${esc(c.settings)}" title="${t("In den Systemeinstellungen öffnen")}">${svg("gear")}</button></div>` : ""}
  </div>`).join("");
  const pend = sec.pending_updates || [];
  const all = ok === sec.checks.length;
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard(all ? "security" : "warn", t("{a} von {b}", { a: ok, b: sec.checks.length }), "Status", all ? t("Alle Schutzfunktionen aktiv") : t("Schutzfunktionen aktiv – Hinweise unten"))}
      ${statCard("macos", pend.length ? nf.format(pend.length) : t("Aktuell"), t("Systemupdates"), pend.length ? esc(pend.map((p) => p.name).join(", ")) : t("Keine ausstehenden Apple-Updates"))}
    </div>
    <div class="group-title">${t("Schutzfunktionen")}</div>
    <div class="group">${rows}</div>
    ${pend.length ? `<div class="group-title">${svg("macos", "i")} ${t("Ausstehende Apple-Updates")}<span class="n">${pend.length}</span></div>
      <div class="group">${pend.map((p) => updateRow({ source: "macos", name: p.name, latest: p.version }, "macos")).join("")}</div>` : ""}
    ${networkSections()}
    <div class="foot-note">${t("Nur Anzeige – MacAtlas ändert keine Einstellungen.")}${sec.last_check ? " " + t("Letzte Prüfung durch Softwareupdate: {d}", { d: esc(fmtDate(sec.last_check.replace(" +0000", "Z").replace(" ", "T"))) }) : ""}</div>
  </div>`;
}

const SCOPE = {
  user: ["Für deinen Benutzer", "~/Library/LaunchAgents – starten bei deiner Anmeldung"],
  agent: ["Für alle Benutzer", "/Library/LaunchAgents – starten bei jeder Anmeldung"],
  daemon: ["System-Dienste", "/Library/LaunchDaemons – laufen im Hintergrund, auch ohne Anmeldung"],
};
function pageAutostart() {
  const list = state.data.autostart;
  const head = pageHead("autostart", t("Autostart"), t("Hintergrunddienste, die macOS automatisch startet"));
  if (!list) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const appIcon = (vendor) => (catById("apps")?.items || []).find((a) => vendor && a.name.toLowerCase().startsWith(vendor.toLowerCase()) && a.icon)?.icon;
  const row = (it) => {
    const icon = appIcon(it.vendor);
    const pills = (it.running ? `<span class="pill green">${t("läuft")}</span>` : "")
      + (it.updater ? `<span class="pill blue">Updater</span>` : "")
      + (it.keep_alive ? `<span class="pill">${t("dauerhaft")}</span>` : "")
      + (it.disabled ? `<span class="pill orange">${t("deaktiviert")}</span>` : "");
    const when = it.interval ? t("alle {n} Min.", { n: Math.round(it.interval / 60) }) : it.run_at_load ? t("beim Start") : t("bei Bedarf");
    let acts = `<button class="act" data-path="${esc(it.path)}" title="${t("Datei im Finder zeigen")}">${svg("finder")}</button>`;
    if (it.brew_service && SAFE.test(it.brew_service)) acts += `<button class="act" data-copy="brew services stop ${esc(it.brew_service)}" title="${t("Befehl zum Stoppen kopieren")}">${svg("copy")}</button>`;
    return `<div class="row" title="${esc(it.path)}">
      ${icon ? `<div class="ricon"><img src="${esc(icon)}" alt=""></div>` : `<div class="ricon glyph" style="${tileBg(it.brew_service ? "brew_formulae" : "autostart")}">${svg(it.brew_service ? "brew_formulae" : "autostart")}</div>`}
      <div class="rmain"><div class="rname">${esc(it.brew_service ? t("Homebrew-Dienst: {s}", { s: it.brew_service }) : it.label)}${pills}</div>
        <div class="rsub">${esc([it.vendor, when, it.program].filter(Boolean).join(" · "))}</div></div>
      <div class="ractions">${acts}</div></div>`;
  };
  const groups = ["user", "agent", "daemon"].map((scope) => {
    const l = list.filter((x) => x.scope === scope);
    if (!l.length) return "";
    const [title, d] = SCOPE[scope];
    return `<div class="group-title">${t(title)}<span class="n">${l.length}</span></div><div class="hint">${esc(t(d))}</div><div class="group">${l.map(row).join("")}</div>`;
  }).join("");
  const updaters = list.filter((x) => x.updater).length, brew = list.filter((x) => x.brew_service).length;
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard("autostart", nf.format(list.length), t("Hintergrunddienste"))}
      ${statCard("updates", nf.format(updaters), t("Davon Updater"))}
      ${statCard("brew_formulae", nf.format(brew), t("Homebrew-Dienste"))}
    </div>
    <div class="hint" style="margin-top:10px">${t("Ein Dienst verschwindet meist mit dem zugehörigen Programm. Viele lassen sich auch unter Systemeinstellungen → Allgemein → Anmeldeobjekte ausschalten.")}
      <button class="btn" style="height:26px;margin-left:6px" data-settings="com.apple.LoginItems-Settings.extension">${svg("gear")} ${t("Anmeldeobjekte öffnen")}</button></div>
    ${groups || `<div class="noresults"><b>${t("Keine Hintergrunddienste")}</b>${t("In den LaunchAgents- und LaunchDaemons-Ordnern liegt nichts.")}</div>`}
  </div>`;
}

// ── Notes & tags ───────────────────────────────────────────────────
function noteEntries() {
  const out = [];
  for (const [key, note] of Object.entries(state.notes || {})) {
    const i = key.indexOf(":");
    const cat = catById(key.slice(0, i)), name = key.slice(i + 1);
    const it = cat?.items.find((x) => x.name === name);
    out.push({ key, note, cat, it: it || { name }, missing: !it });
  }
  return out.sort((a, b) => a.it.name.localeCompare(b.it.name));
}

function pageNotes() {
  const entries = noteEntries();
  const head = pageHead("notes", t("Notizen &amp; Tags"), state.source === "own" ? t("Eigene Notizen zu Programmen und Paketen – Notizsymbol in jeder Zeile") : t("Notizen aus dem importierten Snapshot (nur lesen)"));
  if (!entries.length) {
    return `<div class="page">${head}<div class="noresults"><b>${t("Noch keine Notizen")}</b>${t("Fahre in einer Liste über eine Zeile und klicke auf das Stift-Symbol,<br>um z. B. „Gekauft\", „Lizenz in 1Password\" oder „Kann weg\" zu vermerken.")}</div></div>`;
  }
  const tags = [...new Set(entries.flatMap((e) => e.note.tags || []))].sort((a, b) => {
    const ia = PRESET_TAGS.indexOf(a), ib = PRESET_TAGS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const row = (e) => {
    const cat = e.cat || { id: e.key.split(":")[0] };
    const sub = [e.cat ? label(e.cat) : "", e.it.version, e.missing ? t("nicht mehr installiert") : ""].filter(Boolean).map(esc).join(" · ");
    const edit = state.source === "own" ? `<div class="ractions" style="opacity:1"><button class="act has-note" data-note="${esc(e.key)}" title="${t("Bearbeiten")}">${svg("note")}</button></div>` : "";
    return `<div class="row">${iconHtml(e.it, cat)}
      <div class="rmain"><div class="rname">${esc(e.it.name)}${tagPills(e.note)}</div><div class="rsub">${sub}</div>
        ${e.note.note ? `<div class="rnote" style="white-space:pre-wrap">${esc(e.note.note)}</div>` : ""}</div>${edit}</div>`;
  };
  const groups = tags.map((x) => {
    const l = entries.filter((e) => (e.note.tags || []).includes(x));
    return `<div class="group-title">${esc(tagLabel(x))}<span class="n">${l.length}</span></div><div class="group">${l.map(row).join("")}</div>`;
  }).join("");
  const untagged = entries.filter((e) => !(e.note.tags || []).length);
  return `<div class="page">${head}${groups}
    ${untagged.length ? `<div class="group-title">${t("Ohne Tag")}<span class="n">${untagged.length}</span></div><div class="group">${untagged.map(row).join("")}</div>` : ""}
  </div>`;
}

function openNoteSheet(key) {
  const i = key.indexOf(":");
  const cat = catById(key.slice(0, i)), name = key.slice(i + 1);
  const it = cat?.items.find((x) => x.name === name) || { name };
  const cur = (state.notes || {})[key] || { note: "", tags: [] };
  const sel = new Set(cur.tags);
  const known = [...new Set([...PRESET_TAGS, ...Object.values(state.notes || {}).flatMap((n) => n.tags || [])])];
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  const tagsHtml = () => known.map((x) => `<button data-tag="${esc(x)}" class="${sel.has(x) ? "on" : ""}">${esc(tagLabel(x))}</button>`).join("")
    + `<input id="newTag" placeholder="${t("+ Eigener Tag")}" maxlength="40">`;
  bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${t("Notiz")}">
    <div class="sheet-head">${cat ? iconHtml(it, cat) : ""}<div><b>${esc(it.name)}</b><span>${esc(cat ? label(cat) : "")}${it.version ? " · " + esc(it.version) : ""}</span></div></div>
    <div class="lbl">${t("Notiz")}</div>
    <textarea id="noteText" placeholder="${t("z. B. Lizenz in 1Password, gekauft 2024, nur für Kunde X …")}">${esc(cur.note)}</textarea>
    <div class="lbl">Tags</div>
    <div class="tagpick" id="tagPick">${tagsHtml()}</div>
    <div class="lbl">${t("Abo / Lizenz")}</div>
    <div class="lic-row">
      <input id="licPrice" type="number" min="0" step="0.01" placeholder="${t("Preis")}" value="${cur.price ?? ""}">
      <select id="licCur" class="select">${["EUR", "USD", "CHF", "GBP"].map((c) => `<option${(cur.currency || "EUR") === c ? " selected" : ""}>${c}</option>`).join("")}</select>
      <select id="licCycle" class="select"><option value="">${t("kein Abo")}</option>${Object.entries(CYCLE).map(([k, v]) => `<option value="${k}"${cur.cycle === k ? " selected" : ""}>${t(v)}</option>`).join("")}</select>
      <input id="licDate" type="date" value="${esc(cur.renews || "")}" title="${t("Nächste Verlängerung")}">
    </div>
    <div class="sheet-foot">
      ${cur.note || cur.tags.length || cur.price || cur.renews ? `<button class="btn danger" data-sheet="delete">${t("Löschen")}</button>` : ""}
      <button class="btn" data-sheet="cancel">${t("Abbrechen")}</button>
      <button class="btn primary" data-sheet="save">${t("Sichern")}</button>
    </div></div>`;
  document.body.appendChild(bg);
  const ta = bg.querySelector("#noteText");
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey, true); };
  const lic = () => ({ price: bg.querySelector("#licPrice").value, currency: bg.querySelector("#licCur").value,
    cycle: bg.querySelector("#licCycle").value, renews: bg.querySelector("#licDate").value });
  const save = async (value) => {
    if (!value.clear) Object.assign(value, lic());
    await window.inventory.setNote(key, value);
    state.notes = await window.inventory.notes();
    close(); render();
  };
  const addTyped = () => {
    const inp = bg.querySelector("#newTag"), v = inp.value.trim();
    if (!v) return false;
    if (!known.includes(v)) known.push(v);
    sel.add(v); bg.querySelector("#tagPick").innerHTML = tagsHtml();
    return true;
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Enter" && e.target.id === "newTag") { e.preventDefault(); addTyped(); bg.querySelector("#newTag").focus(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { addTyped(); save({ note: ta.value, tags: [...sel] }); }
  };
  document.addEventListener("keydown", onKey, true);
  bg.addEventListener("click", (e) => {
    if (e.target === bg) return close();
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      const x = tag.dataset.tag;
      if (sel.has(x)) sel.delete(x); else sel.add(x);
      tag.classList.toggle("on");
      return;
    }
    const act = e.target.closest("[data-sheet]")?.dataset.sheet;
    if (act === "cancel") close();
    if (act === "delete") save({ note: "", tags: [], clear: true });
    if (act === "save") { addTyped(); save({ note: ta.value, tags: [...sel] }); }
  });
}

// ── PDF report ─────────────────────────────────────────────────────
const REPORT_CATS = ["apps", "mas", "brew_casks", "brew_formulae", "npm", "pip", "gem", "vscode", "docker_images", "claude_plugins", "claude_mcp", "user_apps"];
function buildReportHtml() {
  const d = state.data, s = d.system || {};
  const marketing = s.marketing_name || s.model_name || "Mac";
  const ram = s.ram_gb ? `${s.ram_gb} GB${s.memory_type ? " " + s.memory_type : ""}` : "";
  const st = s.storage;
  const kvs = [
    [t("Modell"), marketing], ["Chip", s.chip], [t("Arbeitsspeicher"), ram],
    [t("Kerne"), s.cpu_cores ? `${s.cpu_cores} CPU${s.perf_cores ? ` (${s.perf_cores}P + ${s.eff_cores}E)` : ""}${s.gpu_cores ? ` · ${s.gpu_cores} GPU` : ""}` : ""],
    [t("Speicher"), st ? t("{u} von {t} GB belegt ({f} GB frei)", { u: st.used_gb, t: st.total_gb, f: st.free_gb }) : ""],
    ["macOS", [s.os_marketing, s.os_version, s.os_build && `(${s.os_build})`].filter(Boolean).join(" ")],
    [t("Seriennummer"), s.serial], [t("Modell-ID"), s.model_id],
    [t("Batterie"), s.battery ? t("{c} max. Kapazität · {n} Ladezyklen", { c: s.battery.max_capacity, n: s.battery.cycles }) : ""],
    [t("Gerätename"), s.hostname], [t("Benutzer"), s.user],
  ].filter(([, v]) => v);
  const table = (rows, cols, numCol) => `<table><thead><tr>${cols.map((c, i) => `<th${i === numCol ? ' class="num"' : ""}>${c}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  let body = `<header><div><h1>${esc(marketing)}</h1><p>${t("MacAtlas-Bericht")} · ${esc(s.hostname || "")} · ${t("Scan vom {d}", { d: esc(fmtDate(d.generated_at)) })}</p></div>
    ${s.device_image ? `<img class="dev" src="${esc(s.device_image)}" alt="">` : ""}</header>
    <h2>${t("Gerät")}</h2><table class="kv">${kvs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  if (d.security) {
    body += `<h2>${t("Sicherheit")}</h2>` + table(d.security.checks.map((c) => `<tr><td>${c.ok ? "✓" : "!"} ${esc(secLabel(c))}</td><td class="${c.ok ? "ok" : "bad"}">${esc(secValue(c.value))}</td></tr>`), [t("Schutzfunktion"), "Status"]);
  }
  const counts = cats().filter((c) => c.count).map((c) => `<tr><td>${esc(label(c))}</td><td class="num">${nf.format(c.count)}</td></tr>`);
  body += `<h2>${t("Übersicht")}</h2>` + table(counts, [t("Kategorie"), t("Anzahl")], 1);
  if (d.updates) body += `<p class="note">${t("{n} Updates verfügbar (geprüft {d}).", { n: nf.format(d.updates.items.length), d: esc(fmtDate(d.updates.checked_at)) })}</p>`;
  for (const id of REPORT_CATS) {
    const c = catById(id);
    if (!c || !c.count) continue;
    let items = c.items;
    if (id === "brew_formulae" && items.some((it) => "leaf" in it)) items = items.filter((it) => it.leaf);
    const rows = items.map((it) => {
      const n = noteOf(c, it);
      const extra = [it.install_desc && !/^Homebrew Cask:|^Websuche$/.test(it.install_desc) ? installDesc(it.install_desc) : "", id === "apps" && it.size_bytes ? fmtBytes(it.size_bytes) : "",
        ...(n?.tags || []).map(tagLabel), n?.note || ""].filter(Boolean).join(" · ");
      return `<tr><td>${id === "apps" && it.icon ? `<img class="ic" src="${esc(it.icon)}" alt="">` : ""}${esc(it.name)}</td><td>${esc(it.version || "")}</td><td class="muted">${esc(extra)}</td></tr>`;
    });
    const sub = id === "brew_formulae" && items.length !== c.count ? ` <small>${t("(selbst installiert, ohne {n} Abhängigkeiten)", { n: c.count - items.length })}</small>` : "";
    body += `<h2>${esc(label(c))} <small>${nf.format(items.length)}</small>${sub}</h2>` + table(rows, ["Name", "Version", "Details"]);
  }
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>MacAtlas – ${esc(s.hostname || "")}</title><style>
    @page { size: A4; }
    body { font: 10px/1.4 -apple-system, "Helvetica Neue", sans-serif; color: #1d1d1f; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1d1d1f; padding-bottom: 10px; margin-bottom: 6px; }
    h1 { font-size: 22px; margin: 0; letter-spacing: -.02em; }
    header p { margin: 2px 0 0; color: #6e6e73; }
    .dev { width: 70px; height: 70px; object-fit: contain; }
    h2 { font-size: 13px; margin: 18px 0 6px; break-after: avoid; }
    h2 small { font-weight: 400; color: #6e6e73; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 600; color: #6e6e73; border-bottom: 1px solid #d2d2d7; padding: 3px 6px; font-size: 9px; }
    td { padding: 3px 6px; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
    tr { break-inside: avoid; }
    .kv td:first-child { color: #6e6e73; width: 32%; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #6e6e73; }
    .ok { color: #248a3d; font-weight: 600; } .bad { color: #c66b00; font-weight: 600; }
    .ic { width: 12px; height: 12px; vertical-align: -2px; margin-right: 5px; }
    .note { color: #6e6e73; margin: 6px 0 0; }
  </style></head><body>${body}</body></html>`;
}

async function saveReport() {
  if (!state.data) return toast(t("Noch nichts zu berichten – zuerst scannen."));
  const host = (state.data.system?.hostname || "Mac").replace(/[^\w .-]+/g, "-").trim();
  const ok = await window.inventory.savePdf(buildReportHtml(), `MacAtlas – ${host} – ${String(state.data.generated_at || "").slice(0, 10)}.pdf`);
  if (ok) toast(t("PDF-Bericht gesichert"));
}

// ── History: diff consecutive compact scans ────────────────────────
const VOLATILE_VERSIONS = new Set(["docker_containers", "docker_images", "fonts", "brew_bin", "usr_local_bin", "claude_skills"]);
function diffScans(prev, cur) {
  const added = [], removed = [], changed = [];
  const ids = new Set([...Object.keys(prev.cats || {}), ...Object.keys(cur.cats || {})]);
  for (const id of ids) {
    const a = prev.cats[id] || {}, b = cur.cats[id] || {};
    for (const n in b) {
      if (!(n in a)) added.push({ id, name: n, v: b[n] });
      else if (!VOLATILE_VERSIONS.has(id) && a[n] !== b[n] && a[n] && b[n]) changed.push({ id, name: n, from: a[n], to: b[n] });
    }
    for (const n in a) if (!(n in b)) removed.push({ id, name: n, v: a[n] });
  }
  const ps = prev.system || {}, cs = cur.system || {};
  const os = ps.os_version && cs.os_version && (ps.os_version !== cs.os_version || ps.os_build !== cs.os_build)
    ? `macOS ${ps.os_version} → ${cs.os_version}` : "";
  return { added, removed, changed, os };
}
const histLabel = (id, entry) => t(SHORT_LABELS[id] || entry?.labels?.[id] || id);

function historyDetail(d, entry) {
  const byCat = {};
  const push = (kind, x) => ((byCat[x.id] ||= []).push({ kind, ...x }));
  d.added.forEach((x) => push("add", x)); d.removed.forEach((x) => push("rem", x)); d.changed.forEach((x) => push("upd", x));
  const order = { add: 0, upd: 1, rem: 2 };
  return Object.entries(byCat).map(([id, list]) => {
    list.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
    const shown = list.slice(0, 150);
    const lines = shown.map((x) => `<div class="tl-line ${x.kind}"><span class="sym">${x.kind === "add" ? "+" : x.kind === "rem" ? "−" : "↑"}</span>
      <span>${esc(x.name)}</span><span class="v">${x.kind === "upd" ? `${esc(x.from)} → ${esc(x.to)}` : esc(x.v)}</span></div>`).join("");
    const more = list.length > shown.length ? `<div class="tl-line"><span class="sym"></span><span class="v">${t("… und {n} weitere", { n: nf.format(list.length - shown.length) })}</span></div>` : "";
    return `<div class="tl-cat">${svg(id)} ${esc(histLabel(id, entry))}</div>${lines}${more}`;
  }).join("");
}

function pageHistory() {
  const H = state.history || [];
  const head = pageHead("history", t("Verlauf"), t("Was sich zwischen den Scans dieses Macs geändert hat"));
  if (!H.length) return `<div class="page">${head}<div class="noresults"><b>${t("Noch kein Verlauf")}</b>${t("Jeder Scan wird ab jetzt automatisch gespeichert.")}</div></div>`;
  const count = (e) => Object.values(e.cats || {}).reduce((s, c) => s + Object.keys(c).length, 0);
  const items = [];
  let sumAdd = 0, sumRem = 0, sumUpd = 0, openedOne = false;
  for (let i = H.length - 1; i >= 0; i--) {
    const e = H[i];
    const when = `<b>${esc(fmtDate(e.generated_at))}</b><span class="muted">${esc(relTime(e.generated_at))}</span>`;
    if (i === 0) {
      items.push(`<div class="tl-item first"><div class="tl-dot"></div><div class="tl-head">${when}</div>
        <div class="tl-chips"><span class="pill green">${t("Erster Scan")}</span><span class="pill">${t("{n} Einträge", { n: nf.format(count(e)) })}</span>${e.system?.os_version ? `<span class="pill">macOS ${esc(e.system.os_version)}</span>` : ""}</div></div>`);
      continue;
    }
    const d = diffScans(H[i - 1], e);
    sumAdd += d.added.length; sumRem += d.removed.length; sumUpd += d.changed.length;
    const any = d.added.length || d.removed.length || d.changed.length;
    const chips = [
      d.added.length ? `<span class="pill green">${t("+{n} neu", { n: nf.format(d.added.length) })}</span>` : "",
      d.changed.length ? `<span class="pill blue">${t("{n} aktualisiert", { n: nf.format(d.changed.length) })}</span>` : "",
      d.removed.length ? `<span class="pill red">${t("−{n} entfernt", { n: nf.format(d.removed.length) })}</span>` : "",
      d.os ? `<span class="pill orange">${esc(d.os)}</span>` : "",
      !any && !d.os ? `<span class="pill">${t("Keine Änderungen")}</span>` : "",
    ].join("");
    const open = any && !openedOne ? " open" : "";
    if (any) openedOne = true;
    items.push(`<div class="tl-item${any || d.os ? " changed" : ""}"><div class="tl-dot"></div><div class="tl-head">${when}</div>
      <div class="tl-chips">${chips}</div>
      ${any ? `<details${open}><summary>Details</summary><div class="tl-detail">${historyDetail(d, e)}</div></details>` : ""}</div>`);
  }
  return `<div class="page">${head}
    ${H.length > 1 ? `<div class="ov-grid" style="margin-top:0">
      ${statCard("plus", nf.format(sumAdd), t("Neu installiert"))}
      ${statCard("updates", nf.format(sumUpd), t("Aktualisiert"))}
      ${statCard("minus", nf.format(sumRem), t("Entfernt"))}
    </div><div class="hint" style="margin-top:8px">${t("Seit dem ersten Scan am {d} · {n} Scans", { d: esc(fmtDate(H[0].generated_at)), n: nf.format(H.length) })}</div>`
    : `<div class="hint">${t("Der Verlauf beginnt mit diesem Scan. Nach dem nächsten Scan siehst du hier, was neu dazugekommen, aktualisiert oder entfernt wurde.")}</div>`}
    ${historyCharts(H)}
    <div class="tl">${items.join("")}</div>
  </div>`;
}

// ── Terminal helper: run a fixed command after asking in Terminal ──
function confirmScript(title, cmd) {
  return `#!/usr/bin/env bash
echo "MacAtlas – ${t(title)}"
echo ""
echo "  ${cmd.replace(/"/g, '\\"').replace(/\$/g, "\\$")}"
echo ""
read -r -p "${t("Ausführen? [j/N] ")}" ok
case "$ok" in j|J|y|Y) ;; *) echo "${t("Abgebrochen.")}"; exit 0 ;; esac
${cmd}
echo ""
echo "${t("Fertig. Danach in MacAtlas neu scannen (⌘R).")}"
`;
}
async function runInTerminal(title, cmd) {
  const ok = await window.inventory.runScript(confirmScript(title, cmd), "MacAtlas.command");
  toast(ok ? t("Läuft im Terminal – dort bestätigen") : t("Terminal konnte nicht geöffnet werden"), 4000);
}

// ── Storage ────────────────────────────────────────────────────────
// Commands are fixed strings defined here (never taken from scan data).
const STORAGE_META = {
  xcode_derived: { label: "Xcode: Zwischendaten (DerivedData)", path: "~/Library/Developer/Xcode/DerivedData", cmd: "rm -rf ~/Library/Developer/Xcode/DerivedData/*", safe: true, hint: "Wird beim nächsten Build automatisch neu erzeugt.", group: "dev", icon: "brew_formulae" },
  simulators: { label: "iOS-Simulatoren", path: "~/Library/Developer/CoreSimulator/Devices", cmd: "xcrun simctl delete unavailable", safe: false, hint: "Der Befehl entfernt nur nicht mehr verfügbare Simulatoren. Alle zurücksetzen (Apps und Daten darin gehen verloren): xcrun simctl erase all", group: "dev", icon: "display" },
  xcode_devicesupport: { label: "Xcode: Gerätedaten (DeviceSupport)", path: "~/Library/Developer/Xcode/iOS DeviceSupport", cmd: "rm -rf ~/Library/Developer/Xcode/*DeviceSupport/*", safe: true, hint: "Wird beim nächsten Verbinden eines iPhones oder iPads neu geladen.", group: "dev", icon: "chip" },
  xcode_archives: { label: "Xcode: Archive", path: "~/Library/Developer/Xcode/Archives", cmd: null, safe: false, hint: "Fertige App-Builds – in Xcode unter Window → Organizer gezielt löschen.", group: "dev", icon: "folder" },
  sim_caches: { label: "Simulator-Caches", path: "~/Library/Developer/CoreSimulator/Caches", cmd: "rm -rf ~/Library/Developer/CoreSimulator/Caches/*", safe: true, hint: "Wird bei Bedarf neu erzeugt.", group: "dev", icon: "display" },
  npm_cache: { label: "npm-Cache", path: "~/.npm", cmd: "npm cache clean --force", safe: true, hint: "Pakete werden bei Bedarf neu geladen.", group: "dev", icon: "npm" },
  pnpm_store: { label: "pnpm-Speicher", path: "~/Library/pnpm/store", cmd: "pnpm store prune", safe: true, hint: "Entfernt nur Pakete, die kein Projekt mehr nutzt.", group: "dev", icon: "npm" },
  yarn_cache: { label: "Yarn-Cache", path: "~/Library/Caches/Yarn", cmd: "yarn cache clean", safe: true, hint: "Pakete werden bei Bedarf neu geladen.", group: "dev", icon: "npm" },
  pip_cache: { label: "pip-Cache", path: "~/Library/Caches/pip", cmd: "pip3 cache purge", safe: true, hint: "Pakete werden bei Bedarf neu geladen.", group: "dev", icon: "pip" },
  gradle_cache: { label: "Gradle-Cache", path: "~/.gradle/caches", cmd: "rm -rf ~/.gradle/caches", safe: true, hint: "Wird beim nächsten Android-/Java-Build neu geladen.", group: "dev", icon: "brew_formulae" },
  cocoapods_cache: { label: "CocoaPods-Cache", path: "~/Library/Caches/CocoaPods", cmd: "pod cache clean --all", safe: true, hint: "Pods werden bei Bedarf neu geladen.", group: "dev", icon: "gem" },
  user_caches: { label: "Programm-Caches", path: "~/Library/Caches", cmd: null, safe: false, hint: "Die größten Ordner stehen unten. Einzelne Caches lassen sich löschen, während das Programm geschlossen ist.", group: "system", icon: "folder" },
  logs: { label: "Protokolle", path: "~/Library/Logs", cmd: null, safe: false, hint: "Meist klein; bei Bedarf im Finder leeren.", group: "system", icon: "script" },
  trash: { label: "Papierkorb", path: "~/.Trash", cmd: null, safe: false, hint: "Im Finder leeren.", group: "system", icon: "cleanup" },
  downloads: { label: "Downloads", path: "~/Downloads", cmd: null, safe: false, hint: "Alte Downloads im Finder durchsehen.", group: "system", icon: "import" },
};
const DOCKER_META = {
  "Build Cache": { label: "Docker: Build-Cache", cmd: "docker builder prune -a -f", safe: true, hint: "Zwischenstände von Image-Builds. Der nächste Build dauert einmal länger." },
  "Images": { label: "Docker: ungenutzte Images", cmd: "docker image prune -a", safe: false, hint: "Löscht alle Images, die gerade kein Container verwendet. Sie lassen sich neu laden oder bauen." },
  "Containers": { label: "Docker: gestoppte Container", cmd: "docker container prune", safe: false, hint: "Daten innerhalb gestoppter Container gehen verloren." },
  "Local Volumes": { label: "Docker: ungenutzte Volumes", cmd: "docker volume prune", safe: false, hint: "Achtung: Volumes enthalten oft Datenbanken. Nur löschen, wenn du sicher bist." },
};
function storageRows() {
  const st = state.data.storage;
  if (!st) return null;
  const rows = [];
  for (const it of st.items) {
    const m = STORAGE_META[it.id];
    if (!m) continue;
    rows.push({ ...m, id: it.id, bytes: it.bytes, reclaim: m.safe ? it.bytes : 0 });
  }
  if (st.brew_cleanup_bytes) rows.push({ id: "brew", label: "Homebrew: alte Versionen & Downloads", path: "", cmd: "brew cleanup --prune=all", safe: true, hint: "Entfernt veraltete Paketversionen und den Download-Cache.", group: "dev", icon: "brew_formulae", bytes: st.brew_cleanup_bytes, reclaim: st.brew_cleanup_bytes });
  for (const d of st.docker || []) {
    const m = DOCKER_META[d.type];
    if (!m || !d.reclaim_bytes) continue;
    rows.push({ ...m, id: "docker_" + d.type, group: "docker", icon: "docker_images", bytes: d.reclaim_bytes, total: d.size_bytes, reclaim: m.safe ? d.reclaim_bytes : 0 });
  }
  return rows;
}
function storageRow(r, max) {
  const noAccess = r.id === "trash" && !r.bytes;
  const sub = [r.path, t(r.hint)].filter(Boolean).map(esc).join(" · ");
  let acts = "";
  if (r.cmd) acts += `<button class="act" data-copy="${esc(r.cmd)}" title="${t("Befehl kopieren")}">${svg("copy")}</button>`;
  if (r.cmd) acts += `<button class="act" data-runcmd="${esc(r.id)}" title="${t("Im Terminal ausführen")}">${svg("terminal")}</button>`;
  const size = noAccess ? t("kein Zugriff") : r.bytes ? fmtBytes(r.bytes) : "–";
  const bar = `<div class="sizebar">${size}${r.bytes && max ? `<div class="bar ${r.safe ? "" : "warn"}"><span style="width:${Math.max(2, Math.round((r.bytes / max) * 100))}%"></span></div>` : ""}</div>`;
  const box = r.cmd && r.bytes ? pickBox("storage", r.group, r.id, r) : `<span class="pick pick-none"></span>`;
  return `<div class="row">
    ${box}<div class="ricon glyph" style="${tileBg(r.icon)}">${svg(r.icon)}</div>
    <div class="rmain"><div class="rname">${esc(t(r.label))}${r.safe ? `<span class="pill green">${t("sicher")}</span>` : r.cmd ? `<span class="pill orange">${t("prüfen")}</span>` : ""}</div>
      <div class="rsub" style="white-space:normal">${sub}</div>${r.cmd ? `<div class="rnote" style="font-style:normal;font-family:var(--mono)">${esc(r.cmd)}</div>` : ""}</div>
    ${bar}${acts ? `<div class="ractions">${acts}</div>` : ""}
  </div>`;
}
function pageStorage() {
  const head = pageHead("size", t("Speicherplatz"), t("Caches und Entwickler-Altlasten, die sich aufräumen lassen"));
  const rows = storageRows();
  if (!rows) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const safe = rows.filter((r) => r.safe && r.bytes).reduce((s, r) => s + r.bytes, 0);
  const check = rows.filter((r) => !r.safe && r.cmd && r.bytes).reduce((s, r) => s + r.bytes, 0);
  const max = Math.max(...rows.map((r) => r.bytes || 0), 1);
  const st = state.data.system?.storage;
  const group = (g, title) => {
    const l = rows.filter((r) => r.group === g).sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
    return l.length ? `<div class="group-title">${title}<span class="n">${fmtBytes(l.reduce((s, r) => s + (r.bytes || 0), 0))}</span>${l.some((r) => r.cmd && r.bytes) ? pickGroupButtons("storage", g) : ""}</div><div class="group">${l.map((r) => storageRow(r, max)).join("")}</div>` : "";
  };
  const groups = group("dev", t("Entwicklung")) + group("docker", "Docker") + group("system", t("Benutzerordner"));
  const picked = rows.filter((r) => r.cmd && r.bytes && isPicked("storage", r.id, r));
  const pickedBytes = picked.reduce((s, r) => s + r.bytes, 0);
  const top = state.data.storage.caches_top || [];
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard("check", fmtBytes(safe) || "0 GB", t("Sicher freigebbar"), t("Caches, die sich automatisch neu aufbauen"))}
      ${statCard("warn", fmtBytes(check) || "0 GB", t("Nach Prüfung freigebbar"), t("Simulatoren, Docker-Images, Volumes"))}
      ${st ? statCard("disk", `${nf.format(st.free_gb)} GB`, t("Frei auf {n}", { n: esc(st.name || "Macintosh HD") }), t("{u} GB von {t} GB belegt", { u: nf.format(st.used_gb), t: nf.format(st.total_gb) })) : ""}
    </div>
    ${rows.some((r) => r.cmd && r.bytes) ? `<div class="card script-card"><div class="ch"><span class="tile" style="${tileBg("cleanup")}">${svg("cleanup")}</span>${t("Ausgewählte aufräumen")}</div>
      <div class="muted">${t("Führt die Befehle der ausgewählten Einträge nacheinander im Terminal aus – nach einer Rückfrage. Sichere Caches sind vorausgewählt, alles mit „prüfen\" musst du bewusst anhaken.")}</div>
      ${pickSummary("storage")}
      <div class="btns" style="justify-content:flex-start;margin-top:6px"><button class="btn primary" data-do="cleanpicked"${picked.length ? "" : " disabled"}>${svg("terminal")} ${picked.length ? t("{s} freigeben", { s: fmtBytes(pickedBytes) }) : t("Nichts ausgewählt")}</button></div></div>` : ""}
    ${groups}
    ${top.length ? `<div class="group-title">${t("Größte Programm-Caches")}<span class="n">~/Library/Caches</span></div>
      <div class="group">${top.map((c) => `<div class="row"><div class="ricon glyph" style="${tileBg("folder")}">${svg("folder")}</div>
        <div class="rmain"><div class="rname">${esc(c.name)}</div></div><div class="sizebar">${fmtBytes(c.bytes)}<div class="bar"><span style="width:${Math.max(2, Math.round((c.bytes / top[0].bytes) * 100))}%"></span></div></div></div>`).join("")}</div>` : ""}
    <div class="foot-note">${t("MacAtlas löscht nie selbst etwas. Befehle laufen nur nach deiner Bestätigung im Terminal.")}</div>
  </div>`;
}
function storageCmd(id) { return (storageRows() || []).find((r) => r.id === id); }

// ── Versions & duplicates ──────────────────────────────────────────
const DUP_REASON = { both_folders: "liegt in /Applications und in ~/Applications", brew_and_mas: "über Homebrew und den App Store installiert" };
function versionsFlagged() {
  const v = state.data.versions;
  if (!v) return null;
  return v.runtimes.filter((r) => r.entries.length > 1).length + v.brew_multi.length + v.dup_apps.length + (v.xcodes.length > 1 ? 1 : 0) + (v.orphans.length ? 1 : 0);
}
function pageVersions() {
  const v = state.data.versions;
  const head = pageHead("history", t("Versionen & Doppeltes"), t("Mehrfach installierte Laufzeiten, doppelte Programme und verwaiste Pakete"));
  if (!v) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const multi = v.runtimes.filter((r) => r.entries.length > 1), single = v.runtimes.filter((r) => r.entries.length === 1);
  const runtimeGroup = (r) => `<div class="group-title">${esc(r.tool)}<span class="n">${pl(r.entries.length, "{n} Installation", "{n} Installationen")}</span></div>
    <div class="group">${r.entries.map((e) => `<div class="row">
      <div class="ricon glyph" style="${tileBg(e.active ? "check" : "equal")}">${svg(e.active ? "check" : "dot")}</div>
      <div class="rmain"><div class="rname">${esc(e.version || "?")}${e.active ? `<span class="pill green">${t("wird verwendet")}</span>` : ""}${e.source ? `<span class="pill">${esc(e.source)}</span>` : ""}</div>
        <div class="rsub">${esc(e.path)}</div></div></div>`).join("")}</div>`;
  const simple = (title, n, rows, hint) => rows ? `<div class="group-title">${title}<span class="n">${n}</span></div>${hint ? `<div class="hint">${hint}</div>` : ""}<div class="group">${rows}</div>` : "";
  const brewRows = v.brew_multi.map((b) => `<div class="row"><div class="ricon glyph" style="${tileBg("brew_formulae")}">${svg("brew_formulae")}</div>
    <div class="rmain"><div class="rname">${esc(b.base)}</div><div class="rsub">${esc(b.formulae.join(", "))}</div></div>
    <div class="ractions"><button class="act" data-copy="${esc(b.formulae.map((f) => `brew uses --installed ${f}`).join("; "))}" title="${t("Prüfbefehl kopieren")}">${svg("copy")}</button></div></div>`).join("");
  const dupRows = v.dup_apps.map((d) => `<div class="row"><div class="ricon glyph" style="${tileBg("apps")}">${svg("apps")}</div>
    <div class="rmain"><div class="rname">${esc(d.name)}</div><div class="rsub">${esc(t(DUP_REASON[d.reason] || d.reason))}</div></div>
    <div class="ractions"><button class="act" data-reveal="${esc(d.name)}" title="${t("Im Finder zeigen")}">${svg("finder")}</button></div></div>`).join("");
  const xcodeRows = v.xcodes.length > 1 ? v.xcodes.map((x) => `<div class="row"><div class="ricon glyph" style="${tileBg("brew_formulae")}">${svg("brew_formulae")}</div><div class="rmain"><div class="rname">${esc(x.split("/").pop())}</div><div class="rsub">${esc(x)}</div></div></div>`).join("") : "";
  const orphanRows = v.orphans.length ? `<div class="row"><div class="ricon glyph" style="${tileBg("cleanup")}">${svg("cleanup")}</div>
    <div class="rmain"><div class="rname">${esc(v.orphans.join(", "))}</div><div class="rsub">brew autoremove</div></div>
    <div class="ractions"><button class="act" data-copy="brew autoremove" title="${t("Befehl kopieren")}">${svg("copy")}</button></div></div>` : "";
  const flagged = versionsFlagged();
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">
      ${statCard(flagged ? "warn" : "check", nf.format(flagged), t("Hinweise"), flagged ? t("Mehrfach vorhanden – nicht zwingend ein Problem") : t("Nichts doppelt"))}
      ${statCard("history", nf.format(multi.length), t("Laufzeiten mehrfach"), esc(multi.map((r) => r.tool).join(", ")) || "–")}
    </div>
    ${multi.length ? `<div class="hint" style="margin-top:12px">${t("Der grün markierte Eintrag startet, wenn du den Befehl im Terminal eingibst (erster Treffer im PATH). Die macOS-Versionen unter /usr/bin nie entfernen. Mehrere Versionen sind normal, wenn Projekte unterschiedliche brauchen – sie können sich aber in die Quere kommen.")}</div>` : ""}
    ${multi.map(runtimeGroup).join("")}
    ${simple(t("Homebrew: Paket in mehreren Versionen"), v.brew_multi.length, brewRows, t("Oft von anderen Paketen benötigt. Mit dem Prüfbefehl siehst du, wer welche Version braucht."))}
    ${simple(t("Doppelte Programme"), v.dup_apps.length, dupRows, "")}
    ${simple(t("Mehrere Xcode-Versionen"), v.xcodes.length, xcodeRows, t("Jede Xcode-Version belegt 10–40 GB."))}
    ${simple(t("Verwaiste Homebrew-Pakete"), v.orphans.length, orphanRows, t("Wurden als Abhängigkeit installiert und werden von nichts mehr gebraucht."))}
    ${single.length ? `<div class="group-title">${t("Weitere Laufzeiten")}</div><div class="group">${single.map((r) => kv(esc(r.tool), esc(`${r.entries[0].version || "?"} · ${r.entries[0].source || r.entries[0].path}`))).join("")}</div>` : ""}
  </div>`;
}

// ── Network & extensions (part of the security page) ───────────────
const KNOWN_PROCS = {
  ControlCenter: "AirPlay-Empfänger von macOS (Systemeinstellungen → Allgemein → AirDrop & Handoff)",
  rapportd: "Handoff und Universal Clipboard von macOS",
  sharingd: "AirDrop und Freigaben von macOS",
  "com.docker.backend": "Docker – Ports deiner laufenden Container",
  mariadbd: "MariaDB-Datenbank (Homebrew-Dienst)", mysqld: "MySQL-Datenbank", postgres: "PostgreSQL-Datenbank",
  "redis-server": "Redis-Datenbank", node: "Node.js – meist ein Entwicklungsserver", "python3.13": "Python – meist ein Entwicklungsserver",
};
const procHint = (p) => KNOWN_PROCS[p] || (/^python/i.test(p) ? KNOWN_PROCS["python3.13"] : "");
function networkSections() {
  const ports = state.data.ports, ext = state.data.extensions;
  let html = "";
  if (ports) {
    const exposed = ports.filter((p) => p.exposed).length;
    html += `<div class="group-title">${svg("globe", "i")} ${t("Offene Netzwerk-Ports")}<span class="n">${ports.length}${exposed ? " · " + t("{n} von außen erreichbar", { n: exposed }) : ""}</span></div>
      <div class="hint">${t("Programme, die auf eingehende Verbindungen warten. „Von außen erreichbar\" heißt: auch andere Geräte im selben Netzwerk können sich verbinden – im fremden WLAN ein Risiko, wenn die Firewall aus ist.")}</div>
      ${ports.length ? `<div class="group">${ports.map((p) => `<div class="row">
        <div class="ricon glyph" style="${tileBg(p.exposed ? "warn" : "equal")}">${svg(p.exposed ? "warn" : "dot")}</div>
        <div class="rmain"><div class="rname">${esc(p.process)}<span class="pill ${p.exposed ? "orange" : ""}">${p.exposed ? t("von außen erreichbar") : t("nur dieser Mac")}</span></div>
          <div class="rsub">Port ${esc(p.port)} · ${esc(p.address)}${p.pid ? " · PID " + esc(p.pid) : ""}${procHint(p.process) ? " · " + esc(t(procHint(p.process))) : ""}</div></div></div>`).join("")}</div>` : `<div class="noresults" style="padding:20px">${t("Keine offenen Ports.")}</div>`}`;
  }
  if (ext) {
    const sys = [...ext.system.map((e) => ({ name: e.name, sub: `${e.id} · ${e.version} · ${e.state}` })), ...ext.kexts.map((k) => ({ name: k, sub: t("Kernel-Erweiterung") }))];
    html += `<div class="group-title">${svg("chip", "i")} ${t("Systemerweiterungen")}<span class="n">${sys.length}</span></div>
      <div class="hint">${t("Treiber und Erweiterungen, die sich tief in macOS einklinken (z. B. VPN, Virenscanner, Audio-Treiber).")}</div>
      ${sys.length ? `<div class="group">${sys.map((e) => `<div class="row"><div class="ricon glyph" style="${tileBg("chip")}">${svg("chip")}</div><div class="rmain"><div class="rname">${esc(e.name)}</div><div class="rsub">${esc(e.sub)}</div></div></div>`).join("")}</div>`
        : `<div class="noresults" style="padding:20px">${t("Keine Systemerweiterungen von Drittanbietern.")}</div>`}`;
    const browsers = [...new Set(ext.browser.map((b) => b.browser))];
    html += `<div class="group-title">${svg("globe", "i")} ${t("Browser-Erweiterungen")}<span class="n">${ext.browser.length}</span></div>
      <div class="hint">${t("Erweiterungen können alles lesen, was du im Browser siehst. Entferne, was du nicht kennst oder nicht mehr brauchst.")}${ext.blocked?.length ? " " + t("Kein Zugriff auf: {b} (macOS-Datenschutz).", { b: esc(ext.blocked.join(", ")) }) : ""}</div>
      ${browsers.map((b) => `<div class="group" style="margin-bottom:10px">${ext.browser.filter((x) => x.browser === b).map((x) => `<div class="row">
        <div class="ricon glyph" style="${tileBg("globe")}">${svg("globe")}</div>
        <div class="rmain"><div class="rname">${esc(x.name)}<span class="pill">${esc(b)}</span>${x.enabled === false ? `<span class="pill orange">${t("deaktiviert")}</span>` : ""}</div>
          <div class="rsub">${esc([x.version, x.app, x.id].filter(Boolean).join(" · "))}</div></div>
        ${x.url ? `<div class="ractions"><button class="act" data-url="${esc(x.url)}" title="${t("Website öffnen")}">${svg("link")}</button></div>` : ""}</div>`).join("")}</div>`).join("") || `<div class="noresults" style="padding:20px">${t("Keine Browser-Erweiterungen gefunden.")}</div>`}`;
  }
  return html;
}

// ── History charts (one series per chart, single hue) ──────────────
function lineChart(id, title, points, fmt) {
  const pts = points.filter((p) => p.y != null && isFinite(p.y));
  if (pts.length < 2) return "";
  const W = 320, H = 120, L = 8, R = 8, T = 14, B = 22;
  const xs = pts.map((p) => +new Date(p.x)), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.15; y0 -= pad; y1 += pad;
  const sx = (x) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(+new Date(p.x)).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const last = pts[pts.length - 1], first = pts[0];
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="${L}" x2="${W - R}" y1="${T + f * (H - T - B)}" y2="${T + f * (H - T - B)}" class="ch-grid"/>`).join("");
  const dots = pts.map((p) => `<circle cx="${sx(+new Date(p.x)).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4" class="ch-dot"/>`).join("");
  const data = esc(JSON.stringify(pts.map((p) => [sx(+new Date(p.x)), sy(p.y), fmtDate(p.x), fmt(p.y)])));
  const delta = last.y - first.y;
  return `<div class="card chart-card"><div class="ch">${title}</div>
    <div class="big" style="font-size:20px">${fmt(last.y)} <span class="muted" style="font-size:12px;font-weight:500">${delta === 0 ? t("unverändert") : (delta > 0 ? "+" : "−") + fmt(Math.abs(delta))} ${t("seit {d}", { d: new Date(first.x).toLocaleDateString(LOC(), { day: "numeric", month: "short" }) })}</span></div>
    <div class="chart" data-chart="${data}">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${esc(title)}">${grid}
        <path d="${d}" class="ch-line"/>${dots}
        <line class="ch-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/>
        <text x="${L}" y="${H - 6}" class="ch-axis">${esc(new Date(first.x).toLocaleDateString(LOC(), { day: "numeric", month: "short" }))}</text>
        <text x="${W - R}" y="${H - 6}" class="ch-axis" text-anchor="end">${esc(new Date(last.x).toLocaleDateString(LOC(), { day: "numeric", month: "short" }))}</text>
      </svg><div class="ch-tip" style="display:none"></div></div></div>`;
}
function historyCharts(H) {
  const total = (e) => e.total ?? Object.values(e.cats || {}).reduce((s, c) => s + Object.keys(c).length, 0);
  const gb = (v) => `${nf.format(Math.round(v))} GB`;
  const charts = [
    lineChart("used", t("Belegter Speicher"), H.map((e) => ({ x: e.generated_at, y: e.system?.storage_used_gb })), gb),
    lineChart("total", t("Einträge gesamt"), H.map((e) => ({ x: e.generated_at, y: total(e) })), (v) => nf.format(Math.round(v))),
    lineChart("updates", t("Verfügbare Updates"), H.map((e) => ({ x: e.generated_at, y: e.updates })), (v) => nf.format(Math.round(v))),
    lineChart("reclaim", t("Aufräumbar"), H.map((e) => ({ x: e.generated_at, y: e.reclaimable != null ? e.reclaimable / 1e9 : null })), (v) => `${v.toLocaleString(LOC(), { maximumFractionDigits: 1 })} GB`),
  ].filter(Boolean);
  return charts.length ? `<div class="chart-grid">${charts.join("")}</div>` : "";
}
document.addEventListener("mousemove", (e) => {
  const box = e.target.closest?.(".chart");
  document.querySelectorAll(".chart .ch-tip").forEach((tip) => { if (!box || !box.contains(tip)) { tip.style.display = "none"; tip.parentElement.querySelector(".ch-cross").style.display = "none"; } });
  if (!box) return;
  const pts = JSON.parse(box.dataset.chart), svgEl = box.querySelector("svg"), rect = svgEl.getBoundingClientRect();
  const vb = svgEl.viewBox.baseVal, x = ((e.clientX - rect.left) / rect.width) * vb.width;
  let best = pts[0];
  for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  const cross = box.querySelector(".ch-cross"), tip = box.querySelector(".ch-tip");
  cross.setAttribute("x1", best[0]); cross.setAttribute("x2", best[0]); cross.style.display = "";
  tip.innerHTML = `<b>${esc(best[3])}</b><br>${esc(best[2])}`;
  tip.style.display = "block";
  const left = (best[0] / vb.width) * rect.width;
  tip.style.left = Math.min(Math.max(left, 50), rect.width - 50) + "px";
  tip.style.top = ((best[1] / vb.height) * rect.height - 8) + "px";
});

// ── My Macs (shared folder) ────────────────────────────────────────
async function loadMacs() {
  try { state.macs = await window.inventory.listMacs(); } catch { state.macs = { dir: "", macs: [] }; }
}
function pageMacs() {
  const s = state.settings || {};
  const head = pageHead("macos", t("Meine Macs"), t("Alle Macs, die ihre Scans in einen gemeinsamen Ordner legen – z. B. über iCloud Drive"));
  if (!s.syncEnabled) {
    return `<div class="page">${head}<div class="noresults"><b>${t("Teilen ist ausgeschaltet")}</b>${t("Schalte das Teilen auf jedem Mac ein. Jeder Scan wird dann in den gemeinsamen Ordner kopiert:")}<br><code style="font:12px var(--mono)">${esc(s.syncDirResolved || "")}</code><br><br>
      <button class="btn primary" data-do="enablesync">${svg("macos")} ${t("Teilen einschalten")}</button></div>
      <div class="foot-note">${t("Der Scan enthält Seriennummer, Benutzername und Programmliste. Teile den Ordner nur mit Geräten, denen du vertraust.")}</div></div>`;
  }
  const m = state.macs?.macs || [];
  const cards = m.map((x) => `<div class="card mac-card">
    <div class="mac-top">${x.device_image ? `<img src="${esc(x.device_image)}" alt="">` : `<span class="tile" style="${tileBg("macos")}">${svg("macos")}</span>`}
      <div><b>${esc(x.hostname || "Mac")}</b>${x.self ? `<span class="pill blue">${t("dieser Mac")}</span>` : ""}<div class="muted">${esc(x.model || "")}</div></div></div>
    <div class="group" style="margin-top:6px">
      ${kv("Chip", esc([x.chip, x.ram_gb ? x.ram_gb + " GB" : ""].filter(Boolean).join(" · ")))}
      ${kv("macOS", esc(x.os))}
      ${kv(t("Gescannt"), esc(relTime(x.generated_at)))}
      ${kv(t("Einträge"), nf.format(x.total || 0))}
      ${x.updates != null ? kv(t("Updates"), nf.format(x.updates)) : ""}
      ${x.security ? kv(t("Sicherheit"), t("{a} von {b}", { a: x.security.ok, b: x.security.total })) : ""}
      ${x.storage ? kv(t("Frei"), `${nf.format(x.storage.free_gb)} GB`) : ""}
    </div>
    <div class="btns" style="justify-content:flex-start;margin-top:8px">
      ${x.self ? "" : `<button class="btn primary" data-openmac="${esc(x.file)}">${svg("compare")} ${t("Vergleichen")}</button>`}
    </div></div>`).join("");
  return `<div class="page">${head}
    <div class="btns" style="justify-content:flex-start;margin-bottom:6px">
      <button class="btn" data-do="syncnow">${svg("scan")} ${t("Jetzt teilen")}</button>
      <button class="btn" data-do="opensync">${svg("folder")} ${t("Ordner öffnen")}</button>
    </div>
    <div class="hint">${esc(state.macs?.dir || s.syncDirResolved || "")}</div>
    ${m.length ? `<div class="mac-grid">${cards}</div>` : `<div class="noresults"><b>${t("Noch keine Macs im Ordner")}</b>${t("Nach dem nächsten Scan erscheint dieser Mac hier – andere Macs, sobald sie dort auch teilen.")}</div>`}
  </div>`;
}

// ── Migration assistant (snapshot of the old Mac → this Mac) ───────
function migrationSteps() {
  const cmp = compareData();
  if (!cmp) return null;
  const by = Object.fromEntries(cmp.res.map((r) => [r.cat.id, r]));
  const miss = (ids) => ids.reduce((s, id) => s + (by[id]?.missing.length || 0), 0);
  const appsWithCask = (by.apps?.missing || []).filter((it) => /^brew install --cask /.test(it.install_cmd || "")).length;
  const appsWithMas = (by.apps?.missing || []).filter((it) => /^mas install /.test(it.install_cmd || "")).length;
  const manual = (by.apps?.missing || []).filter((it) => !it.install_cmd);
  const ownCount = (id) => state.own?.categories.find((c) => c.id === id)?.count || 0;
  const hasBrew = ownCount("brew_formulae") > 0 || ownCount("brew_bin") > 0;
  return [
    { id: "homebrew", title: "Homebrew installieren", desc: "Paketverwaltung für fast alle weiteren Schritte.", open: hasBrew ? 0 : 1, run: hasBrew ? null : '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', icon: "brew_formulae", link: "https://brew.sh" },
    { id: "brew", title: "Programme & Tools über Homebrew", desc: "Fehlende Homebrew-Formeln und -Casks.", open: miss(["brew_formulae", "brew_casks"]) + appsWithCask, script: ["brew"], icon: "brew_casks", needs: "homebrew" },
    { id: "mas", title: "Apps aus dem App Store", desc: "Vorher im App Store anmelden.", open: miss(["mas"]) + appsWithMas, script: ["mas"], icon: "mas", needs: "homebrew" },
    { id: "dev", title: "Entwickler-Pakete", desc: "npm-, pip- und Ruby-Pakete.", open: miss(["npm", "pip", "gem"]), script: ["dev"], icon: "npm" },
    { id: "code", title: "VS-Code-Erweiterungen", desc: "Braucht den Befehl „code\" (VS Code → Shell-Befehl installieren).", open: miss(["vscode"]), script: ["code"], icon: "vscode" },
    { id: "manual", title: "Programme von Hand installieren", desc: "Für diese Programme gibt es keine Paketquelle.", open: manual.length, manual, icon: "apps" },
    { id: "settings", title: "Einstellungen übernehmen", desc: "Auf dem alten Mac unter „Einstellungen mitnehmen\" ein Paket sichern, hier „Wiederherstellen.command\" doppelklicken.", open: null, icon: "settings" },
  ];
}
function pageMigrate() {
  const s = state.data.system || {};
  const head = pageHead("import", t("Umzug von {h}", { h: esc(s.hostname || "Mac") }), t("Schritt für Schritt alles vom alten Mac auf diesen übertragen"));
  if (!state.own) {
    return `<div class="page">${head}<div class="group"><div class="kv"><span class="k">${t("Dieser Mac wurde noch nicht gescannt.")}</span>
      <button class="btn primary" data-do="scankeep">${svg("scan")} ${t("Diesen Mac scannen")}</button></div></div></div>`;
  }
  const steps = migrationSteps();
  const countable = steps.filter((x) => x.open != null);
  const done = countable.filter((x) => x.open === 0).length;
  const pct = Math.round((done / countable.length) * 100);
  const card = (x, i) => {
    const status = x.open == null ? `<span class="pill">${t("Info")}</span>` : x.open === 0 ? `<span class="pill green">✓ ${t("erledigt")}</span>` : `<span class="pill orange">${t("{n} offen", { n: x.open })}</span>`;
    let btn = "";
    if (x.open && x.script) btn = `<button class="btn primary" data-migrate="${x.id}">${svg("terminal")} ${t("Im Terminal ausführen")}</button>`;
    if (x.open && x.run) btn = `<button class="btn primary" data-migrate="${x.id}">${svg("terminal")} ${t("Im Terminal ausführen")}</button>` + (x.link ? ` <button class="btn" data-url="${x.link}">${svg("link")} brew.sh</button>` : "");
    const manual = x.manual?.length ? `<div class="group" style="margin-top:8px">${x.manual.map((it) => `<div class="row" style="min-height:38px"><div class="rmain"><div class="rname">${esc(it.name)}</div></div>${it.install_url ? `<div class="ractions" style="opacity:1"><button class="act" data-url="${esc(it.install_url)}" title="${t("Website öffnen")}">${svg("link")}</button></div>` : ""}</div>`).join("")}</div>` : "";
    return `<div class="card mig-step${x.open === 0 ? " done" : ""}"><div class="ch"><span class="mig-num">${i + 1}</span><span class="tile" style="${tileBg(x.icon)}">${svg(x.icon)}</span>${t(x.title)} ${status}</div>
      <div class="muted">${t(x.desc)}</div>${btn ? `<div class="btns" style="justify-content:flex-start;margin-top:6px">${btn}</div>` : ""}${manual}</div>`;
  };
  return `<div class="page">${head}
    <div class="card"><div class="ch">${t("Fortschritt")}</div>
      <div class="big">${t("{a} von {b} Schritten", { a: done, b: countable.length })}</div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="btns" style="justify-content:flex-start;margin-top:6px"><button class="btn" data-do="scankeep">${svg("scan")} ${t("Diesen Mac neu prüfen")}</button></div>
      <div class="muted">${t("Nach jedem Schritt neu prüfen – erledigte Schritte werden abgehakt.")} ${t("Was installiert wird, legst du per Häkchen im Vergleich fest.")}</div></div>
    <div class="mig-list">${steps.map(card).join("")}</div>
  </div>`;
}
function migrationScript(id) {
  const step = migrationSteps().find((x) => x.id === id);
  if (!step) return null;
  if (step.run) return confirmScript(step.title, step.run);
  if (!step.script || !step.open) return null;
  return buildScript(compareData(), new Set(step.script));
}

// ── Settings package (dotfiles) ────────────────────────────────────
const DOT_KIND = { shell: ["terminal", "Shell"], git: ["brew_formulae", "Git"], ssh: ["security", "SSH"], vscode: ["vscode", "VS Code"], cursor: ["vscode", "Cursor"], editor: ["script", "Editor"] };
function pageDotfiles() {
  const list = state.data.dotfiles;
  const head = pageHead("settings", t("Einstellungen mitnehmen"), t("Shell, Git, SSH-Konfiguration, Editor und macOS-Einstellungen als Paket für den nächsten Mac"));
  if (!list) return `<div class="page">${head}${oldScan(t("Keine Daten"))}</div>`;
  const res = state.dotResult;
  return `<div class="page">${head}
    <div class="card script-card"><div class="ch"><span class="tile" style="${tileBg("settings")}">${svg("settings")}</span>${t("Einstellungspaket")}</div>
      <div class="muted">${t("Erstellt eine ZIP-Datei mit den Dateien unten, den Einstellungen für Dock, Finder, Bildschirmfotos und Trackpad sowie einem Wiederherstellen-Skript. Werte, die wie Passwörter oder Tokens aussehen, werden ersetzt. SSH-Schlüssel kommen nie mit.")}</div>
      <div class="btns" style="justify-content:flex-start;margin-top:6px"><button class="btn primary" data-do="dotexport">${svg("import")} ${t("Paket sichern …")}</button></div>
      ${res ? `<div class="hint" style="margin:8px 0 0">${t("Gesichert: {f} Dateien, {d} macOS-Bereiche. {r}", { f: res.files.length, d: res.defaults.length, r: res.redacted ? t("{n} geheime Werte wurden entfernt.", { n: res.redacted }) : t("Keine geheimen Werte gefunden.") })}</div>` : ""}
    </div>
    <div class="group-title">${t("Gefundene Dateien")}<span class="n">${list.length}</span></div>
    <div class="group">${list.map((f) => { const [icon, kind] = DOT_KIND[f.kind] || DOT_KIND.editor; const r = res?.files.find((x) => x.path === f.path);
      return `<div class="row"><div class="ricon glyph" style="${tileBg(icon)}">${svg(icon)}</div>
        <div class="rmain"><div class="rname">${esc(f.path)}${r?.redacted ? `<span class="pill orange">${t("{n} Werte entfernt", { n: r.redacted })}</span>` : ""}</div><div class="rsub">${esc(kind)} · ${fmtBytes(f.size) || "0 KB"}</div></div></div>`; }).join("")}</div>
    <div class="foot-note">${t("Wiederherstellen: ZIP auf dem neuen Mac entpacken und „Wiederherstellen.command\" doppelklicken. Vorhandene Dateien werden vorher gesichert.")}</div>
  </div>`;
}

// ── Subscriptions & licenses (stored with notes) ───────────────────
const CYCLE = { once: "einmalig", monthly: "monatlich", yearly: "jährlich" };
const money = (v, cur) => Number(v).toLocaleString(LOC(), { style: "currency", currency: cur || "EUR" });
function licenseEntries() { return noteEntries().filter((e) => e.note.price || e.note.renews); }
function pageLicenses() {
  const list = licenseEntries();
  const head = pageHead("notes", t("Abos & Lizenzen"), t("Kosten und Verlängerungen deiner Programme – aus den Notizen"));
  if (!list.length) {
    return `<div class="page">${head}<div class="noresults"><b>${t("Noch keine Abos erfasst")}</b>${t("Öffne bei einem Programm die Notiz (Stift-Symbol) und trage Preis, Abrechnung und Verlängerungsdatum ein.")}</div></div>`;
  }
  const totals = {};
  for (const e of list) {
    const n = e.note, cur = n.currency || "EUR";
    totals[cur] ||= { month: 0, year: 0, once: 0 };
    if (n.cycle === "monthly") { totals[cur].month += n.price || 0; totals[cur].year += (n.price || 0) * 12; }
    else if (n.cycle === "yearly") { totals[cur].month += (n.price || 0) / 12; totals[cur].year += n.price || 0; }
    else totals[cur].once += n.price || 0;
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parseDay = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const rows = list.map((e) => ({ e, next: parseDay(e.note.next || e.note.renews) }))
    .sort((a, b) => (a.next ? +a.next : Infinity) - (b.next ? +b.next : Infinity));
  const cards = Object.entries(totals).map(([cur, x]) => statCard("notes", money(x.month, cur), t("pro Monat"), t("{y} pro Jahr{o}", { y: money(x.year, cur), o: x.once ? " · " + t("{v} einmalig", { v: money(x.once, cur) }) : "" }))).join("");
  const soon = rows.filter((r) => r.next && (r.next - today) / 864e5 <= 30).length;
  return `<div class="page">${head}
    <div class="ov-grid" style="margin-top:0">${cards}${statCard("clock", nf.format(soon), t("Verlängerungen in 30 Tagen"))}</div>
    <div class="group-title">${t("Alle Abos & Lizenzen")}<span class="n">${list.length}</span></div>
    <div class="group">${rows.map(({ e, next }) => {
      const days = next ? Math.round((next - today) / 864e5) : null;
      const when = next ? (days === 0 ? t("heute") : days > 0 ? t("in {n} Tagen", { n: days }) : t("abgelaufen")) : "";
      return `<div class="row">${iconHtml(e.it, e.cat || { id: e.key.split(":")[0] })}
        <div class="rmain"><div class="rname">${esc(e.it.name)}${tagPills(e.note)}</div>
          <div class="rsub">${[e.note.price ? money(e.note.price, e.note.currency) : "", e.note.cycle ? t(CYCLE[e.note.cycle]) : "", next ? t("Verlängerung {d}", { d: next.toLocaleDateString(LOC(), { dateStyle: "medium" }) }) : ""].filter(Boolean).map(esc).join(" · ")}</div></div>
        ${when ? `<span class="pill ${days != null && days <= 7 ? "orange" : ""}" style="margin:0">${esc(when)}</span>` : ""}
        <div class="ractions" style="opacity:1"><button class="act has-note" data-note="${esc(e.key)}" title="${t("Bearbeiten")}">${svg("note")}</button></div></div>`;
    }).join("")}</div>
    <div class="foot-note">${t("Erinnerung 7 Tage vor jeder Verlängerung – in den Einstellungen abschaltbar.")}</div>
  </div>`;
}

// ── Settings ───────────────────────────────────────────────────────
const BUDDSTER_URL = "https://buddster.de";
const REPO_URL = "https://github.com/m4rcelnoel/MacAtlas";
function toggle(key, on, disabled) {
  return `<label class="switch${disabled ? " disabled" : ""}"><input type="checkbox" data-set="${key}"${on ? " checked" : ""}${disabled ? " disabled" : ""}><span></span></label>`;
}
function choice(key, value, options) {
  return `<div class="segmented choice" data-choice="${key}">${options.map(([v, text]) =>
    `<button data-value="${v}" class="${String(value) === String(v) ? "on" : ""}">${text}</button>`).join("")}</div>`;
}
function selectBox(key, value, options) {
  return `<select class="select" data-select="${key}">${options.map(([v, text]) =>
    `<option value="${v}"${String(value) === String(v) ? " selected" : ""}>${text}</option>`).join("")}</select>`;
}
function setRow(icon, title, hint, control) {
  return `<div class="row set-row"><div class="ricon glyph" style="${tileBg(icon)}">${svg(icon)}</div>
    <div class="rmain"><div class="rname">${title}</div>${hint ? `<div class="rsub" style="white-space:normal">${hint}</div>` : ""}</div>
    <div class="set-ctl">${control}</div></div>`;
}
function pageSettings() {
  const s = state.settings;
  if (!s) return `<div class="page"><div class="noresults"><b>${t("Einstellungen werden geladen …")}</b></div></div>`;
  const sysLang = s.language === "system" ? (s.resolvedLanguage === "de" ? "Deutsch" : "English") : "";
  return `<div class="page set-page">
    ${pageHead("settings", t("Einstellungen"), t("Verhalten, Darstellung und Daten von MacAtlas"))}
    <div class="group-title">${t("Allgemein")}</div>
    <div class="group">
      ${setRow("globe", t("Sprache"), "", selectBox("language", s.language, [["system", t("System ({l})", { l: sysLang || (LANG === "de" ? "Deutsch" : "English") })], ["de", "Deutsch"], ["en", "English"]]))}
      ${setRow("appearance", t("Erscheinungsbild"), "", choice("theme", s.theme, [["system", t("Automatisch")], ["light", t("Hell")], ["dark", t("Dunkel")]]))}
      ${setRow("power", t("Bei Anmeldung starten"), t("MacAtlas startet automatisch, wenn du dich am Mac anmeldest."), toggle("openAtLogin", s.openAtLogin))}
    </div>
    <div class="group-title">${t("Menüleiste")}</div>
    <div class="group">
      ${setRow("menubar", t("Symbol in der Menüleiste"), t("Schneller Zugriff auf Scan, Updates und Einstellungen – auch bei geschlossenem Fenster."), toggle("showTray", s.showTray))}
      ${setRow("updates", t("Anzahl der Updates anzeigen"), t("Zahl neben dem Symbol in der Menüleiste."), toggle("trayCount", s.trayCount, !s.showTray))}
    </div>
    <div class="group-title">${t("Scannen")}</div>
    <div class="group">
      ${setRow("scan", t("Automatisch scannen"), t("Läuft im Hintergrund, solange MacAtlas geöffnet ist – auch mit geschlossenem Fenster."), choice("autoScan", s.autoScan, [["off", t("Aus")], ["daily", t("Täglich")], ["weekly", t("Wöchentlich")]]))}
      ${setRow("bell", t("Mitteilung bei neuen Updates"), t("Nach einem automatischen Scan, wenn mehr Updates verfügbar sind als zuvor."), toggle("notify", s.notify, s.autoScan === "off"))}
      ${setRow("brew_formulae", t("Homebrew vor der Update-Prüfung aktualisieren"), t("Führt „brew update\" aus, damit neue Versionen erkannt werden. Macht den Scan 5–30 Sekunden länger."), toggle("brewUpdate", s.brewUpdate))}
    </div>
    <div class="group-title">${t("Benachrichtigungen")}</div>
    <div class="group">
      ${setRow("warn", t("Bei Änderungen warnen"), t("Nach einem Scan im Hintergrund: neue Programme, neue Hintergrunddienste, schwächerer Schutz oder neu geöffnete Ports."), toggle("warnChanges", s.warnChanges))}
      ${setRow("notes", t("An Abo-Verlängerungen erinnern"), t("7 Tage vorher – für Abos mit Datum in den Notizen."), toggle("remindRenewals", s.remindRenewals))}
    </div>
    <div class="group-title">${t("Mehrere Macs")}</div>
    <div class="group">
      ${setRow("macos", t("Scans mit anderen Macs teilen"), t("Jeder Scan wird in einen gemeinsamen Ordner kopiert. Mit iCloud Drive sehen alle deine Macs sich gegenseitig unter „Meine Macs\"."), toggle("syncEnabled", s.syncEnabled))}
      ${setRow("folder", t("Gemeinsamer Ordner"), esc(s.syncDirResolved || ""), `<button class="btn" data-do="choosesync">${t("Ändern …")}</button><button class="btn" data-do="opensync">${t("Öffnen")}</button>`)}
    </div>
    <div class="group-title">${t("Kurzbefehle & Automatisierung")}</div>
    <div class="hint">${t("In der Kurzbefehle-App die Aktion „URL öffnen\" verwenden – oder im Terminal: open macatlas://scan. Berichte und Exporte landen in {d}.", { d: esc(s.exportDir || "~/Documents/MacAtlas") })}</div>
    <div class="group">
      ${[["macatlas://scan", "Mac scannen"], ["macatlas://report", "PDF-Bericht sichern"], ["macatlas://csv", "CSV exportieren"], ["macatlas://export", "JSON exportieren"], ["macatlas://open/updates", "Updates öffnen"]]
        .map(([u, d]) => setRow("terminal", `<code style="font:12px var(--mono)">${u}</code>`, t(d), `<button class="act" style="opacity:1" data-copy="${u}" title="${t("Kopieren")}">${svg("copy")}</button>`)).join("")}
      ${setRow("folder", t("Ordner für Berichte & Exporte"), esc(s.exportDir || ""), `<button class="btn" data-do="openautodir">${t("Öffnen")}</button>`)}
    </div>
    <div class="group-title">${t("Daten")}</div>
    <div class="group">
      ${setRow("photo", t("App-Symbole im Export"), t("Symbole machen die exportierte Datei größer (ca. 1–2 MB), zeigen aber auf dem anderen Mac die richtigen Icons. Gilt ab dem nächsten Scan."), toggle("embedIcons", s.embedIcons))}
      ${setRow("history", t("Verlauf aufbewahren"), t("Aktuell {n} gespeichert. Ältere Scans werden automatisch entfernt.", { n: pl(s.historyCount, "{n} Scan", "{n} Scans") }), selectBox("historyMax", s.historyMax, [25, 50, 100, 200, 500].map((n) => [n, t("{n} Scans", { n })])))}
      ${setRow("folder", t("Datenordner"), esc(s.dataDir), `<button class="btn" data-do="opendata">${t("Im Finder zeigen")}</button>`)}
      ${setRow("warn", t("Zurücksetzen"), t("Verlauf: {a} · Notizen: {b}", { a: pl(s.historyCount, "{n} Scan", "{n} Scans"), b: nf.format(s.notesCount) }),
        `<button class="btn" data-do="clearhistory"${s.historyCount ? "" : " disabled"}>${t("Verlauf löschen …")}</button>
         <button class="btn" data-do="clearnotes"${s.notesCount ? "" : " disabled"}>${t("Notizen löschen …")}</button>`)}
    </div>
    <div class="group-title">${t("Über")}</div>
    <div class="group">
      <div class="about-head">
        <img src="icon.png" alt="">
        <div><b>MacAtlas</b><span>${esc(t("Version {v}", { v: s.version }))}</span>
          <span>${t("Entwickelt von {b}", { b: `<a href="#" data-url="${BUDDSTER_URL}">buddster</a>` })} · ${t("Software- und Webdevelopment")}</span></div>
      </div>
      ${setRow("globe", "buddster", "buddster.de", `<button class="btn" data-url="${BUDDSTER_URL}">${t("Webseite öffnen")}</button>`)}
      ${setRow("script", t("Quellcode"), "github.com/m4rcelnoel/MacAtlas", `<button class="btn" data-url="${REPO_URL}">GitHub</button>`)}
      ${setRow("warn", t("Fehler melden & Ideen"), t("Issue auf GitHub öffnen"), `<button class="btn" data-url="${REPO_URL}/issues">${t("Öffnen")}</button>`)}
      ${kv("Electron", esc(s.electron))}
      ${kv(t("Tastenkürzel"), "⌘R " + t("Scannen") + " · ⌘E " + t("Export") + " · ⇧⌘E Brewfile · ⌘P PDF · ⌘I Import · ⌘F " + t("Suche") + " · ⌘, " + t("Einstellungen"))}
    </div>
  </div>`;
}

async function changeSetting(key, value) {
  state.settings = await window.inventory.setSettings({ [key]: value });
  if (key === "language") setLanguage(state.settings.resolvedLanguage);
  if (key === "syncEnabled" && value) await loadMacs();
  render();
}

// ── Render ─────────────────────────────────────────────────────────
function setTitle(title, sub) { $("title").textContent = title; $("subtitle").textContent = sub || ""; }

function render(opts = {}) {
  const content = $("content");
  const prevScroll = content.scrollTop;
  state.pickRegistry = {};
  const hasData = !!state.data;
  $("exportBtn").disabled = !hasData || state.scanning;
  $("scanBtn").disabled = state.scanning;
  $("q").disabled = !hasData;
  const seg = $("viewSeg");
  seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.view));
  const snap = state.source === "snapshot" && hasData;
  $("snapPill").classList.toggle("on", snap);
  if (snap) $("snapText").textContent = "Snapshot · " + (state.data.system?.hostname || t("unbekannt"));
  renderNav();
  const show = (title, sub, html, segVisible) => {
    setTitle(title, sub);
    seg.style.visibility = segVisible ? "" : "hidden";
    content.innerHTML = html;
    content.scrollTop = opts.keepScroll ? prevScroll : 0;
    refreshInspector();
  };

  if (state.sel === "settings" && !state.q) return show(t("Einstellungen"), "", pageSettings(), false);
  if (state.scanning) return show("Scan", "", pageScanning(state.progress), false);
  if (!hasData) return show("MacAtlas", "", pageEmpty(), false);

  const q = state.q.trim();
  if (q) { seg.style.visibility = ""; content.innerHTML = pageSearch(q); return; }
  if (state.sel === "compare" && state.source === "snapshot") {
    const cmp = compareData();
    return show(t("Vergleich"), cmp ? t("{n} fehlen auf diesem Mac", { n: nf.format(cmp.missingTotal) }) : "", pageCompare(), true);
  }
  if (state.sel === "migrate" && state.source === "snapshot") {
    const ms = state.own ? migrationSteps() : null;
    return show(t("Umzug"), ms ? t("{n} Schritte offen", { n: ms.filter((x) => x.open).length }) : "", pageMigrate(), false);
  }
  if (state.sel === "notes") {
    const n = Object.keys(state.notes || {}).length;
    return show(t("Notizen"), n ? pl(n, "{n} Eintrag", "{n} Einträge") : "", pageNotes(), false);
  }
  const MAINT = {
    updates: ["Updates", () => state.data.updates ? (state.data.updates.items.length ? t("{n} verfügbar", { n: nf.format(state.data.updates.items.length) }) : t("Alles aktuell")) : "", pageUpdates],
    cleanup: ["Aufräumen", () => { const c = cleanupData(); return c ? t("{s} in {n} Programmen", { s: fmtBytes(c.total), n: nf.format(c.apps.length) }) : ""; }, pageCleanup],
    security: ["Sicherheit", () => { const s = state.data.security; return s ? t("{a} von {b} Schutzfunktionen aktiv", { a: s.checks.filter((c) => c.ok).length, b: s.checks.length }) : ""; }, pageSecurity],
    autostart: ["Autostart", () => state.data.autostart ? t("{n} Hintergrunddienste", { n: nf.format(state.data.autostart.length) }) : "", pageAutostart],
    storage: ["Speicherplatz", () => { const r = storageRows(); const b = r ? r.filter((x) => x.safe && x.bytes).reduce((a, x) => a + x.bytes, 0) : 0; return b ? t("{s} sicher freigebbar", { s: fmtBytes(b) }) : ""; }, pageStorage],
    versions: ["Versionen & Doppeltes", () => state.data.versions ? pl(versionsFlagged(), "{n} Hinweis", "{n} Hinweise") : "", pageVersions],
    licenses: ["Abos & Lizenzen", () => pl(licenseEntries().length, "{n} Eintrag", "{n} Einträge"), pageLicenses],
    dotfiles: ["Einstellungen mitnehmen", () => state.data.dotfiles ? pl(state.data.dotfiles.length, "{n} Datei", "{n} Dateien") : "", pageDotfiles],
    macs: ["Meine Macs", () => state.settings?.syncEnabled && state.macs ? pl(state.macs.macs.length, "{n} Mac", "{n} Macs") : "", pageMacs],
    history: ["Verlauf", () => { const n = state.history?.length || 0; return n ? pl(n, "{n} Scan", "{n} Scans") : ""; }, pageHistory],
  };
  if (MAINT[state.sel] && ownMode()) {
    const [title, sub, page] = MAINT[state.sel];
    return show(t(title), sub(), page(), false);
  }
  const cat = catById(state.sel);
  if (!cat || !cat.count) {
    state.sel = "overview";
    const s = state.data.system || {};
    return show(t("Übersicht"), [s.hostname, s.os_version && `macOS ${s.os_version}`].filter(Boolean).join(" · "), pageOverview(), false);
  }
  show(label(cat), pl(cat.count, "{n} Eintrag", "{n} Einträge"), pageCategory(cat), true);
}

// ── Events ─────────────────────────────────────────────────────────
function go(id) { closeInspector(); state.sel = id; state.q = ""; $("q").value = ""; $("sbSearch").classList.remove("has-q"); store.set("mi-sel", id); document.body.classList.remove("sb-open"); render(); }

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text || ""); toast(msg); }
  catch { toast(t("Kopieren nicht möglich")); }
}

document.addEventListener("click", async (e) => {
  if (e.target.closest(".sheet-bg")) return;
  const ch = e.target.closest("[data-choice] button[data-value]");
  if (ch) {
    const key = ch.parentElement.dataset.choice;
    return changeSetting(key, ch.dataset.value);
  }
  if (e.target.closest("label.pick")) return;   // handled by the change event
  const pa = e.target.closest("[data-pickall]");
  if (pa) {
    const [ctx, group, on] = pa.dataset.pickall.split("|");
    setPicked(ctx, pickEntries(ctx, group), on === "1");
    return render({ keepScroll: true });
  }
  const lf = e.target.closest("[data-listfilter]");
  if (lf) {
    const [catId, key] = lf.dataset.listfilter.split("|");
    setListOpt(catId, "filter", key);
    return render({ keepScroll: true });
  }
  const el = e.target.closest("[data-nav],[data-copy],[data-url],[data-reveal],[data-do],[data-settings],[data-path],[data-note],[data-runcmd],[data-openmac],[data-migrate],[data-open]");
  if (!el) return;
  const d = el.dataset;
  if (d.nav) return go(d.nav);
  if (d.settings) return window.inventory.openSettings(d.settings);
  if (d.path) return window.inventory.revealPath(d.path);
  if (d.note) return openNoteSheet(d.note);
  if (d.runcmd) { const r = storageCmd(d.runcmd); return r && r.cmd ? runInTerminal(r.label, r.cmd) : null; }
  if (d.openmac) return window.inventory.openMac(d.openmac);
  if (d.migrate) {
    const scr = migrationScript(d.migrate);
    if (!scr) return;
    const ok = await window.inventory.runScript(scr, "MacAtlas Umzug.command");
    return toast(ok ? t("Läuft im Terminal – danach „Diesen Mac neu prüfen\"") : t("Terminal konnte nicht geöffnet werden"), 4500);
  }
  if (d.copy) {
    try {
      await navigator.clipboard.writeText(d.copy);
      el.classList.add("ok"); el.innerHTML = svg("check");
      toast(`${t("Kopiert:")} <code>${esc(d.copy)}</code>`);
      setTimeout(() => { el.classList.remove("ok"); el.innerHTML = svg("copy"); }, 1200);
    } catch { toast(t("Kopieren nicht möglich")); }
    return;
  }
  if (d.url) return window.inventory.openUrl(d.url);
  if (d.reveal) return window.inventory.reveal(d.reveal);
  if (d.open) return state.inspect?.key === d.open ? closeInspector() : openInspector(d.open);
  switch (d.do) {
    case "closeinspector": return closeInspector();
    case "scan": return startScan();
    case "cancelscan": return window.inventory.cancelScan();
    case "import": return window.inventory.import();
    case "brewfile": return window.inventory.exportBrewfile();
    case "report": return saveReport();
    case "copyscript": return copyText(state.script, t("Installationsskript kopiert"));
    case "copyupdates": return copyText(state.updateScript, t("Update-Skript kopiert"));
    case "runupdates": {
      const ok = await window.inventory.runScript(state.updateScript || "", "MacAtlas Updates.command");
      return toast(ok ? t("Updates laufen im Terminal – danach neu scannen (⌘R)") : t("Terminal konnte nicht geöffnet werden"), 4500);
    }
    case "saveupdates":
      if (await window.inventory.saveScript(state.updateScript || "", "MacAtlas Updates.command")) toast(t("Skript gesichert"));
      return;
    case "savescript": {
      const host = (state.data?.system?.hostname || "Mac").replace(/[^\w.-]+/g, "-");
      if (await window.inventory.saveScript(state.script || "", t("Fehlende Programme von {h}.command", { h: host }))) toast(t("Skript gesichert"));
      return;
    }
    case "opendata": return window.inventory.openDataDir();
    case "scankeep": return startScan(true);
    case "csv": return window.inventory.exportCsv();
    case "cleanpicked": {
      const cmds = (storageRows() || []).filter((r) => r.cmd && r.bytes && isPicked("storage", r.id, r)).map((r) => r.cmd);
      return cmds.length ? runInTerminal("Ausgewählte aufräumen", cmds.join(" ; ")) : null;
    }
    case "enablesync": return changeSetting("syncEnabled", true);
    case "choosesync": state.settings = await window.inventory.chooseSyncDir(); await loadMacs(); return render();
    case "opensync": return window.inventory.openSyncDir();
    case "openautodir": return window.inventory.openAutoDir("");
    case "syncnow": state.macs = await window.inventory.syncNow(); toast(t("Geteilt")); return render();
    case "dotexport": {
      const res = await window.inventory.exportDotfiles();
      if (res) { state.dotResult = res; toast(t("Einstellungspaket gesichert")); render(); }
      return;
    }
    case "clearhistory":
      if (await window.inventory.clearHistory()) { toast(t("Verlauf gelöscht")); state.history = await window.inventory.history(); state.settings = await window.inventory.getSettings(); render(); }
      return;
    case "clearnotes":
      if (await window.inventory.clearNotes()) { toast(t("Notizen gelöscht")); state.notes = {}; state.settings = await window.inventory.getSettings(); render(); }
      return;
  }
});
document.addEventListener("change", (e) => {
  const pk = e.target.closest("input[data-pick]");
  if (pk) {
    const entry = pickEntries(pk.dataset.pick, "*").find((x) => x.key === pk.dataset.key);
    if (entry) setPicked(pk.dataset.pick, [entry], pk.checked);
    return render({ keepScroll: true });
  }
  const ls = e.target.closest("select[data-listsort]");
  if (ls) { setListOpt(ls.dataset.listsort, "sort", ls.value); return render({ keepScroll: true }); }
  const tg = e.target.closest("input[data-set]");
  if (tg) return changeSetting(tg.dataset.set, tg.checked);
  const sel = e.target.closest("select[data-select]");
  if (sel) return changeSetting(sel.dataset.select, sel.dataset.select === "historyMax" ? Number(sel.value) : sel.value);
});
// Typing in a list filter only re-renders the list, so the input keeps focus
document.addEventListener("input", (e) => {
  const lq = e.target.closest("input[data-listq]");
  if (!lq) return;
  (state.listText ||= {})[lq.dataset.listq] = lq.value;
  const cat = catById(lq.dataset.listq);
  clearTimeout(render.lt);
  render.lt = setTimeout(() => { if (cat && $("listBody")) $("listBody").innerHTML = listBodyHtml(cat); }, 80);
});
$("viewSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  state.view = b.dataset.v; store.set("mi-view", state.view); render();
});
$("q").addEventListener("input", (e) => {
  state.q = e.target.value;
  $("sbSearch").classList.toggle("has-q", !!state.q);
  clearTimeout(render.t); render.t = setTimeout(render, 90);
});
$("qClear").onclick = () => { $("q").value = ""; state.q = ""; $("sbSearch").classList.remove("has-q"); render(); $("q").focus(); };
$("scanBtn").onclick = () => startScan();
$("importBtn").onclick = () => window.inventory.import();
$("exportBtn").onclick = () => window.inventory.export();
$("snapBack").onclick = () => window.inventory.switchToOwn();
$("sbToggle").onclick = () => document.body.classList.toggle("sb-open");
$("scrim").onclick = () => document.body.classList.remove("sb-open");
$("gearBtn").onclick = () => go("settings");
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key === "f" || e.key === "k")) { e.preventDefault(); $("q").focus(); $("q").select(); }
  if (mod && e.key === ",") { e.preventDefault(); go("settings"); }
  if (e.key === "Escape" && document.activeElement === $("q")) $("qClear").click();
  else if (e.key === "Escape" && state.inspect && !document.querySelector(".sheet-bg")) closeInspector();
});

function startScan(keepSnapshot) {
  if (state.scanning) return;
  state.scanning = true; state.progress = null;
  if (state.sel === "settings") state.sel = "overview";
  render();
  window.inventory.rescan(keepSnapshot ? { keepSnapshot: true } : undefined);
}
window.inventory.onScanStarted(() => {
  // Started from the menu or menu bar: show the progress page (with Cancel) instead of settings
  if (state.sel === "settings") state.sel = "overview";
  if (!state.scanning) { state.scanning = true; state.progress = null; }
  render();
});
window.inventory.onScanProgress((p) => {
  state.progress = p;
  const bar = $("progBar"), step = $("progStep");
  if (bar && step) { bar.style.width = Math.round((p.step / p.total) * 100) + "%"; step.textContent = stepLabel(p); }
  else render();
});
window.inventory.onScanDone(async (p) => {
  state.scanning = false;
  if (p.ok) { await load(); toast(t("Scan abgeschlossen")); }
  else if (p.cancelled) { render(); toast(t("Scan abgebrochen")); }
  else { render(); toast(t("Scan fehlgeschlagen: {e}", { e: esc(p.error || t("unbekannt")) }), 6000); }
});
window.inventory.onInventoryChanged(() => load());
window.inventory.onNav((page) => { if (state.data || page === "settings") go(page); else state.sel = page; });
window.inventory.onReportRequest(() => saveReport());
window.inventory.onReportAuto(async () => {
  for (let i = 0; i < 50 && !state.data; i++) await new Promise((r) => setTimeout(r, 100));
  if (state.data && state.source === "own") window.inventory.savePdfAuto(buildReportHtml());
});
window.inventory.onToast(({ msg, ms }) => toast(esc(msg), ms));
window.inventory.onFocus((f) => document.body.classList.toggle("inactive", !f));
window.inventory.onAccent((c) => c && document.documentElement.style.setProperty("--accent", c));
window.inventory.onSettings((s) => {
  const langChanged = !state.settings || state.settings.resolvedLanguage !== s.resolvedLanguage;
  state.settings = s;
  if (langChanged) setLanguage(s.resolvedLanguage);
  render();
});
window.inventory.accent().then((c) => c && document.documentElement.style.setProperty("--accent", c));

async function load() {
  const wasSnapshot = state.source === "snapshot" && !!state.data;
  const r = await window.inventory.read();
  state.data = r && r.data ? r.data : null;
  state.own = r && r.own ? r.own : null;
  state.source = r ? r.source : "own";
  const SNAPSHOT_PAGES = new Set(["compare", "migrate", "notes", ...cats().map((c) => c.id)]);
  if (state.source === "snapshot" && (!wasSnapshot || !SNAPSHOT_PAGES.has(state.sel))) state.sel = "compare";
  try { state.history = state.source === "own" && state.data ? await window.inventory.history() : []; } catch { state.history = []; }
  try { state.notes = state.source === "own" ? await window.inventory.notes() : (state.data?.notes || {}); } catch { state.notes = {}; }
  if (state.source === "own" && state.settings?.syncEnabled) await loadMacs();
  render();
}

(async () => {
  try { state.settings = await window.inventory.getSettings(); } catch { state.settings = null; }
  setLanguage(state.settings?.resolvedLanguage || "de");
  await load();
})();
