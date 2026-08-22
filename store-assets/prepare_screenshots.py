#!/usr/bin/env python3
"""
Make raw `adb exec-out screencap -p` captures uploadable to Google Play.

    python3 store-assets/prepare_screenshots.py store-assets/screenshots/en

For every PNG/JPEG in the directory this:
  * strips the alpha channel (screencap writes RGBA; Play rejects alpha),
  * re-saves as a 24-bit PNG in place,
  * validates the file against Play's phone-screenshot constraints and prints
    the real dimensions it read back.

Constraints checked (re-confirm against Play Console before uploading — the
uploader itself is the only never-stale source; see docs/PLAY_STORE_LISTING.md):
  * each side between 320 and 3840 px
  * longest side no more than 2x the shortest side
  * at least 2 screenshots present (>=4 for Play's featuring surfaces)

Exits non-zero if any file or the set as a whole would be rejected.
"""

from __future__ import annotations

import os
import sys

from PIL import Image

MIN_SIDE = 320
MAX_SIDE = 3840
MAX_RATIO = 2.0
MIN_COUNT = 2
FEATURING_COUNT = 4
EXTS = (".png", ".jpg", ".jpeg")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    d = argv[1]
    if not os.path.isdir(d):
        print(f"not a directory: {d}", file=sys.stderr)
        return 2

    files = sorted(f for f in os.listdir(d) if f.lower().endswith(EXTS))
    if not files:
        print(f"no screenshots found in {d}", file=sys.stderr)
        return 1

    problems = 0
    for name in files:
        path = os.path.join(d, name)
        im = Image.open(path)
        had_alpha = im.mode in ("RGBA", "LA", "P") and (
            im.mode != "P" or "transparency" in im.info
        )
        if im.mode != "RGB":
            im = im.convert("RGB")
            im.save(path, "PNG", optimize=True)

        check = Image.open(path)
        w, h = check.size
        lo, hi = min(w, h), max(w, h)
        ratio = hi / lo
        errs = []
        if lo < MIN_SIDE or hi > MAX_SIDE:
            errs.append(f"side out of {MIN_SIDE}-{MAX_SIDE}px range")
        if ratio > MAX_RATIO:
            errs.append(f"aspect {ratio:.2f}:1 exceeds the {MAX_RATIO:.0f}x cap")
        if check.mode != "RGB":
            errs.append(f"mode {check.mode} still carries alpha")
        problems += len(errs)

        print(f"{name}: {w}x{h} {check.mode} ratio={ratio:.2f} "
              f"{'(alpha stripped) ' if had_alpha else ''}"
              f"{'REJECT: ' + '; '.join(errs) if errs else 'OK'}")

    n = len(files)
    print(f"\n{n} screenshot(s) in {d}")
    if n < MIN_COUNT:
        print(f"REJECT: Play requires at least {MIN_COUNT} phone screenshots.")
        problems += 1
    elif n < FEATURING_COUNT:
        print(f"WARNING: {FEATURING_COUNT}+ are needed to be eligible for Play's "
              f"featuring surfaces.")
    if n > 8:
        print("REJECT: Play accepts at most 8 screenshots per locale.")
        problems += 1

    print("FAIL" if problems else "All screenshots pass the checked constraints.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
