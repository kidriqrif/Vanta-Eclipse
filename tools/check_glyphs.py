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

Sources scanned:
    Assets/Scripts/**/*.cs               string and interpolated literals
    Assets/Resources/Content/**/*.asset  the authored display fields
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FNT = ROOT / "Assets" / "Resources" / "Fonts" / "vanta_pixel.fnt"

CHAR_ID = re.compile(r"^char id=(\d+)", re.M)

# The authored text fields in a ScriptableObject asset. Unity writes them as
# plain YAML scalars, quoted only when they need to be.
ASSET_FIELD = re.compile(
    r"^\s*(?:displayName|description|flavor|sealedFlavor|effectDescription|"
    r"priceText|displayTemplate|stageNames)\s*:\s*(.+)$", re.M
)

# A C# string literal, verbatim or not. Interpolated holes are stripped
# separately, because "{count}" is a placeholder and never rendered.
LITERAL = re.compile(r'@?"((?:[^"\\]|\\.)*)"')
HOLE = re.compile(r"\{[^{}]*\}")

# Diagnostics never reach a player, and they legitimately carry odd characters
# from engine messages and file paths.
DIAGNOSTIC = re.compile(r"Debug\.Log|Debug\.LogWarning|Debug\.LogError|nameof\(")

# Names, not prose: a resource path or a node name is looked up, never drawn.
NOT_RENDERED = re.compile(
    r'^(?:Assets/|Resources/|Art/|Audio/|Prefabs/|Fonts/|Shaders/|Content/|'
    r'[A-Za-z0-9_./-]+\.(?:png|wav|ogg|asset|prefab|unity|shader|mat|cs|json|fnt))'
)


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

    content = ROOT / "Assets" / "Resources" / "Content"
    for path in sorted(content.rglob("*.asset")) if content.exists() else []:
        rel = path.relative_to(ROOT).as_posix()
        for match in ASSET_FIELD.finditer(path.read_text(encoding="utf-8")):
            value = match.group(1).strip().strip("'\"")
            for char in value:
                note(char, rel)

    scripts = ROOT / "Assets" / "Scripts"
    for path in sorted(scripts.rglob("*.cs")) if scripts.exists() else []:
        rel = path.relative_to(ROOT).as_posix()
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            stripped = line.lstrip()
            # Comments carry prose that is never drawn, and this file is full of
            # it — an em dash in a comment is not a missing glyph.
            if stripped.startswith(("//", "///", "*", "/*")):
                continue
            if DIAGNOSTIC.search(line):
                continue
            for match in LITERAL.finditer(line):
                text = HOLE.sub("", match.group(1))
                if NOT_RENDERED.match(text):
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
