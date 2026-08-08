#!/usr/bin/env python3
"""Generate every sprite in the game as pixel art.

Replaces 51 hand-authored 512x512 SVGs (gradients, radial auras, soft vector
forms) with 51 generated PNGs drawn from the closed 16-colour palette in
pixelart.py.

Rules that apply to every sprite here, learned by drawing the first one wrong:

  * NEVER fill with `void`. Void is the background the game draws on, so a
    void-filled body is not a dark shape, it is a hole — the first Frost Shade
    had a robe that simply vanished into the panel behind it. Void is legal in
    exactly two places: the outline, and a face cavity that is *meant* to read
    as empty.
  * Every sprite gets outline('void') last. Without a hard border the darkest
    pixels dissolve into the background and the silhouette stops reading, which
    at a glance is the only thing a 64x64 creature has.
  * Shade with a three-step ramp (lit / mid / shadow) from the same family.
    Two tones read as flat, four read as mush at this size.
  * Draw the left half and mirror_x(). Then break the symmetry with ONE
    asymmetric mark — a crack, a scar, a missing horn. Perfect symmetry reads
    as a logo; one broken thing reads as a creature.

Silhouette is the whole job. These are seen small, in motion, against black.

Run: python3 tools/make_sprites.py [--sheet]
     --sheet also writes a contact sheet of everything for review.
"""

import math
import pathlib
import sys

from pixelart import Canvas, write_png

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "sprites"

ENEMY = 64
PET = 48
ICON = 32


# --- shared motifs ------------------------------------------------------------


def _ramp(canvas: Canvas, x: int, y: int, half: int, lit: str, mid: str, dark: str) -> None:
    """One horizontal span of a body, shaded left-to-right."""
    for px in range(x - half, x + half):
        depth = (px - (x - half)) / max(1.0, 2.0 * half)
        canvas.put(px, y, lit if depth < 0.24 else (mid if depth < 0.64 else dark))


def _taper(canvas: Canvas, top: int, bottom: int, width: float, curve: float,
           lit: str, mid: str, dark: str, shrink: float = 0.72) -> None:
    """A body that narrows from `width` at the top to a point at the bottom."""
    for y in range(top, bottom):
        t = (y - top) / max(1.0, float(bottom - top))
        half = int(width * (1.0 - t * shrink) ** curve) + 1
        _ramp(canvas, 32 if canvas.width == ENEMY else canvas.width // 2, y, half, lit, mid, dark)


def _ragged_hem(canvas: Canvas, left: int, right: int, base: int, depth: float = 3.0) -> None:
    for x in range(left, right):
        notch = int(depth * (1.0 + math.sin(x * 1.9)))
        for y in range(base - notch, base + 2):
            canvas.put(x, y, None)


def _eyes(canvas: Canvas, y: int, inner: int, colour: str, glint: str = "ivory") -> None:
    canvas.rect(32 - inner - 2, y, 2, 2, colour)
    canvas.put(32 - inner - 2, y, glint)


# --- enemies (64x64) ----------------------------------------------------------
#
# THE SET IS CELESTIAL, NOT MEDIEVAL.
#
# The first roster was a suit of armour, a crowned king in robes, a thorn
# plant, a stone giant and a hooded ghost — a competent fantasy bestiary
# attached to a game called Vanta Eclipse whose tagline is "Devour the light."
# Nothing in it had anything to do with either half of the name.
#
# Two motifs carry the rework, and every creature uses at least one:
#
#   ECLIPSE — a body DARKER than the background it sits on, ringed by the light
#   it is blocking. That is the whole read of an eclipse, and it is why
#   _corona() draws a ring and punches the middle out rather than drawing a lit
#   ball. A creature that glows is a lamp; a creature with a corona is a hole
#   with light behind it.
#
#   ALIEN — no bilateral face, no crown, no armour. Eyes come in threes and
#   rings, limbs are unequal, nothing wears clothing. Where a shape has to be
#   symmetric to read at all (the Sovereign), the symmetry is ORBITAL rather
#   than left-right.


def _corona(canvas: Canvas, cx: int, cy: int, radius: int,
            outer: str, inner: str, core: str = "void") -> None:
    """A ring of light around a hole. The eclipse motif, shared by the set.

    Drawn outside-in, punching a transparent gap before filling the core, so
    the body is genuinely separated from its own halo. Filling a lit disc and
    darkening the middle looks identical at rest and wrong the moment anything
    passes behind it.
    """
    canvas.disc(cx, cy, radius, outer)
    canvas.disc(cx, cy, radius - 2, inner)
    canvas.disc(cx, cy, radius - 4, None)
    canvas.disc(cx, cy, radius - 5, core)


def _eye_ring(canvas: Canvas, cx: int, cy: int, radius: float, count: int,
              colour: str, glint: str = "ivory") -> None:
    """Eyes spaced around a circle. Alien by ARRANGEMENT, not by shape — the
    dots are ordinary; a ring of them is what no vertebrate has."""
    for i in range(count):
        angle = math.tau * i / count - math.tau / 4.0
        ex = int(cx + math.cos(angle) * radius)
        ey = int(cy + math.sin(angle) * radius)
        canvas.rect(ex, ey, 2, 2, colour)
        canvas.put(ex, ey, glint)


def gloom_wisp() -> Canvas:
    """A void mote wearing its own eclipse, trailing the light it has eaten.

    The wake is overlapping discs that shrink and drift, never a line: there is
    no LINE anywhere in a wisp, and a one-pixel tail reads as a balloon on a
    string.
    """
    c = Canvas(ENEMY, ENEMY)
    for i in range(6):                            # wake first, core draws over
        radius = 9 - i
        if radius < 2:
            break
        x = 32 + int(3.5 * math.sin(i * 0.95))
        y = 34 + i * 4
        c.disc(x, y, radius, "abyss" if i > 2 else "violet")
        if radius > 3:
            c.disc(x, y, radius - 3, "azure")
    _corona(c, 32, 24, 15, "violet", "azure")
    # Three eyes, off-centre. Two would be a face; three cannot be.
    for ex, ey in ((28, 20), (35, 19), (31, 26)):
        c.rect(ex, ey, 2, 2, "frost")
        c.put(ex, ey, "ivory")
    for mx, my, r in ((13, 16, 2), (52, 42, 2), (48, 11, 1)):
        c.disc(mx, my, r, "violet")               # motes still in orbit
    c.outline("void")
    return c


def shade_stalker() -> Canvas:
    """A carapace predator mid-stalk: heavy shoulders rising ABOVE a head
    carried low, and two thick planted forelimbs.

    NOTHING IS MIRRORED, and the geometry here is not up for redesign. Four
    earlier attempts failed: one-pixel limbs off a round body is a tick; a
    symmetric dome with a head under it is a mushroom; and a pair of Gaussian
    humps filled straight down to a flat belly is a BRIDGE — two towers with a
    span between them, which is what replacing this body with "something more
    alien" produced. A predator is asymmetric along its LENGTH, its head hangs
    clear of its chest, and its legs are unequal. Restyle the surface; leave
    the skeleton alone.

    The back line has two humps with a dip between them. One smooth arc over
    two posts is a boot in profile; the dip is the shape a cat makes when it
    gathers itself, and nothing inanimate has it.
    """
    c = Canvas(ENEMY, ENEMY)
    for x in range(22, 52):
        t = (x - 22) / 29.0
        back = int(31
                   - 7 * math.exp(-(((t - 0.20) / 0.17) ** 2))    # shoulder blades
                   - 8 * math.exp(-(((t - 0.78) / 0.19) ** 2)))   # haunches
        belly = int(46 - 2 * t)
        for y in range(back, belly):
            depth = (y - back) / max(1.0, float(belly - back))
            c.put(x, y, "crimson" if depth < 0.28 else
                  ("blood" if depth < 0.72 else "abyss"))

    # Chitin banding across the back. This is the whole alien restyle: the mass
    # underneath is unchanged, but segmented plating reads as shell where a
    # smooth ramp read as fur.
    for x in range(26, 50, 5):
        t = (x - 22) / 29.0
        back = int(31
                   - 7 * math.exp(-(((t - 0.20) / 0.17) ** 2))
                   - 8 * math.exp(-(((t - 0.78) / 0.19) ** 2)))
        c.rect(x, back + 1, 1, int(46 - 2 * t) - back - 2, "abyss")

    # Neck: a thick band running down and FORWARD off the shoulder hump, so the
    # head hangs below the shoulders instead of continuing the back line.
    for step in range(11):
        nx, ny = 25 - step, 30 + step
        for k in range(6):
            c.put(nx + k, ny, "blood" if k < 4 else "abyss")
        c.put(nx, ny, "crimson")

    # Head: a WEDGE, deep at the skull and tapering to the muzzle. A flat
    # rectangle with two square eyes in it read as a toaster. LIFTED OFF THE
    # BELLY LINE — head and torso sharing one unbroken bottom edge is a sole,
    # and the gap under the jaw does more work here than the skull's shape.
    for x in range(11, 24):
        t = (x - 11) / 12.0                       # 0 at the muzzle, 1 at the skull
        top = int(40 - 4 * t)
        bottom = int(49 + t)
        for y in range(top, bottom):
            depth = (y - top) / max(1.0, float(bottom - top))
            c.put(x, y, "crimson" if depth < 0.30 else
                  ("blood" if depth < 0.72 else "abyss"))
    c.rect(20, 37, 4, 3, "blood")                 # brow ridge, breaking the block
    c.rect(20, 36, 3, 2, "crimson")
    for tooth in range(12, 21, 3):                # mandible teeth on the jaw line
        c.put(tooth, 48, "ivory")
    # A ROW of eyes rather than a pair — the one change to the head, and the
    # cheapest way to say "not a mammal" without touching the silhouette.
    for i, ex in enumerate((13, 16, 19)):
        c.rect(ex, 42 + (i % 2), 2, 2, "frost")
        c.put(ex, 42 + (i % 2), "ivory")

    # Legs: foreleg planted under the shoulder, hind leg coiled under the
    # haunch. Different lengths and angles — a matched pair would put the
    # symmetry straight back.
    c.rect(24, 44, 6, 13, "abyss")
    c.rect(25, 45, 4, 11, "blood")
    c.rect(23, 56, 8, 3, "abyss")
    c.rect(42, 42, 7, 11, "abyss")
    c.rect(43, 43, 5, 9, "blood")
    c.rect(41, 52, 9, 3, "abyss")
    c.rect(40, 55, 10, 3, "abyss")                # the coiled hind foot

    # Tail: two pixels thick and rooted IN the rump. At one pixel it was a
    # stray line floating off the back corner and read as an antenna.
    for i in range(9):
        tx, ty = 49 + i, 27 - int(i * 0.7)
        c.put(tx, ty, "blood")
        c.put(tx, ty + 1, "abyss")

    # The one asymmetric mark. On the flank, not in the air above it — the old
    # one hung clear of the silhouette and read as a second whisker.
    c.line(33, 26, 39, 30, "ash")
    c.outline("void")
    return c


def thorn_fiend() -> Canvas:
    """A spore bloom: a sac of bioluminescence that grew where the light died.

    The palette carries ONE green, so a green body cannot be shaded in green.
    The sac ramps moss into abyss and the light comes from gold pods sitting ON
    it — which is also the honest way a bioluminescent thing works.
    """
    c = Canvas(ENEMY, ENEMY)
    for y in range(18, 44):                       # bulbous sac, widest low
        t = (y - 18) / 26.0
        half = int(4 + 13.0 * math.sin(t * 2.4) ** 0.7)
        _ramp(c, 32, y, half, "moss", "abyss", "void")
    for px, py, r in ((24, 24, 3), (39, 22, 3), (32, 17, 2), (21, 33, 2), (43, 32, 3)):
        c.disc(px, py, r, "gold")                 # glowing pods
        c.disc(px, py, r - 1, "ivory")
    for tx in (18, 25, 32, 39, 46):               # tendrils, uneven lengths
        length = 8 + (tx % 4) * 3
        for i in range(length):
            c.put(tx + int(1.6 * math.sin(i * 0.5)), 43 + i, "moss")
    _eye_ring(c, 32, 30, 7.0, 5, "frost")
    c.outline("void")
    return c


def hollow_sentinel() -> Canvas:
    """A derelict probe still running its scan. Hard rectangles only, so it
    never reads as flesh — but the rectangles are a HULL, not a breastplate.

    Azure with a single ember lens. The armour it used to be was 94% neutral
    and read as a grey box on a near-black background: the silhouette was
    right and completely inert.
    """
    c = Canvas(ENEMY, ENEMY)
    c.rect(22, 22, 20, 24, "frost")               # hull, lit rim
    c.rect(24, 24, 16, 20, "azure")
    c.rect(24, 28, 16, 2, "gold")                 # instrument bands
    c.rect(24, 36, 16, 2, "gold")
    for vx in (8, 44):                            # solar vanes, not pauldrons
        c.rect(vx, 20, 12, 3, "iron")
        for i in range(4):
            c.rect(vx + i * 3, 23, 2, 9, "azure")
    c.rect(28, 12, 8, 10, "frost")                # sensor head
    c.rect(30, 14, 4, 6, "abyss")
    c.disc(32, 17, 2, "ember")                    # the one lens
    c.rect(31, 4, 2, 8, "iron")                   # antenna
    c.disc(32, 4, 3, "gold")
    c.disc(32, 4, 1, "ivory")
    c.rect(26, 46, 4, 10, "azure")                # landing struts
    c.rect(34, 46, 4, 10, "azure")
    c.outline("void")
    return c


def silent_colossus() -> Canvas:
    """A planetoid that woke up. Fills the frame, and its weight comes from a
    low centre of mass rather than from detail.

    Molten, not stone: the body is its own light source and the craters are
    punched out of it rather than drawn on.
    """
    c = Canvas(ENEMY, ENEMY)
    c.disc(32, 34, 22, "blood")                   # the mass
    c.disc(32, 34, 19, "ember")
    c.disc(30, 31, 13, "gold")                    # molten core showing through
    c.disc(30, 31, 9, "ivory")
    for cx, cy, r in ((16, 26, 4), (46, 24, 3), (43, 45, 5), (20, 46, 3)):
        c.disc(cx, cy, r, "blood")                # craters
        c.disc(cx, cy, r - 1, "abyss")
    for i in range(3):                            # orbiting debris
        angle = math.tau * i / 3.0 + 0.4
        c.disc(int(32 + math.cos(angle) * 27), int(34 + math.sin(angle) * 27),
               2, "iron")
    _eye_ring(c, 30, 31, 5.0, 3, "void", "crimson")
    c.outline("void")
    return c


def hollow_sovereign() -> Canvas:
    """The world boss: the eclipse itself.

    Everything else in the set wears one hue; this one is a black disc inside a
    full gold corona, which is the game's own name drawn as a creature. Its
    symmetry is ORBITAL rather than left-right — spokes at even angles, not a
    mirrored face — so it reads as a body in the sky rather than as a king.
    """
    c = Canvas(ENEMY, ENEMY)
    for i in range(12):                           # corona spokes
        angle = math.tau * i / 12.0
        for step in range(18, 30):
            c.put(int(32 + math.cos(angle) * step),
                  int(32 + math.sin(angle) * step),
                  "gold" if step < 25 else "ember")
    _corona(c, 32, 32, 19, "gold", "crimson")
    c.disc(32, 32, 13, "void")                    # the disc that eats the light
    _eye_ring(c, 32, 32, 8.0, 6, "crimson", "gold")
    c.disc(32, 32, 3, "ivory")                    # the one bright point left
    c.outline("void")
    return c


def frost_shade() -> Canvas:
    """A comet drifter: a frozen nucleus and the tail it is still shedding.

    The tail is STREAKS, not a row of discs. Discs gave a string of beads that
    read as debris rather than motion; a comet tail is directional, so these
    are lines that thin and dim along their length and the nucleus draws over
    their root.

    The nucleus is deliberately NOT a circle. The pets are circles, and a round
    blue ball at 64px reads as the same creature as a round blue pet at 48 —
    which is what the first version did.
    """
    c = Canvas(ENEMY, ENEMY)
    for k in range(7):
        spread = (k - 3) * 2
        for i in range(26):
            t = i / 26.0
            x = 26 - int(t * 22) + int(spread * t)
            y = 34 + int(t * 22) + int(spread * t * 0.4)
            if 0 <= x < ENEMY and 0 <= y < ENEMY:
                c.put(x, y, "frost" if t < 0.25 else ("azure" if t < 0.6 else "abyss"))
    for dx, dy, r in ((34, 24, 11), (28, 20, 8), (38, 30, 7), (30, 30, 6)):
        c.disc(dx, dy, r, "frost")
    for dx, dy, r in ((34, 24, 8), (29, 21, 5), (37, 29, 4)):
        c.disc(dx, dy, r, "azure")
    c.disc(33, 25, 5, "abyss")
    for sx, sy in ((24, 14), (44, 20), (42, 36), (22, 31)):
        c.disc(sx, sy, 2, "ivory")                # ice plates catching light
    _eye_ring(c, 33, 25, 4.0, 4, "ivory", "frost")
    c.outline("void")
    return c


def rime_fiend() -> Canvas:
    """All hard facets, against the comet's soft round nucleus — the two share
    a world and must never read as the same creature."""
    c = Canvas(ENEMY, ENEMY)
    for i in range(9):                            # shards radiating from a core
        angle = math.tau * i / 9.0 + 0.2
        for step in range(4, 24):
            width = max(1, (24 - step) // 5)
            sx = int(32 + math.cos(angle) * step)
            sy = int(32 + math.sin(angle) * step)
            c.rect(sx, sy, width, width, "frost" if step < 14 else "azure")
    c.disc(32, 32, 9, "azure")                    # core
    c.disc(32, 32, 6, "frost")
    c.disc(32, 32, 3, "abyss")
    _eye_ring(c, 32, 32, 4.0, 3, "ivory", "azure")
    c.outline("void")
    return c


# --- pets (48x48) -------------------------------------------------------------
#
# Companions are ALIEN AND FLOATING. They kept feet and a two-eyed face through
# the whole first pass, which made them pets from a different game — the one
# creature class a player looks at for hours had nothing to do with the void.
# They hover now, carry ONE large eye instead of a pair, and each wears a ring
# of its own: the same eclipse motif the enemies have, scaled down and made
# friendly by being ROUND rather than sharp.


def _pet_base(body: str, mid: str, dark: str, accent: str, big: bool,
              halo: tuple[str, str] | None = None) -> Canvas:
    c = Canvas(PET, PET)
    size = 13 if big else 10
    cx = PET // 2
    # The halo is drawn FIRST, behind everything. Drawing it afterwards and
    # punching its middle out erases the body it is supposed to surround —
    # which is exactly what happened to Blaze, and it shipped as a bare orange
    # ring with nothing inside it.
    if halo is not None:
        c.disc(cx, 23, size + 7, halo[0])
        c.disc(cx, 23, size + 5, halo[1])
        c.disc(cx, 23, size + 3, None)
    c.disc(cx, 24, size, mid)                     # soft round body
    c.disc(cx, 23, size - 3, body)
    c.disc(cx - 3, 20, size - 6, accent)
    # ONE eye, big enough to BE the face. Two small ones read as a mammal.
    c.disc(cx, 21, size - 5, "void")
    c.disc(cx, 21, size - 7, accent)
    c.disc(cx - 1, 20, max(1, size - 9), "ivory")
    for i in range(3):                            # hover motes where feet were
        c.disc(cx - 7 + i * 7, 38 + (i % 2), 2, dark)
    return c


def pet_ember() -> Canvas:
    c = _pet_base("ember", "crimson", "blood", "gold", big=False)
    for i in range(8):                            # a warm ring, not a flame tuft
        angle = math.tau * i / 8.0
        c.put(int(24 + math.cos(angle) * 15), int(23 + math.sin(angle) * 15), "gold")
    c.outline("void")
    return c


def pet_blaze() -> Canvas:
    """Ember evolved: bigger, hotter, and its ring has closed into a corona."""
    c = _pet_base("gold", "ember", "crimson", "ivory", big=True,
                  halo=("ember", "gold"))
    for i in range(6):
        angle = math.tau * i / 6.0 + 0.3
        c.disc(int(24 + math.cos(angle) * 19), int(23 + math.sin(angle) * 19), 2, "ivory")
    c.outline("void")
    return c


def pet_frostling() -> Canvas:
    c = _pet_base("frost", "azure", "iron", "ivory", big=False)
    for i in range(8):
        angle = math.tau * i / 8.0
        c.put(int(24 + math.cos(angle) * 15), int(23 + math.sin(angle) * 15), "bone")
    c.outline("void")
    return c


def pet_frostwyrm() -> Canvas:
    """Frostling evolved: serpentine, winged, and the only pet with a tail.

    The crest of bone spikes it used to wear read as a comb at 48px and was the
    last fantasy holdover in the set. It wears the same halo as Blaze instead,
    so the two evolutions rhyme.
    """
    c = _pet_base("frost", "azure", "iron", "ivory", big=True,
                  halo=("azure", "frost"))
    for wing in (2, 36):
        for i in range(5):
            c.rect(wing + i, 14 + i * 2, 9 - i, 2, "azure")
            c.rect(wing + i, 14 + i * 2, 7 - i, 1, "frost")
    for i, y in enumerate(range(38, 46, 2)):      # tail
        c.rect(24 + int(4 * math.sin(i)), y, 4 - i // 3, 2, "azure")
    c.outline("void")
    return c


# --- minigame pieces (32x32) --------------------------------------------------
#
# Board pieces are read at a glance, dozens at a time, while a timer runs. They
# are geometry, not illustration: every one must be identifiable by SHAPE with
# the colour removed, because Connect Four and Memory Match both stop being
# playable if two pieces differ only by hue.


def _tile(fill: str, border: str) -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(2, 2, 28, 28, fill)
    c.frame(2, 2, 28, 28, border)
    c.frame(3, 3, 26, 26, border)
    return c


def card_back() -> Canvas:
    c = _tile("abyss", "iron")
    for y in range(6, 27, 4):                     # a woven back, not a blank
        for x in range(6, 27, 4):
            c.rect(x, y, 2, 2, "violet" if (x + y) % 8 else "azure")
    c.frame(5, 5, 22, 22, "iron")
    return c


def cell_empty() -> Canvas:
    c = _tile("void", "iron")
    c.rect(15, 15, 2, 2, "slate")
    return c


def _disc(fill: str, mid: str, rim: str) -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 13, rim)
    c.disc(16, 16, 11, mid)
    c.disc(16, 16, 8, fill)
    c.disc(13, 13, 3, "ivory")                    # one specular pip, top-left
    return c


def disc_player() -> Canvas:
    return _disc("crimson", "blood", "ivory")


def disc_ai() -> Canvas:
    return _disc("azure", "iron", "bone")


def face_circle() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 11, "frost")
    c.disc(16, 16, 7, "abyss")
    return c


def face_cross() -> Canvas:
    c = Canvas(ICON, ICON)
    for i in range(-10, 11):
        for t in range(-2, 3):
            c.put(16 + i, 16 + i + t, "ember")
            c.put(16 + i, 16 - i + t, "ember")
    return c


def face_diamond() -> Canvas:
    c = Canvas(ICON, ICON)
    for y in range(-11, 12):
        span = 11 - abs(y)
        c.rect(16 - span, 16 + y, span * 2, 1, "gold")
    return c


def face_square() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(6, 6, 20, 20, "moss")
    c.rect(9, 9, 14, 14, "abyss")
    return c


def face_triangle() -> Canvas:
    c = Canvas(ICON, ICON)
    for i, y in enumerate(range(5, 26)):
        span = int(i * 0.55) + 1
        c.rect(16 - span, y, span * 2, 1, "violet")
    return c


def face_hexagon() -> Canvas:
    c = Canvas(ICON, ICON)
    # Pointy-top: flat VERTICAL sides, a vertex top and bottom. Chamfering all
    # four corners — twice now — just produces an octagon, and an octagon on a
    # board that already has a circle is not a distinguishable piece. Straight
    # sides are what separate it from the disc at a glance.
    for y in range(-12, 13):
        span = 10 if abs(y) <= 6 else 10 - (abs(y) - 6) * 2
        if span <= 0:
            continue
        c.rect(16 - span, 16 + y, span * 2, 1, "rose")
    return c


def shot_hit() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 10, "crimson")
    c.disc(16, 16, 6, "ember")
    for degrees in range(0, 360, 45):             # a burst, unmistakably a hit
        radians = math.radians(degrees)
        c.line(16, 16, int(16 + math.cos(radians) * 14),
               int(16 + math.sin(radians) * 14), "gold")
    return c


def shot_miss() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 9, "iron")
    c.disc(16, 16, 6, "abyss")
    c.disc(16, 16, 3, "ash")
    return c


def shot_sunk() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(4, 4, 24, 24, "blood")
    for i in range(-11, 12):                      # a struck-out square
        for t in range(-1, 2):
            c.put(16 + i, 16 + i + t, "gold")
            c.put(16 + i, 16 - i + t, "gold")
    c.frame(4, 4, 24, 24, "crimson")
    return c


# --- UI icons (32x32) ---------------------------------------------------------
#
# The one rule: a UI icon is a SILHOUETTE. These sit on buttons at roughly
# 24-32px on a phone, so interior detail is wasted and outline is everything.


# Ordered dither. A gradient is the one thing this style cannot draw, so a
# falloff is expressed as SOLID pixels at decreasing density instead — which is
# how pixel art has always done it, and why the matrix is worth having.
BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def ground_glow() -> Canvas:
    """The pool of light an enemy stands in.

    Replaces a 64x64 radial GradientTexture2D. That texture was the last smooth
    thing on the gameplay screen: a hard-edged creature standing in a softly
    blurred ellipse read as a sticker pasted onto a photograph.

    Authored 40x8, which is the 5:1 aspect of the TextureRect that draws it.
    The first version was a 32x32 ellipse stretched into that rect — 8x across
    and 1.6x down — so the dither cells came out as long thin rectangles and
    the whole thing read as a dotted line rather than a pool. A dithered
    texture has to be drawn at the shape it will be seen at, because the
    pattern IS the image.

    Drawn in ivory and tinted at runtime — enemy_view.gd modulates it to the
    creature's own glow_color.
    """
    width, height = 40, 8
    c = Canvas(width, height)
    for y in range(height):
        for x in range(width):
            nx = (x + 0.5 - width / 2.0) / (width / 2.0)
            ny = (y + 0.5 - height / 2.0) / (height / 2.0)
            distance = nx * nx + ny * ny
            if distance >= 1.0:
                continue
            # Shallower falloff than a true gradient: at eight rows tall there
            # is only room for about three density steps before the pattern
            # stops reading as light at all.
            density = (1.0 - distance) ** 0.45
            if density * 16.0 > BAYER4[y % 4][x % 4]:
                c.put(x, y, "ivory")
    return c


def menu_divider() -> Canvas:
    """The rule under the main menu's title.

    Replaces a GradientTexture2D that faded crimson out to alpha 0 at both
    ends — the last GradientTexture2D in the project, and the last smooth thing
    on the main menu. It survived the palette pass because a gradient declares
    its stops as a flat PackedColorArray rather than as Color() calls, so the
    check walked straight past it; check_ui.py reads both spellings now.

    Tapered in THREE HARD STEPS rather than by dithering, which is the opposite
    of what ground_glow() does and for the same underlying reason. This is 64px
    of texture stretched across roughly 950px of phone, so every source pixel
    lands about fifteen wide. A 1px dither cell at that scale is not a dither,
    it is a dashed line. Blocks eight columns wide survive the stretch as
    blocks — coarse enough that magnifying them changes nothing but their size.

    Vertically it is 1:1: four rows drawn, four pixels tall on screen.
    """
    width, height = 64, 4
    c = Canvas(width, height)
    half = width // 2
    for x in range(half):
        reach = x / float(half - 1)      # 0 at the outer end, 1 at the centre
        if reach < 0.25:
            continue                     # the ends stop, rather than fading
        if reach < 0.55:
            c.put(x, 2, "blood")         # one row: the thinnest the rule gets
        elif reach < 0.8:
            c.put(x, 1, "blood")
            c.put(x, 2, "blood")
        else:
            c.put(x, 1, "crimson")       # the core, in the accent
            c.put(x, 2, "crimson")
    c.mirror_x()
    return c


def _gem(fill: str, mid: str, spark: bool = True) -> Canvas:
    c = Canvas(ICON, ICON)
    for y in range(-12, 13):                      # cut-gem diamond
        span = int((12 - abs(y)) * 0.8) + 1
        c.rect(16 - span, 16 + y, span * 2, 1, mid)
    for y in range(-8, 9):
        span = int((8 - abs(y)) * 0.7) + 1
        c.rect(16 - span, 16 + y, span * 2, 1, fill)
    if spark:
        c.rect(14, 8, 2, 6, "ivory")
    return c


def essence_icon() -> Canvas:
    return _gem("crimson", "blood")


def void_crystal_icon() -> Canvas:
    return _gem("violet", "azure")


def void_scraps_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    for x, y, w, h in [(5, 12, 9, 7), (16, 8, 8, 8), (12, 20, 10, 6), (20, 17, 6, 5)]:
        c.rect(x, y, w, h, "iron")
        c.rect(x + 1, y + 1, w - 2, h - 2, "ash")
    return c


def arcade_token_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 13, "gold")
    c.disc(16, 16, 10, "ember")
    c.disc(16, 16, 5, "abyss")
    for degrees in range(0, 360, 60):
        radians = math.radians(degrees)
        c.rect(int(16 + math.cos(radians) * 12) - 1,
               int(16 + math.sin(radians) * 12) - 1, 3, 3, "abyss")
    return c


def boss_skull_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 14, 11, "bone")
    c.rect(9, 14, 14, 9, "bone")
    c.rect(11, 23, 10, 4, "bone")                 # jaw
    c.rect(10, 11, 5, 6, "void")                  # sockets
    c.rect(17, 11, 5, 6, "void")
    c.rect(14, 19, 4, 4, "void")
    for x in range(12, 21, 3):                    # teeth
        c.rect(x, 23, 1, 4, "void")
    return c


def eclipse_icon() -> Canvas:
    """The game's own mark: a disc bitten out by a shadow."""
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 13, "crimson")
    c.disc(16, 16, 10, "ember")
    c.disc(11, 13, 10, "void")                    # the occulting body
    return c


def eclipse_emblem() -> Canvas:
    c = eclipse_icon()
    for degrees in range(0, 360, 30):             # a corona
        radians = math.radians(degrees)
        c.line(int(16 + math.cos(radians) * 13), int(16 + math.sin(radians) * 13),
               int(16 + math.cos(radians) * 15), int(16 + math.sin(radians) * 15),
               "gold")
    return c


def auto_attack_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    for i, y in enumerate(range(4, 17)):          # a lightning bolt
        c.rect(18 - i // 2, y, 5, 1, "gold")
    for i, y in enumerate(range(16, 28)):
        c.rect(13 - i // 3 + 3, y, 5, 1, "ember")
    c.rect(11, 15, 10, 2, "gold")
    return c


def forge_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(4, 6, 18, 10, "iron")                  # hammer head, heavy
    c.rect(5, 7, 16, 8, "ash")
    c.rect(20, 8, 7, 6, "iron")                   # peen
    for i in range(14):                           # haft, thick enough to read
        c.rect(12 + i, 16 + i, 4, 2, "ember")
    c.rect(24, 28, 5, 3, "blood")                 # grip end
    return c


def journal_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(6, 5, 20, 23, "bone")
    c.rect(6, 5, 4, 23, "blood")                  # spine
    for y in range(9, 26, 4):
        c.rect(12, y, 11, 1, "iron")
    return c


def lock_glyph() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(7, 15, 18, 13, "ash")
    c.rect(9, 17, 14, 9, "iron")
    c.frame(11, 6, 10, 11, "ash")                 # shackle
    c.frame(12, 7, 8, 9, "ash")
    c.rect(11, 14, 10, 3, None)
    c.rect(15, 20, 2, 4, "void")
    return c


def minigame_reflex_icon() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(16, 16, 13, "frost")
    c.disc(16, 16, 10, "abyss")
    c.disc(16, 16, 5, "frost")
    c.rect(15, 8, 2, 9, "ivory")                  # a clock hand
    return c


def minigame_lights_icon() -> Canvas:
    """Four panes, two lit — the puzzle's whole idea in one glance."""
    c = Canvas(ICON, ICON)
    for x, y, lit in ((4, 4, True), (17, 4, False), (4, 17, False), (17, 17, True)):
        c.rect(x, y, 11, 11, "gold" if lit else "iron")
        c.frame(x, y, 11, 11, "ivory" if lit else "slate")
    return c


def minigame_sequence_icon() -> Canvas:
    """Four runes around a ring with one calling — a sequence mid-playback."""
    c = Canvas(ICON, ICON)
    c.disc(16, 6, 5, "crimson")
    c.disc(16, 6, 2, "ivory")
    c.disc(6, 16, 5, "iron")
    c.disc(26, 16, 5, "iron")
    c.disc(16, 26, 5, "iron")
    return c


def minigame_sweeper_icon() -> Canvas:
    """A gridded field with one rune showing. The grid has to read as CELLS,
    so the lines run the full span rather than boxing each cell separately —
    at 32px a per-cell frame closes up into a solid block."""
    c = Canvas(ICON, ICON)
    c.rect(3, 3, 26, 26, "slate")
    for offset in (3, 11, 19, 27):
        c.rect(offset, 3, 1, 26, "iron")
        c.rect(3, offset, 26, 1, "iron")
    c.disc(19, 19, 4, "ember")
    c.disc(19, 19, 1, "ivory")
    return c


def card_frame_icon() -> Canvas:
    """A blank trophy card. Drawn WHITE-ish on purpose: the collection tints
    each one with its rarity colour through modulate, so any hue baked in here
    would multiply against that and make every tier the wrong colour."""
    c = Canvas(ICON, ICON)
    c.rect(8, 3, 16, 26, "ivory")
    c.rect(9, 4, 14, 24, "abyss")
    c.disc(16, 12, 5, "ivory")
    c.disc(16, 12, 3, "abyss")
    c.rect(11, 21, 10, 2, "ash")
    c.rect(11, 25, 6, 2, "ash")
    return c


def star_flourish() -> Canvas:
    c = Canvas(ICON, ICON)
    for y in range(-13, 14):                      # four-point star
        span = max(0, int((13 - abs(y)) * 0.42))
        c.rect(16 - span, 16 + y, span * 2 + 1, 1, "gold")
    for x in range(-13, 14):
        span = max(0, int((13 - abs(x)) * 0.42))
        c.rect(16 + x, 16 - span, 1, span * 2 + 1, "gold")
    c.disc(16, 16, 3, "ivory")
    return c


def slider_grabber() -> Canvas:
    c = Canvas(ICON, ICON)
    c.rect(9, 4, 14, 24, "crimson")
    c.rect(11, 6, 10, 20, "ember")
    c.rect(14, 11, 4, 10, "ivory")                # a grip mark
    return c


def _slot(draw) -> Canvas:
    """Empty-slot icons are drawn in `iron` on nothing: they are placeholders,
    so they must read as absence, not as an item worth tapping."""
    c = Canvas(ICON, ICON)
    draw(c)
    return c


def slot_weapon() -> Canvas:
    def draw(c: Canvas) -> None:
        # A beam emitter, not a sword. Upright for the same reason the sword
        # was upright: a diagonal is three pixels wide at every point and reads
        # as a dropped stick.
        #
        # The blade is LIGHT, so it is drawn as a hot core with a falloff
        # either side, rather than as a solid bar with an edge — an edge is the
        # one thing a beam does not have, and it was the whole read of the
        # sword this replaces.
        for y in range(3, 19):
            span = 1 if y < 5 else 2
            c.rect(16 - span, y, span * 2, 1, "ash")
            c.rect(15, y, 2, 1, "bone")
        c.rect(11, 19, 10, 3, "iron")             # emitter shroud
        c.rect(12, 20, 8, 1, "ash")
        c.rect(13, 22, 6, 8, "iron")              # grip
        c.rect(14, 24, 4, 1, "ash")               # power cell bands
        c.rect(14, 27, 4, 1, "ash")
    return _slot(draw)


def slot_armor() -> Canvas:
    def draw(c: Canvas) -> None:
        # A world, not a breastplate. Plating in this game is cut from
        # somewhere, so the icon is the somewhere.
        c.disc(16, 13, 8, "iron")
        c.disc(16, 13, 6, "ash")
        for y in (10, 13, 16):                    # cloud bands
            c.rect(8, y, 16, 1, "iron")
        # The ring is an ellipse whose FRONT half is drawn OVER the planet and
        # whose back half is hidden behind it. Cutting only the occluded part
        # and never crossing in front gives a disc sitting on debris — which is
        # exactly how the first version read. The crossing is what says orbit.
        for i in range(96):
            angle = math.tau * i / 96.0
            x = int(16 + math.cos(angle) * 15.0)
            y = int(18 + math.sin(angle) * 4.5)
            if math.sin(angle) > 0 or (x - 16) ** 2 + (y - 13) ** 2 > 72:
                c.put(x, y, "bone")
                c.put(x, y + 1, "iron")
    return _slot(draw)


def slot_helmet() -> Canvas:
    def draw(c: Canvas) -> None:
        c.disc(16, 14, 10, "iron")                # pressure dome
        c.rect(6, 14, 20, 8, "iron")
        c.disc(16, 14, 8, "ash")                  # visor glass
        c.disc(16, 14, 6, "void")
        c.rect(6, 22, 20, 4, "iron")              # neck ring
        c.rect(7, 23, 18, 1, "ash")
    return _slot(draw)


def slot_gloves() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(9, 14, 14, 12, "iron")             # forearm cuff
        c.rect(10, 16, 12, 2, "ash")
        c.rect(10, 21, 12, 2, "ash")
        for x in (10, 15, 20):                    # emitter nodes, not fingers
            c.disc(x + 1, 9, 3, "iron")
            c.disc(x + 1, 9, 1, "ash")
    return _slot(draw)


def slot_boots() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(11, 4, 9, 14, "iron")              # shin
        c.rect(12, 6, 6, 10, "ash")
        c.rect(9, 18, 14, 5, "iron")              # ankle housing
        c.rect(11, 23, 10, 4, "iron")             # thruster bell
        c.rect(12, 27, 8, 2, "ash")               # exhaust
        c.rect(14, 29, 4, 2, "bone")
    return _slot(draw)


def slot_ring() -> Canvas:
    def draw(c: Canvas) -> None:
        c.disc(16, 17, 10, "iron")                # an orbital band
        c.disc(16, 17, 8, "ash")
        c.disc(16, 17, 6, None)
        c.disc(16, 6, 3, "iron")                  # a mote riding it
        c.disc(16, 6, 1, "bone")
    return _slot(draw)


def slot_relic() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(12, 3, 8, 19, "iron")              # a monolith, hovering
        c.rect(13, 5, 6, 15, "ash")
        c.rect(14, 8, 4, 2, "iron")               # inscribed bands
        c.rect(14, 13, 4, 2, "iron")
        c.disc(16, 27, 7, "iron")                 # the pad it hovers over
        c.disc(16, 27, 5, None)
    return _slot(draw)


def relic_twin_fang() -> Canvas:
    c = Canvas(ICON, ICON)
    # Two curved fangs hanging from a gum line. The first version drifted them
    # apart by one pixel per three rows, which is a pair of tweezers — a fang
    # is FAT at the root and comes to a point fast.
    # Two teeth on a strong diagonal, meeting at the bottom — no connecting
    # bar. Twice this was drawn as a pair of vertical tapering tubes hanging
    # from a horizontal red bar, and twice it came out as trousers: the bar
    # reads as a waistband and parallel verticals read as legs. Angling them
    # into a V and deleting the bar is what makes them teeth.
    for side in (-1, 1):
        root_x = 16 - side * 9
        for i in range(22):
            t = i / 21.0
            width = max(1, int(6 * (1.0 - t)))
            x = int(root_x + side * (t ** 1.4) * 7)
            c.rect(x - (width - 1 if side > 0 else 0), 5 + i, width, 1,
                   "bone" if t < 0.7 else "ivory")
    c.disc(16, 8, 4, "blood")                     # the setting they hang from
    c.disc(16, 8, 2, "crimson")
    return c


def relic_eclipse_heart() -> Canvas:
    c = Canvas(ICON, ICON)
    c.disc(11, 13, 7, "crimson")                  # two lobes
    c.disc(21, 13, 7, "crimson")
    for y in range(-9, 12):                       # the point
        span = max(0, 11 - abs(y + 2))
        c.rect(16 - span, 18 + y, span * 2, 1, "crimson")
    c.disc(14, 11, 3, "ember")
    c.disc(16, 15, 4, "void")                     # eclipsed core
    return c


def relic_essence_prism() -> Canvas:
    c = Canvas(ICON, ICON)
    for i, y in enumerate(range(4, 28)):          # a tall prism
        span = int((12 - abs(i - 12)) * 0.7) + 2
        c.rect(16 - span, y, span * 2, 1, "violet" if i % 6 < 3 else "azure")
    c.line(16, 4, 16, 27, "ivory")
    return c


def relic_hunters_sigil() -> Canvas:
    c = Canvas(ICON, ICON)
    c.frame(4, 4, 24, 24, "gold")
    c.frame(5, 5, 22, 22, "gold")
    c.disc(16, 16, 8, "blood")
    c.disc(16, 16, 5, "abyss")
    c.rect(15, 6, 2, 20, "gold")                  # crosshair
    c.rect(6, 15, 20, 2, "gold")
    return c


def relic_shatterstone() -> Canvas:
    c = Canvas(ICON, ICON)
    for y in range(-12, 13):
        span = int((12 - abs(y)) * 0.85) + 1
        c.rect(16 - span, 16 + y, span * 2, 1, "iron")
    for i in range(10):                           # the fracture
        c.put(16 + (i % 3) - 1, 6 + i * 2, "frost")
        c.put(16 + (i % 3), 7 + i * 2, "ivory")
    c.rect(9, 14, 5, 2, "ash")
    c.rect(19, 18, 5, 2, "ash")
    return c


MINIGAMES = {
    "card_back": card_back, "cell_empty": cell_empty,
    "disc_ai": disc_ai, "disc_player": disc_player,
    "face_circle": face_circle, "face_cross": face_cross,
    "face_diamond": face_diamond, "face_hexagon": face_hexagon,
    "face_square": face_square, "face_triangle": face_triangle,
    "shot_hit": shot_hit, "shot_miss": shot_miss, "shot_sunk": shot_sunk,
}
UI = {
    "arcade_token_icon": arcade_token_icon, "auto_attack_icon": auto_attack_icon,
    "boss_skull_icon": boss_skull_icon, "eclipse_emblem": eclipse_emblem,
    "eclipse_icon": eclipse_icon, "essence_icon": essence_icon,
    "forge_icon": forge_icon, "ground_glow": ground_glow, "journal_icon": journal_icon,
    "lock_glyph": lock_glyph, "menu_divider": menu_divider,
    "card_frame_icon": card_frame_icon,
    "minigame_lights_icon": minigame_lights_icon,
    "minigame_reflex_icon": minigame_reflex_icon,
    "minigame_sequence_icon": minigame_sequence_icon,
    "minigame_sweeper_icon": minigame_sweeper_icon,
    "relic_eclipse_heart": relic_eclipse_heart,
    "relic_essence_prism": relic_essence_prism,
    "relic_hunters_sigil": relic_hunters_sigil,
    "relic_shatterstone": relic_shatterstone, "relic_twin_fang": relic_twin_fang,
    "slider_grabber": slider_grabber, "slot_armor": slot_armor,
    "slot_boots": slot_boots, "slot_gloves": slot_gloves,
    "slot_helmet": slot_helmet, "slot_relic": slot_relic,
    "slot_ring": slot_ring, "slot_weapon": slot_weapon,
    "star_flourish": star_flourish, "void_crystal_icon": void_crystal_icon,
    "void_scraps_icon": void_scraps_icon,
}

ENEMIES = {
    "gloom_wisp": gloom_wisp, "shade_stalker": shade_stalker,
    "thorn_fiend": thorn_fiend, "hollow_sentinel": hollow_sentinel,
    "silent_colossus": silent_colossus, "hollow_sovereign": hollow_sovereign,
    "frost_shade": frost_shade, "rime_fiend": rime_fiend,
}
PETS = {
    "pet_ember": pet_ember, "pet_blaze": pet_blaze,
    "pet_frostling": pet_frostling, "pet_frostwyrm": pet_frostwyrm,
}


GROUPS = {
    "enemies": ENEMIES, "pets": PETS, "minigames": MINIGAMES, "ui": UI,
}


def main() -> int:
    written = 0
    for group, table in GROUPS.items():
        print(f"{group} ({len(table)}):")
        for name, build in table.items():
            canvas = build()
            size = write_png(OUT / group / f"{name}.png", canvas)
            print("  %-22s %2dx%-2d %5d B" % (name, canvas.width, canvas.height, size))
            written += 1
    print(f"{written} sprites")
    if "--sheet" in sys.argv:
        sheet()
    return 0


def sheet() -> None:
    """One contact sheet per group, for looking at. Reviewing generated art by
    reading the code that made it does not work — the first pass produced a
    balloon on a string and four detached squares, and both looked correct as
    source."""
    for group, table in GROUPS.items():
        names = list(table)
        columns = min(7, len(names))
        cell = ENEMY + 4
        rows = (len(names) + columns - 1) // columns
        board = Canvas(columns * cell, rows * cell)
        board.rect(0, 0, board.width, board.height, "void")
        for index, name in enumerate(names):
            art = table[name]()
            x = (index % columns) * cell + (cell - art.width) // 2
            y = (index // columns) * cell + (cell - art.height) // 2
            board.paste(art, x, y)
        scale = 3 if group in ("enemies", "pets") else 4
        path = ROOT / ".godot-shots" / f"sheet_{group}.png"
        write_png(path, board.scaled(scale))
        print(f"  sheet -> {path.name}")


if __name__ == "__main__":
    raise SystemExit(main())
