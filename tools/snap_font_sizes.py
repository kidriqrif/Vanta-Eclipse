#!/usr/bin/env python3
"""Snap every font size to a whole multiple of the bitmap font's glyph box.

WHY THIS EXISTS

The revamp replaced Nunito — an outline font, which renders correctly at any
size because the renderer solves the curve — with vanta_pixel, a BITMAP font
whose glyphs are 9 pixels tall and exist only at that one size. Godot serves a
bitmap font at some other size by SCALING the atlas. At a whole multiple that
is exact: every source pixel becomes a 2x2 or 3x3 block and the result is the
glyph the font actually contains. At 26, the scale factor is 26/9 = 2.889 and
the renderer has to invent the remainder, so stems land on fractional pixels
and get resampled. The output is a soft, unevenly-weighted approximation of a
crisp glyph — which is precisely the smooth look the revamp existed to remove,
reintroduced at the one place a player looks most.

The theme was converted by hand during the revamp and the scenes were not, so
135 of the project's 145 font sizes were still the values that had been tuned
for an outline font. Every one of them was resampling.

THE RATIO

Sizes could not simply be rounded to the nearest legal multiple, because the
two fonts do not occupy the same width at the same nominal size. vanta_pixel is
monospace with a 6px advance on a 9px box, so a character costs 0.667 * size.
Nunito averaged closer to 0.5 * size. Rounding 26 up to 27 would therefore have
made that line about a third wider than the layout was built for, and the text
would overhang its container.

So sizes are scaled by RATIO before snapping. 0.8 is not a guess — it is the
ratio the theme's own hand conversion used (34 -> 27), and it lands slightly
above the 0.75 the advance widths alone imply, which keeps text legible on a
phone while still shrinking every line. tools/screenshot_harness.gd's LAYOUT
pass is the check on that arithmetic: it measures real controls on 7 device
shapes and fails on any label wider than its parent.

Collapsing is expected. The project used 17 distinct sizes where a 9px font
offers 18/27/36/45/54; several near-identical old sizes therefore land on the
same new one. That is the constraint doing its job — a bitmap font has discrete
sizes, and a hierarchy of five real steps reads better than seventeen steps
that were never distinguishable anyway.

Idempotent: a value already on a multiple of the glyph box is left alone, so
re-running after adding a screen only touches the new sizes.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FNT = ROOT / "fonts/vanta_pixel.fnt"

# Width compensation, applied before snapping. See "THE RATIO" above.
RATIO = 0.8

# The theme is excluded: it was converted by hand during the revamp and its
# values are already legal. Re-scaling them would shrink them a second time.
SCOPES = ("scenes/**/*.tscn", "scripts/**/*.gd")

# `font_size = 26`, `default_font_size = 26`, `label_settings.font_size = 64`
ASSIGN = re.compile(r"((?:^|\.|/)\w*font_size\w*\s*=\s*)(\d+)", re.M)
# `add_theme_font_size_override("font_size", 26)`
OVERRIDE = re.compile(r"(add_theme_font_size_override\(\s*&?\"font_size\"\s*,\s*)(\d+)")


def glyph_box() -> int:
    """The one size the font actually contains, read from the font itself.

    Taken from the .fnt rather than hardcoded so that regenerating the font at
    a different glyph height moves this tool and tools/check_ui.py's legality
    check together. A constant here could disagree with the shipped atlas.
    """
    header = FNT.read_text(encoding="utf-8").splitlines()[0]
    match = re.search(r"\bsize=(\d+)", header)
    if match is None:
        raise SystemExit(f"{FNT}: no size= on the info line")
    return int(match.group(1))


def snap(size: int, box: int) -> int:
    """The legal size closest to `size` once width compensation is applied."""
    if size % box == 0:
        return size
    steps = max(1, round(size * RATIO / box))
    return steps * box


def main() -> int:
    box = glyph_box()
    changed: dict[int, int] = {}
    touched = 0

    for scope in SCOPES:
        for path in sorted(ROOT.glob(scope)):
            text = path.read_text(encoding="utf-8")

            def replace(match: re.Match[str]) -> str:
                old = int(match.group(2))
                new = snap(old, box)
                if new != old:
                    changed[old] = new
                return f"{match.group(1)}{new}"

            updated = OVERRIDE.sub(replace, ASSIGN.sub(replace, text))
            if updated != text:
                path.write_text(updated, encoding="utf-8", newline="\n")
                touched += 1

    if not changed:
        print(f"font sizes: already legal (glyph box {box}px)")
        return 0
    moves = ", ".join(f"{old}->{new}" for old, new in sorted(changed.items()))
    print(f"font sizes: {touched} files, glyph box {box}px — {moves}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
