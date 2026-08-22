#!/usr/bin/env python3
"""
Regenerate the Google Play graphic assets for ZBR Courier.

Run from the repo root:

    python3 store-assets/generate_assets.py

Requires Pillow (`pip install Pillow`) and the DejaVu fonts
(`fonts-dejavu-core` on Debian/Ubuntu). Both are present in the
environment this file was authored in; the script prints the real
dimensions/mode of every file it writes so the output can be checked.

Outputs (into store-assets/):
  play-icon-512.png            512x512 RGBA, opaque   -> Play "App icon"
  feature-graphic-1024x500.png 1024x500 RGB           -> Play "Feature graphic"

Both take their mark from the SAME source, assets/images/icon.png, so the
two Play assets cannot drift apart when the app icon is redrawn. (An earlier
version of this script hand-drew a lightning bolt from favicon.svg; the app
icon has since become a map pin, and the feature graphic silently kept
advertising a mark the app no longer uses. Deriving both from icon.png is
what stops that recurring.)

Brand palette, from constants/colors.ts:
  brand green   #059669 -> #047857 (gradient ground)
  accent amber  #FBBF24 -> #F59E0B (kicker text and rule)
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "store-assets")
SRC_ICON = os.path.join(REPO_ROOT, "assets", "images", "icon.png")

GREEN_LIGHT = (5, 150, 105)     # #059669 - Colors.primary in constants/colors.ts
GREEN_DARK = (4, 120, 87)       # #047857
AMBER_LIGHT = (251, 191, 36)    # #FBBF24
AMBER_DARK = (245, 158, 11)     # #F59E0B
WHITE = (255, 255, 255)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Corner radius of the icon tile in the feature graphic, as a fraction of its
# side. ~22% is the proportion Play's own launcher/store masks use, so the tile
# reads as "this app's icon" rather than as a pasted square.
TILE_RADIUS_FRAC = 0.22


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        print(f"WARNING: {path} not found, falling back to PIL's bitmap default "
              f"(text will look poor). Install fonts-dejavu-core.", file=sys.stderr)
        return ImageFont.load_default()


def linear_gradient(size, c0, c1, horizontal_bias=0.5):
    """Diagonal gradient from c0 (top-left) to c1 (bottom-right)."""
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    denom = float(w * horizontal_bias + h * (1.0 - horizontal_bias))
    for y in range(h):
        ypart = y * (1.0 - horizontal_bias)
        for x in range(w):
            t = (x * horizontal_bias + ypart) / denom
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            px[x, y] = (
                int(c0[0] + (c1[0] - c0[0]) * t),
                int(c0[1] + (c1[1] - c0[1]) * t),
                int(c0[2] + (c1[2] - c0[2]) * t),
            )
    return img


def load_app_icon() -> Image.Image:
    """assets/images/icon.png, flattened onto the brand green, as opaque RGB.

    Flattening first means no source alpha can survive as a transparent pixel:
    Play renders the icon on its own backgrounds and shows transparency as
    black. Both outputs go through here, so both always show the same mark.
    """
    src = Image.open(SRC_ICON)
    if src.size != (1024, 1024):
        raise SystemExit(f"expected a 1024x1024 source icon, got {src.size}")

    flat = Image.new("RGB", src.size, GREEN_LIGHT)
    if src.mode in ("RGBA", "LA") or "transparency" in src.info:
        rgba = src.convert("RGBA")
        flat.paste(rgba, (0, 0), rgba.split()[3])
    else:
        flat.paste(src.convert("RGB"), (0, 0))
    return flat


def paste_icon_tile(canvas: Image.Image, ox: int, oy: int, side: int) -> None:
    """Paste the app icon onto `canvas` (RGBA) as a rounded tile of `side` px.

    The mark is the real app icon, not a redrawing of it, so the feature
    graphic can never advertise artwork the installed app does not have.
    """
    tile = load_app_icon().resize((side, side), Image.LANCZOS).convert("RGBA")

    # Antialiased rounded-square mask: built at 4x and downsampled, because
    # ImageDraw does not antialias its own shapes.
    SS = 4
    mask = Image.new("L", (side * SS, side * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, side * SS - 1, side * SS - 1],
        radius=int(side * SS * TILE_RADIUS_FRAC), fill=255,
    )
    tile.putalpha(mask.resize((side, side), Image.LANCZOS))

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(tile, (ox, oy), tile)
    canvas.alpha_composite(layer)


def build_play_icon() -> str:
    """512x512 app icon, derived from assets/images/icon.png at full quality."""
    out = os.path.join(OUT_DIR, "play-icon-512.png")
    icon = load_app_icon().resize((512, 512), Image.LANCZOS).convert("RGBA")
    icon.putalpha(255)      # 32-bit PNG, every pixel fully opaque
    icon.save(out, "PNG", optimize=True)
    return out


def build_feature_graphic() -> str:
    """1024x500 feature graphic, composed programmatically at 4x then downsampled.

    Play crops the feature graphic on some surfaces, so the whole lockup is
    centred and kept inside a ~10% safe margin on every edge.
    """
    out = os.path.join(OUT_DIR, "feature-graphic-1024x500.png")
    S = 4  # supersample factor -> antialiased edges and text after the downscale
    W, H = 1024 * S, 500 * S

    base = linear_gradient((W, H), GREEN_LIGHT, GREEN_DARK, horizontal_bias=0.72)
    canvas = base.convert("RGBA")

    # Background texture: motion streaks raked across the whole panel at very
    # low opacity. Full-bleed and directional, so cropping any edge still looks
    # intentional. Abstract on purpose - it carries no product claim.
    streaks = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(streaks)
    for i, (frac, length, alpha) in enumerate(
        [(0.06, 0.52, 16), (0.20, 0.34, 11), (0.34, 0.44, 9),
         (0.62, 0.40, 9), (0.76, 0.56, 13), (0.90, 0.30, 10)]
    ):
        y0 = int(H * 2 * frac)
        x0 = int((W * 2) * (0.05 + 0.10 * (i % 3)))
        sd.rounded_rectangle(
            [x0, y0, x0 + int(W * 2 * length), y0 + int(16 * S)],
            radius=int(8 * S), fill=WHITE + (alpha,),
        )
    streaks = streaks.rotate(-18, resample=Image.BICUBIC, center=(W, H))
    canvas.alpha_composite(streaks.crop((W // 2, H // 2, W // 2 + W, H // 2 + H)))

    d = ImageDraw.Draw(canvas)
    f_title = load_font(FONT_BOLD, int(78 * S))
    f_tag = load_font(FONT_REGULAR, int(31 * S))
    f_kicker = load_font(FONT_BOLD, int(19 * S))

    title = "ZBR Courier"
    tagline = "Orders, routes and earnings"
    kicker = "DELIVERY PARTNER APP"

    w_title = d.textbbox((0, 0), title, font=f_title)[2]
    w_tag = d.textbbox((0, 0), tagline, font=f_tag)[2]
    w_kicker = d.textbbox((0, 0), kicker, font=f_kicker)[2]
    h_title = d.textbbox((0, 0), title, font=f_title)[3]
    h_tag = d.textbbox((0, 0), tagline, font=f_tag)[3]
    h_kicker = d.textbbox((0, 0), kicker, font=f_kicker)[3]

    # Horizontal lockup: [icon tile] gap [text block], centred as one unit.
    mark_w = int(H * 0.50)              # square tile, 50% of the panel height
    gap_mark = int(44 * S)
    text_w = max(w_title, w_tag, w_kicker)
    lockup_w = mark_w + gap_mark + text_w
    lockup_x = int((W - lockup_w) / 2)

    paste_icon_tile(canvas, ox=lockup_x, oy=int((H - mark_w) / 2), side=mark_w)

    text_x = int(lockup_x + mark_w + gap_mark)
    gap1, gap2 = int(16 * S), int(18 * S)
    block_h = h_kicker + gap1 + h_title + gap2 + h_tag
    y = int(H / 2 - block_h / 2)

    d.text((text_x, y), kicker, font=f_kicker, fill=AMBER_LIGHT + (255,))
    y += h_kicker + gap1
    d.text((text_x, y), title, font=f_title, fill=WHITE + (255,))
    y += h_title + gap2
    d.text((text_x, y), tagline, font=f_tag, fill=WHITE + (228,))

    # Amber rule under the tagline, carrying the accent colour through.
    rule_y = y + h_tag + int(20 * S)
    d.rounded_rectangle(
        [text_x, rule_y, text_x + int(96 * S), rule_y + int(6 * S)],
        radius=int(3 * S), fill=AMBER_DARK + (255,),
    )

    right_edge = text_x + text_w
    print(f"  feature graphic lockup: x {lockup_x / S:.0f}..{right_edge / S:.0f} "
          f"of 1024 (safe margins {lockup_x / S:.0f}px left, "
          f"{(W - right_edge) / S:.0f}px right)")

    final = canvas.convert("RGB").resize((1024, 500), Image.LANCZOS)
    final.save(out, "PNG", optimize=True)
    return out


def verify(path: str) -> None:
    im = Image.open(path)
    extrema = im.getchannel("A").getextrema() if im.mode == "RGBA" else None
    print(f"{os.path.relpath(path, REPO_ROOT)}: size={im.size} mode={im.mode} "
          f"format={im.format} bytes={os.path.getsize(path)}"
          + (f" alpha_min_max={extrema}" if extrema else ""))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in (build_play_icon(), build_feature_graphic()):
        verify(f)
