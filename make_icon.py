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
    # Background: dark gradient (Tokyo-Night-ish blue → deep indigo)
    bg = gradient(size, (26, 32, 45), (12, 15, 24))

    # Soft inner glow
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = size // 2, int(size * 0.42)
    gd.ellipse((cx - size//2, cy - size//2, cx + size//2, cy + size//2),
               fill=(122, 162, 247, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.12))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow)

    draw = ImageDraw.Draw(bg)

    # Draw a stylized monitor
    # Monitor body
    mw = int(size * 0.72)
    mh = int(size * 0.52)
    mx = (size - mw) // 2
    my = int(size * 0.19)
    mr = int(size * 0.055)

    # Monitor shadow
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((mx + 10, my + 20, mx + mw + 10, my + mh + 20),
                         radius=mr, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.025))
    bg = Image.alpha_composite(bg, shadow)
    draw = ImageDraw.Draw(bg)

    # Monitor bezel
    draw.rounded_rectangle((mx, my, mx + mw, my + mh), radius=mr,
                           fill=(32, 38, 50), outline=(70, 80, 100), width=max(2, size//180))

    # Screen inset
    pad = int(size * 0.028)
    sx1, sy1, sx2, sy2 = mx + pad, my + pad, mx + mw - pad, my + mh - pad
    draw.rounded_rectangle((sx1, sy1, sx2, sy2), radius=int(mr * 0.6),
                           fill=(16, 20, 29))

    # Grid of 4x3 app tiles (inventory items on the screen)
    gpad = int(size * 0.022)
    cols, rows = 4, 3
    cell_w = (sx2 - sx1 - gpad * (cols + 1)) / cols
    cell_h = (sy2 - sy1 - gpad * (rows + 1)) / rows
    # Colors inspired by brew/mas/npm/pip tags
    palette = [
        (122, 162, 247),  # accent blue
        (187, 154, 247),  # purple
        (158, 206, 106),  # green
        (224, 175, 104),  # amber (brew)
        (247, 118, 142),  # pink
        (124, 207, 255),  # cyan
        (209, 143, 167),  # mauve
        (240, 221, 166),  # soft yellow
        (119, 196, 214),  # teal
        (255, 158, 100),  # orange
        (158, 158, 207),  # periwinkle
        (189, 170, 123),  # tan
    ]
    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c
            x = sx1 + gpad + c * (cell_w + gpad)
            y = sy1 + gpad + r * (cell_h + gpad)
            color = palette[idx % len(palette)]
            draw.rounded_rectangle((x, y, x + cell_w, y + cell_h),
                                   radius=int(cell_w * 0.22),
                                   fill=color + (240,))

    # Monitor stand
    stand_w = int(size * 0.14)
    stand_h = int(size * 0.07)
    sx = (size - stand_w) // 2
    sy = my + mh
    draw.polygon([
        (sx, sy + stand_h),
        (sx + stand_w, sy + stand_h),
        (sx + int(stand_w * 0.75), sy),
        (sx + int(stand_w * 0.25), sy),
    ], fill=(45, 52, 68))

    # Base plate
    bw = int(size * 0.26)
    bh = int(size * 0.025)
    bx = (size - bw) // 2
    by = my + mh + stand_h
    draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=bh // 2, fill=(55, 62, 78))

    # Apply squircle mask
    mask = squircle(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out


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
    """Menu bar template image: black monitor with 2×2 tiles on transparent.
    macOS recolors "*Template.png" images for light/dark menu bars."""
    s = px * 8  # draw large, downsample for clean edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = int(s * 0.09)
    d.rounded_rectangle((s * 0.06, s * 0.12, s * 0.94, s * 0.72), radius=s * 0.1, outline=(0, 0, 0, 255), width=lw)
    tile, gap = s * 0.16, s * 0.06
    x0, y0 = s * 0.5 - tile - gap / 2, s * 0.42 - tile - gap / 2
    for r in range(2):
        for c in range(2):
            x, y = x0 + c * (tile + gap), y0 + r * (tile + gap)
            d.rounded_rectangle((x, y, x + tile, y + tile), radius=tile * 0.25, fill=(0, 0, 0, 255))
    d.rectangle((s * 0.44, s * 0.72, s * 0.56, s * 0.84), fill=(0, 0, 0, 255))
    d.rounded_rectangle((s * 0.28, s * 0.83, s * 0.72, s * 0.92), radius=s * 0.04, fill=(0, 0, 0, 255))
    return img.resize((px, px), Image.LANCZOS)


ELECTRON = HERE / "electron"
make_tray(18).save(ELECTRON / "trayTemplate.png")
make_tray(36).save(ELECTRON / "trayTemplate@2x.png")
print("✓ Wrote electron/trayTemplate.png (+@2x)")
