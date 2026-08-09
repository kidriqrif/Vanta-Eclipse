#!/usr/bin/env python3
"""Generate the game's bitmap pixel font.

Replaces Nunito — a rounded humanist sans, the single most "modern mobile app"
thing left in the project — with a hand-authored 5x7 pixel face.

MONOSPACE, on purpose. A roguelike is a grid, every glyph advances 6px, and
numbers that change every frame (essence, DPS, HP) do not jitter as their
digits change width. It also removes kerning as a thing that can be wrong.

Metrics
    glyph box   6 x 7, plus 2 descender rows (g j p q y) = 9 rows
    baseline    row 7 from the top
    advance     7px (6 + 1 gap)
    line height 11

WIDENED FROM 5 TO 6 for small-text legibility. Five columns is the absolute
floor for Latin lowercase and it showed: 'm' could not carry three stems, so it
was drawn with a middle stem that stopped halfway and read as 'rn'. The sixth
column buys a correct 'm', real counters in a/e/g/s, and diagonals in K/X/N
that resolve instead of colliding. The cost is 17% wider text, which the
layout audit in stage 16 is there to catch.

The BOX HEIGHT deliberately did not change. GLYPH_H = 9 is load-bearing far
outside this file: the theme's sizes are 9x{2,3,4,5,6}, tools/snap_font_sizes.py
snaps to it, check_ui.py fails a size that is not a whole multiple of it, and
the FONTDEVICE audit reasons about it. Widening costs one atlas column;
heightening would have cost all of that.

Punctuation that is one pixel is punctuation that vanishes. The period, comma,
colon, semicolon and middot are 2x2 rather than 1x1, because a single pixel is
exactly what a fractional window scale rounds away — that is not hypothetical,
it ate both periods in the main menu tagline.

INTEGER SCALING IS THE WHOLE GAME. A bitmap font asked for a size that is not a
whole multiple of its authored size gets resampled, and resampling is exactly
what pixel art exists to avoid. The face is authored at 9 and the theme is
snapped to 24 / 32 / 80 so every on-screen size is a clean multiple. The old
theme asked for 26, 32, 34 and 78 — three of those four would have produced
fractional scaling and a smeared, uneven baseline.

The atlas is written as WHITE with an alpha mask, not as a palette colour:
Godot multiplies a font atlas by the theme's font_color, so any tint baked in
here would multiply against every colour the UI ever asks for.

EVERY CELL CARRIES A 1px TRANSPARENT GUTTER. Godot did not need one — it drew
the .fnt rects exactly as written. Unity's TextGenerator does not: it inflates
every glyph quad by HALF A TEXEL on all four sides, in both UV and vertex
space, and that is not adjustable. Measured on the real build, a 6x9 rect came
back as 7x10 spanning u=35.5..42.5, v=44.5..54.5. Packed edge to edge, that
half-texel skirt samples the NEIGHBOURING GLYPH, which is why the title
rendered as overlapping letters with a row of stray marks under the baseline.
With the gutter the skirt samples transparency and the face is pixel-exact
again. This costs one column and one row of atlas per cell and nothing else:
the rects the .fnt declares are still exactly GLYPH_W x GLYPH_H.

Run: python3 tools/make_font.py
Out: fonts/vanta_pixel.png + fonts/vanta_pixel.fnt
"""

import os
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / os.environ.get("VANTA_FONT_OUT", "Assets/Resources/Fonts")

GLYPH_W, GLYPH_H = 6, 9
BASELINE = 7
ADVANCE = 7
LINE_HEIGHT = 11
COLUMNS = 16

# Transparent gutter around every cell, in pixels. See "EVERY CELL CARRIES A
# 1px TRANSPARENT GUTTER" above — this is what stops Unity's half-texel quad
# inflation from sampling the next glyph. One on every side, so the cells on
# the atlas edge are padded too and no glyph relies on clamp behaviour.
PAD = 1
CELL_W = GLYPH_W + 2 * PAD
CELL_H = GLYPH_H + 2 * PAD

# Each glyph is 7 rows (cap height) or 9 rows (with descender), '#' set.
# Authored as text so a wrong pixel is visible in the source, which is the only
# review method that works for something this small.
G: dict[str, str] = {
    " ": "......|......|......|......|......|......|......",
    "A": ".####.|#....#|#....#|######|#....#|#....#|#....#",
    "B": "#####.|#....#|#....#|#####.|#....#|#....#|#####.",
    "C": ".#####|#.....|#.....|#.....|#.....|#.....|.#####",
    "D": "#####.|#....#|#....#|#....#|#....#|#....#|#####.",
    "E": "######|#.....|#.....|#####.|#.....|#.....|######",
    "F": "######|#.....|#.....|#####.|#.....|#.....|#.....",
    "G": ".#####|#.....|#.....|#..###|#....#|#....#|.####.",
    "H": "#....#|#....#|#....#|######|#....#|#....#|#....#",
    "I": "######|..#...|..#...|..#...|..#...|..#...|######",
    "J": "..####|.....#|.....#|.....#|#....#|#....#|.####.",
    "K": "#....#|#...#.|#..#..|###...|#..#..|#...#.|#....#",
    "L": "#.....|#.....|#.....|#.....|#.....|#.....|######",
    "M": "#....#|##..##|#.##.#|#.##.#|#....#|#....#|#....#",
    "N": "#....#|##...#|#.#..#|#..#.#|#...##|#....#|#....#",
    "O": ".####.|#....#|#....#|#....#|#....#|#....#|.####.",
    "P": "#####.|#....#|#....#|#####.|#.....|#.....|#.....",
    "Q": ".####.|#....#|#....#|#....#|#..#.#|#...#.|.###.#",
    "R": "#####.|#....#|#....#|#####.|#..#..|#...#.|#....#",
    "S": ".#####|#.....|#.....|.####.|.....#|.....#|#####.",
    "T": "######|..#...|..#...|..#...|..#...|..#...|..#...",
    "U": "#....#|#....#|#....#|#....#|#....#|#....#|.####.",
    "V": "#....#|#....#|#....#|#....#|#....#|.#..#.|..##..",
    "W": "#....#|#....#|#....#|#.##.#|#.##.#|##..##|#....#",
    "X": "#....#|.#..#.|..##..|..##..|..##..|.#..#.|#....#",
    "Y": "#....#|.#..#.|..##..|..#...|..#...|..#...|..#...",
    "Z": "######|....#.|...#..|..#...|.#....|#.....|######",
    "a": "......|......|.####.|.....#|.#####|#....#|.#####",
    "b": "#.....|#.....|#####.|#....#|#....#|#....#|#####.",
    "c": "......|......|.#####|#.....|#.....|#.....|.#####",
    "d": ".....#|.....#|.#####|#....#|#....#|#....#|.#####",
    "e": "......|......|.####.|#....#|######|#.....|.####.",
    "f": "..###.|.#....|#####.|.#....|.#....|.#....|.#....",
    "g": "......|......|.#####|#....#|#....#|.#####|.....#|#....#|.####.",
    "h": "#.....|#.....|#####.|#....#|#....#|#....#|#....#",
    "i": "..#...|......|.##...|..#...|..#...|..#...|.###..",
    "j": "...#..|......|..##..|...#..|...#..|...#..|...#..|#..#..|.##...",
    "k": "#.....|#.....|#...#.|#..#..|###...|#..#..|#...#.",
    "l": ".##...|..#...|..#...|..#...|..#...|..#...|.###..",
    "m": "......|......|#####.|#.#.#.|#.#.#.|#.#.#.|#.#.#.",
    "n": "......|......|#####.|#....#|#....#|#....#|#....#",
    "o": "......|......|.####.|#....#|#....#|#....#|.####.",
    "p": "......|......|#####.|#....#|#....#|#....#|#####.|#.....|#.....",
    "q": "......|......|.#####|#....#|#....#|#....#|.#####|.....#|.....#",
    "r": "......|......|#.###.|##....|#.....|#.....|#.....",
    "s": "......|......|.#####|#.....|.####.|.....#|#####.",
    "t": ".#....|.#....|#####.|.#....|.#....|.#...#|..###.",
    "u": "......|......|#....#|#....#|#....#|#....#|.#####",
    "v": "......|......|#....#|#....#|#....#|.#..#.|..##..",
    "w": "......|......|#....#|#....#|#.##.#|#.##.#|.#..#.",
    "x": "......|......|#....#|.#..#.|..##..|.#..#.|#....#",
    "y": "......|......|#....#|#....#|#....#|.#####|.....#|#....#|.####.",
    "z": "......|......|######|....#.|..##..|.#....|######",
    "0": ".####.|#....#|#...##|#.##.#|##...#|#....#|.####.",
    "1": "..#...|.##...|..#...|..#...|..#...|..#...|.####.",
    "2": ".####.|#....#|.....#|....#.|..##..|.#....|######",
    "3": "#####.|.....#|.....#|.####.|.....#|.....#|#####.",
    "4": "....#.|...##.|..#.#.|.#..#.|######|....#.|....#.",
    "5": "######|#.....|#.....|#####.|.....#|#....#|.####.",
    "6": "..###.|.#....|#.....|#####.|#....#|#....#|.####.",
    "7": "######|.....#|....#.|...#..|..#...|..#...|..#...",
    "8": ".####.|#....#|#....#|.####.|#....#|#....#|.####.",
    "9": ".####.|#....#|#....#|.#####|.....#|....#.|.###..",
    "!": "..#...|..#...|..#...|..#...|..#...|......|..##..",
    '"': ".#.#..|.#.#..|......|......|......|......|......",
    "#": ".#.#..|######|.#.#..|######|.#.#..|......|......",
    "$": "..#...|.#####|#.#...|.####.|..#..#|#####.|..#...",
    "%": "##...#|##..#.|...#..|..#...|.#..##|#...##|......",
    "&": ".##...|#..#..|#..#..|.##...|#..#.#|#...#.|.###.#",
    "'": "..#...|..#...|......|......|......|......|......",
    "(": "...#..|..#...|.#....|.#....|.#....|..#...|...#..",
    ")": ".#....|..#...|...#..|...#..|...#..|..#...|.#....",
    "*": "......|..#...|#.#.#.|.###..|#.#.#.|..#...|......",
    "+": "......|..#...|..#...|#####.|..#...|..#...|......",
    ",": "......|......|......|......|......|.##...|.##...|..#...|.#....",
    "-": "......|......|......|#####.|......|......|......",
    ".": "......|......|......|......|......|.##...|.##...",
    "/": ".....#|....#.|...#..|..#...|.#....|#.....|......",
    ":": "......|.##...|.##...|......|.##...|.##...|......",
    ";": "......|.##...|.##...|......|.##...|.##...|..#...|.#....|......",
    "<": "...#..|..#...|.#....|#.....|.#....|..#...|...#..",
    "=": "......|......|#####.|......|#####.|......|......",
    ">": ".#....|..#...|...#..|....#.|...#..|..#...|.#....",
    "?": ".####.|#....#|.....#|..###.|..#...|......|..##..",
    "@": ".####.|#....#|#.####|#.#..#|#.####|#.....|.####.",
    "[": "..###.|..#...|..#...|..#...|..#...|..#...|..###.",
    "\\": "#.....|.#....|..#...|...#..|....#.|.....#|......",
    "]": ".###..|...#..|...#..|...#..|...#..|...#..|.###..",
    "^": "..#...|.#.#..|#...#.|......|......|......|......",
    "_": "......|......|......|......|......|......|######",
    "`": ".#....|..#...|......|......|......|......|......",
    "{": "...##.|..#...|..#...|.#....|..#...|..#...|...##.",
    "|": "..#...|..#...|..#...|..#...|..#...|..#...|..#...",
    "}": ".##...|...#..|...#..|....#.|...#..|...#..|.##...",
    "~": "......|......|.##..#|#..##.|......|......|......",
    "·": "......|......|......|..##..|..##..|......|......",   # ·
    "–": "......|......|......|.####.|......|......|......",   # –
    "—": "......|......|......|######|......|......|......",   # —
    "…": "......|......|......|......|......|......|#.#.#.",   # …
    "→": "......|..#...|...#..|######|...#..|..#...|......",   # →
    "−": "......|......|......|######|......|......|......",   # −
    "▲": "......|..#...|..#...|.###..|.###..|#####.|......",   # ▲
    "▼": "......|#####.|.###..|.###..|..#...|..#...|......",   # ▼
    "◆": "......|..#...|.###..|#####.|.###..|..#...|......",   # ◆
    "●": "......|.###..|#####.|#####.|#####.|.###..|......",   # ●
    "★": "..#...|..#...|#####.|.###..|.###..|#...#.|......",   # ★
}


def rows_of(spec: str) -> list[str]:
    rows = spec.split("|")
    return rows + ["." * GLYPH_W] * (GLYPH_H - len(rows))


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def build() -> tuple[bytes, int, int, dict[str, tuple[int, int]]]:
    glyphs = list(G)
    columns = COLUMNS
    rows = (len(glyphs) + columns - 1) // columns
    width = columns * CELL_W
    height = rows * CELL_H
    pixels = [0] * (width * height)          # alpha only; colour is always white
    placement: dict[str, tuple[int, int]] = {}
    for index, char in enumerate(glyphs):
        # The cell is CELL_W x CELL_H; the glyph sits PAD in from its corner, so
        # the gutter is on all four sides and the .fnt rect below is still the
        # bare GLYPH_W x GLYPH_H.
        ox = (index % columns) * CELL_W + PAD
        oy = (index // columns) * CELL_H + PAD
        placement[char] = (ox, oy)
        for y, row in enumerate(rows_of(G[char])):
            for x, cell in enumerate(row):
                if cell == "#":
                    pixels[(oy + y) * width + ox + x] = 255
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            alpha = pixels[y * width + x]
            raw += bytes((255, 255, 255, alpha))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", header)
           + _chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + _chunk(b"IEND", b""))
    return png, width, height, placement


def main() -> int:
    png, width, height, placement = build()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "vanta_pixel.png").write_bytes(png)

    lines = [
        # padding stays 0: the gutter is around the rect, not inside it, so the
        # declared width/height are the glyph and nothing else. spacing reports
        # the gap a consumer will find between two adjacent rects.
        'info face="VantaPixel" size=%d bold=0 italic=0 charset="" unicode=1 '
        "stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=%d,%d"
        % (GLYPH_H, 2 * PAD, 2 * PAD),
        "common lineHeight=%d base=%d scaleW=%d scaleH=%d pages=1 packed=0"
        % (LINE_HEIGHT, BASELINE, width, height),
        'page id=0 file="vanta_pixel.png"',
        "chars count=%d" % len(placement),
    ]
    for char, (x, y) in placement.items():
        lines.append(
            "char id=%d x=%d y=%d width=%d height=%d xoffset=0 yoffset=0 "
            "xadvance=%d page=0 chnl=15"
            % (ord(char), x, y, GLYPH_W, GLYPH_H, ADVANCE)
        )
    (OUT / "vanta_pixel.fnt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("vanta_pixel.png  %dx%d  %d bytes" % (width, height, len(png)))
    print("vanta_pixel.fnt  %d glyphs, advance %d, line height %d"
          % (len(placement), ADVANCE, LINE_HEIGHT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
