#!/usr/bin/env python3
"""Generate the game's bitmap pixel font.

Replaces Nunito — a rounded humanist sans, the single most "modern mobile app"
thing left in the project — with a hand-authored 5x7 pixel face.

MONOSPACE, on purpose. A roguelike is a grid, every glyph advances 6px, and
numbers that change every frame (essence, DPS, HP) do not jitter as their
digits change width. It also removes kerning as a thing that can be wrong.

Metrics
    glyph box   5 x 7, plus 2 descender rows (g j p q y) = 9 rows
    baseline    row 7 from the top
    advance     6px (5 + 1 gap)
    line height 11

INTEGER SCALING IS THE WHOLE GAME. A bitmap font asked for a size that is not a
whole multiple of its authored size gets resampled, and resampling is exactly
what pixel art exists to avoid. The face is authored at 9 and the theme is
snapped to 24 / 32 / 80 so every on-screen size is a clean multiple. The old
theme asked for 26, 32, 34 and 78 — three of those four would have produced
fractional scaling and a smeared, uneven baseline.

The atlas is written as WHITE with an alpha mask, not as a palette colour:
Godot multiplies a font atlas by the theme's font_color, so any tint baked in
here would multiply against every colour the UI ever asks for.

Run: python3 tools/make_font.py
Out: fonts/vanta_pixel.png + fonts/vanta_pixel.fnt
"""

import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "fonts"

GLYPH_W, GLYPH_H = 5, 9
BASELINE = 7
ADVANCE = 6
LINE_HEIGHT = 11
COLUMNS = 16

# Each glyph is 7 rows (cap height) or 9 rows (with descender), '#' set.
# Authored as text so a wrong pixel is visible in the source, which is the only
# review method that works for something this small.
G: dict[str, str] = {
    " ": ".....|.....|.....|.....|.....|.....|.....",
    "A": ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    "B": "####.|#...#|#...#|####.|#...#|#...#|####.",
    "C": ".####|#....|#....|#....|#....|#....|.####",
    "D": "####.|#...#|#...#|#...#|#...#|#...#|####.",
    "E": "#####|#....|#....|####.|#....|#....|#####",
    "F": "#####|#....|#....|####.|#....|#....|#....",
    "G": ".###.|#....|#....|#.###|#...#|#...#|.###.",
    "H": "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    "I": "#####|..#..|..#..|..#..|..#..|..#..|#####",
    "J": "....#|....#|....#|....#|#...#|#...#|.###.",
    "K": "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    "L": "#....|#....|#....|#....|#....|#....|#####",
    "M": "#...#|##.##|#.#.#|#...#|#...#|#...#|#...#",
    "N": "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    "O": ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    "P": "####.|#...#|#...#|####.|#....|#....|#....",
    "Q": ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    "R": "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    "S": ".####|#....|#....|.###.|....#|....#|####.",
    "T": "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    "U": "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    "V": "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    "W": "#...#|#...#|#...#|#...#|#.#.#|##.##|#...#",
    "X": "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    "Y": "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    "Z": "#####|....#|...#.|..#..|.#...|#....|#####",
    "a": ".....|.....|.###.|....#|.####|#...#|.####",
    "b": "#....|#....|####.|#...#|#...#|#...#|####.",
    "c": ".....|.....|.####|#....|#....|#....|.####",
    "d": "....#|....#|.####|#...#|#...#|#...#|.####",
    "e": ".....|.....|.###.|#...#|#####|#....|.###.",
    "f": "..##.|.#...|####.|.#...|.#...|.#...|.#...",
    "g": ".....|.....|.####|#...#|#...#|.####|....#|#...#|.###.",
    "h": "#....|#....|####.|#...#|#...#|#...#|#...#",
    "i": "..#..|.....|.##..|..#..|..#..|..#..|.###.",
    "j": "...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..",
    "k": "#....|#....|#..#.|#.#..|##...|#.#..|#..#.",
    "l": ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
    "m": ".....|.....|##.#.|#.#.#|#.#.#|#...#|#...#",
    "n": ".....|.....|####.|#...#|#...#|#...#|#...#",
    "o": ".....|.....|.###.|#...#|#...#|#...#|.###.",
    "p": ".....|.....|####.|#...#|#...#|#...#|####.|#....|#....",
    "q": ".....|.....|.####|#...#|#...#|#...#|.####|....#|....#",
    "r": ".....|.....|#.##.|##...|#....|#....|#....",
    "s": ".....|.....|.####|#....|.###.|....#|####.",
    "t": ".#...|.#...|####.|.#...|.#...|.#...|..##.",
    "u": ".....|.....|#...#|#...#|#...#|#...#|.####",
    "v": ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
    "w": ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.",
    "x": ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
    "y": ".....|.....|#...#|#...#|#...#|.####|....#|#...#|.###.",
    "z": ".....|.....|#####|...#.|..#..|.#...|#####",
    "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
    "3": "####.|....#|....#|.###.|....#|....#|####.",
    "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    "5": "#####|#....|####.|....#|....#|#...#|.###.",
    "6": "..##.|.#...|#....|####.|#...#|#...#|.###.",
    "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
    "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    "9": ".###.|#...#|#...#|.####|....#|...#.|.##..",
    "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
    '"': ".#.#.|.#.#.|.....|.....|.....|.....|.....",
    "#": ".#.#.|#####|.#.#.|#####|.#.#.|.....|.....",
    "$": "..#..|.####|#.#..|.###.|..#.#|####.|..#..",
    "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##",
    "&": ".##..|#..#.|#..#.|.##..|#..#.|#...#|.###.",
    "'": "..#..|..#..|.....|.....|.....|.....|.....",
    "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.",
    ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
    "*": ".....|..#..|#.#.#|.###.|#.#.#|..#..|.....",
    "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
    ",": ".....|.....|.....|.....|.....|..#..|..#..|.#...|.....",
    "-": ".....|.....|.....|#####|.....|.....|.....",
    ".": ".....|.....|.....|.....|.....|.....|..#..",
    "/": "....#|....#|...#.|..#..|.#...|#....|#....",
    ":": ".....|..#..|..#..|.....|..#..|..#..|.....",
    ";": ".....|..#..|..#..|.....|..#..|..#..|.#...|.....|.....",
    "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.",
    "=": ".....|.....|#####|.....|#####|.....|.....",
    ">": ".#...|..#..|...#.|....#|...#.|..#..|.#...",
    "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
    "@": ".###.|#...#|#.###|#.#.#|#.###|#....|.###.",
    "[": "..##.|..#..|..#..|..#..|..#..|..#..|..##.",
    "\\": "#....|#....|.#...|..#..|...#.|....#|....#",
    "]": ".##..|..#..|..#..|..#..|..#..|..#..|.##..",
    "^": "..#..|.#.#.|#...#|.....|.....|.....|.....",
    "_": ".....|.....|.....|.....|.....|.....|#####",
    "`": ".#...|..#..|.....|.....|.....|.....|.....",
    "{": "...##|..#..|..#..|.#...|..#..|..#..|...##",
    "|": "..#..|..#..|..#..|..#..|..#..|..#..|..#..",
    "}": "##...|..#..|..#..|...#.|..#..|..#..|##...",
    "~": ".....|.....|.#..#|#..#.|.....|.....|.....",
    # Symbols the UI actually uses. Four of these (star, diamond, disc, arrow)
    # were BANNED from button text because the previous face's coverage was
    # never verified — drawing them here is what retires that ban.
    "·": ".....|.....|.....|..#..|.....|.....|.....",   # ·
    "–": ".....|.....|.....|.###.|.....|.....|.....",   # –
    "—": ".....|.....|.....|#####|.....|.....|.....",   # —
    "…": ".....|.....|.....|.....|.....|.....|#.#.#",   # …
    "→": ".....|..#..|...#.|#####|...#.|..#..|.....",   # →
    "−": ".....|.....|.....|#####|.....|.....|.....",   # −
    "▲": ".....|..#..|..#..|.###.|.###.|#####|.....",   # ▲
    "▼": ".....|#####|.###.|.###.|..#..|..#..|.....",   # ▼
    "◆": ".....|..#..|.###.|#####|.###.|..#..|.....",   # ◆
    "●": ".....|.###.|#####|#####|#####|.###.|.....",   # ●
    "★": "..#..|..#..|#####|.###.|.###.|#...#|.....",   # ★
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
    width = columns * GLYPH_W
    height = rows * GLYPH_H
    pixels = [0] * (width * height)          # alpha only; colour is always white
    placement: dict[str, tuple[int, int]] = {}
    for index, char in enumerate(glyphs):
        ox = (index % columns) * GLYPH_W
        oy = (index // columns) * GLYPH_H
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
        'info face="VantaPixel" size=%d bold=0 italic=0 charset="" unicode=1 '
        "stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0" % GLYPH_H,
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
