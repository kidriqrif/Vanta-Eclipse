#!/usr/bin/env python3
"""Every character the UI renders must exist in the font.

This replaces a hardcoded blacklist of five symbols that were missing from
Cinzel, the face used two restyles ago. That check was the right shape while
the font was third-party and its coverage unknown — the honest move was to ban
the glyphs nobody had verified.

It is the wrong shape now. The face is authored in tools/make_font.py, so its
coverage is not a mystery to be guarded against, it is a FACT to be read: the
.fnt lists exactly which codepoints exist. A bitmap font has no fallback, so a
character outside that list does not render as a substitute or a .notdef box —
it renders as nothing at all, and a label silently loses a word.

Being over-strict here costs a design choice. Being under-strict ships blank
gaps to players, in text nobody re-reads after the day it was written.
"""

import pathlib
import re
import sys

from _tree import rglob

ROOT = pathlib.Path(__file__).resolve().parent.parent
FNT = ROOT / "fonts" / "vanta_pixel.fnt"

CHAR_ID = re.compile(r"^char id=(\d+)", re.M)
# Visible strings in scenes and content resources.
FIELD = re.compile(
    r'^(?:text|display_name|description|title|name|flavou?r\w*)\s*=\s*"([^"]*)"', re.M
)
LITERAL = re.compile(r'"([^"]*)"')
# Diagnostics never reach a player, and they legitimately carry odd characters
# from engine messages and file paths.
DIAGNOSTIC = re.compile(r"push_error|push_warning|printerr|\bprint\(|assert\(")


def covered() -> set[str]:
    if not FNT.exists():
        return set()
    return {chr(int(code)) for code in CHAR_ID.findall(FNT.read_text(encoding="utf-8"))}


def used() -> dict[str, list[str]]:
    """character -> where it was found (first few sites)."""
    sites: dict[str, list[str]] = {}

    def note(char: str, where: str) -> None:
        if char.isprintable() and char != " ":
            sites.setdefault(char, [])
            if len(sites[char]) < 3 and where not in sites[char]:
                sites[char].append(where)

    for pattern in ("scenes/**/*.tscn", "data/**/*.tres", "ui/**/*.tres"):
        for path in rglob(ROOT, pattern):
            rel = path.relative_to(ROOT).as_posix()
            for match in FIELD.finditer(path.read_text(encoding="utf-8")):
                for char in match.group(1):
                    note(char, rel)

    for path in rglob(ROOT, "scripts/**/*.gd"):
        rel = path.relative_to(ROOT).as_posix()
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if DIAGNOSTIC.search(line):
                continue
            for match in LITERAL.finditer(line):
                text = match.group(1)
                if text.startswith(("res://", "uid://", "user://")):
                    continue
                for char in text:
                    note(char, f"{rel}:{number}")
    return sites


def main() -> int:
    have = covered()
    if not have:
        print(f"FAIL: no glyphs found in {FNT.relative_to(ROOT)} — is the font built?")
        return 1
    sites = used()
    missing = sorted(set(sites) - have)
    if missing:
        print(f"font coverage: FAIL ({len(have)} glyphs in the face)")
        for char in missing:
            where = ", ".join(sites[char])
            print(f"    U+{ord(char):04X} {char!r} is rendered but not in the font — {where}")
        return 1
    print(f"font coverage: OK ({len(sites)} distinct characters, {len(have)} glyphs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
