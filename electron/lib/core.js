// Pure helpers used by the main process. No Electron imports here, so they
// can be unit-tested with plain Node (see test/core.test.js).

// Package names that are safe to put into generated shell scripts / Brewfiles.
// Imported snapshots are untrusted, so anything else is dropped.
const SAFE_TOKEN = /^[A-Za-z0-9@._/+:-]+$/;

// Storage items whose content regenerates by itself (caches). Must match the
// `safe: true` entries of STORAGE_META in renderer/app.js (checked by a test).
const SAFE_STORAGE = new Set(["xcode_derived", "xcode_devicesupport", "sim_caches", "npm_cache", "pip_cache",
  "yarn_cache", "pnpm_store", "gradle_cache", "cocoapods_cache"]);

const safeHost = (h) => String(h || "Mac").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "Mac";

/** Next renewal date on or after `today` for "YYYY-MM-DD" + cycle (once | monthly | yearly). */
function nextRenewal(dateStr, cycle, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const day0 = new Date(today); day0.setHours(0, 0, 0, 0);
  if (cycle === "monthly" || cycle === "yearly") {
    while (d < day0) {
      if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
      else d.setFullYear(d.getFullYear() + 1);
    }
  }
  return d;
}

/** Local "YYYY-MM-DD" (toISOString would shift the day for time zones east of UTC). */
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Bytes that can be reclaimed without losing data. */
function storageReclaimable(st) {
  let b = (st.items || []).filter((i) => SAFE_STORAGE.has(i.id)).reduce((s, i) => s + (i.bytes || 0), 0);
  b += st.brew_cleanup_bytes || 0;
  for (const d of st.docker || []) if (d.type === "Build Cache") b += d.reclaim_bytes || 0;
  return b;
}

/** Small per-scan record for the history timeline, charts and change warnings. */
function compactInventory(data) {
  const s = data.system || {};
  const cats = {};
  for (const c of data.categories || []) {
    cats[c.id] = {};
    for (const it of c.items || []) cats[c.id][it.name] = it.version || "";
  }
  return {
    generated_at: data.generated_at,
    system: {
      hostname: s.hostname, os_version: s.os_version, os_build: s.os_build, os_marketing: s.os_marketing,
      storage_used_gb: s.storage?.used_gb, storage_total_gb: s.storage?.total_gb,
    },
    updates: data.updates ? data.updates.items.length : null,
    total: data.total_count,
    labels: Object.fromEntries((data.categories || []).map((c) => [c.id, c.label])),
    cats,
    autostart: data.autostart ? data.autostart.map((a) => a.label) : undefined,
    security: data.security ? Object.fromEntries(data.security.checks.map((c) => [c.id, c.ok])) : undefined,
    ports: data.ports ? data.ports.filter((p) => p.exposed).map((p) => `${p.process}:${p.port}`) : undefined,
    reclaimable: data.storage ? storageReclaimable(data.storage) : undefined,
  };
}

/** What changed between two compact scans that is worth a notification. */
function significantChanges(prev, cur) {
  return {
    newApps: Object.keys(cur.cats.apps || {}).filter((n) => !(n in (prev.cats?.apps || {}))),
    newAgents: (cur.autostart || []).filter((l) => prev.autostart && !prev.autostart.includes(l)),
    weaker: Object.entries(cur.security || {}).filter(([id, ok]) => !ok && prev.security && prev.security[id] === true).map(([id]) => id),
    newPorts: (cur.ports || []).filter((p) => prev.ports && !prev.ports.includes(p)),
  };
}

/**
 * Brewfile for `brew bundle`. A Brewfile is Ruby, so only plain package tokens
 * are written and App Store names lose quotes, backslashes and "#" (interpolation).
 * `header` holds the three comment lines (already translated).
 */
function buildBrewfile(data, header = []) {
  const items = (id) => (data.categories.find((c) => c.id === id) || {}).items || [];
  const formulae = items("brew_formulae"), casks = items("brew_casks");
  const hasLeaf = formulae.some((f) => "leaf" in f);
  const taps = new Set();
  for (const it of [...formulae, ...casks]) if (it.tap && SAFE_TOKEN.test(it.tap)) taps.add(it.tap);
  const name = (it) => it.full_name || it.name;
  const brews = formulae.filter((f) => !hasLeaf || f.leaf).map(name).filter((n) => SAFE_TOKEN.test(n));
  const caskNames = casks.map(name).filter((n) => SAFE_TOKEN.test(n));
  const mas = items("mas").map((it) => [String(it.name).replace(/["\\#\r\n]/g, ""), (it.install_cmd || "").match(/^mas install (\d+)$/)?.[1]])
    .filter(([, id]) => id);
  const vscode = items("vscode").map((it) => it.name).filter((n) => SAFE_TOKEN.test(n));
  const section = (lines) => (lines.length ? [...lines, ""] : []);
  const lines = [
    ...header.map((h) => `# ${String(h).replace(/[\r\n]/g, " ")}`), "",
    ...section([...taps].sort().map((t) => `tap "${t}"`)),
    ...section(brews.sort().map((n) => `brew "${n}"`)),
    ...section(caskNames.sort().map((n) => `cask "${n}"`)),
    ...section(mas.map(([n, id]) => `mas "${n}", id: ${id}`)),
    ...vscode.sort().map((n) => `vscode "${n}"`),
  ];
  return { text: lines.join("\n").trimEnd() + "\n", count: taps.size + brews.length + caskNames.length + mas.length + vscode.length };
}

/** CSV for Excel/Numbers. German Excel expects ";" and a decimal comma. */
function buildCsv(data, notes = {}, lang = "en") {
  const de = lang === "de";
  const sep = de ? ";" : ",";
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // never let a cell become a formula (snapshot data is untrusted)
    return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = de
    ? ["Kategorie", "Name", "Version", "Installationsbefehl", "Website", "Größe (MB)", "Zuletzt benutzt", "Architektur", "Tags", "Notiz"]
    : ["Category", "Name", "Version", "Install command", "Website", "Size (MB)", "Last used", "Architecture", "Tags", "Note"];
  const rows = [head.map(cell).join(sep)];
  for (const c of data.categories || []) {
    for (const it of c.items || []) {
      const n = notes[`${c.id}:${it.name}`] || {};
      rows.push([c.label, it.name, it.version, it.install_cmd, it.install_url,
        it.size_bytes ? (it.size_bytes / 1e6).toFixed(1).replace(".", de ? "," : ".") : "",
        it.last_used ? it.last_used.slice(0, 10) : "", it.arch, (n.tags || []).join(", "), n.note].map(cell).join(sep));
    }
  }
  return "\ufeff" + rows.join("\r\n") + "\r\n";
}

// Values that look like secrets are replaced before settings files are exported.
const REDACTED = "<ENTFERNT-REMOVED>";
const SECRET_ASSIGN = /((?:api[_-]?key|apikey|token|secret|passw(?:or)?d|pwd|auth|bearer|private[_-]?key|access[_-]?key|client[_-]?secret)[\w-]*["']?\s*[=:]\s*)(["']?)[^\s"'#]+\2/gi;
const SECRET_TOKEN = /\b(ghp_[A-Za-z0-9]{20,}|github_pat_\w{20,}|gh[ousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abpr]-[\w-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|glpat-[\w-]{20,})\b/g;
function redact(text) {
  let n = 0;
  const out = String(text)
    .replace(SECRET_ASSIGN, (_m, pre, q) => { n++; return `${pre}${q}${REDACTED}${q}`; })
    .replace(SECRET_TOKEN, () => { n++; return REDACTED; });
  return { text: out, count: n };
}

/** Parses "macatlas://<action>[/<arg>]" – returns null for anything else. */
function parseAppUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "macatlas:") return null;
  const parts = [u.hostname, ...u.pathname.split("/")].filter(Boolean).map((p) => p.toLowerCase());
  return parts.length ? { action: parts[0], arg: parts[1] || null } : null;
}

/** Compares release versions like "v1.3.0" and "1.2.10": 1 if a is newer, -1 if older, 0 if equal. */
function compareVersions(a, b) {
  const parse = (v) => String(v || "").replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}

const RELEASE_PREFIX = "https://github.com/m4rcelnoel/MacAtlas/releases/";
/**
 * Picks what the updater needs from a GitHub "latest release" response.
 * Returns null for drafts, pre-releases and releases without the DMG; the download URL
 * must point at this repository's releases.
 */
function releaseInfo(rel) {
  if (!rel || rel.draft || rel.prerelease || !rel.tag_name) return null;
  const dmg = (rel.assets || []).find((a) => a && a.name === "MacAtlas.dmg");
  const url = dmg ? String(dmg.browser_download_url || "") : "";
  if (!url.startsWith(RELEASE_PREFIX + "download/")) return null;
  const page = String(rel.html_url || "");
  return {
    version: String(rel.tag_name).replace(/^v/i, ""),
    url,
    size: dmg.size || 0,
    page: page.startsWith(RELEASE_PREFIX) ? page : RELEASE_PREFIX + "latest",
    notes: String(rel.body || "").slice(0, 4000),
  };
}

// ── Running scripts inside the app ──────────────────────────────────
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]|[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
/**
 * Turns raw terminal output into plain lines. Progress bars redraw a line with "\r",
 * so only the text after the last "\r" counts. Returns complete lines and the unfinished rest.
 */
function splitOutput(buffer) {
  const parts = String(buffer).split("\n");
  const rest = parts.pop();
  const clean = (l) => l.split("\r").filter((x) => x.trim()).pop()?.replace(ANSI, "").trimEnd() ?? "";
  return { lines: parts.map(clean).filter((l) => l !== ""), rest };
}
/** Recognises progress, errors and known problems in package manager output. */
function classifyLine(line) {
  let m;
  if ((m = line.match(/^==> (?:Upgrading|Installing|Reinstalling) ([A-Za-z@][\w@.+-]*)$/))) return { step: m[1] };
  if ((m = line.match(/^Successfully installed (.+)$/))) return { step: m[1].split(" ")[0] };
  if ((m = line.match(/^==> (?:▸ (.+)|Installed (.+))$/))) return { step: m[1] || m[2] };
  if (/not signed in|sign in to the App Store/i.test(line)) return { hint: "mas", error: line };
  if (/^sudo: .*(password|askpass)/i.test(line)) return { hint: "sudo", error: line };
  if (/FilePermissionError|Permission denied|EACCES|You don't have write permissions/.test(line)) {
    return /^(Error|ERROR|error)[:\s]|^npm (ERR!|error) /.test(line) ? { hint: "perm", error: line } : { hint: "perm" };
  }
  if (/^(Error|ERROR|error)[:\s]|^npm (ERR!|error) |^fatal: |^E: /.test(line)) return { error: line };
  return null;
}

module.exports = {
  SAFE_TOKEN, SAFE_STORAGE, REDACTED, safeHost, nextRenewal, isoDate, storageReclaimable, compactInventory,
  significantChanges, buildBrewfile, buildCsv, redact, parseAppUrl, compareVersions, releaseInfo,
  splitOutput, classifyLine,
};
