#!/usr/bin/env python3
"""Generate the app icon, the Play Store icon and the feature graphic.

Everything here is authored on a small grid and scaled by a WHOLE number, so
the shipped art is exactly the pixels that were drawn. That constraint picks
the grid sizes for us rather than the other way round:

    store icon   512 = 32 x 16
    launcher     192 = 32 x  6
    adaptive     432 = 27 x 16
    project icon 128 = 32 x  4

27 rather than 32 for the adaptive pair because Android composites a 432px
canvas and only guarantees the middle 264px is visible — every launcher masks
the rest to its own shape. On a 27 grid the mark occupies the middle 17 cells,
which is 272px: inside the safe circle with a cell to spare.

The mark is the game's name made literal — a disc with a bite taken out of it.
It survives being 32 pixels wide, which is the only test an app icon has to
pass, since on a phone home screen it is about 40 device pixels of decision.

Run: python3 tools/make_icons.py
"""

import pathlib

from pixelart import Canvas, write_png
import make_font

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "production" / "icons"


def eclipse_mark(grid: int, with_corona: bool = True) -> Canvas:
    """The eclipse, drawn to fill `grid` cells.

    Proportional rather than pixel-absolute so the same mark can be authored on
    a 32 grid for the store icon and a 27 grid for the adaptive foreground
    without becoming two different drawings that drift apart.
    """
    c = Canvas(grid, grid)
    centre = grid / 2.0
    radius = grid * 0.34
    c.disc(centre, centre, radius, "crimson")
    c.disc(centre, centre, radius * 0.82, "ember")
    c.disc(centre, centre, radius * 0.45, "gold")
    # The occulting body, offset up and left. Void, because this is the one
    # place the background colour is the subject rather than the backdrop.
    c.disc(centre - radius * 0.44, centre - radius * 0.30, radius * 0.92, "void")
    if with_corona:
        # A few flecks, not a ring: at 32px a continuous corona closes up into
        # a fuzzy halo and the crescent stops being a crescent.
        for angle_cell in range(0, 12):
            import math
            radians = math.radians(angle_cell * 30 + 15)
            distance = radius * 1.28
            x = int(centre + math.cos(radians) * distance)
            y = int(centre + math.sin(radians) * distance)
            if angle_cell % 2 == 0:
                c.put(x, y, "gold")
    return c


def adaptive_foreground(grid: int = 27) -> Canvas:
    """Transparent but for the mark, sized into the safe circle."""
    return eclipse_mark(grid)


def adaptive_background(grid: int = 27) -> Canvas:
    """Flat void with a one-cell vignette ring.

    Deliberately almost empty: the launcher masks this to a circle, a squircle
    or a rounded square depending on the device, and anything with structure in
    it gets cropped differently on every phone.
    """
    c = Canvas(grid, grid)
    c.rect(0, 0, grid, grid, "void")
    c.frame(0, 0, grid, grid, "abyss")
    c.frame(1, 1, grid - 2, grid - 2, "abyss")
    return c


def store_icon(grid: int = 32) -> Canvas:
    """Play listing icon — opaque, because the store renders it on white."""
    c = Canvas(grid, grid)
    c.rect(0, 0, grid, grid, "void")
    c.paste(eclipse_mark(grid), 0, 0)
    c.frame(0, 0, grid, grid, "abyss")
    return c


def _text(canvas: Canvas, text: str, x: int, y: int, colour: str) -> int:
    """Stamp a string using the game's own bitmap font. Returns the width."""
    for index, char in enumerate(text):
        spec = make_font.G.get(char)
        if spec is None:
            continue
        for row_index, row in enumerate(make_font.rows_of(spec)):
            for col_index, cell in enumerate(row):
                if cell == "#":
                    canvas.put(x + index * make_font.ADVANCE + col_index,
                               y + row_index, colour)
    return len(text) * make_font.ADVANCE


def feature_graphic() -> Canvas:
    """1024x500, built on a 128x62.5 grid... which does not divide.

    So it is drawn at 256x125 and scaled 4x: 1024 = 256 x 4, 500 = 125 x 4.
    Picking the grid to fit the required output, rather than scaling a nice
    grid to a wrong size, is the whole discipline here.
    """
    grid_w, grid_h = 256, 125
    c = Canvas(grid_w, grid_h)
    c.rect(0, 0, grid_w, grid_h, "void")
    # A horizon band so the mark has something to sit against. Thin: at 30 of
    # 125 rows it was a quarter of the canvas doing nothing, which on a store
    # page reads as a rendering fault rather than as composition.
    band = 14
    c.rect(0, grid_h - band, grid_w, band, "abyss")
    for x in range(0, grid_w, 2):
        c.put(x, grid_h - band, "slate")

    c.paste(eclipse_mark(56), 26, (grid_h - band - 56) // 2)

    title = "VANTA ECLIPSE"
    subtitle = "IDLE RPG IN THE DARK"
    # Measured, not estimated. The previous feature graphic shipped with its
    # title running off the right edge because the width was guessed — and the
    # rule spans the WIDER of the two lines, so it reads as underlining the
    # block rather than stopping short of it.
    width = max(len(title), len(subtitle)) * make_font.ADVANCE
    _text(c, title, 100, 40, "ivory")
    c.rect(100, 54, width - 1, 1, "crimson")
    _text(c, subtitle, 100, 62, "ash")
    return c


def main() -> int:
    ICONS.mkdir(parents=True, exist_ok=True)
    # alpha=False on the three that Play composites itself rather than masks.
    #
    # The store icon and the feature graphic are listing artwork: Play draws
    # them on its own surfaces and rejects — or has historically rejected —
    # transparency in them. The adaptive BACKGROUND layer must be fully opaque
    # by Android's own rule, because the launcher slides it under the
    # foreground during parallax and any hole shows through to nothing.
    #
    # The adaptive FOREGROUND keeps its alpha: that layer is supposed to be
    # mostly transparent. So does launcher_192 (legacy icon, masked by the
    # launcher) and icon.png (the in-engine window icon).
    jobs = [
        (ICONS / "store_icon_512.png", store_icon(32).scaled(16), False),
        (ICONS / "launcher_192.png", store_icon(32).scaled(6), True),
        (ICONS / "adaptive_foreground_432.png", adaptive_foreground(27).scaled(16), True),
        (ICONS / "adaptive_background_432.png", adaptive_background(27).scaled(16), False),
        (ICONS / "feature_graphic_1024x500.png", feature_graphic().scaled(4), False),
        (ROOT / "icon.png", store_icon(32).scaled(4), True),
    ]
    for path, canvas, alpha in jobs:
        size = write_png(path, canvas, alpha=alpha)
        print("  %-38s %4dx%-4d %7d B  %s"
              % (path.relative_to(ROOT).as_posix(), canvas.width, canvas.height,
                 size, "RGBA" if alpha else "RGB"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
