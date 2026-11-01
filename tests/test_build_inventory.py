"""Tests for electron/scripts/build_inventory.py.

The builder runs against synthetic scanner output in a temporary folder.
HOME points to an empty folder so no real browser profiles are read.
Runs on the system Python 3.9 shipped with macOS and on newer versions.
"""
import importlib.util
import json
import os
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILDER = ROOT / "electron" / "scripts" / "build_inventory.py"


def write_fixture(work, home):
    data = work / "data"
    (data / "icons").mkdir(parents=True)
    agents = home / "Library" / "LaunchAgents"   # user agents are recognised by their location
    agents.mkdir(parents=True)
    with open(agents / "homebrew.mxcl.redis.plist", "wb") as fh:
        plistlib.dump({"Label": "homebrew.mxcl.redis", "ProgramArguments": ["/opt/homebrew/opt/redis/bin/redis-server"],
                       "RunAtLoad": True, "KeepAlive": True}, fh)
    with open(agents / "com.google.keystone.agent.plist", "wb") as fh:
        plistlib.dump({"Label": "com.google.keystone.agent", "Program": "/Library/Google/Keystone.app/agent", "StartInterval": 3600}, fh)

    files = {
        "system.txt": "hostname|Test Mac\nuser|demo\nos_version|26.1\nos_build|25B1\narch|arm64\ncores|10\n"
                      "perf_cores|8\neff_cores|2\nram_bytes|68719476736\nmarketing_name|MacBook Pro (14-inch, 2021)\n",
        "applications.txt": "Visual Studio Code\nOld Tool\nRoyal TSX\nSome App\n",
        "user_applications.txt": "Some App\n",
        "apps_detailed.txt": "Visual Studio Code|1.143.1|com.microsoft.VSCode|Code|universal|Developer ID Application: Microsoft\n"
                             "Old Tool|2.0|com.example.old|AppIcon|intel|\n"
                             "Royal TSX|6.4.5|com.royalapps.royaltsx|AppIcon|universal|adhoc\n"
                             "Some App|1.0|com.example.some|AppIcon|arm64|Apple Mac OS Application Signing\n",
        "apps_meta.txt": "Visual Studio Code|1500000000|2026-10-30 23:17:03 +0000|92\nOld Tool|20000000|2023-01-01 10:00:00 +0000|3\n"
                         "Royal TSX|300000000||\nSome App|1000||\n",
        "brew_formulae_versions.txt": "git 2.50.0\nopenssl@3 3.5.0\nopenssl@4 4.0.0\nnode 24.0.0\n",
        "brew_leaves.txt": "git\nnode\n",
        "brew_casks_versions.txt": "rectangle 0.80\n",
        "brew_info.json": json.dumps({
            "formulae": [{"name": "git", "full_name": "git", "tap": "homebrew/core", "homepage": "https://git-scm.com", "desc": "Distributed VCS"}],
            "casks": [{"token": "rectangle", "tap": "homebrew/cask", "homepage": "https://rectangleapp.com", "desc": "Window manager",
                       "artifacts": [{"app": ["Rectangle.app"]}]}],
        }),
        "all_casks.json": json.dumps([
            {"token": "visual-studio-code", "version": "1.144.0", "auto_updates": True, "homepage": "https://code.visualstudio.com",
             "artifacts": [{"app": ["Visual Studio Code.app"]}]},
            {"token": "royal-tsx", "version": "6.4.5.1000", "artifacts": [{"app": ["Royal TSX.app"]}]},
        ]),
        "mas_apps.txt": "497799835  Xcode  (27.1)\n",
        "mas_outdated.txt": "497799835  Xcode        (27.1   -> 27.2)\n",
        "npm_global.txt": "├── corepack@0.35.0\n└── npm@11.17.0\n",
        "npm_outdated.json": json.dumps({"npm": {"current": "11.17.0", "latest": "12.2.1"}, "corepack": {"current": "0.36.0", "latest": "0.36.0"}}),
        "pip_packages.txt": "Package    Version\n---------- -------\nrequests   2.32.0\npip        26.0\n",
        "pip_outdated.json": json.dumps([{"name": "requests", "version": "2.32.0", "latest_version": "2.33.1"}]),
        "ruby_gems.txt": "bundler (4.0.20)\n",
        "gem_outdated.txt": "bundler (4.0.20 < 4.0.23)\n",
        "vscode_extensions.txt": "esbenp.prettier-vscode\n",
        "docker_images.txt": "postgres:16|450MB\n",
        "docker_containers.txt": "db|postgres:16|Exited (0) 2 days ago\n",
        "fonts.txt": "Menlo.ttc\n",
        "brew_outdated.json": json.dumps({"formulae": [{"name": "openssl@3", "installed_versions": ["3.5.0"], "current_version": "3.5.1", "pinned": False}],
                                          "casks": [{"name": "rectangle", "installed_versions": ["0.80"], "current_version": "0.81"}]}),
        "updates_checked.txt": "2026-10-31T20:00:00\n",
        "security.txt": "filevault|FileVault is On.\nfirewall|Firewall is disabled. (State = 0)\nstealth|Firewall stealth mode is off\n"
                        "sip|System Integrity Protection status: enabled.\ngatekeeper|assessments enabled\nscreenlock|screenLock delay is 300 seconds\n",
        "launchd.txt": f"{agents / 'homebrew.mxcl.redis.plist'}\n{agents / 'com.google.keystone.agent.plist'}\n",
        "launchctl_list.txt": "806|0|homebrew.mxcl.redis\n",
        "storage.txt": "xcode_derived|1000000\nsimulators|2000000\ntrash|\n",
        "docker_df.txt": '{"Type":"Build Cache","Size":"30.3GB","Reclaimable":"21.25GB","TotalCount":"347","Active":"0"}\n'
                         '{"Type":"Images","Size":"40.96GB","Reclaimable":"13.6GB (33%)","TotalCount":"78","Active":"33"}\n',
        "caches_top.txt": "2131684\t/Users/demo/Library/Caches/CocoaPods\n",
        "brew_cleanup.txt": "free approximately 501.9MB\n",
        "sim_unavailable.txt": "0\n",
        "versions.txt": "path|python3|/opt/homebrew/bin/python3|Python 3.15.0\npath|python3|/usr/bin/python3|Python 3.9.6\n"
                        "path|node|/Users/demo/.nvm/versions/node/v24.19.0/bin/node|v24.19.0\n"
                        "dir||/Users/demo/.nvm/versions/node/v24.15.0|\ndir||/Users/demo/miniconda3|\n",
        "ports.txt": "com.docker.backend|114|*:3000\nCode\\x20Helper|501|127.0.0.1:59776\nControlCenter|625|*:7000\n",
        "safari_ext.txt": "     com.bitwarden.desktop.safari(2026.10.0)\n\t    Display Name = Bitwarden\n\t     Parent Name = Bitwarden\n",
        "dotfiles.txt": ".zshrc|5636\n.ssh/config|1964\nLibrary/Application Support/Code/User/settings.json|201\n",
        "cargo_install.txt": "ripgrep v14.1.1:\n    rg\nmytool v0.1.0 (/Users/demo/src/mytool):\n    mytool\n",
        "go_bins.txt": "gopls|golang.org/x/tools/gopls|v0.20.0\nlocal|example.com/local|(devel)\n",
        "pipx.txt": "black 25.1.0\n",
        "uv_tools.txt": "ruff v0.12.0\n",
        "composer.json": json.dumps({"installed": [{"name": "laravel/installer", "version": "v5.12.0"}]}),
        "mise.json": json.dumps({"node": [{"version": "22.1.0", "installed": True}, {"version": "20.0.0", "installed": False}]}),
        "asdf.txt": "nodejs|20.11.0\n",
        "macports.txt": "  ripgrep @14.1.0_0 (active)\n  wget @1.25.0_1+ssl (active)\n",
    }
    for name, text in files.items():
        (data / name).write_text(text, encoding="utf-8")


class BuildInventoryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.work = pathlib.Path(cls.tmp.name) / "scan"
        cls.home = pathlib.Path(cls.tmp.name) / "home"
        cls.home.mkdir()
        write_fixture(cls.work, cls.home)
        env = {**os.environ, "MI_WORKDIR": str(cls.work), "MI_EMBED_ICONS": "0", "HOME": str(cls.home)}
        res = subprocess.run([sys.executable, str(BUILDER)], env=env, capture_output=True, text=True)
        if res.returncode != 0:
            raise AssertionError(res.stdout + res.stderr)
        cls.inv = json.loads((cls.work / "inventory.json").read_text())
        cls.cats = {c["id"]: c for c in cls.inv["categories"]}
        # Import the module (it rebuilds the same fixture) to unit-test its helpers
        os.environ.update(env)
        spec = importlib.util.spec_from_file_location("build_inventory", BUILDER)
        cls.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def app(self, name):
        return next(a for a in self.cats["apps"]["items"] if a["name"] == name)

    def test_format_and_counts(self):
        self.assertEqual(self.inv["format"], "mac-inventory/1")
        self.assertEqual(self.inv["total_count"], sum(c["count"] for c in self.inv["categories"]))
        self.assertEqual(self.cats["apps"]["count"], 4)

    def test_system_info(self):
        s = self.inv["system"]
        self.assertEqual(s["hostname"], "Test Mac")
        self.assertEqual(s["ram_gb"], 64)
        self.assertEqual(s["os_marketing"], "Tahoe" if s["os_version"].startswith("26") else s["os_marketing"])
        self.assertEqual((s["perf_cores"], s["eff_cores"]), (8, 2))

    def test_app_sources(self):
        code = self.app("Visual Studio Code")
        self.assertEqual(code["install_cmd"], "brew install --cask visual-studio-code")
        self.assertEqual(code["arch"], "universal")
        self.assertEqual(code["size_bytes"], 1500000000)
        self.assertTrue(code["last_used"].startswith("2026-10-30"))
        self.assertEqual(self.app("Old Tool")["install_desc"], "Websuche")
        self.assertIsNone(self.app("Royal TSX")["last_used"])

    def test_extra_package_managers(self):
        cmd = lambda cid: {i["name"]: i["install_cmd"] for i in self.cats[cid]["items"]}
        # A crate installed from a local path has no reinstall command
        self.assertEqual(cmd("cargo"), {"ripgrep": "cargo install ripgrep", "mytool": None})
        self.assertEqual(cmd("go"), {"gopls": "go install golang.org/x/tools/gopls@latest", "local": None})
        self.assertEqual(next(i for i in self.cats["go"]["items"] if i["name"] == "gopls")["version"], "0.20.0")
        self.assertEqual(cmd("pipx"), {"black": "pipx install black"})
        self.assertEqual(cmd("uv"), {"ruff": "uv tool install ruff"})
        self.assertEqual(cmd("composer"), {"laravel/installer": "composer global require laravel/installer"})
        self.assertEqual(cmd("mise"), {"node@22.1.0": "mise use -g node@22.1.0"})
        self.assertEqual(cmd("asdf"), {"nodejs 20.11.0": "asdf install nodejs 20.11.0"})
        self.assertEqual(cmd("macports"), {"ripgrep": "sudo port install ripgrep", "wget": "sudo port install wget"})
        self.assertEqual({i["name"]: i["version"] for i in self.cats["macports"]["items"]}, {"ripgrep": "14.1.0", "wget": "1.25.0"})

    def test_formula_leaves(self):
        leaf = {f["name"]: f.get("leaf") for f in self.cats["brew_formulae"]["items"]}
        self.assertEqual(leaf, {"git": True, "node": True, "openssl@3": False, "openssl@4": False})

    def test_updates(self):
        items = self.inv["updates"]["items"]
        by = {(i["source"], i["name"]): i for i in items}
        self.assertEqual(by[("brew", "openssl@3")]["cmd"], "brew upgrade openssl@3")
        self.assertTrue(by[("brew", "openssl@3")]["dep"])
        self.assertEqual(by[("cask", "rectangle")]["latest"], "0.81")
        self.assertEqual(by[("mas", "Xcode")]["cmd"], "mas upgrade 497799835")
        self.assertEqual(by[("npm", "npm")]["cmd"], "npm install -g npm@latest")
        self.assertNotIn(("npm", "corepack"), by, "up-to-date packages are skipped")
        self.assertEqual(by[("pip", "requests")]["cmd"], "pip3 install -U requests")
        self.assertEqual(by[("gem", "bundler")]["latest"], "4.0.23")
        self.assertEqual(by[("app", "Visual Studio Code")]["latest"], "1.144.0")
        self.assertTrue(by[("app", "Visual Studio Code")]["auto"])
        self.assertNotIn(("app", "Royal TSX"), by, "a build-number suffix is not an update")

    def test_is_newer(self):
        f = self.mod.is_newer
        self.assertTrue(f("1.144.0", "1.143.1"))
        self.assertTrue(f("2.0", "1.9.9"))
        self.assertFalse(f("1.0", "1.0"))
        self.assertFalse(f("6.4.5.1000", "6.4.5"), "same release with build number")
        self.assertFalse(f("2026.2.2.8", "2026.2"))
        self.assertFalse(f("2024.1", "5.0"), "different version schemes")
        self.assertFalse(f("latest", "1.0"))

    def test_size_parser(self):
        f = self.mod._size_to_bytes
        self.assertEqual(f("13.6GB (33%)"), 13600000000)
        self.assertEqual(f("501.9MB"), 501900000)
        self.assertEqual(f("1,5 GB"), 1500000000)
        self.assertEqual(f(""), 0)

    def test_security(self):
        checks = {c["id"]: c for c in self.inv["security"]["checks"]}
        self.assertTrue(checks["filevault"]["ok"])
        self.assertFalse(checks["firewall"]["ok"])
        self.assertEqual(checks["screenlock"]["value"], "nach 5 Min.")

    def test_autostart(self):
        agents = {a["label"]: a for a in self.inv["autostart"]}
        self.assertEqual(agents["homebrew.mxcl.redis"]["brew_service"], "redis")
        self.assertTrue(agents["homebrew.mxcl.redis"]["running"])
        self.assertTrue(agents["com.google.keystone.agent"]["updater"])
        self.assertEqual(agents["com.google.keystone.agent"]["vendor"], "Google")

    def test_storage(self):
        st = self.inv["storage"]
        items = {i["id"]: i["bytes"] for i in st["items"]}
        self.assertEqual(items["xcode_derived"], 1000000 * 1024)
        self.assertIsNone(items["trash"], "no access is not the same as 0 bytes")
        self.assertEqual(st["brew_cleanup_bytes"], 501900000)
        self.assertEqual({d["type"] for d in st["docker"]}, {"Build Cache", "Images"})
        self.assertEqual(st["caches_top"][0]["name"], "CocoaPods")

    def test_versions(self):
        v = self.inv["versions"]
        rt = {r["tool"]: r["entries"] for r in v["runtimes"]}
        self.assertEqual([e["source"] for e in rt["Python"]], ["Homebrew", "macOS", "Conda"])
        self.assertTrue(rt["Python"][0]["active"])
        self.assertEqual(sorted(e["version"] for e in rt["Node.js"]), ["24.15.0", "24.19.0"])
        self.assertEqual(v["brew_multi"], [{"base": "openssl", "formulae": ["openssl@3", "openssl@4"]}])
        self.assertIn({"name": "Some App", "reason": "both_folders"}, v["dup_apps"])

    def test_ports(self):
        ports = {(p["process"], p["port"]): p for p in self.inv["ports"]}
        self.assertTrue(ports[("com.docker.backend", 3000)]["exposed"])
        self.assertFalse(ports[("Code Helper", 59776)]["exposed"], "escaped spaces are decoded")
        self.assertTrue(self.inv["ports"][0]["exposed"], "exposed ports are listed first")

    def test_extensions(self):
        ext = self.inv["extensions"]
        self.assertEqual(ext["browser"], [{"browser": "Safari", "id": "com.bitwarden.desktop.safari", "version": "2026.10.0",
                                           "name": "Bitwarden", "app": "Bitwarden"}])
        self.assertEqual(ext["blocked"], [])

    def test_dotfiles(self):
        kinds = {d["path"]: d["kind"] for d in self.inv["dotfiles"]}
        self.assertEqual(kinds, {"~/.zshrc": "shell", "~/.ssh/config": "ssh",
                                 "~/Library/Application Support/Code/User/settings.json": "vscode"})

    def test_missing_sources_do_not_break_the_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = pathlib.Path(tmp)
            (work / "data" / "icons").mkdir(parents=True)
            env = {**os.environ, "MI_WORKDIR": str(work), "HOME": tmp}
            res = subprocess.run([sys.executable, str(BUILDER)], env=env, capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, res.stderr)
            inv = json.loads((work / "inventory.json").read_text())
            self.assertEqual(inv["total_count"], 0)
            for key in ("updates", "storage", "versions", "ports", "security"):
                self.assertNotIn(key, inv)


if __name__ == "__main__":
    unittest.main()
