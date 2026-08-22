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

Both are drawn from the same brand primitives as assets/images/icon.svg:
  brand green   #059669 -> #047857 (gradient)
  accent amber  #FBBF24 -> #F59E0B (the bolt)
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

# Geometry copied verbatim from assets/images/icon.svg (viewBox 0 0 1024 1024)
BOLT_PATH = [(430, 180), (640, 430), (530, 430), (600, 844), (390, 530), (500, 530)]
SPEED_LINES = [  # x, y, w, h, opacity
    (120, 430, 165, 32, 0.60),
    (165, 490, 120, 32, 0.40),
    (140, 550, 145, 32, 0.50),
]


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


def vertical_gradient(size, c0, c1):
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line(
            [(0, y), (w, y)],
            fill=(
                int(c0[0] + (c1[0] - c0[0]) * t),
                int(c0[1] + (c1[1] - c0[1]) * t),
                int(c0[2] + (c1[2] - c0[2]) * t),
            ),
        )
    return img


def draw_logo_mark(canvas: Image.Image, ox: int, oy: int, scale: float,
                   with_speed_lines: bool = True) -> None:
    """Draw the ZBR bolt mark onto `canvas` (RGBA) at offset ox/oy.

    `scale` maps the 1024-unit icon.svg coordinate space onto canvas pixels.
    """

    def P(x, y):
        return (ox + x * scale, oy + y * scale)

    if with_speed_lines:
        for x, y, w, h, op in SPEED_LINES:
            layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            x0, y0 = P(x, y)
            x1, y1 = P(x + w, y + h)
            ld.rounded_rectangle([x0, y0, x1, y1], radius=(h * scale) / 2,
                                 fill=WHITE + (int(255 * op),))
            canvas.alpha_composite(layer)

    poly = [P(x, y) for x, y in BOLT_PATH]

    # Amber vertical gradient, clipped to the bolt silhouette.
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    bbox = mask.getbbox()
    if bbox:
        grad = Image.new("RGB", canvas.size, AMBER_DARK)
        strip = vertical_gradient((canvas.size[0], bbox[3] - bbox[1]), AMBER_LIGHT, AMBER_DARK)
        grad.paste(strip, (0, bbox[1]))
        canvas.paste(grad, (0, 0), mask)

    # White outline, same proportion as the SVG's stroke-width="16" at 1024.
    ImageDraw.Draw(canvas).line(poly + [poly[0]], fill=WHITE + (255,),
                                width=max(1, int(16 * scale)), joint="curve")


def build_play_icon() -> str:
    """512x512 app icon, derived from assets/images/icon.png at full quality."""
    out = os.path.join(OUT_DIR, "play-icon-512.png")
    src = Image.open(SRC_ICON)
    if src.size != (1024, 1024):
        raise SystemExit(f"expected a 1024x1024 source icon, got {src.size}")

    # Flatten onto the brand green first so any source alpha can never become a
    # transparent pixel: Play renders the icon on its own backgrounds and shows
    # transparency as black. Result is a 32-bit PNG with a fully opaque alpha.
    flat = Image.new("RGB", src.size, GREEN_LIGHT)
    if src.mode in ("RGBA", "LA") or "transparency" in src.info:
        rgba = src.convert("RGBA")
        flat.paste(rgba, (0, 0), rgba.split()[3])
    else:
        flat.paste(src.convert("RGB"), (0, 0))

    icon = flat.resize((512, 512), Image.LANCZOS).convert("RGBA")
    icon.putalpha(255)
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

    # Background texture: the icon's "speed lines" motif, raked across the whole
    # panel at very low opacity. Full-bleed and directional, so cropping any
    # edge still looks intentional.
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

    # Horizontal lockup: [mark] gap [text block], centred as one unit.
    mark_scale = (H * 0.56) / 1024
    mark_w = (640 - 120) * mark_scale   # bolt + speed lines span x=120..640 in icon.svg
    gap_mark = int(52 * S)
    text_w = max(w_title, w_tag, w_kicker)
    lockup_w = mark_w + gap_mark + text_w
    lockup_x = int((W - lockup_w) / 2)

    draw_logo_mark(canvas, ox=int(lockup_x - 120 * mark_scale),
                   oy=int(H * 0.50 - 512 * mark_scale), scale=mark_scale)

    text_x = int(lockup_x + mark_w + gap_mark)
    gap1, gap2 = int(16 * S), int(18 * S)
    block_h = h_kicker + gap1 + h_title + gap2 + h_tag
    y = int(H / 2 - block_h / 2)

    d.text((text_x, y), kicker, font=f_kicker, fill=AMBER_LIGHT + (255,))
    y += h_kicker + gap1
    d.text((text_x, y), title, font=f_title, fill=WHITE + (255,))
    y += h_title + gap2
    d.text((text_x, y), tagline, font=f_tag, fill=WHITE + (228,))

    # Amber rule under the tagline, tying the accent back to the bolt.
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
