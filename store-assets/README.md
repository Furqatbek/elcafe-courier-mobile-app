# store-assets/

Google Play store-listing assets for **ZBR Courier** (`app.zbr.courier`).

Nothing in here ships inside the app — these files are uploaded by hand to
Play Console → Grow → Store presence → Main store listing. The listing copy,
the screenshot capture plan, and the outstanding decisions live in
[`../docs/PLAY_STORE_LISTING.md`](../docs/PLAY_STORE_LISTING.md).

## Contents

| File | What it is |
|---|---|
| `listing-copy.json` | **Source of truth** for every listing string, in en / ru / uz. |
| `check_copy.py` | Validates that copy against Play's character limits and asserts the background-location disclosure sentence is present in all three locales. |
| `generate_assets.py` | Regenerates the two graphic assets below from `assets/images/icon.png` and the brand palette. |
| `play-icon-512.png` | 512×512 32-bit PNG, fully opaque. Play "App icon". |
| `feature-graphic-1024x500.png` | 1024×500 24-bit PNG. Play "Feature graphic" (required). |
| `prepare_screenshots.py` | Strips alpha from raw `adb screencap` PNGs and validates them against Play's screenshot constraints. |
| `screenshots/<locale>/` | Captured phone screenshots. Not present yet — see §5 of the listing doc. |

## Commands

```bash
# Re-verify all listing text against Play's limits (exits non-zero on failure)
python3 store-assets/check_copy.py

# Rebuild the icon and the feature graphic, printing their real dimensions
python3 store-assets/generate_assets.py

# Clean up and validate a captured screenshot set
python3 store-assets/prepare_screenshots.py store-assets/screenshots/en
```

Requirements: Python 3 with **Pillow**, and the **DejaVu** fonts
(`fonts-dejavu-core`) for the feature graphic's type. `generate_assets.py`
warns on stderr and falls back to PIL's bitmap default if DejaVu is missing,
rather than silently producing a low-quality graphic.

## Editing the copy

Edit `listing-copy.json`, then re-run `check_copy.py`. If you change a string,
update the matching block in `docs/PLAY_STORE_LISTING.md` too — the doc
reproduces the copy verbatim for reading, and the two were verified
character-identical when they were written.
