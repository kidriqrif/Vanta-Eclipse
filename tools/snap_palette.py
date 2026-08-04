#!/usr/bin/env python3
"""Snap every UI colour onto the closed 16-colour palette.

The revamp replaced the art before the chrome, so the theme was still carrying
the colours of the old style: a near-black surface ramp and one crimson accent,
picked by hand and drifting a few points either side of itself in 119 places.
Those values are close to the new palette but not equal to it, and "close" is
exactly what a closed palette cannot tolerate — two greys one step apart read as
a rendering error rather than as a decision.

This maps each colour to its nearest palette entry and rewrites it in place.
Idempotent: run it twice and the second run changes nothing, because a colour
already in the palette is its own nearest neighbour.

Two things are deliberately NOT snapped:
  * Any channel above 1.0. Those are HDR multipliers — enemy_view's
    FLASH_COLOR is Color(3.0, 2.0, 1.9), which multiplies modulate to blow a
    sprite past white. Snapping it into the 0..1 range would turn a flash into
    a tint and quietly delete the hit feedback.
  * Alpha. A scrim at 0.6 is a statement about opacity, not about hue.

Run: python3 tools/snap_palette.py [--dry-run]
"""

import pathlib
import re
import sys

from pixelart import PALETTE, rgb
from _tree import glob

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Where UI chrome lives. Enemy glow colours in data/ are included: with a
# closed palette they are no longer "content is free" — a creature that glows a
# hue the UI can never show is the one thing that breaks the illusion that the
# whole game is drawn from one box of sixteen crayons.
SCOPES = (
    "ui/**/*.tres",
    "scenes/**/*.tscn",
    "scripts/ui/**/*.gd",
    "scripts/minigames/**/*.gd",
    "data/**/*.tres",
)

COLOR_CALL = re.compile(
    r"Color\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)"
)
PACKED = re.compile(r"PackedColorArray\(([^)]*)\)")


def nearest(red: float, green: float, blue: float) -> tuple[float, float, float]:
    """Closest palette entry by redmean distance.

    Redmean rather than plain Euclidean RGB: plain RGB puts saturated blue and
    saturated violet closer together than the eye does, and the palette has
    both. It is a cheap approximation of perceptual distance and it is enough
    to stop a crimson snapping to blood.
    """
    best = None
    best_distance = None
    for name in PALETTE:
        pr, pg, pb = (channel / 255.0 for channel in rgb(name))
        mean_red = (red + pr) / 2.0
        dr, dg, db = red - pr, green - pg, blue - pb
        distance = ((2 + mean_red) * dr * dr
                    + 4 * dg * dg
                    + (3 - mean_red) * db * db)
        if best_distance is None or distance < best_distance:
            best_distance, best = distance, (pr, pg, pb)
    return best


def _fmt(value: float) -> str:
    return ("%.3f" % value).rstrip("0").rstrip(".") or "0"


def snap_color(match: re.Match) -> str:
    red, green, blue = (float(match.group(i)) for i in (1, 2, 3))
    alpha = match.group(4)
    if max(red, green, blue) > 1.0:
        return match.group(0)            # HDR multiplier — leave it alone
    nr, ng, nb = nearest(red, green, blue)
    body = "%s, %s, %s" % (_fmt(nr), _fmt(ng), _fmt(nb))
    return f"Color({body}, {alpha})" if alpha is not None else f"Color({body})"


def snap_packed(match: re.Match) -> str:
    numbers = [n.strip() for n in match.group(1).split(",") if n.strip()]
    if len(numbers) % 4:
        return match.group(0)
    out: list[str] = []
    for i in range(0, len(numbers), 4):
        red, green, blue, alpha = (float(n) for n in numbers[i:i + 4])
        if max(red, green, blue) > 1.0:
            out += [_fmt(red), _fmt(green), _fmt(blue), _fmt(alpha)]
            continue
        nr, ng, nb = nearest(red, green, blue)
        out += [_fmt(nr), _fmt(ng), _fmt(nb), _fmt(alpha)]
    return "PackedColorArray(" + ", ".join(out) + ")"


def main() -> int:
    dry = "--dry-run" in sys.argv
    files = 0
    changes = 0
    for scope in SCOPES:
        for path in glob(ROOT, scope):
            text = path.read_text(encoding="utf-8")
            snapped = COLOR_CALL.sub(snap_color, text)
            snapped = PACKED.sub(snap_packed, snapped)
            if snapped != text:
                moved = sum(
                    1 for a, b in zip(COLOR_CALL.findall(text), COLOR_CALL.findall(snapped))
                    if a != b
                )
                changes += moved
                files += 1
                print("  %-52s %d colours" % (path.relative_to(ROOT).as_posix(), moved))
                if not dry:
                    path.write_text(snapped, encoding="utf-8")
    verb = "would move" if dry else "moved"
    print(f"{verb} {changes} colours onto the palette across {files} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
