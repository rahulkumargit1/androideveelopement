"""
VeriCash icon generator
Produces:
  icon.png          1024x1024  navy circle bg + gold star (opaque)
  adaptive-icon.png 1024x1024  navy circle on transparent bg + gold star
  splash.png        1284x2778  navy bg + centred star + "VeriCash" text
"""

import math
from PIL import Image, ImageDraw, ImageFont

NAVY  = "#162e51"
GOLD  = "#ffbc78"
WHITE = "#ffffff"


def star_polygon(cx, cy, r_outer, r_inner, points=5):
    coords = []
    for i in range(points * 2):
        angle = math.radians(i * 180 / points - 90)
        r = r_outer if i % 2 == 0 else r_inner
        coords.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return coords


# ── icon.png — 1024×1024, navy square bg, navy circle, gold star ─────────────
def make_icon(path="icon.png", size=1024):
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)

    # Circle fills the entire square
    draw.ellipse([0, 0, size - 1, size - 1], fill=NAVY)

    # Gold star centred, outer radius = 30 % of size
    cx, cy = size / 2, size / 2
    r_outer = size * 0.30
    r_inner = r_outer * 0.42   # inner radius ≈ 42 % of outer (classic 5-pt star)
    pts = star_polygon(cx, cy, r_outer, r_inner)
    draw.polygon(pts, fill=GOLD)

    # Save as flat RGB (PNG)
    img.convert("RGB").save(path, "PNG")
    print(f"  Written {path}")


# ── adaptive-icon.png — navy circle on transparent bg ────────────────────────
def make_adaptive_icon(path="adaptive-icon.png", size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))   # transparent
    draw = ImageDraw.Draw(img)

    # Navy circle
    draw.ellipse([0, 0, size - 1, size - 1], fill=NAVY)

    # Gold star centred, same proportions as icon
    cx, cy = size / 2, size / 2
    r_outer = size * 0.30
    r_inner = r_outer * 0.42
    pts = star_polygon(cx, cy, r_outer, r_inner)
    draw.polygon(pts, fill=GOLD)

    img.save(path, "PNG")
    print(f"  Written {path}")


# ── splash.png — 1284×2778, navy bg, larger star + "VeriCash" below ──────────
def make_splash(path="splash.png", w=1284, h=2778):
    img = Image.new("RGBA", (w, h), NAVY)
    draw = ImageDraw.Draw(img)

    cx, cy_star = w / 2, h * 0.42   # star slightly above centre

    # Star: outer radius = 22 % of width
    r_outer = w * 0.22
    r_inner = r_outer * 0.42
    pts = star_polygon(cx, cy_star, r_outer, r_inner)
    draw.polygon(pts, fill=GOLD)

    # "VeriCash" text below star
    text = "VeriCash"
    font_size = int(w * 0.10)   # ~128 px at 1284 wide

    # Try to load a bold system font; fall back to default
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (w - tw) / 2 - bbox[0]
    ty = cy_star + r_outer + int(w * 0.06) - bbox[1]
    draw.text((tx, ty), text, font=font, fill=GOLD)

    img.convert("RGB").save(path, "PNG")
    print(f"  Written {path}")


if __name__ == "__main__":
    import os
    # Run from the assets directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("Generating VeriCash icons …")
    make_icon()
    make_adaptive_icon()
    make_splash()
    print("Done.")
