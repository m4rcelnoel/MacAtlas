// Static checks of the renderer: translations, shared constants and security settings.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { SAFE_STORAGE } = require("../lib/core");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const appJs = read("renderer/app.js");
const i18nSrc = read("renderer/i18n.js");
const I18N_EN = vm.runInNewContext(i18nSrc + "\nI18N_EN;");
const unquote = (s) => JSON.parse(`"${s}"`);

// Every string the UI passes through t()/pl(), plus the label tables translated at render time
function translationKeys() {
  const keys = new Set();
  for (const m of appJs.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(unquote(m[1]));
  for (const m of appJs.matchAll(/\bpl\([^,]+,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g)) { keys.add(unquote(m[1])); keys.add(unquote(m[2])); }
  for (const m of appJs.matchAll(/(?:label|hint|desc|title): "((?:[^"\\]|\\.)*)"/g)) keys.add(unquote(m[1]));
  for (const name of ["SECTIONS", "SHORT_LABELS", "DESC", "STEP", "SEC_TEXT", "SCOPE", "ARCH", "CYCLE", "DUP_REASON", "KNOWN_PROCS", "UPD_SOURCES", "PRESET_TAGS"]) {
    const block = appJs.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
    assert.ok(block, `table ${name} not found`);
    for (const m of block[1].matchAll(/:\s*"((?:[^"\\]|\\.)*)"|\[\s*"((?:[^"\\]|\\.)*)"(?:,\s*"((?:[^"\\]|\\.)*)")?/g)) {
      for (const v of [m[1], m[2], m[3]]) if (v) keys.add(unquote(v));
    }
  }
  return keys;
}

// Names, ids and technical terms that are the same in both languages
const SAME_IN_EN = /^(Chip|Status|Shell|Hardware|Software|Details|Name|Version|Electron|Updater|Brewfile|Intel|MacAtlas|Tags|Snapshot|Scan|Docker|Homebrew|Claude|Claude Code|Apple Silicon|Universal|FileVault|Firewall|Gatekeeper|VS Code|Ruby Gems|Plugins|Skills|npm \(global\)|Python \(pip\)|Mac App Store|Homebrew Casks|Homebrew bin|Docker Images|Docker Container|Updates|System|Info|Downloads|macos|brew|cask|app|npm|pip|gem|user|agent|daemon|[a-z_]+|\/.*|~.*)$/;

test("every UI string has an English translation", () => {
  const missing = [...translationKeys()].filter((k) => !(k in I18N_EN) && !SAME_IN_EN.test(k) && /[a-zäöü]/i.test(k));
  assert.deepEqual(missing, []);
});

test("translations keep the same {placeholders}", () => {
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const broken = Object.entries(I18N_EN).filter(([de, en]) => ph(de) !== ph(en)).map(([de]) => de);
  assert.deepEqual(broken, []);
});

test("i18n.js has no duplicate keys", () => {
  const keys = [...i18nSrc.matchAll(/^\s*"((?:[^"\\]|\\.)*)":|,\s*"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1] ?? m[2]);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dupes, []);
});

test("storage items marked safe in the UI match the core definition", () => {
  const block = appJs.match(/const STORAGE_META = \{([\s\S]*?)\n\};/)[1];
  const safeInUi = [...block.matchAll(/^\s*(\w+): \{[^\n]*safe: true/gm)].map((m) => m[1]).sort();
  assert.deepEqual(safeInUi, [...SAFE_STORAGE].sort());
});

test("renderer runs with a strict Content Security Policy", () => {
  const csp = read("renderer/index.html").match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const scriptSrc = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("script-src"));
  assert.equal(scriptSrc, "script-src 'self'");
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(read("renderer/index.html"), /<script>(?!\s*<\/script>)/, "no inline scripts");
});

test("main window is sandboxed and cannot navigate away", () => {
  const main = read("main.js");
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /will-navigate/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
});

test("preload only exposes IPC wrappers, never Node APIs", () => {
  const preload = read("preload.js");
  assert.deepEqual([...preload.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]), ["electron"]);
  // ipcRenderer.on("x", cb) would pass the event object (with .sender = ipcRenderer) to the page
  assert.doesNotMatch(preload, /ipcRenderer\.on\("[^"]+",\s*cb\)/, "listeners must wrap the callback");
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer\s*\)/, "ipcRenderer itself is not exposed");
  assert.doesNotMatch(preload, /\b(fs|child_process|shell)\b/);
});
