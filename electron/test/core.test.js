const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core");

const inv = (cats, extra = {}) => ({
  generated_at: "2026-10-31T20:00:00",
  system: { hostname: "Test Mac", storage: { used_gb: 500, total_gb: 1000 } },
  total_count: 0,
  categories: Object.entries(cats).map(([id, items]) => ({ id, label: id, items, count: items.length })),
  ...extra,
});

test("safeHost turns any hostname into a file-name-safe token", () => {
  assert.equal(core.safeHost("MacBook Pro – Büro"), "MacBook-Pro-B-ro");
  assert.equal(core.safeHost("../../etc"), "..-..-etc");
  assert.equal(core.safeHost(""), "Mac");
  assert.equal(core.safeHost("---"), "Mac");
});

test("nextRenewal rolls monthly and yearly subscriptions forward", () => {
  const today = new Date(2026, 9, 31); // 31 Oct 2026
  assert.equal(core.isoDate(core.nextRenewal("2026-01-15", "monthly", today)), "2026-11-15");
  assert.equal(core.isoDate(core.nextRenewal("2024-03-01", "yearly", today)), "2027-03-01");
  assert.equal(core.isoDate(core.nextRenewal("2026-10-31", "monthly", today)), "2026-10-31", "today counts as upcoming");
  assert.equal(core.isoDate(core.nextRenewal("2025-05-05", "once", today)), "2025-05-05", "one-time dates stay in the past");
  assert.equal(core.nextRenewal("31.10.2026", "monthly", today), null);
  assert.equal(core.nextRenewal(undefined, "monthly", today), null);
});

test("isoDate uses the local calendar day", () => {
  assert.equal(core.isoDate(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
});

test("storageReclaimable only counts caches that regenerate", () => {
  const st = {
    items: [{ id: "xcode_derived", bytes: 10 }, { id: "simulators", bytes: 1000 }, { id: "npm_cache", bytes: 5 }, { id: "downloads", bytes: 99 }],
    brew_cleanup_bytes: 3,
    docker: [{ type: "Build Cache", reclaim_bytes: 7 }, { type: "Images", reclaim_bytes: 500 }, { type: "Local Volumes", reclaim_bytes: 400 }],
  };
  assert.equal(core.storageReclaimable(st), 10 + 5 + 3 + 7);
});

test("compactInventory keeps names, versions and the fields used for warnings", () => {
  const data = inv({ apps: [{ name: "Xcode", version: "27.1" }], npm: [{ name: "corepack", version: "" }] }, {
    total_count: 2,
    updates: { items: [{}, {}, {}] },
    autostart: [{ label: "com.example.agent" }],
    security: { checks: [{ id: "firewall", ok: false }, { id: "sip", ok: true }] },
    ports: [{ process: "node", port: 3000, exposed: true }, { process: "redis", port: 6379, exposed: false }],
    storage: { items: [{ id: "npm_cache", bytes: 42 }] },
  });
  const c = core.compactInventory(data);
  assert.deepEqual(c.cats.apps, { Xcode: "27.1" });
  assert.equal(c.cats.npm.corepack, "");
  assert.equal(c.updates, 3);
  assert.equal(c.total, 2);
  assert.deepEqual(c.autostart, ["com.example.agent"]);
  assert.deepEqual(c.security, { firewall: false, sip: true });
  assert.deepEqual(c.ports, ["node:3000"]);
  assert.equal(c.reclaimable, 42);
  assert.equal(c.system.storage_used_gb, 500);
});

test("significantChanges reports new apps, services, weaker protection and new ports", () => {
  const prev = { cats: { apps: { A: "1" } }, autostart: ["x"], security: { firewall: true, sip: true }, ports: ["node:3000"] };
  const cur = { cats: { apps: { A: "1", B: "2" } }, autostart: ["x", "y"], security: { firewall: false, sip: true }, ports: ["node:3000", "py:8000"] };
  assert.deepEqual(core.significantChanges(prev, cur), { newApps: ["B"], newAgents: ["y"], weaker: ["firewall"], newPorts: ["py:8000"] });
  // older history entries without the new fields must not produce false alarms
  assert.deepEqual(core.significantChanges({ cats: { apps: { A: "1" } } }, cur).newAgents, []);
  assert.deepEqual(core.significantChanges({ cats: { apps: { A: "1" } } }, cur).weaker, []);
});

test("buildBrewfile writes only safe tokens and neutralises Ruby interpolation", () => {
  const data = inv({
    brew_formulae: [{ name: "git", leaf: true }, { name: "openssl@3", leaf: false }, { name: "x; rm -rf ~", leaf: true },
      { name: "tool", leaf: true, tap: "someone/tap", full_name: "someone/tap/tool" }],
    brew_casks: [{ name: "rectangle" }, { name: "evil`cmd`" }],
    mas: [{ name: 'Evil" #{system("rm -rf ~")}', install_cmd: "mas install 123" }, { name: "Xcode", install_cmd: "mas install 497799835" },
      { name: "Bad", install_cmd: "mas install 1; rm -rf ~" }],
    vscode: [{ name: "esbenp.prettier-vscode" }],
  });
  const { text, count } = core.buildBrewfile(data, ["Header", "Source", "Install"]);
  assert.match(text, /^# Header\n# Source\n# Install\n/);
  assert.match(text, /^tap "someone\/tap"$/m);
  assert.match(text, /^brew "git"$/m);
  assert.match(text, /^brew "someone\/tap\/tool"$/m);
  assert.doesNotMatch(text, /openssl/, "dependencies are left out");
  assert.doesNotMatch(text, /rm -rf ~"?$/m);
  assert.doesNotMatch(text, /#\{/, "no Ruby interpolation survives");
  assert.doesNotMatch(text, /evil/);
  assert.match(text, /^mas "Xcode", id: 497799835$/m);
  assert.doesNotMatch(text, /id: 1;/);
  assert.match(text, /^vscode "esbenp.prettier-vscode"$/m);
  assert.equal(count, 1 + 2 + 1 + 2 + 1);
});

test("buildCsv escapes formulas and uses the locale's separator", () => {
  const data = inv({ apps: [{ name: "=HYPERLINK(\"http://evil\")", version: "1", size_bytes: 1234567 }, { name: "Normal, App", version: "2" }] });
  const de = core.buildCsv(data, { "apps:Normal, App": { tags: ["Arbeit"], note: "Lizenz" } }, "de");
  assert.ok(de.startsWith("﻿Kategorie;Name;"));
  assert.match(de, /'=HYPERLINK/, "formula is prefixed with an apostrophe");
  assert.match(de, /;"1,2";/, "decimal comma in German");
  assert.match(de, /"Normal, App"/);
  assert.match(de, /Arbeit;Lizenz/);
  const en = core.buildCsv(data, {}, "en");
  assert.ok(en.startsWith("﻿Category,Name,"));
  assert.match(en, /,1\.2,/);
  assert.ok(en.endsWith("\r\n"));
});

test("redact removes secrets but keeps normal settings", () => {
  // Fake tokens are assembled at runtime so secret scanners don't flag this file
  const gh = "gh" + "p_" + "ABCDEFGHIJKLMNOPQRSTUVWX12345", aws = "AK" + "IA" + "ABCDEFGHIJKLMNOP";
  const input = [
    'export OPENAI_API_KEY="sk-abc123def456ghi789jkl012mno"',
    'export PATH="/opt/homebrew/bin:$PATH"',
    "//registry.npmjs.org/:_authToken=npm_abcdefghijk123",
    "password = hunter2",
    'alias ll="ls -la"',
    `token: ${gh}`,
    `url = https://x.test?key=${aws}`,
    "  IdentityFile ~/.ssh/id_ed25519",
  ].join("\n");
  const { text, count } = core.redact(input);
  assert.equal(count, 5);
  for (const secret of ["sk-abc123", "npm_abcdef", "hunter2", gh, aws]) assert.ok(!text.includes(secret), secret);
  assert.match(text, /export PATH="\/opt\/homebrew\/bin:\$PATH"/);
  assert.match(text, /alias ll="ls -la"/);
  assert.match(text, /IdentityFile ~\/\.ssh\/id_ed25519/);
  assert.match(text, new RegExp(`OPENAI_API_KEY="${core.REDACTED}"`));
});

test("parseAppUrl accepts only macatlas:// links", () => {
  assert.deepEqual(core.parseAppUrl("macatlas://scan"), { action: "scan", arg: null });
  assert.deepEqual(core.parseAppUrl("macatlas://open/Updates"), { action: "open", arg: "updates" });
  assert.deepEqual(core.parseAppUrl("macatlas:///report"), { action: "report", arg: null });
  assert.equal(core.parseAppUrl("https://evil.test/scan"), null);
  assert.equal(core.parseAppUrl("not a url"), null);
  assert.equal(core.parseAppUrl("macatlas://"), null);
});

test("SAFE_TOKEN rejects shell metacharacters", () => {
  for (const ok of ["git", "node@22", "someone/tap/tool", "esbenp.prettier-vscode", "c++"]) assert.ok(core.SAFE_TOKEN.test(ok), ok);
  for (const bad of ["a;b", "a b", "$(x)", "`x`", "a|b", "a&b", "a>b", ""]) assert.ok(!core.SAFE_TOKEN.test(bad), bad);
});

test("compareVersions orders release tags numerically", () => {
  assert.equal(core.compareVersions("v1.3.0", "1.2.1"), 1);
  assert.equal(core.compareVersions("1.2.10", "1.2.9"), 1);
  assert.equal(core.compareVersions("1.2", "1.2.0"), 0);
  assert.equal(core.compareVersions("1.2.1", "v1.10.0"), -1);
});

test("releaseInfo only accepts the DMG from this repository", () => {
  const rel = (url, extra = {}) => ({ tag_name: "v1.3.0", html_url: "https://github.com/m4rcelnoel/MacAtlas/releases/tag/v1.3.0",
    assets: [{ name: "MacAtlas.dmg", size: 5, browser_download_url: url }], ...extra });
  const ok = "https://github.com/m4rcelnoel/MacAtlas/releases/download/v1.3.0/MacAtlas.dmg";
  assert.deepEqual(core.releaseInfo(rel(ok)), { version: "1.3.0", url: ok, size: 5,
    page: "https://github.com/m4rcelnoel/MacAtlas/releases/tag/v1.3.0", notes: "" });
  assert.equal(core.releaseInfo(rel("https://evil.example/MacAtlas.dmg")), null);
  assert.equal(core.releaseInfo(rel("https://github.com/someone/MacAtlas/releases/download/v1.3.0/MacAtlas.dmg")), null);
  assert.equal(core.releaseInfo(rel(ok, { prerelease: true })), null);
  assert.equal(core.releaseInfo(rel(ok, { draft: true })), null);
  assert.equal(core.releaseInfo({ tag_name: "v1.3.0", assets: [] }), null);
});

test("splitOutput strips colours and keeps the last state of progress bars", () => {
  const r = core.splitOutput("\x1b[34m==>\x1b[0m \x1b[1mUpgrading aom\x1b[0m\n###   10%\r######  60%\r######## 100%\nDownloading par");
  assert.deepEqual(r.lines, ["==> Upgrading aom", "######## 100%"]);
  assert.equal(r.rest, "Downloading par");
  assert.deepEqual(core.splitOutput("\n\n").lines, []);
});

test("classifyLine finds steps, errors and known problems", () => {
  assert.deepEqual(core.classifyLine("==> Upgrading aom"), { step: "aom" });
  assert.equal(core.classifyLine("==> Upgrading 29 outdated packages:"), null);
  assert.deepEqual(core.classifyLine("Successfully installed requests-2.33.1"), { step: "requests-2.33.1" });
  assert.deepEqual(core.classifyLine("Error: openssl@3: no bottle available"), { error: "Error: openssl@3: no bottle available" });
  assert.equal(core.classifyLine("npm error code EACCES").error, "npm error code EACCES");
  assert.equal(core.classifyLine("Warning: mas is not signed in").hint, "mas");
  assert.equal(core.classifyLine("sudo: a password is required").hint, "sudo");
  assert.equal(core.classifyLine("Pouring aom--3.15.3.arm64_tahoe.bottle.tar.gz"), null);
  assert.deepEqual(core.classifyLine("==> ▸ Xcode: Zwischendaten"), { step: "Xcode: Zwischendaten" });
  assert.deepEqual(core.classifyLine("==> Installed Xcode"), { step: "Xcode" });
});
