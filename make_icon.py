#!/usr/bin/env python3
"""Generate a macOS .icns icon for MacAtlas."""
import pathlib, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).parent
OUT_DIR = HERE / "build"
OUT_DIR.mkdir(exist_ok=True)
ICONSET = OUT_DIR / "icon.iconset"
if ICONSET.exists():
    shutil.rmtree(ICONSET)
ICONSET.mkdir()

SIZE = 1024  # master

def squircle(size, radius_ratio=0.237):
    """Apple-style squircle mask (approximation via rounded rectangle)."""
    r = int(size * radius_ratio)
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size, size), radius=r, fill=255)
    return mask


def gradient(size, c_top, c_bottom):
    """Vertical gradient."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(c_top[0] + (c_bottom[0] - c_top[0]) * t)
        g = int(c_top[1] + (c_bottom[1] - c_top[1]) * t)
        b = int(c_top[2] + (c_bottom[2] - c_top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def make_master(size=SIZE):
    """Atlas globe with a cluster of app tiles, on Apple's icon grid (824 px body, soft shadow)."""
    S = size * 2                      # draw at 2× and downsample for smooth edges
    body = int(S * 824 / 1024)
    off = (S - body) // 2

    # Background: deep ocean blue
    bg = gradient(body, (34, 92, 196), (12, 34, 92)).convert("RGBA")
    glow = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((body * 0.1, -body * 0.25, body * 0.9, body * 0.55), fill=(120, 190, 255, 90))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(body * 0.08)))

    # Globe: lighter disc with latitude/longitude lines
    cx = cy = body / 2
    R = body * 0.36
    globe = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    gd = ImageDraw.Draw(globe)
    gd.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(70, 150, 245, 255))
    shade = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    ImageDraw.Draw(shade).ellipse((cx - R * 0.55, cy - R * 1.05, cx + R * 1.25, cy + R * 0.7), fill=(150, 210, 255, 120))
    shade = shade.filter(ImageFilter.GaussianBlur(R * 0.25))
    disc = Image.new("L", (body, body), 0)
    ImageDraw.Draw(disc).ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
    globe = Image.alpha_composite(globe, Image.composite(shade, Image.new("RGBA", (body, body), (0, 0, 0, 0)), disc))
    lines = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lines)
    lw = max(2, int(body * 0.008))
    line = (255, 255, 255, 110)
    for k in (0.33, 0.66):            # meridians as ellipses
        ld.ellipse((cx - R * k, cy - R, cx + R * k, cy + R), outline=line, width=lw)
    ld.line((cx, cy - R, cx, cy + R), fill=line, width=lw)
    for lat in (-0.6, -0.3, 0, 0.3, 0.6):   # parallels
        y = cy + R * lat
        half = (R * R - (R * lat) ** 2) ** 0.5
        ld.line((cx - half, y, cx + half, y), fill=line, width=lw)
    lines = Image.composite(lines, Image.new("RGBA", (body, body), (0, 0, 0, 0)), disc)
    globe = Image.alpha_composite(globe, lines)
    ImageDraw.Draw(globe).ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255, 170), width=lw * 2)
    bg = Image.alpha_composite(bg, globe)

    # App tiles pinned on the globe (2×2, slightly offset like map markers)
    tile = body * 0.17
    gap = body * 0.035
    colors = [(255, 159, 10), (52, 199, 89), (255, 69, 58), (191, 90, 242)]
    x0 = cx - tile - gap / 2
    y0 = cy - tile - gap / 2
    tiles = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (body, body), (0, 0, 0, 0))
    td, sd = ImageDraw.Draw(tiles), ImageDraw.Draw(shadow)
    for i, col in enumerate(colors):
        x = x0 + (i % 2) * (tile + gap)
        y = y0 + (i // 2) * (tile + gap)
        sd.rounded_rectangle((x, y + body * 0.015, x + tile, y + tile + body * 0.015), radius=tile * 0.26, fill=(0, 20, 60, 120))
        top = tuple(min(255, int(c + (255 - c) * 0.25)) for c in col)
        tg = gradient(int(tile), top, col).convert("RGBA")
        m = Image.new("L", tg.size, 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, tg.size[0] - 1, tg.size[1] - 1), radius=tile * 0.26, fill=255)
        tiles.paste(tg, (int(x), int(y)), m)
    bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(body * 0.012)))
    bg = Image.alpha_composite(bg, tiles)

    # Mask to a squircle and place it on the canvas with a drop shadow
    mask = squircle(body, 0.225)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    drop = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(drop).rounded_rectangle((off, off + S * 0.012, off + body, off + body + S * 0.012), radius=body * 0.225, fill=(0, 0, 0, 110))
    canvas = Image.alpha_composite(canvas, drop.filter(ImageFilter.GaussianBlur(S * 0.014)))
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer.paste(bg, (off, off), mask)
    canvas = Image.alpha_composite(canvas, layer)
    return canvas.resize((size, size), Image.LANCZOS)


print("Generating 1024×1024 master …")
master = make_master()
master_path = OUT_DIR / "icon_1024.png"
master.save(master_path)
print(f"  → {master_path}")

# iconset: standard macOS sizes
sizes = [
    (16, "16x16"),
    (32, "16x16@2x"),
    (32, "32x32"),
    (64, "32x32@2x"),
    (128, "128x128"),
    (256, "128x128@2x"),
    (256, "256x256"),
    (512, "256x256@2x"),
    (512, "512x512"),
    (1024, "512x512@2x"),
]

print("Rendering iconset …")
for px, name in sizes:
    out = master.resize((px, px), Image.LANCZOS)
    out.save(ICONSET / f"icon_{name}.png")
    print(f"  → icon_{name}.png")

icns = OUT_DIR / "icon.icns"
if icns.exists():
    icns.unlink()
subprocess.run(["iconutil", "-c", "icns", str(ICONSET), "-o", str(icns)], check=True)
print(f"✓ Wrote {icns}")


def make_tray(px):
    """Menu bar template image: globe outline on transparent.
    macOS recolors "*Template.png" images for light/dark menu bars."""
    s = px * 8  # draw large, downsample for clean edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = int(s * 0.085)
    pad = s * 0.08
    d.ellipse((pad, pad, s - pad, s - pad), outline=(0, 0, 0, 255), width=lw)
    d.ellipse((s * 0.32, pad, s * 0.68, s - pad), outline=(0, 0, 0, 255), width=int(lw * 0.8))
    d.line((pad, s / 2, s - pad, s / 2), fill=(0, 0, 0, 255), width=int(lw * 0.8))
    return img.resize((px, px), Image.LANCZOS)


ELECTRON = HERE / "electron"
make_tray(18).save(ELECTRON / "trayTemplate.png")
make_tray(36).save(ELECTRON / "trayTemplate@2x.png")
print("✓ Wrote electron/trayTemplate.png (+@2x)")
