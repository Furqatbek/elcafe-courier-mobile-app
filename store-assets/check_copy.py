#!/usr/bin/env python3
"""
Verify every Google Play listing string in store-assets/listing-copy.json
against Play Console's character limits.

    python3 store-assets/check_copy.py

Play counts characters, not bytes, and counts a newline as one character.
Exits non-zero if any field is over its limit, so this can gate a release.
"""

from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COPY = os.path.join(HERE, "listing-copy.json")

FIELD_LABEL = {
    "name": "App name",
    "short_description": "Short description",
    "full_description": "Full description",
    "release_notes": "Release notes (What's new)",
}

# The one sentence Google Play expects in the listing of any app that accesses
# location in the background. Must appear verbatim-in-substance per locale.
DISCLOSURE_MARKER = {
    "en": "even when the app is closed or not in use",
    "ru": "даже когда приложение закрыто или не используется",
    "uz": "hatto ilova yopiq yoki ishlatilmayotgan bo'lsa ham",
}


def main() -> int:
    data = json.load(open(COPY, encoding="utf-8"))
    limits = data["_limits"]
    locales = [k for k in data if not k.startswith("_")]
    failures = 0

    print(f"{'locale':7} {'field':28} {'chars':>6} {'limit':>6}  status")
    print("-" * 62)
    for loc in locales:
        for field, limit in limits.items():
            value = data[loc][field]
            n = len(value)
            ok = n <= limit
            failures += 0 if ok else 1
            print(f"{loc:7} {FIELD_LABEL[field]:28} {n:6} {limit:6}  "
                  f"{'OK' if ok else 'OVER LIMIT'}")
        marker = DISCLOSURE_MARKER[loc]
        present = marker in data[loc]["full_description"]
        failures += 0 if present else 1
        print(f"{loc:7} {'background-location sentence':28} {'':6} {'':6}  "
              f"{'present' if present else 'MISSING'}")
        print("-" * 62)

    print("FAIL" if failures else "All listing fields within Play limits.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
