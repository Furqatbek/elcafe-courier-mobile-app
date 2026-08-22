#!/usr/bin/env python3
"""
Verify every Google Play listing string in store-assets/listing-copy.json
against Play Console's character limits, and check the background-location
disclosure sentence against what the app actually ships.

    python3 store-assets/check_copy.py
    python3 store-assets/check_copy.py --skip-config   # limits only, no npx

Play counts characters, not bytes, and counts a newline as one character —
`len()` on a Python str is exactly that count, so it is the right measure.

The disclosure check is NOT unconditional. Play requires the "even when the app
is closed or not in use" sentence in the store listing of an app that collects
location in the background — and treats it as a misrepresentation if the
listing claims background collection the app does not perform. So the required
direction is decided by the resolved app config:

    ACCESS_BACKGROUND_LOCATION present  -> the sentence MUST be in every locale
    ACCESS_BACKGROUND_LOCATION absent   -> the sentence MUST NOT be anywhere

Exits non-zero if any field is over its limit or either disclosure rule is
broken, so this can gate a release.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
COPY = os.path.join(HERE, "listing-copy.json")

BACKGROUND_LOCATION = "android.permission.ACCESS_BACKGROUND_LOCATION"

FIELD_LABEL = {
    "name": "App name",
    "short_description": "Short description",
    "full_description": "Full description",
    "release_notes": "Release notes (What's new)",
}

# The sentence Play's own Location policy guidance models, per locale. Matched
# after apostrophe normalisation so a typographic ’ in the Uzbek copy still
# counts as the same sentence.
DISCLOSURE_MARKER = {
    "en": "even when the app is closed or not in use",
    "ru": "даже когда приложение закрыто или не используется",
    "uz": "hatto ilova yopiq yoki ishlatilmayotgan bo'lsa ham",
}


def normalize(text: str) -> str:
    """Fold the apostrophe variants Uzbek copy mixes freely, and case."""
    folded = unicodedata.normalize("NFC", text)
    for ch in "‘’ʻʼʾ`´":
        folded = folded.replace(ch, "'")
    return folded.casefold()


def resolve_android_permissions() -> set[str] | None:
    """Permissions in the resolved prebuild config, or None if unresolvable.

    This is the same source `expo prebuild` writes the manifest from, so it is
    the honest answer to "does this build ship background location?" without
    needing a built AAB. Note it does NOT include permissions that only merge
    in from library manifests at Gradle time — irrelevant here, because
    ACCESS_BACKGROUND_LOCATION is declared by app.config.ts / the expo-location
    plugin, never by a library manifest.
    """
    try:
        proc = subprocess.run(
            ["npx", "--no-install", "expo", "config", "--type", "prebuild", "--json"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"  could not run npx expo config: {exc}", file=sys.stderr)
        return None
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-3:]
        print(f"  npx expo config exited {proc.returncode}", file=sys.stderr)
        for line in tail:
            print(f"    {line}", file=sys.stderr)
        return None
    try:
        cfg = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        print(f"  npx expo config did not return JSON: {exc}", file=sys.stderr)
        return None

    raw = (cfg.get("android") or {}).get("permissions") or []
    return {p if "." in p else f"android.permission.{p}" for p in raw}


def main() -> int:
    skip_config = "--skip-config" in sys.argv[1:]

    with open(COPY, encoding="utf-8") as fh:
        data = json.load(fh)
    limits = data["_limits"]
    locales = [k for k in data if not k.startswith("_")]
    failures = 0

    # ------------------------------------------------ character limits ------
    print(f"{'locale':7} {'field':28} {'chars':>6} {'limit':>6} {'left':>6}  status")
    print("-" * 70)
    for loc in locales:
        for field, limit in limits.items():
            value = data[loc][field]
            n = len(value)
            ok = n <= limit
            failures += 0 if ok else 1
            print(f"{loc:7} {FIELD_LABEL[field]:28} {n:6} {limit:6} {limit - n:6}  "
                  f"{'OK' if ok else 'OVER LIMIT'}")
        print("-" * 70)

    # ------------------------------ background-location disclosure ----------
    print()
    if skip_config:
        print("background-location disclosure: SKIPPED (--skip-config)")
        print("  Re-run without --skip-config before any upload: the required")
        print("  direction of this check depends on the resolved app config.")
    else:
        print("Resolving android.permissions from app.config.ts "
              "(npx expo config --type prebuild --json) ...")
        permissions = resolve_android_permissions()

        if permissions is None:
            print("FAIL  could not resolve the app config, so whether the "
                  "background-location")
            print("      disclosure is required or forbidden is unknown. Run this from a "
                  "checkout")
            print("      with node_modules installed, or pass --skip-config to check only "
                  "the")
            print("      character limits.")
            return 2

        required = BACKGROUND_LOCATION in permissions
        if required:
            print(f"  {BACKGROUND_LOCATION} IS declared "
                  "-> the disclosure sentence is REQUIRED in every locale.")
        else:
            print(f"  {BACKGROUND_LOCATION} is NOT declared "
                  "-> the disclosure sentence is FORBIDDEN.")
            print("  A listing that claims background collection the app does not perform "
                  "is a")
            print("  misrepresentation under Play's Location policy, and contradicts Data "
                  "safety.")
        print()

        for loc in locales:
            marker = DISCLOSURE_MARKER.get(loc)
            if marker is None:
                print(f"{loc:7} background-location sentence   "
                      "NO MARKER DEFINED for this locale")
                failures += 1
                continue
            present = normalize(marker) in normalize(data[loc]["full_description"])
            if required:
                ok, label = present, ("present" if present else "MISSING - add it")
            else:
                ok, label = (not present), ("absent" if not present
                                            else "PRESENT BUT FORBIDDEN - remove it")
            failures += 0 if ok else 1
            print(f"{loc:7} {'background-location sentence':30} {label}")

    print()
    if failures:
        print("FAIL")
    elif skip_config:
        print("All listing fields within Play limits. "
              "Disclosure NOT checked (--skip-config).")
    else:
        print("All listing fields within Play limits, "
              "disclosure state consistent with the app config.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
