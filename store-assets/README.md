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
| `check_copy.py` | Validates that copy against Play's character limits, then checks the background-location disclosure sentence **in the direction the app config requires** — mandatory while `ACCESS_BACKGROUND_LOCATION` is declared, forbidden if it is ever dropped. |
| `generate_assets.py` | Regenerates the two graphic assets below. Both take their mark from `assets/images/icon.png`, so they cannot drift apart when the app icon is redrawn. |
| `play-icon-512.png` | 512×512 32-bit PNG, fully opaque. Play "App icon". |
| `feature-graphic-1024x500.png` | 1024×500 24-bit PNG. Play "Feature graphic" (required). |
| `prepare_screenshots.py` | Strips alpha from raw `adb screencap` PNGs and validates them against Play's screenshot constraints. |
| `screenshots/<locale>/` | Captured phone screenshots. Not present yet — see §5 of the listing doc. |

## Commands

```bash
# Re-verify all listing text against Play's limits and check the disclosure
# sentence against the resolved app config (exits non-zero on failure).
# Needs node_modules — it runs `npx expo config --type prebuild --json`.
python3 store-assets/check_copy.py

# Character limits only, no config resolve (do not use as a release gate)
python3 store-assets/check_copy.py --skip-config

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
reproduces the copy verbatim for reading, and the character counts printed in
its §1 table come from this file.

The one paragraph you may not edit freely is the `LOCATION` block of each full
description. Its disclosure sentence is coupled to
`android.permissions` in `app.config.ts`: `check_copy.py` requires the sentence
while `ACCESS_BACKGROUND_LOCATION` is declared and rejects it if the permission
is ever dropped, because a listing that claims background collection the app
does not perform is a misrepresentation under Play's Location policy.
