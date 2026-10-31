#!/usr/bin/env python3
"""Builds inventory.json from the data/ files produced by scan.sh."""
import json, os, re, datetime, pathlib, urllib.parse, base64

# Work directory holding data/ and (output) inventory.json. Defaults to the
# script's directory for standalone/dev use; the Electron app overrides it
# via MI_WORKDIR so the read-only app bundle isn't touched.
HERE = pathlib.Path(os.environ.get("MI_WORKDIR") or pathlib.Path(__file__).parent)
DATA = HERE / "data"
ICONS = DATA / "icons"

# When set, embed every app icon in the JSON as a data: URL so the exported
# file is self-contained and can be imported on another Mac. Defaults on.
EMBED_ICONS = os.environ.get("MI_EMBED_ICONS", "1") != "0"


def _icon_data_url(png_path):
    try:
        b = png_path.read_bytes()
        return "data:image/png;base64," + base64.b64encode(b).decode("ascii")
    except Exception:
        return None


MACOS_NAMES = {
    "11": "Big Sur", "12": "Monterey", "13": "Ventura",
    "14": "Sonoma", "15": "Sequoia", "26": "Tahoe",
}


def _to_int(v):
    try:
        return int(str(v).strip())
    except Exception:
        return None


def _display_type(raw):
    if not raw:
        return ""
    s = raw.replace("spdisplays_", "")
    known = {
        "built-in-liquid-retina-xdr": "Integriert · Liquid Retina XDR",
        "built-in-liquid-retina": "Integriert · Liquid Retina",
        "built-in_retinaLCD": "Integriert · Retina",
        "retina": "Retina",
    }
    return known.get(s, s.replace("-", " ").replace("_", " ").strip().capitalize())


def _parse_system():
    raw = {}
    sysfile = DATA / "system.txt"
    if sysfile.exists():
        for line in sysfile.read_text().splitlines():
            if "|" in line:
                k, v = line.split("|", 1)
                raw[k.strip()] = v.strip()

    hw = read_json("hardware.json") or {}
    h = (hw.get("SPHardwareDataType") or [{}])[0]

    os_version = raw.get("os_version", "")
    info = {
        "hostname": raw.get("hostname", ""),
        "user": raw.get("user", ""),
        "os_name": raw.get("os_name") or "macOS",
        "os_version": os_version,
        "os_build": raw.get("os_build", ""),
        "os_marketing": MACOS_NAMES.get(os_version.split(".")[0], ""),
        "arch": raw.get("arch", ""),
        "model_name": h.get("machine_name") or "",
        "marketing_name": raw.get("marketing_name") or h.get("machine_name") or "",
        "model_id": h.get("machine_model") or raw.get("model_id", ""),
        "model_number": h.get("model_number", ""),
        "chip": h.get("chip_type") or h.get("cpu_type") or raw.get("cpu", ""),
        "cpu_cores": _to_int(raw.get("cores")),
        "perf_cores": _to_int(raw.get("perf_cores")),
        "eff_cores": _to_int(raw.get("eff_cores")),
        "serial": h.get("serial_number", ""),
        "timezone": raw.get("timezone", ""),
        "shell": raw.get("shell", ""),
    }

    # Memory: hw.memsize is exact bytes; Apple reports binary GB ("64 GB")
    mem_bytes = _to_int(raw.get("ram_bytes")) or 0
    info["ram_gb"] = round(mem_bytes / 1024 ** 3) if mem_bytes else None
    mem = (hw.get("SPMemoryDataType") or [{}])[0]
    info["memory_type"] = mem.get("dimm_type", "")
    info["memory_vendor"] = mem.get("dimm_manufacturer", "")

    # GPU + displays
    displays, gpu_cores = [], None
    for g in hw.get("SPDisplaysDataType") or []:
        gpu_cores = gpu_cores or _to_int(g.get("sppci_cores"))
        info.setdefault("gpu", g.get("sppci_model", ""))
        for d in g.get("spdisplays_ndrvs") or []:
            displays.append({
                "name": d.get("_name", ""),
                "resolution": d.get("_spdisplays_resolution", ""),
                "type": _display_type(d.get("spdisplays_display_type", "")),
                "main": d.get("spdisplays_main") == "spdisplays_yes",
            })
    info["gpu_cores"] = gpu_cores
    info["displays"] = displays

    # Storage: the volume mounted at "/" reports the APFS container size/free,
    # which is what "About This Mac" shows. Apple uses decimal GB.
    for v in hw.get("SPStorageDataType") or []:
        if v.get("mount_point") == "/":
            size = _to_int(v.get("size_in_bytes")) or 0
            free = _to_int(v.get("free_space_in_bytes")) or 0
            info["storage"] = {
                "name": v.get("_name", "Macintosh HD"),
                "total_gb": round(size / 1e9),
                "free_gb": round(free / 1e9),
                "used_gb": round((size - free) / 1e9),
                "device": (v.get("physical_drive") or {}).get("device_name", ""),
            }
            break

    # Battery (laptops only)
    for p in hw.get("SPPowerDataType") or []:
        bh = p.get("sppower_battery_health_info")
        if bh:
            charge = p.get("sppower_battery_charge_info") or {}
            info["battery"] = {
                "health": bh.get("sppower_battery_health", ""),
                "max_capacity": str(bh.get("sppower_battery_health_maximum_capacity", "")).replace("\xa0", " "),
                "cycles": bh.get("sppower_battery_cycle_count"),
                "charge": charge.get("sppower_battery_state_of_charge"),
                "charging": charge.get("sppower_battery_is_charging") == "TRUE",
            }
            break

    bt = _to_int(raw.get("boot_time"))
    if bt:
        boot = datetime.datetime.fromtimestamp(bt)
        info["boot_time_iso"] = boot.isoformat(timespec="seconds")
        info["uptime_seconds"] = int((datetime.datetime.now() - boot).total_seconds())

    device = DATA / "device.png"
    if device.exists():
        info["device_image"] = _icon_data_url(device)
    return info


def read_lines(name):
    p = DATA / name
    if not p.exists():
        return []
    return [l.strip() for l in p.read_text().splitlines() if l.strip()]


def read_json(name):
    p = DATA / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


# ─── Brew metadata ─────────────────────────────────────────────────
brew_info = read_json("brew_info.json") or {}
FORMULAE_META = {}  # name → {homepage, desc}
CASK_META = {}      # token → {homepage, desc, app_paths}
APP_TO_CASK = {}    # "App Name" (lowercase) → token

for f in brew_info.get("formulae", []):
    FORMULAE_META[f["name"]] = {
        "homepage": f.get("homepage", ""),
        "desc": f.get("desc", ""),
        "tap": f.get("tap", ""),
        "full_name": f.get("full_name", f["name"]),
    }
def _collect_app_paths(cask):
    """Pull all .app artifact names from a cask JSON entry (both schemas)."""
    out = []
    for art in cask.get("artifacts") or []:
        if isinstance(art, dict):
            for a in art.get("app") or []:
                if isinstance(a, str):
                    out.append(a)
                elif isinstance(a, dict) and "source" in a:
                    out.append(a["source"])
        elif isinstance(art, list):
            for a in art:
                if isinstance(a, str) and a.endswith(".app"):
                    out.append(a)
    return out


for c in brew_info.get("casks", []):
    token = c.get("token", "")
    app_paths = _collect_app_paths(c)
    CASK_META[token] = {
        "homepage": c.get("homepage", ""),
        "desc": c.get("desc", ""),
        "app_paths": app_paths,
        "tap": c.get("tap", ""),
        "full_token": c.get("full_token", token),
    }
    for ap in app_paths:
        name = pathlib.Path(ap).stem
        APP_TO_CASK[name.lower()] = token

# Also index EVERY cask in the Homebrew catalog so we can match apps the user
# installed outside of brew.
all_casks = read_json("all_casks.json") or []
ALL_CASK_META = {}  # token → {homepage, desc}
for c in all_casks:
    token = c.get("token", "")
    if not token:
        continue
    ALL_CASK_META[token] = {
        "homepage": c.get("homepage", ""),
        "desc": c.get("desc", ""),
        "version": str(c.get("version") or ""),
        "auto_updates": bool(c.get("auto_updates")),
    }
    for ap in _collect_app_paths(c):
        name = pathlib.Path(ap).stem.lower()
        # Prefer installed casks over catalog matches
        APP_TO_CASK.setdefault(name, token)

# ─── Mac App Store cross-reference ─────────────────────────────────
# Build map "App Name" → mas id so /Applications apps installed via MAS can
# surface a `mas install <id>` command and a direct App Store URL.
MAS_BY_NAME = {}
for line in read_lines("mas_apps.txt"):
    m = re.match(r"^(\d+)\s+(.+?)\s+\(([^)]+)\)\s*$", line)
    if m:
        MAS_BY_NAME[m.group(2).lower()] = m.group(1)


# ─── Helpers ────────────────────────────────────────────────────────
def ddg(q):
    return "https://duckduckgo.com/?q=" + urllib.parse.quote(q)


def _vtuple(v):
    """'1.2.3' → (1, 2, 3); None for versions that aren't plain dotted numbers."""
    v = str(v or "").split(",")[0].strip()
    if not re.fullmatch(r"\d+(\.\d+)*", v):
        return None
    return tuple(int(x) for x in v.split("."))


def is_newer(latest, current):
    a, b = _vtuple(latest), _vtuple(current)
    if not a or not b:
        return False
    # Different version schemes (year-based "2024.1" vs. semantic "5.0") can't be compared
    if (a[0] >= 1000) != (b[0] >= 1000):
        return False
    # "6.4.5" vs "6.4.5.1000": same release, one side just adds a build number
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    if len(a) != len(b) and long_[:len(short)] == short:
        return False
    n = max(len(a), len(b))
    return a + (0,) * (n - len(a)) > b + (0,) * (n - len(b))


def _parse_mdls_date(s):
    # "2026-10-31 00:38:37 +0000" → ISO 8601
    try:
        return datetime.datetime.strptime(s.strip(), "%Y-%m-%d %H:%M:%S %z").isoformat()
    except Exception:
        return None


APP_META = {}  # app name → {size_bytes, last_used, use_count}
for line in read_lines("apps_meta.txt"):
    parts = line.split("|")
    if len(parts) >= 4:
        APP_META[parts[0]] = {
            "size_bytes": _to_int(parts[1]),
            "last_used": _parse_mdls_date(parts[2]) if parts[2] else None,
            "use_count": _to_int(parts[3]),
        }

INSTALLED_CASKS = {l.split(" ", 1)[0] for l in read_lines("brew_casks_versions.txt")}


# ─── Parsers ────────────────────────────────────────────────────────
def parse_apps():
    icon_map = {p.stem.lower(): p for p in ICONS.glob("*.png")}
    out = []
    for line in read_lines("apps_detailed.txt"):
        parts = line.split("|")
        if len(parts) < 4:
            continue
        name, version, bundle_id, _ = parts[0], parts[1], parts[2], parts[3]
        arch = parts[4] if len(parts) > 4 else ""
        signer = parts[5] if len(parts) > 5 else ""
        safe = re.sub(r"[/ ]", "_", name)
        icon_path = icon_map.get(safe.lower())
        if icon_path is None:
            icon = None
        elif EMBED_ICONS:
            icon = _icon_data_url(icon_path)
        else:
            icon = f"data/icons/{safe}.png"

        cask = APP_TO_CASK.get(name.lower())
        mas_id = MAS_BY_NAME.get(name.lower())
        install_cmd = install_url = install_desc = None
        if cask:
            install_cmd = f"brew install --cask {cask}"
            meta = CASK_META.get(cask) or ALL_CASK_META.get(cask, {})
            install_url = meta.get("homepage", "")
            install_desc = f"Homebrew Cask: {cask}"
        elif mas_id:
            install_cmd = f"mas install {mas_id}"
            install_url = f"https://apps.apple.com/app/id{mas_id}"
            install_desc = "Mac App Store"
        elif bundle_id.startswith("com.apple."):
            install_url = "https://www.apple.com/"
            install_desc = "Apple (vorinstalliert / System)"
        else:
            install_url = ddg(f'"{name}" mac download')
            install_desc = "Websuche"

        item = {
            "name": name,
            "version": version,
            "bundle_id": bundle_id,
            "icon": icon,
            "install_cmd": install_cmd,
            "install_url": install_url,
            "install_desc": install_desc,
            "arch": arch,
            "signer": signer,
        }
        item.update(APP_META.get(name, {}))
        if cask:
            item["cask"] = cask
            item["brew_managed"] = cask in INSTALLED_CASKS
        out.append(item)
    return out


# ─── Updates ────────────────────────────────────────────────────────
def parse_updates(apps):
    """Collect outdated packages from brew/mas/npm/pip/gem, plus apps whose
    version is older than the Homebrew catalog's current release."""
    if not (DATA / "updates_checked.txt").exists():
        return None
    checked = (read_lines("updates_checked.txt") or [""])[0]
    if not checked:
        return None  # scan was interrupted before the check finished
    icon_by_name = {a["name"].lower(): a.get("icon") for a in apps}
    leaves = set(read_lines("brew_leaves.txt"))
    items = []

    def add(source, name, current, latest, cmd=None, url="", icon=None, **extra):
        it = {"source": source, "name": name, "current": current, "latest": latest,
              "cmd": cmd, "url": url, "icon": icon}
        it.update(extra)
        items.append(it)

    bo = read_json("brew_outdated.json") or {}
    for f in bo.get("formulae", []):
        n = f.get("name", "")
        add("brew", n, ", ".join(f.get("installed_versions") or []), f.get("current_version", ""),
            cmd=f"brew upgrade {n}", url=f"https://formulae.brew.sh/formula/{n}",
            dep=bool(leaves) and n not in leaves, pinned=bool(f.get("pinned")))
    for c in bo.get("casks", []):
        n = c.get("name", "")
        icon = None
        for ap in (CASK_META.get(n) or {}).get("app_paths", []):
            icon = icon or icon_by_name.get(pathlib.Path(ap).stem.lower())
        add("cask", n, ", ".join(c.get("installed_versions") or []), c.get("current_version", ""),
            cmd=f"brew upgrade --cask {n}", url=f"https://formulae.brew.sh/cask/{n}", icon=icon)

    mas_names = set()
    for line in read_lines("mas_outdated.txt"):
        m = re.match(r"^\s*(\d+)\s+(.+?)\s+\((.+?)\s*->\s*(.+?)\)\s*$", line)
        if m:
            app_id, name = m.group(1), m.group(2)
            mas_names.add(name.lower())
            add("mas", name, m.group(3), m.group(4), cmd=f"mas upgrade {app_id}",
                url=f"https://apps.apple.com/app/id{app_id}", icon=icon_by_name.get(name.lower()))

    for name, v in (read_json("npm_outdated.json") or {}).items():
        if isinstance(v, dict) and v.get("latest") and v.get("current") != v.get("latest"):
            add("npm", name, v.get("current", ""), v["latest"], cmd=f"npm install -g {name}@latest",
                url=f"https://www.npmjs.com/package/{name}")

    for p in read_json("pip_outdated.json") or []:
        n = p.get("name", "")
        add("pip", n, p.get("version", ""), p.get("latest_version", ""), cmd=f"pip3 install -U {n}",
            url=f"https://pypi.org/project/{urllib.parse.quote(n)}/")

    for line in read_lines("gem_outdated.txt"):
        m = re.match(r"^(\S+)\s+\((\S+)\s+<\s+(\S+)\)", line)
        if m:
            add("gem", m.group(1), m.group(2), m.group(3), cmd=f"gem update {m.group(1)}",
                url=f"https://rubygems.org/gems/{urllib.parse.quote(m.group(1))}")

    # Apps installed outside brew/MAS: compare against the Homebrew catalog
    for a in apps:
        cask = a.get("cask")
        if not cask or a.get("brew_managed") or a["name"].lower() in mas_names:
            continue
        meta = ALL_CASK_META.get(cask) or {}
        latest = meta.get("version", "").split(",")[0]
        if latest and is_newer(latest, a.get("version")):
            add("app", a["name"], a.get("version", ""), latest, url=meta.get("homepage", ""),
                icon=a.get("icon"), auto=meta.get("auto_updates", False), cask=cask)

    items.sort(key=lambda x: (x["source"], x["name"].lower()))
    return {"checked_at": checked, "items": items}


def parse_brew_formulae():
    # "leaf" = installed on request (not just pulled in as a dependency)
    leaves = set(read_lines("brew_leaves.txt"))
    out = []
    for line in read_lines("brew_formulae_versions.txt"):
        parts = line.split(" ", 1)
        pkg = parts[0]
        ver = parts[1] if len(parts) > 1 else ""
        meta = FORMULAE_META.get(pkg, {})
        item = {
            "name": pkg,
            "version": ver,
            "install_cmd": f"brew install {pkg}",
            "install_url": meta.get("homepage") or f"https://formulae.brew.sh/formula/{pkg}",
            "install_desc": meta.get("desc") or "",
        }
        if leaves:
            item["leaf"] = pkg in leaves
        if meta.get("tap") and meta["tap"] != "homebrew/core":
            item["tap"] = meta["tap"]
            item["full_name"] = meta.get("full_name", pkg)
        out.append(item)
    return out


def parse_brew_casks():
    out = []
    for line in read_lines("brew_casks_versions.txt"):
        parts = line.split(" ", 1)
        pkg = parts[0]
        ver = parts[1] if len(parts) > 1 else ""
        meta = CASK_META.get(pkg, {})
        item = {
            "name": pkg,
            "version": ver,
            "install_cmd": f"brew install --cask {pkg}",
            "install_url": meta.get("homepage") or f"https://formulae.brew.sh/cask/{pkg}",
            "install_desc": meta.get("desc") or "",
        }
        if meta.get("tap") and meta["tap"] != "homebrew/cask":
            item["tap"] = meta["tap"]
            item["full_name"] = meta.get("full_token", pkg)
        out.append(item)
    return out


# ─── Security + autostart ───────────────────────────────────────────
def parse_security():
    raw = {}
    for line in read_lines("security.txt"):
        if "|" in line:
            k, v = line.split("|", 1)
            raw[k] = v.strip()
    if not raw:
        return None
    su = {}
    try:
        import plistlib
        with open(DATA / "softwareupdate.plist", "rb") as fh:
            su = plistlib.load(fh)
    except Exception:
        pass

    def check(id_, label, ok, value, hint, settings=""):
        return {"id": id_, "label": label, "ok": ok, "value": value, "hint": hint, "settings": settings}

    fv, fw, st = raw.get("filevault", ""), raw.get("firewall", ""), raw.get("stealth", "")
    sip, gk, sl = raw.get("sip", ""), raw.get("gatekeeper", ""), raw.get("screenlock", "")
    checks = []
    if fv:
        on = "is On" in fv
        checks.append(check("filevault", "FileVault", on, "Aktiv" if on else "Aus",
                            "Verschlüsselt die Festplatte – bei Verlust des Macs sind die Daten geschützt.",
                            "com.apple.settings.PrivacySecurity.extension"))
    if fw:
        on = "enabled" in fw or "State = 1" in fw or "State = 2" in fw
        stealth = "on" in st.split("is")[-1] if st else False
        checks.append(check("firewall", "Firewall", on, ("Aktiv" + (" · Tarnmodus" if stealth else "")) if on else "Aus",
                            "Blockiert eingehende Verbindungen zu nicht freigegebenen Programmen. In fremden WLANs empfohlen.",
                            "com.apple.Network-Settings.extension"))
    if sip:
        on = "enabled" in sip
        checks.append(check("sip", "Systemintegritätsschutz (SIP)", on, "Aktiv" if on else "Deaktiviert",
                            "Schützt macOS-Systemdateien vor Veränderung. Sollte immer aktiv sein."))
    if gk:
        on = "enabled" in gk
        checks.append(check("gatekeeper", "Gatekeeper", on, "Aktiv" if on else "Aus",
                            "Prüft beim Öffnen, ob ein Programm signiert und von Apple geprüft ist.",
                            "com.apple.settings.PrivacySecurity.extension"))
    m = re.search(r"delay is (-?\d+) seconds", sl)
    if m or "immediate" in sl:
        secs = 0 if "immediate" in sl else int(m.group(1))
        ok = 0 <= secs <= 300
        value = "Sofort" if secs == 0 else ("Aus" if secs < 0 else (f"nach {secs // 60} Min." if secs >= 60 else f"nach {secs} s"))
        checks.append(check("screenlock", "Passwort nach Ruhezustand", ok, value,
                            "Wie schnell nach Bildschirmschoner oder Ruhezustand das Passwort verlangt wird.",
                            "com.apple.Lock-Screen-Settings.extension"))
    if su:
        auto = bool(su.get("AutomaticallyInstallMacOSUpdates"))
        crit = bool(su.get("CriticalUpdateInstall", True))
        checks.append(check("autoupdate", "Automatische Updates", auto and crit,
                            "macOS + Sicherheit" if auto and crit else ("Nur Sicherheit" if crit else "Aus"),
                            "Installiert macOS-Updates und Sicherheitskorrekturen automatisch.",
                            "com.apple.Software-Update-Settings.extension"))
    pending = []
    for u in su.get("RecommendedUpdates") or []:
        pending.append({"name": str(u.get("Display Name", "")).replace("\xa0", " "),
                        "version": str(u.get("Display Version", ""))})
    return {"checks": checks, "pending_updates": pending, "last_check": str(su.get("LastSuccessfulDate", ""))}


def _vendor(label):
    parts = label.split(".")
    if label.startswith(("homebrew.mxcl.", "sh.brew.")):
        return "Homebrew"
    known = {"com.google": "Google", "com.microsoft": "Microsoft", "us.zoom": "Zoom", "com.docker": "Docker",
             "com.adobe": "Adobe", "com.apple": "Apple", "com.dropbox": "Dropbox", "com.teamviewer": "TeamViewer"}
    key = ".".join(parts[:2])
    if key in known:
        return known[key]
    return parts[1].capitalize() if len(parts) > 2 else ""


def parse_autostart():
    import plistlib
    paths = read_lines("launchd.txt")
    if not paths and not (DATA / "launchd.txt").exists():
        return None
    loaded = {}
    for line in read_lines("launchctl_list.txt"):
        pid, status, label = (line.split("|") + ["", "", ""])[:3]
        loaded[label] = {"running": pid not in ("", "-"), "status": status}
    home = str(pathlib.Path.home())
    out = []
    for p in paths:
        try:
            with open(p, "rb") as fh:
                pl = plistlib.load(fh)
        except Exception:
            continue
        label = str(pl.get("Label") or pathlib.Path(p).stem)
        prog = pl.get("Program") or (pl.get("ProgramArguments") or [""])[0]
        scope = "user" if p.startswith(home) else ("daemon" if "/LaunchDaemons/" in p else "agent")
        item = {
            "label": label, "path": p, "program": str(prog), "scope": scope,
            "vendor": _vendor(label),
            "run_at_load": bool(pl.get("RunAtLoad")), "keep_alive": bool(pl.get("KeepAlive")),
            "interval": pl.get("StartInterval"), "disabled": bool(pl.get("Disabled")),
        }
        if scope == "user" and label in loaded:
            item["running"] = loaded[label]["running"]
        m = re.match(r"^(?:homebrew\.mxcl|sh\.brew)\.(.+)$", label)
        if m and scope == "user":
            item["brew_service"] = m.group(1)
        prog_l = str(prog).lower() + label.lower()
        item["updater"] = any(w in prog_l for w in ("update", "keystone", "shipit"))
        out.append(item)
    out.sort(key=lambda x: (x["scope"] != "user", x["vendor"].lower(), x["label"].lower()))
    return out


def parse_pip():
    out = []
    for line in read_lines("pip_packages.txt"):
        if line.startswith("Package") or line.startswith("---"):
            continue
        parts = re.split(r"\s{2,}", line)
        name = parts[0]
        ver = parts[1] if len(parts) > 1 else ""
        out.append({
            "name": name,
            "version": ver,
            "install_cmd": f"pip3 install {name}",
            "install_url": f"https://pypi.org/project/{urllib.parse.quote(name)}/",
        })
    return out


def parse_npm():
    out = []
    for line in read_lines("npm_global.txt"):
        line = line.lstrip("├└│─ ").lstrip("`-")
        if not line or line.startswith("("):
            continue
        if "@" in line and not line.startswith("@"):
            idx = line.rfind("@")
            name, ver = line[:idx], line[idx+1:]
        elif line.startswith("@") and line.count("@") > 1:
            idx = line.rfind("@")
            name, ver = line[:idx], line[idx+1:]
        else:
            name, ver = line, ""
        out.append({
            "name": name,
            "version": ver,
            "install_cmd": f"npm install -g {name}",
            "install_url": f"https://www.npmjs.com/package/{name}",
        })
    return out


def parse_gems():
    out = []
    for line in read_lines("ruby_gems.txt"):
        m = re.match(r"^(\S+)\s*\(([^)]+)\)", line)
        if m:
            name, ver = m.group(1), m.group(2)
        else:
            name, ver = line, ""
        out.append({
            "name": name,
            "version": ver,
            "install_cmd": f"gem install {name}",
            "install_url": f"https://rubygems.org/gems/{urllib.parse.quote(name)}",
        })
    return out


def parse_mas():
    out = []
    for line in read_lines("mas_apps.txt"):
        m = re.match(r"^(\d+)\s+(.+?)\s+\(([^)]+)\)\s*$", line)
        if m:
            app_id, name, ver = m.group(1), m.group(2), m.group(3)
            out.append({
                "name": name,
                "version": ver,
                "bundle_id": f"id {app_id}",
                "install_cmd": f"mas install {app_id}",
                "install_url": f"https://apps.apple.com/app/id{app_id}",
                "install_desc": "Mac App Store",
            })
        else:
            out.append({"name": line, "version": ""})
    return out


def parse_vscode():
    out = []
    for ext in read_lines("vscode_extensions.txt"):
        out.append({
            "name": ext,
            "version": "",
            "install_cmd": f"code --install-extension {ext}",
            "install_url": f"https://marketplace.visualstudio.com/items?itemName={ext}",
        })
    return out


def parse_docker_images():
    out = []
    for line in read_lines("docker_images.txt"):
        parts = line.split("|")
        name = parts[0] if parts else line
        size = parts[1] if len(parts) > 1 else ""
        pull_target = name.replace(":<none>", "")
        # Build Hub URL
        base = pull_target.split(":")[0]
        if "/" in base:
            url = f"https://hub.docker.com/r/{base}"
        else:
            url = f"https://hub.docker.com/_/{base}"
        out.append({
            "name": name,
            "version": size,
            "install_cmd": f"docker pull {pull_target}",
            "install_url": url,
        })
    return out


def parse_docker_containers():
    out = []
    for line in read_lines("docker_containers.txt"):
        parts = line.split("|")
        if len(parts) >= 3:
            name, image, status = parts[0], parts[1], parts[2]
            out.append({
                "name": name,
                "version": status,
                "bundle_id": image,
                "install_cmd": f"docker start {name}" if status.startswith("Exited") else None,
                "install_url": f"https://hub.docker.com/r/{image.split(':')[0]}" if "/" in image else None,
                "install_desc": image,
            })
        else:
            out.append({"name": line, "version": ""})
    return out


def parse_fonts():
    return [{"name": n, "version": ""} for n in read_lines("fonts.txt")]


def parse_claude_mcp():
    # Known MCP server names → helpful commands if public
    out = []
    for n in read_lines("mcp_servers.txt"):
        out.append({
            "name": n,
            "version": "",
            "install_url": "https://modelcontextprotocol.io/",
            "install_desc": "~/Library/Application Support/Claude/claude_desktop_config.json",
        })
    return out


def parse_claude_plugins():
    out = []
    for n in read_lines("claude_plugins.txt"):
        out.append({
            "name": n,
            "version": "",
            "install_cmd": f"/plugin install {n}",
            "install_url": "https://docs.claude.com/en/docs/claude-code/plugins",
        })
    return out


# ─── Storage, versions, network, extensions, dotfiles ──────────────
def _size_to_bytes(s):
    """'13.6GB (33%)' / '501.9MB' / '1,2 GB' → bytes."""
    m = re.search(r"([\d.,]+)\s*([KMGT]?)B", str(s or ""), re.I)
    if not m:
        return 0
    num = float(m.group(1).replace(",", "."))
    return int(num * {"": 1, "K": 1e3, "M": 1e6, "G": 1e9, "T": 1e12}[m.group(2).upper()])


def parse_storage():
    if not (DATA / "storage.txt").exists():
        return None
    items = []
    for line in read_lines("storage.txt"):
        key, _, kb = line.partition("|")
        kb = _to_int(kb)
        items.append({"id": key, "bytes": kb * 1024 if kb is not None else None})
    docker = []
    for line in read_lines("docker_df.txt"):
        try:
            d = json.loads(line)
        except Exception:
            continue
        docker.append({
            "type": d.get("Type", ""), "size_bytes": _size_to_bytes(d.get("Size")),
            "reclaim_bytes": _size_to_bytes(d.get("Reclaimable")),
            "count": _to_int(d.get("TotalCount")), "active": _to_int(d.get("Active")),
        })
    caches_top = []
    for line in read_lines("caches_top.txt"):
        parts = line.split("\t", 1)
        if len(parts) == 2 and _to_int(parts[0]):
            caches_top.append({"name": pathlib.Path(parts[1]).name, "bytes": _to_int(parts[0]) * 1024})
    brew = read_lines("brew_cleanup.txt")
    return {
        "items": items, "docker": docker, "caches_top": caches_top,
        "brew_cleanup_bytes": _size_to_bytes(brew[0]) if brew else 0,
        "sim_unavailable": _to_int((read_lines("sim_unavailable.txt") or ["0"])[0]) or 0,
    }


def _version_source(path):
    p = path.lower()
    for needle, src in (("/.nvm/", "nvm"), ("/.pyenv/", "pyenv"), ("/.rbenv/", "rbenv"), ("/.volta/", "Volta"),
                        ("conda", "Conda"), ("miniforge", "Conda"), ("python.framework", "python.org"),
                        ("/opt/homebrew/", "Homebrew"), ("/usr/local/", "Homebrew (Intel)"), ("/usr/bin/", "macOS"),
                        ("/library/java/", "JDK")):
        if needle in p:
            return src
    return ""


def _clean_version(v):
    m = re.search(r"(\d+\.\d+(?:\.\d+)?)", v or "")
    return m.group(1) if m else (v or "").strip()


def parse_versions():
    if not (DATA / "versions.txt").exists():
        return None
    runtimes = {}   # tool → list of {version, path, source, active}
    order = {}
    def add(tool, version, path, source):
        lst = runtimes.setdefault(tool, [])
        if any(e["path"] == path or (e["version"] == version and e["source"] == source) for e in lst):
            return
        lst.append({"version": version, "path": path, "source": source, "active": False})
    xcodes, jdks = [], []
    for line in read_lines("versions.txt"):
        parts = (line.split("|") + ["", "", ""])[:4]
        kind, tool, path, ver = parts
        if kind == "path" and tool:
            label = {"python3": "Python", "node": "Node.js", "ruby": "Ruby", "java": "Java", "go": "Go",
                     "php": "PHP", "git": "Git", "pip3": "pip"}.get(tool, tool)
            if label not in order:
                order[label] = path   # first hit in PATH = the one that runs
            add(label, _clean_version(ver), path, _version_source(path))
        elif kind == "dir":
            low = path.lower()
            if "/.nvm/" in low or "/.volta/" in low:
                add("Node.js", pathlib.Path(path).name.lstrip("v"), path, _version_source(path))
            elif "/.pyenv/" in low or "python.framework" in low:
                add("Python", pathlib.Path(path).name, path, _version_source(path))
            elif ("conda" in low or "miniforge" in low) and not any(e["source"] == "Conda" for e in runtimes.get("Python", [])):
                add("Python", "Conda", path, "Conda")
            elif "/.rbenv/" in low:
                add("Ruby", pathlib.Path(path).name, path, "rbenv")
        elif kind == "jdk":
            jdks.append(line.split("||", 1)[1].strip())
        elif kind == "xcode":
            xcodes.append(line.split("||", 1)[1].strip())
    for label, first in order.items():
        for e in runtimes.get(label, []):
            e["active"] = e["path"] == first
    # Homebrew formulae installed in several versions (python@3.x, node@xx, …)
    by_base = {}
    for f in read_lines("brew_formulae_versions.txt"):
        name = f.split(" ", 1)[0]
        base = re.sub(r"@.*$", "", name)
        if base in ("python", "node", "ruby", "openjdk", "php", "postgresql", "mysql", "llvm", "go", "perl", "icu4c", "openssl"):
            by_base.setdefault(base, []).append(name)
    brew_multi = [{"base": b, "formulae": sorted(v)} for b, v in sorted(by_base.items()) if len(v) > 1]
    # Same app twice: /Applications + ~/Applications, or Homebrew cask + App Store
    sys_apps = {n.lower() for n in read_lines("applications.txt")}
    dup_apps = [{"name": n, "reason": "both_folders"} for n in read_lines("user_applications.txt") if n.lower() in sys_apps]
    for a in APPS:
        if a.get("brew_managed") and a["name"].lower() in MAS_BY_NAME:
            dup_apps.append({"name": a["name"], "reason": "brew_and_mas"})
    return {
        "runtimes": [{"tool": t, "entries": runtimes[t]} for t in sorted(runtimes, key=lambda x: (-len(runtimes[x]), x))],
        "brew_multi": brew_multi, "dup_apps": dup_apps,
        "xcodes": [x for x in xcodes if x.endswith(".app") and pathlib.Path(x).name.startswith("Xcode") and pathlib.Path(x).name != "Xcodes.app"],
        "jdks": jdks, "orphans": read_lines("brew_orphans.txt"),
    }


def parse_ports():
    if not (DATA / "ports.txt").exists():
        return None
    out, seen = [], set()
    for line in read_lines("ports.txt"):
        parts = line.split("|")
        if len(parts) < 3:
            continue
        proc = parts[0].replace("\\x20", " ")
        addr = parts[2]
        host, _, port = addr.rpartition(":")
        key = (proc, port)
        if key in seen:
            continue
        seen.add(key)
        exposed = host in ("*", "0.0.0.0", "[::]", "::")
        out.append({"process": proc, "pid": _to_int(parts[1]), "address": addr, "port": _to_int(port), "exposed": exposed})
    out.sort(key=lambda x: (not x["exposed"], x["process"].lower(), x["port"] or 0))
    return out


def _chromium_name(ext_dir, manifest):
    name = manifest.get("name", "")
    m = re.match(r"^__MSG_(.+)__$", name)
    if not m:
        return name
    key = m.group(1).lower()
    for loc in ("de", "en", "en_US", manifest.get("default_locale") or "en"):
        f = ext_dir / "_locales" / loc / "messages.json"
        if f.exists():
            try:
                msgs = {k.lower(): v for k, v in json.loads(f.read_text(encoding="utf-8", errors="ignore")).items()}
                if key in msgs:
                    return msgs[key].get("message", name)
            except Exception:
                pass
    return name


def parse_extensions():
    home = pathlib.Path.home()
    system = []
    for line in read_lines("sysext.txt"):
        m = re.search(r"\t(\S+) \(([^)]*)\)\t(.+?)\t\[(.+)\]", line)
        if m:
            system.append({"id": m.group(1), "version": m.group(2), "name": m.group(3), "state": m.group(4)})
    kexts = [l.split()[-1] if l.split() else l for l in read_lines("kexts.txt")]
    browser, blocked = [], []
    chromium = {"Google Chrome": "Google/Chrome", "Brave": "BraveSoftware/Brave-Browser", "Microsoft Edge": "Microsoft Edge",
                "Arc": "Arc/User Data", "Vivaldi": "Vivaldi", "Chromium": "Chromium"}
    for bname, rel in chromium.items():
        root = home / "Library/Application Support" / rel
        try:
            if not root.is_dir():
                continue
            profiles = [p for p in root.iterdir() if p.is_dir() and (p.name == "Default" or p.name.startswith("Profile "))]
        except OSError:
            blocked.append(bname)   # macOS privacy protection (data of other apps)
            continue
        seen = set()
        for prof in profiles:
            ext_root = prof / "Extensions"
            if not ext_root.is_dir():
                continue
            for ext in ext_root.iterdir():
                versions = sorted([v for v in ext.iterdir() if v.is_dir()]) if ext.is_dir() else []
                if not versions or ext.name in seen:
                    continue
                try:
                    man = json.loads((versions[-1] / "manifest.json").read_text(encoding="utf-8", errors="ignore"))
                except Exception:
                    continue
                seen.add(ext.name)
                browser.append({"browser": bname, "name": _chromium_name(versions[-1], man), "version": man.get("version", ""),
                                "id": ext.name, "url": f"https://chromewebstore.google.com/detail/{ext.name}"})
    ff = home / "Library/Application Support/Firefox/Profiles"
    try:
        ff_profiles = list(ff.iterdir()) if ff.is_dir() else []
    except OSError:
        blocked.append("Firefox")
        ff_profiles = []
    if ff_profiles:
        for prof in ff_profiles:
            f = prof / "extensions.json"
            if not f.exists():
                continue
            try:
                addons = json.loads(f.read_text(encoding="utf-8", errors="ignore")).get("addons", [])
            except Exception:
                continue
            for a in addons:
                if a.get("type") == "extension" and a.get("location") == "app-profile":
                    browser.append({"browser": "Firefox", "name": (a.get("defaultLocale") or {}).get("name") or a.get("id", ""),
                                    "version": a.get("version", ""), "id": a.get("id", ""), "enabled": a.get("active", True)})
    # Safari: pluginkit blocks → Display Name / Parent Name
    cur = None
    for raw in (DATA / "safari_ext.txt").read_text(errors="ignore").splitlines() if (DATA / "safari_ext.txt").exists() else []:
        m = re.match(r"^\s{2,}([\w.-]+)\(([^)]*)\)\s*$", raw)
        if m:
            cur = {"browser": "Safari", "id": m.group(1), "version": m.group(2), "name": m.group(1)}
            browser.append(cur)
            continue
        m = re.match(r"^\s+Display Name = (.+)$", raw)
        if m and cur:
            cur["name"] = m.group(1).strip()
        m = re.match(r"^\s+Parent Name = (.+)$", raw)
        if m and cur:
            cur["app"] = m.group(1).strip()
    uniq, seen = [], set()
    for b in browser:
        k = (b["browser"], b["id"])
        if k not in seen:
            seen.add(k)
            uniq.append(b)
    uniq.sort(key=lambda x: (x["browser"], x["name"].lower()))
    return {"system": system, "kexts": kexts, "browser": uniq, "blocked": blocked}


def parse_dotfiles():
    if not (DATA / "dotfiles.txt").exists():
        return None
    out = []
    for line in read_lines("dotfiles.txt"):
        path, _, size = line.rpartition("|")
        low = path.lower()
        kind = ("vscode" if "/code/" in low else "cursor" if "/cursor/" in low else "ssh" if ".ssh" in low else
                "git" if "git" in low else "shell" if any(x in low for x in ("zsh", "bash", "profile")) else "editor")
        out.append({"path": "~/" + path, "size": _to_int(size), "kind": kind})
    return out


# ─── Inventory ──────────────────────────────────────────────────────
APPS = parse_apps()
inventory = {
    "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
    "format": "mac-inventory/1",
    "system": _parse_system(),
    "categories": [
        {
            "id": "apps", "label": "Applications", "icon": "🖥",
            "description": "GUI apps in /Applications (Homebrew-Cask-Erkennung)",
            "items": APPS,
        },
        {
            "id": "mas", "label": "Mac App Store", "icon": "🛍",
            "description": "Installiert via `mas install <id>`",
            "items": parse_mas(),
        },
        {
            "id": "brew_formulae", "label": "Homebrew Formulae", "icon": "🍺",
            "description": "CLI-Tools via `brew install <name>`",
            "items": parse_brew_formulae(),
        },
        {
            "id": "brew_casks", "label": "Homebrew Casks", "icon": "📦",
            "description": "GUI-Apps via `brew install --cask <token>`",
            "items": parse_brew_casks(),
        },
        {
            "id": "npm", "label": "npm Global", "icon": "📗",
            "description": "`npm install -g <name>`",
            "items": parse_npm(),
        },
        {
            "id": "pip", "label": "Python Packages", "icon": "🐍",
            "description": "`pip3 install <name>`",
            "items": parse_pip(),
        },
        {
            "id": "gem", "label": "Ruby Gems", "icon": "💎",
            "description": "`gem install <name>`",
            "items": parse_gems(),
        },
        {
            "id": "vscode", "label": "VS Code Extensions", "icon": "🧩",
            "description": "`code --install-extension <id>`",
            "items": parse_vscode(),
        },
        {
            "id": "claude_mcp", "label": "Claude MCP Server", "icon": "🤖",
            "description": "Konfiguriert in claude_desktop_config.json",
            "items": parse_claude_mcp(),
        },
        {
            "id": "claude_plugins", "label": "Claude Plugins", "icon": "🔌",
            "description": "`/plugin install <name>` in Claude Code",
            "items": parse_claude_plugins(),
        },
        {
            "id": "claude_skills", "label": "Claude Skills (lokal)", "icon": "🪄",
            "description": "~/.claude/skills",
            "items": [{"name": n, "version": ""} for n in read_lines("claude_skills.txt")],
        },
        {
            "id": "docker_images", "label": "Docker Images", "icon": "🐳",
            "description": "`docker pull <image>`",
            "items": parse_docker_images(),
        },
        {
            "id": "docker_containers", "label": "Docker Container", "icon": "📦",
            "description": "Alle Docker-Container (laufend + gestoppt)",
            "items": parse_docker_containers(),
        },
        {
            "id": "fonts", "label": "Schriftarten", "icon": "🔤",
            "description": "~/Library/Fonts, /Library/Fonts, /System/Library/Fonts",
            "items": parse_fonts(),
        },
        {
            "id": "system_apps", "label": "System Apps", "icon": "⚙️",
            "description": "Apple-shipped Apps in /System/Applications",
            "items": [{"name": n, "version": "", "install_url": "https://www.apple.com/", "install_desc": "Teil von macOS"} for n in read_lines("system_applications.txt")],
        },
        {
            "id": "user_apps", "label": "User Apps", "icon": "👤",
            "description": "Apps in ~/Applications",
            "items": [{"name": n, "version": ""} for n in read_lines("user_applications.txt")],
        },
        {
            "id": "brew_bin", "label": "/opt/homebrew/bin", "icon": "⚒️",
            "description": "Jede Datei im Homebrew-bin-Ordner",
            "items": [{"name": n, "version": ""} for n in read_lines("brew_binaries.txt")],
        },
        {
            "id": "usr_local_bin", "label": "/usr/local/bin", "icon": "🗂",
            "description": "Binaries in /usr/local/bin",
            "items": [{"name": n, "version": ""} for n in read_lines("usr_local_binaries.txt")],
        },
    ],
}

for cat in inventory["categories"]:
    cat["items"].sort(key=lambda x: x["name"].lower())
    cat["count"] = len(cat["items"])

inventory["total_count"] = sum(c["count"] for c in inventory["categories"])
for key, fn in (("storage", parse_storage), ("versions", parse_versions), ("ports", parse_ports),
                ("extensions", parse_extensions), ("dotfiles", parse_dotfiles)):
    try:
        val = fn()
    except Exception as e:  # one broken source must not break the whole inventory
        print(f"warning: {key}: {e}")
        val = None
    if val is not None:
        inventory[key] = val
security = parse_security()
if security is not None:
    inventory["security"] = security
autostart = parse_autostart()
if autostart is not None:
    inventory["autostart"] = autostart
updates = parse_updates(APPS)
if updates is not None:
    # Pending macOS / Command Line Tools updates from Software Update
    for u in (security or {}).get("pending_updates", []):
        updates["items"].insert(0, {
            "source": "macos", "name": u["name"], "current": "", "latest": u["version"], "cmd": None,
            "url": "x-apple.systempreferences:com.apple.Software-Update-Settings.extension", "icon": None,
        })
    inventory["updates"] = updates

out = HERE / "inventory.json"
out.write_text(json.dumps(inventory, indent=2, ensure_ascii=False))
installable = sum(1 for cat in inventory["categories"] for it in cat["items"] if it.get("install_cmd"))
print(f"wrote {out} — {inventory['total_count']} items across {len(inventory['categories'])} categories ({installable} with install commands)")
