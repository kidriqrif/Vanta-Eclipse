#!/usr/bin/env python3
"""The pixel-art foundation: one 16-colour palette and a tiny drawing canvas.

Everything visual in the revamp is generated from this module — creatures, UI
icons, the bitmap font, the theme, the store art. That is deliberate and it is
the same bet make_audio.py makes about sound: an asset you can regenerate is an
asset you can *change*. A palette tweak is one edit here and one command, not
51 files reopened by hand.

PNGs are written by hand with zlib and struct. There is no imaging library on
this machine, and adding a dependency to generate art that never changes at
runtime would be a poor trade.

THE PALETTE IS CLOSED. Sixteen colours, no sixteen-and-a-halves. Every pixel of
every sprite and every colour in the theme is an index into PALETTE, and
tools/check_ui.py fails the sweep on any UI colour that is not one of them.
That constraint is the whole reason a generated set can look coherent: it takes
the one decision a program makes badly — which colour is *right* — and removes
it from the program.
"""

import pathlib
import struct
import zlib

# --- the palette --------------------------------------------------------------
#
# Seven neutrals and nine hues. The neutrals do the structure (background,
# panel, row, border, muted text, body text, title) and the hues do meaning
# (element, rarity, currency, danger).
#
# Two rules held it together while it was being picked:
#   * VOID and CRIMSON are inherited, not chosen. The game is named for an
#     eclipse, and the icon, feature graphic and store listing already commit
#     to red on black. A revamp that abandons them is a different product.
#   * Neutrals climb in value with roughly even steps, so a row on a panel on
#     the background reads as three distinct planes without a single border.

PALETTE: dict[str, str] = {
    # neutrals, darkest to lightest
    "void":    "#08080C",   # the background behind everything
    "abyss":   "#14141C",   # panel surface
    "slate":   "#24242F",   # a row or tile sitting on a panel
    "iron":    "#3D3D4E",   # borders, dividers, inactive outlines
    "ash":     "#6E6E85",   # muted and disabled text
    "bone":    "#B8B8C8",   # body text
    "ivory":   "#F0F0F6",   # titles, highlights, the brightest pixel allowed
    # hues
    "blood":   "#7A0E1C",   # deep accent — a fill that ivory text sits ON
    "crimson": "#E8323C",   # the accent — marks, active state, the identity
    "ember":   "#F07830",   # fire, warning, heat
    "gold":    "#F0C040",   # currency, legendary
    "moss":    "#58A83C",   # poison, nature, success
    "frost":   "#40C8E0",   # ice, rare
    "azure":   "#3868D8",   # arcane, uncommon
    "violet":  "#8848E0",   # void magic, epic
    "rose":    "#E060A8",   # mythic, charm
}

ORDER: list[str] = list(PALETTE)
TRANSPARENT = "_"


def rgb(name: str) -> tuple[int, int, int]:
    value = PALETTE[name]
    return int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)


def godot(name: str, alpha: float = 1.0) -> str:
    """The colour as a Godot `Color(r, g, b, a)` literal."""
    red, green, blue = rgb(name)
    return "Color(%.3f, %.3f, %.3f, %g)" % (red / 255, green / 255, blue / 255, alpha)


# --- canvas -------------------------------------------------------------------


class Canvas:
    """A grid of palette names. `None` is transparent.

    Deliberately stores NAMES rather than RGBA: a mistyped colour raises a
    KeyError at generation time instead of quietly writing the wrong pixels,
    and every sprite is readable as text while it is being written.
    """

    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.cells: list[str | None] = [None] * (width * height)

    def put(self, x: int, y: int, colour: str | None) -> None:
        if colour is not None and colour not in PALETTE:
            raise KeyError(f"{colour!r} is not one of the 16 palette colours")
        if 0 <= x < self.width and 0 <= y < self.height:
            self.cells[y * self.width + x] = colour

    def get(self, x: int, y: int) -> str | None:
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.cells[y * self.width + x]
        return None

    def rect(self, x: int, y: int, w: int, h: int, colour: str | None) -> None:
        for dy in range(h):
            for dx in range(w):
                self.put(x + dx, y + dy, colour)

    def frame(self, x: int, y: int, w: int, h: int, colour: str) -> None:
        for dx in range(w):
            self.put(x + dx, y, colour)
            self.put(x + dx, y + h - 1, colour)
        for dy in range(h):
            self.put(x, y + dy, colour)
            self.put(x + w - 1, y + dy, colour)

    def disc(self, cx: float, cy: float, radius: float, colour: str | None) -> None:
        top, bottom = int(cy - radius) - 1, int(cy + radius) + 2
        left, right = int(cx - radius) - 1, int(cx + radius) + 2
        for y in range(top, bottom):
            for x in range(left, right):
                # +0.5 samples the pixel centre, which keeps a circle centred
                # on a pixel boundary symmetric instead of one column heavy.
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius * radius:
                    self.put(x, y, colour)

    def line(self, x0: int, y0: int, x1: int, y1: int, colour: str) -> None:
        """Bresenham. Straight, aliased, one pixel wide — the point of the
        style is that a diagonal IS a staircase."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        step_x = 1 if x0 < x1 else -1
        step_y = 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.put(x0, y0, colour)
            if x0 == x1 and y0 == y1:
                return
            doubled = 2 * error
            if doubled >= dy:
                error += dy
                x0 += step_x
            if doubled <= dx:
                error += dx
                y0 += step_y

    def mirror_x(self) -> None:
        """Copy the left half over the right. Most creatures are symmetric, and
        drawing half of one is both faster and steadier than drawing both."""
        for y in range(self.height):
            for x in range(self.width // 2):
                self.put(self.width - 1 - x, y, self.get(x, y))

    def outline(self, colour: str = "void", diagonal: bool = False) -> None:
        """Trace a hard border around every filled region.

        This is what makes a 64x64 creature legible against a dark background
        at a glance — without it the darkest pixels of a sprite dissolve into
        the panel behind it and the silhouette stops reading.
        """
        neighbours = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        if diagonal:
            neighbours += [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        additions: list[tuple[int, int]] = []
        for y in range(self.height):
            for x in range(self.width):
                if self.get(x, y) is not None:
                    continue
                if any(self.get(x + dx, y + dy) is not None for dx, dy in neighbours):
                    additions.append((x, y))
        for x, y in additions:
            self.put(x, y, colour)

    def paste(self, other: "Canvas", x: int, y: int) -> None:
        for sy in range(other.height):
            for sx in range(other.width):
                cell = other.get(sx, sy)
                if cell is not None:
                    self.put(x + sx, y + sy, cell)

    def scaled(self, factor: int) -> "Canvas":
        out = Canvas(self.width * factor, self.height * factor)
        for y in range(self.height):
            for x in range(self.width):
                cell = self.get(x, y)
                if cell is not None:
                    out.rect(x * factor, y * factor, factor, factor, cell)
        return out

    def to_rgba(self) -> bytes:
        rows = bytearray()
        cache = {name: bytes(rgb(name)) + b"\xff" for name in PALETTE}
        clear = b"\x00\x00\x00\x00"
        for y in range(self.height):
            rows.append(0)  # filter type 0 (None) for every scanline
            for x in range(self.width):
                cell = self.cells[y * self.width + x]
                rows += clear if cell is None else cache[cell]
        return bytes(rows)


# --- PNG ----------------------------------------------------------------------


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: pathlib.Path, canvas: Canvas) -> int:
    """8-bit RGBA, no interlacing. Returns the byte size written."""
    header = struct.pack(">IIBBBBB", canvas.width, canvas.height, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(canvas.to_rgba(), 9))
        + _chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)
    return len(blob)


# --- Godot import sidecar -----------------------------------------------------

# Pixel art MUST NOT be filtered. Godot's default is linear, which turns a
# 64x64 creature scaled to fill a phone screen into a blurred smear — the
# single most common way a pixel-art game ships looking wrong. This is written
# beside every generated PNG so the setting travels with the asset rather than
# depending on anyone remembering a project default.
IMPORT_TEMPLATE = """[remap]

importer="texture"
type="CompressedTexture2D"
uid="uid://{uid}"
path="res://.godot/imported/{base}-{digest}.ctex"
metadata={{
"vram_texture": false
}}

[deps]

source_file="res://{res_path}"
dest_files=["res://.godot/imported/{base}-{digest}.ctex"]

[params]

compress/mode=0
compress/high_quality=false
compress/lossy_quality=0.7
compress/hdr_compression=1
compress/normal_map=0
compress/channel_pack=0
mipmaps/generate=false
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/fix_alpha_border=true
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=0
"""
