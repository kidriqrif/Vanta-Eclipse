#!/usr/bin/env python3
"""Publish Play Store phone screenshots from the harness captures.

    bash tools/screenshots.sh          # produce build/screenshots first
    python tools/make_store_screenshots.py

The store listing must show the app as it actually is. The six that shipped in
this folder before were 540x960 renders from the previous engine, and every one
of them predates the layout work — the collapsed rows, the clipped lists, the
enemy hanging off the frame. Regenerating them from the same captures the sweep
gates on is the only way they cannot drift again.

PLAY'S RULES, all checked below rather than assumed:
    2-8 phone screenshots
    PNG or JPEG, 24-bit, no alpha channel
    each side between 320 and 3840 px
    aspect between 16:9 and 9:16

1080x1920 is the reference shape, so it is also the shape where text lands on
whole glyph boxes — the sharpest the game ever looks, and the honest one to
show.
"""

import pathlib
import struct
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "build" / "screenshots"
OUT = ROOT / "production" / "screenshots"
SHAPE = "1080x1920_9-16"

# Ordered as the listing shows them: what the game is, then what you do in it.
CHOSEN = [
    ("01_main_menu", "MainMenu"),
    ("02_gameplay", "Gameplay"),
    ("03_gear", "Gear"),
    ("04_eclipse", "Eclipse"),
    ("05_arcade", "Arcade"),
    ("06_shop", "Shop"),
]

MIN_SIDE, MAX_SIDE = 320, 3840


def png_header(data: bytes) -> tuple[int, int, int, int]:
    """width, height, bit depth, colour type — read straight from IHDR."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return width, height, data[24], data[25]


def main() -> int:
    if not SRC.is_dir():
        print(f"no captures at {SRC} — run: bash tools/screenshots.sh", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    for stale in OUT.glob("*.png"):
        stale.unlink()

    problems: list[str] = []
    for name, scene in CHOSEN:
        source = SRC / f"{scene}__{SHAPE}.png"
        if not source.exists():
            problems.append(f"{scene}: no capture at {source.name}")
            continue

        target = OUT / f"{name}.png"
        # Flatten to 24-bit RGB. The harness renders with an alpha channel and
        # Play rejects one even when every pixel in it is opaque — the same
        # rule that caught the 512x512 store icon.
        Image.open(source).convert("RGB").save(target)

        data = target.read_bytes()
        width, height, depth, colour = png_header(data)

        if colour in (4, 6):
            problems.append(f"{name}: still has an alpha channel")
        if depth != 8:
            problems.append(f"{name}: {depth}-bit, needs 8")
        if not (MIN_SIDE <= width <= MAX_SIDE and MIN_SIDE <= height <= MAX_SIDE):
            problems.append(f"{name}: {width}x{height} outside {MIN_SIDE}-{MAX_SIDE}")
        ratio = max(width, height) / min(width, height)
        if ratio > 16 / 9 + 0.01:
            problems.append(f"{name}: {width}x{height} is taller than 9:16")

        print(f"  {target.relative_to(ROOT)}  {width}x{height}  {len(data) / 1024:.0f} KB")

    count = len(list(OUT.glob("*.png")))
    if not 2 <= count <= 8:
        problems.append(f"{count} screenshots; Play takes 2-8")

    if problems:
        print("\nFAIL", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1

    print(f"\n{count} store screenshots in {OUT.relative_to(ROOT)}, all within Play's limits")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
