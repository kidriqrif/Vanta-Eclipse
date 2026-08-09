#!/usr/bin/env python3
"""Every pixel of every shipped image is one of the sixteen palette colours.

WHY THIS IS NOT ALREADY COVERED

tools/check_unity.py verifies colour LITERALS — the new Color() calls in the
C# sources. It reads source files and has never opened an image. So
the half of the project's colour that lives inside PNGs — 52 sprites, the font
atlas, the launcher and store icons — was unverified. A sprite regenerated from
an edited palette, a hand-touched pixel, or an asset carried over from the
pre-revamp set would all have passed the sweep with the off-palette colour
sitting in the shipped bundle.

That gap is exactly the shape of the ones this project keeps finding: the check
was named for the thing (palette) and measured a proper subset of it (source
files), so it reported green about territory it never entered.

WHAT COUNTS AS A VIOLATION

A fully transparent pixel carries no colour and is skipped. Everything else
must match a palette entry EXACTLY — no tolerance. These are generated images
written from a palette lookup, not photographs: an off-by-one channel means a
colour was computed rather than chosen, which is the thing a closed palette
exists to prevent.

Partial alpha is allowed and reported. The pixel tools use it for the ground
glow's falloff, and it is composited against the void background at runtime.

THE FONT ATLAS IS THE ONE EXCEPTION

fonts/vanta_pixel.png is written pure white with an alpha mask, because UI.Text
MULTIPLIES a bitmap font's atlas by font_color at draw time. Baking a palette
colour into it would tint every label in the game with that colour and make
font_color a no-op. White is the identity element here, not an off-palette
colour, so the atlas is checked for being exactly that and nothing else — which
is a tighter constraint than palette membership, not a waiver from it.

PNGs are decoded here rather than by an imaging library for the same reason
tools/pixelart.py writes them that way: there is no Pillow on this machine, and
a dependency to read files this project itself generated is a poor trade.
"""

import pathlib
import struct
import sys
import zlib
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from pixelart import PALETTE, rgb  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent

SCOPES = ("Assets/Resources/Art/**/*.png", "Assets/Icons/*.png",
          "production/icons/*.png")

# Written white-on-alpha and multiplied by font_color at draw time. See above.
FONT_ATLAS = "Assets/Resources/Fonts/vanta_pixel.png"
WHITE = (255, 255, 255)


def read_png(path: pathlib.Path) -> tuple[int, int, list[tuple[int, ...]]]:
    """Decode an 8-bit PNG to (width, height, [(r, g, b, a), ...])."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path}: not a PNG")
    pos = 8
    idat = b""
    width = height = depth = ctype = 0
    plte: list[tuple[int, ...]] = []
    trns = b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if tag == b"IHDR":
            width, height, depth, ctype = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"PLTE":
            plte = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif tag == b"tRNS":
            trns = body
        elif tag == b"IEND":
            break
    if depth != 8:
        raise ValueError(f"{path}: bit depth {depth} is not supported")
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = width * channels
    pixels: list[tuple[int, ...]] = []
    prev = bytearray(stride)
    at = 0
    for _ in range(height):
        filt = raw[at]
        at += 1
        line = bytearray(raw[at:at + stride])
        at += stride
        # Undo the per-scanline filter. Byte a is the pixel to the left, b the
        # one above, c the one above-left; the first pixel of a row treats the
        # off-edge bytes as zero.
        for i in range(stride):
            left = line[i - channels] if i >= channels else 0
            up = prev[i]
            upleft = prev[i - channels] if i >= channels else 0
            if filt == 1:
                line[i] = (line[i] + left) & 0xFF
            elif filt == 2:
                line[i] = (line[i] + up) & 0xFF
            elif filt == 3:
                line[i] = (line[i] + (left + up) // 2) & 0xFF
            elif filt == 4:
                estimate = left + up - upleft
                da, db, dc = (abs(estimate - left), abs(estimate - up),
                              abs(estimate - upleft))
                if da <= db and da <= dc:
                    line[i] = (line[i] + left) & 0xFF
                elif db <= dc:
                    line[i] = (line[i] + up) & 0xFF
                else:
                    line[i] = (line[i] + upleft) & 0xFF
        for x in range(width):
            px = line[x * channels:(x + 1) * channels]
            if ctype == 6:
                pixels.append((px[0], px[1], px[2], px[3]))
            elif ctype == 2:
                pixels.append((px[0], px[1], px[2], 255))
            elif ctype == 0:
                pixels.append((px[0], px[0], px[0], 255))
            elif ctype == 4:
                pixels.append((px[0], px[0], px[0], px[1]))
            else:
                index = px[0]
                red, green, blue = plte[index]
                alpha = trns[index] if index < len(trns) else 255
                pixels.append((red, green, blue, alpha))
        prev = line
    return width, height, pixels


def targets() -> list[pathlib.Path]:
    found: list[pathlib.Path] = []
    for scope in SCOPES:
        found.extend(sorted(ROOT.glob(scope)))
    return found


def main() -> int:
    allowed = {rgb(name): name for name in PALETTE}
    problems: list[str] = []
    images = targets()

    # An empty sweep is a passing sweep, which is how a glob that stopped
    # matching anything reports success. A sprite scan here once spent a whole
    # restyle globbing *.svg after every sprite had become a *.png.
    if len(images) < 50:
        print(f"pixels are on-palette: FAIL (only {len(images)} images matched "
              f"{len(SCOPES)} scopes — the project ships 58)")
        return 1

    scanned = 0
    for path in images:
        try:
            _, _, pixels = read_png(path)
        except (ValueError, KeyError, zlib.error) as error:
            problems.append(f"{path.relative_to(ROOT)}: {error}")
            continue
        scanned += len(pixels)
        off: Counter = Counter()
        for red, green, blue, alpha in pixels:
            if alpha == 0:
                continue
            if (red, green, blue) not in allowed:
                off[(red, green, blue)] += 1
        if off:
            worst = ", ".join(
                f"#{r:02X}{g:02X}{b:02X}x{n}" for (r, g, b), n in off.most_common(3)
            )
            problems.append(
                f"{path.relative_to(ROOT)}: {sum(off.values())} pixels in "
                f"{len(off)} colours outside the palette — {worst}"
            )

    atlas = ROOT / FONT_ATLAS
    if not atlas.exists():
        problems.append(f"{FONT_ATLAS}: missing — the font atlas was not checked")
    else:
        _, _, pixels = read_png(atlas)
        scanned += len(pixels)
        stray = {px[:3] for px in pixels if px[3] != 0 and px[:3] != WHITE}
        if stray:
            problems.append(
                f"{FONT_ATLAS}: {len(stray)} non-white colour(s) baked into the "
                "atlas — the label's colour multiplies it, so any colour here "
                "tints every label in the game"
            )

    label = "pixels are on-palette"
    note = f"{len(images) + 1} images, {scanned} pixels, {len(allowed)} palette entries"
    if problems:
        print(f"{label}: FAIL ({note})")
        for problem in problems:
            print(f"    {problem}")
        return 1
    print(f"{label}: OK ({note})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
