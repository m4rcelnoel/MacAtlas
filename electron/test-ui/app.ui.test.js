// UI tests: start the real app against a throwaway data folder and drive it with Playwright.
// Run with `npm run test:ui` (macOS; CI runs it in the DMG job).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { _electron: electron } = require("playwright-core");

const APP_DIR = path.join(__dirname, "..");

function fixtureInventory() {
  const item = (name, version, install_cmd) => ({ name, version, install_cmd });
  const cats = [
    { id: "apps", label: "Programme", items: [item("Rectangle", "0.80", "brew install --cask rectangle"), item("Some Tool", "1.0", null)] },
    { id: "brew_formulae", label: "Homebrew", items: [item("git", "2.50.0", "brew install git"), item("node", "24.0.0", "brew install node")] },
    { id: "npm", label: "npm", items: [item("typescript", "5.9.0", "npm install -g typescript")] },
  ].map((c) => ({ ...c, count: c.items.length }));
  return {
    format: "mac-inventory/1",
    generated_at: new Date().toISOString(),
    system: { hostname: "UI Test Mac", os_version: "26.1" },
    categories: cats,
    total_count: cats.reduce((s, c) => s + c.count, 0),
    updates: {
      checked_at: new Date().toISOString(),
      items: [
        { source: "brew", name: "git", current: "2.50.0", latest: "2.51.0", cmd: "brew upgrade git" },
        { source: "npm", name: "typescript", current: "5.9.0", latest: "6.0.0", cmd: "npm install -g typescript@latest" },
      ],
    },
  };
}

async function launch(withData) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "macatlas-ui-"));
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ language: "de", showTray: false, updateCheck: false, theme: "light" }));
  if (withData) {
    fs.mkdirSync(path.join(dir, "scan"));
    fs.writeFileSync(path.join(dir, "scan", "inventory.json"), JSON.stringify(fixtureInventory()));
  }
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [APP_DIR],
    env: { ...process.env, MACATLAS_DATA_DIR: dir },
  });
  const page = await app.firstWindow();
  await page.waitForSelector(withData ? "#nav .nav-item" : ".intro");
  return { app, page, dir };
}
async function close({ app, dir }) {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

test("first launch shows the three-step intro", async () => {
  const ctx = await launch(false);
  try {
    assert.equal(await ctx.page.locator(".intro-steps li").count(), 3);
    assert.ok(await ctx.page.locator('[data-do="scan"]').isVisible());
  } finally { await close(ctx); }
});

test("main window: sidebar, quick open, lists, selection", async (t) => {
  const ctx = await launch(true);
  const { page } = ctx;
  try {
    await t.test("sidebar sections collapse and stay collapsed", async () => {
      assert.ok(await page.locator('#nav [data-nav="updates"]').isVisible());
      await page.click('[data-navsec="Wartung"]');
      assert.equal(await page.locator('#nav [data-nav="updates"]').count(), 0);
      await page.reload();
      await page.waitForSelector("#nav .nav-item");
      assert.equal(await page.locator('#nav [data-nav="updates"]').count(), 0);
      await page.click('[data-navsec="Wartung"]');
      assert.ok(await page.locator('#nav [data-nav="updates"]').isVisible());
    });

    await t.test("⌘K finds an entry and opens its detail panel", async () => {
      await page.keyboard.press("Meta+K");
      await page.waitForSelector("#palQ");
      await page.keyboard.type("typescr");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#inspector.open");
      assert.match(await page.locator("#inspector").innerText(), /typescript/);
      assert.equal(await page.locator("#title").innerText(), "npm (global)");
    });

    await t.test("list filter shows only entries with an update", async () => {
      await page.click('[data-nav="brew_formulae"]');
      assert.equal(await page.locator("#listBody [data-open]").count(), 2);
      await page.click('[data-listfilter="brew_formulae|update"]');
      assert.equal(await page.locator("#listBody [data-open]").count(), 1);
      await page.click('[data-listfilter="brew_formulae|all"]');
    });

    await t.test("arrow keys move through the list", async () => {
      await page.keyboard.press("Escape");
      await page.locator("#content").click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("ArrowDown");
      await page.waitForSelector("#inspector.open");
      assert.match(await page.locator("#inspector").innerText(), /git/);
      await page.keyboard.press("ArrowDown");
      assert.match(await page.locator("#inspector").innerText(), /node/);
    });

    await t.test("unticked updates are left out of the script", async () => {
      await page.keyboard.press("Escape");
      await page.click('[data-nav="updates"]');
      const script = () => page.evaluate(() => [...document.querySelectorAll("pre")].map((p) => p.textContent).join("\n"));
      assert.match(await script(), /^\s+git$/m);
      await page.locator('input[data-pick][data-key="brew:git"]').uncheck();
      assert.doesNotMatch(await script(), /^\s+git$/m);
      assert.match(await script(), /typescript@latest/);
      assert.match(await page.locator(".pick-summary").innerText(), /1 von 2/);
    });
  } finally { await close(ctx); }
});
