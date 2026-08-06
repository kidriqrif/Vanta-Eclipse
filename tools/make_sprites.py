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


def gloom_wisp() -> Canvas:
    """A mote of void-light, guttering.

    The first attempt trailed a one-pixel tail and read as a balloon on a
    string. There is no LINE anywhere in a wisp: the wake is overlapping discs
    that shrink and drift, so it dissipates instead of dangling.
    """
    c = Canvas(ENEMY, ENEMY)
    for i in range(6):                            # wake first, core draws over
        radius = 9 - i
        if radius < 2:
            break
        x = 32 + int(3.5 * math.sin(i * 0.95))
        y = 30 + i * 4
        c.disc(x, y, radius, "abyss" if i > 2 else "violet")
        if radius > 3:
            c.disc(x, y, radius - 3, "azure")
    c.disc(32, 24, 12, "violet")
    c.disc(32, 23, 9, "azure")
    c.disc(32, 22, 6, "bone")
    c.disc(31, 21, 3, "ivory")
    # Bite pixels out of the halo. A perfect circle reads as a bubble.
    for degrees in range(0, 360, 22):
        radians = math.radians(degrees)
        c.put(int(32 + math.cos(radians) * 12), int(24 + math.sin(radians) * 12), None)
    c.rect(28, 21, 2, 3, "void")
    c.rect(34, 21, 2, 3, "void")
    c.outline("void")
    return c


def shade_stalker() -> Canvas:
    """A predator mid-stalk: heavy shoulders rising ABOVE a head carried low,
    and two thick planted forelimbs.

    The first attempt used four one-pixel limbs radiating from a round body,
    which is the recipe for a tick. Mass beats detail at this size — the
    posture has to be readable from the silhouette alone.
    """
    c = Canvas(ENEMY, ENEMY)

    # THE THIRD ATTEMPT, AND WHY THE FIRST TWO FAILED THE SAME WAY.
    #
    # Attempt one was four one-pixel limbs off a round body: a tick. Attempt
    # two raised a symmetric dome of haunches centred on x=32 and hung a small
    # head under it — which is a mushroom, and with two lighter shoulder discs
    # on it, a mask. Both failed for one reason: a predator is defined by
    # ASYMMETRY ALONG ITS LENGTH. Front and back of an animal do not match, and
    # anything mirrored about the vertical centre line stops being a creature
    # facing somewhere and becomes an ornament.
    #
    # So this one is drawn in profile-ish three-quarter: head low and forward
    # at the left, spine rising to haunches at the right. Nothing is mirrored.

    # Torso, with TWO humps in the back line: shoulder blades forward, haunches
    # aft, and a dip between them.
    #
    # A single rising curve is what kept this reading as a boot no matter how
    # the head was redrawn. One smooth arc over two posts is a shoe in profile;
    # the dip is the whole difference, because it is the shape a cat makes when
    # it gathers itself and nothing inanimate has it.
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

    # Neck: a thick band running down and FORWARD off the shoulder hump, so the
    # head hangs below the shoulders instead of continuing the back line.
    for step in range(11):
        nx, ny = 25 - step, 30 + step
        for k in range(6):
            c.put(nx + k, ny, "blood" if k < 4 else "abyss")
        c.put(nx, ny, "crimson")

    # Head: a WEDGE, deep at the skull and tapering to the muzzle. It was a
    # flat rectangle, which with two square eyes in it read as a toaster. An
    # animal's head is the one shape on the sprite that must not be a box.
    # LIFTED OFF THE BELLY LINE, which is what actually made it a boot.
    #
    # Shortening the muzzle was not enough. The head's underside sat at y=47
    # and so did the belly, so head and torso shared one unbroken bottom edge
    # running the full width of the sprite — a sole. An animal reads as an
    # animal partly because its head hangs clear of its chest, and the gap
    # under the jaw is doing more work here than the skull's shape.
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
    for tooth in range(12, 21, 3):                # teeth on the jaw line
        c.put(tooth, 48, "ivory")
    c.rect(14, 43, 3, 2, "ember")                 # eyes, set back toward the skull
    c.rect(18, 42, 3, 2, "ember")
    c.put(14, 43, "gold")
    c.put(20, 42, "gold")

    # Legs: foreleg planted under the shoulder, hind leg coiled under the
    # haunch. Different lengths and different angles — a matched pair would put
    # the symmetry straight back.
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
    """Bramble given a body — hunched, shoulders forward, thorns swept back.

    TWO THINGS WERE WRONG AND BOTH ARE INSTRUCTIVE.

    It was shaded with _ramp's (lit, mid, dark) as ("moss", "iron", "slate").
    Those last two are blue-grey NEUTRALS, and _ramp gives them 76% of the
    width, so three quarters of a green creature was near-black. It did not
    read as a shaded body, it read as a hole with a green rim — which is
    exactly what ARCHITECTURE.md warns about under "void is never a fill",
    arrived at from the other direction: not by filling with void, but by
    shading so dark that the fill became one.

    The palette carries ONE green. A green body therefore cannot have a
    three-step green ramp, and the fix is not to hunt for a colour that is not
    there — it is to change the PROPORTIONS. Moss now holds the majority of the
    width and the neutrals are a shadow edge, so the mass reads green and still
    turns away from the light.

    Second: the thorns radiated at even angles through a full circle, which is
    a sunburst. A dandelion, not a predator. They sweep up and back off the
    shoulders now, in one direction, so they describe a posture instead of a
    pattern.
    """
    c = Canvas(ENEMY, ENEMY)

    # Mass first, in flat moss: overlapping discs, widest at the shoulders and
    # tucking in toward a root-like base. Discs rather than a tapered column
    # because a straight-sided body gives a straight-sided shadow, and a
    # rectangle of iron down one edge reads as a grey slab standing next to the
    # creature rather than as the creature's own dark side.
    c.disc(30, 22, 8, "moss")                     # head
    c.disc(31, 36, 13, "moss")                    # shoulders and chest
    c.disc(32, 47, 10, "moss")                    # belly
    c.disc(32, 54, 7, "moss")                     # base

    # RAG THE OUTLINE. Discs alone gave a smooth closed curve, and a smooth
    # closed curve full of one colour is a fruit — the previous pass read as an
    # avocado with eyes. Bramble is jagged, and jaggedness has to be in the
    # SILHOUETTE, because that is all anyone sees of a 64px sprite on a phone.
    #
    # The jitter is a fixed sine, not a random number: this file must produce
    # byte-identical output on every run or check_generated.py fails the sweep.
    for y in range(c.height):
        filled = [x for x in range(c.width) if c.get(x, y) == "moss"]
        if not filled:
            continue
        left, right = min(filled), max(filled)
        for edge, direction in ((left, -1), (right, 1)):
            bite = int(1.8 * (1.0 + math.sin(y * 2.3 + (0 if direction < 0 else 1.7))))
            for step in range(bite):
                c.put(edge - direction * step, y, None)

    # Shadow after ragging, so it follows the ragged edge rather than the
    # smooth one it replaced.
    for y in range(c.height):
        filled = [x for x in range(c.width) if c.get(x, y) == "moss"]
        if not filled:
            continue
        right = max(filled)
        for x in range(right - 2, right + 1):
            if c.get(x, y) == "moss":
                c.put(x, y, "iron")
        if len(filled) > 13:
            c.put(right, y, "slate")

    # A hard notch where the head meets the shoulders. Two rows cut clean out,
    # not shaded — at this size a change of value does not separate two masses,
    # only a gap does.
    for x in range(20, 44):
        if c.get(x, 30) is not None:
            c.put(x, 30, "slate")
        if c.get(x, 31) is not None:
            c.put(x, 31, "iron")

    # Thorns: shoulders and spine, swept up and BACK. Angles are a narrow fan,
    # not a circle.
    # Two pixels thick, not one. A single-pixel spike on a 64px body is a
    # whisker at any size a phone actually shows it at.
    for angle, reach in ((-126, 13), (-104, 16), (-80, 15), (-58, 12), (-34, 9)):
        rad = math.radians(angle)
        for step in range(4, reach):
            x, y = int(30 + math.cos(rad) * step), int(21 + math.sin(rad) * step)
            c.put(x, y, "moss")
            c.put(x + 1, y, "moss" if step < reach - 3 else "bone")

    # Barbs down the flanks, angled downward so they read as defence, not legs.
    # Both sides in moss: drawing the right-hand ones in iron put them on top of
    # the shadow, where they vanished.
    for y in range(30, 54, 7):
        c.line(19, y, 13, y + 4, "moss")
        c.line(45, y, 51, y + 4, "moss")

    # Eyes placed against the head's OWN centre (30, 21). _eyes() measures from
    # x=32, which is the canvas centre and no longer where this head is.
    c.rect(26, 20, 3, 2, "gold")
    c.rect(32, 20, 3, 2, "gold")
    c.put(26, 20, "ivory")
    c.put(34, 20, "ivory")

    # The one asymmetric mark: a thorn snapped off short, stub left behind.
    c.put(20, 13, "slate")
    c.put(21, 13, "slate")
    c.put(21, 14, "slate")
    c.outline("void")
    return c


def hollow_sentinel() -> Canvas:
    """Armour with nobody in it. Hard rectangles only — no curve anywhere, so
    it never reads as flesh.

    The armour is AZURE, not steel. Drawn in iron and slate it was 94% neutral
    and read as a grey rectangle on a near-black background — the silhouette
    was correct and completely inert. A hue carries the plate and the two
    neutrals it kept (the visor's void, the outline) are the holes, which is
    the right way round: the empty parts of a hollow suit should be the dark
    ones. Gold bands and ember visor-glow survive because they now sit on a
    blue field instead of on grey.
    """
    c = Canvas(ENEMY, ENEMY)
    c.rect(20, 24, 24, 26, "frost")               # torso, lit rim
    c.rect(22, 26, 20, 22, "azure")
    c.rect(24, 30, 16, 3, "gold")                 # belt bands
    c.rect(24, 38, 16, 2, "gold")
    c.rect(24, 12, 16, 14, "frost")               # helm
    c.rect(26, 14, 12, 10, "azure")
    c.rect(26, 18, 12, 3, "void")                 # visor slit, deliberately empty
    c.rect(27, 19, 3, 1, "ember")
    c.rect(35, 19, 3, 1, "ember")
    for sx in (14, 44):                           # pauldrons
        c.rect(sx, 24, 6, 8, "azure")
        c.rect(sx + 1, 25, 4, 6, "frost")
    c.rect(16, 32, 5, 16, "azure")                # arms
    c.rect(43, 32, 5, 16, "azure")
    c.rect(22, 50, 8, 10, "azure")                # legs
    c.rect(34, 50, 8, 10, "azure")
    c.line(30, 26, 30, 48, "frost")               # a split down the breastplate
    c.outline("void")
    return c


def silent_colossus() -> Canvas:
    """Fills the frame. Weight comes from a low centre of mass and a head that
    is far too small for the shoulders.

    It is MOLTEN, not stone. In iron and slate it was the worst offender in
    the set — 96.9% neutral, a grey mass whose only colour was a four-pixel
    seam. Running the trunk ramp warm (ember over blood over abyss) keeps the
    exact same shading structure and low centre of mass while making the body
    itself the light source. The seam had to change with it: gold-on-ember
    disappeared, so the core is now ivory inside gold, which is the brightest
    pair the palette allows and still reads as heat.
    """
    c = Canvas(ENEMY, ENEMY)
    c.rect(10, 22, 44, 12, "blood")               # enormous shoulder span
    c.rect(12, 24, 40, 8, "ember")
    for y in range(34, 58):                       # blocky trunk
        half = 16 - abs(y - 46) // 3
        _ramp(c, 32, y, half, "ember", "blood", "abyss")
    c.rect(27, 14, 10, 10, "ember")               # small head
    c.rect(29, 16, 6, 6, "abyss")
    c.rect(29, 18, 2, 2, "gold")
    c.rect(33, 18, 2, 2, "gold")
    for ax in (8, 48):                            # pillar arms
        c.rect(ax, 26, 8, 26, "blood")
        c.rect(ax + 1, 28, 5, 22, "ember")
    c.rect(30, 36, 4, 12, "gold")                 # core seam
    c.rect(31, 38, 2, 8, "ivory")
    c.outline("void")
    return c


def hollow_sovereign() -> Canvas:
    """The world boss. Everything else is one hue; this one is crowned in gold
    over crimson so it is legible as the exception."""
    c = Canvas(ENEMY, ENEMY)
    _taper(c, 24, 60, 15, 0.75, "crimson", "blood", "abyss", shrink=0.4)
    # A V mantle across the shoulders and ONE vertical seam. The first version
    # banded the robe horizontally from edge to edge every five rows, which is
    # a barcode — and it ran the eye across the sprite instead of up to the
    # crown, which is the only thing marking this as the boss.
    for i in range(13):
        c.rect(19 + i, 25 + i, 3, 2, "gold")
        c.rect(42 - i, 25 + i, 3, 2, "gold")
    c.rect(31, 36, 2, 20, "gold")
    c.rect(31, 38, 1, 16, "ember")
    c.disc(32, 20, 10, "blood")
    c.disc(32, 21, 8, "void")                     # a hollow crown has no face
    c.rect(28, 20, 3, 3, "crimson")
    c.rect(34, 20, 3, 3, "crimson")
    c.put(28, 20, "ember")
    c.put(36, 20, "ember")
    for x, height in [(21, 7), (26, 11), (31, 15), (36, 11), (41, 7)]:
        c.rect(x, 18 - height, 3, height, "gold")
        c.put(x + 1, 18 - height, "ivory")
    _ragged_hem(c, 16, 49, 58, 3.5)
    c.line(30, 12, 27, 28, "ivory")
    c.outline("void")
    return c


def frost_shade() -> Canvas:
    """A drowned spirit frozen mid-drift: ice sheeting off the shoulders, a
    fractured mask, a shroud that thins toward the base.

    The shroud ramps frost over azure rather than azure over iron. Two of the
    three ramp steps used to be neutral, which put a grey core inside an ice
    creature and left it 62% neutral — cold in name and drab on screen. Ice is
    the one thing in the set that has a light of its own.
    """
    c = Canvas(ENEMY, ENEMY)
    for y in range(20, 61):
        t = (y - 20) / 40.0
        half = int(11 * (1.0 - t * 0.72) ** 0.8) + 1
        _ramp(c, 32, y, half, "frost", "azure", "abyss")
    _ragged_hem(c, 18, 47, 59)
    c.disc(32, 17, 8, "azure")
    c.disc(32, 18, 7, "frost")
    c.disc(32, 19, 6, "void")
    c.rect(29, 17, 2, 2, "frost")
    c.rect(34, 17, 2, 2, "frost")
    c.put(29, 17, "ivory")
    c.put(35, 17, "ivory")
    for px, py, w, h in [(17, 25, 7, 3), (19, 30, 6, 2), (21, 35, 5, 2)]:
        c.rect(px, py, w, h, "bone")
        c.rect(px, py, w - 2, h - 1, "frost")
    c.mirror_x()
    c.line(33, 11, 30, 23, "bone")
    c.outline("void")
    return c


def rime_fiend() -> Canvas:
    """All hard facets, against the Frost Shade's soft form wrapped in plates —
    the two share a world and must never read as the same creature."""
    c = Canvas(ENEMY, ENEMY)
    for y in range(24, 58):                       # faceted crystal trunk
        t = abs(y - 40) / 16.0
        half = int(13 * (1.0 - t * 0.6))
        step = ((y // 5) % 3) - 1                 # blocky facet steps
        _ramp(c, 32 + step, y, max(4, half), "frost", "azure", "iron")
    # Shards GROW from the trunk. The first version placed free-floating
    # squares beside the body and the sprite read as scattered debris rather
    # than one creature — so each wedge starts at the outermost filled pixel of
    # its own row and tapers outward from there, guaranteeing a shared edge.
    for row, length in [(29, 11), (37, 14), (45, 11), (52, 8)]:
        for side in (-1, 1):
            edge = 32
            for step_out in range(32):
                probe = 32 + side * step_out
                if c.get(probe, row) is not None:
                    edge = probe
            for i in range(length):
                thickness = max(1, (length - i) // 2)
                for dy in range(-thickness, thickness + 1):
                    c.put(edge + side * i, row + dy,
                          "frost" if i < length // 2 else "azure")
    c.rect(24, 14, 16, 12, "azure")               # angular head
    c.rect(26, 16, 12, 8, "iron")
    c.rect(27, 18, 4, 3, "ivory")
    c.rect(33, 18, 4, 3, "ivory")
    c.rect(28, 19, 2, 1, "frost")
    c.rect(34, 19, 2, 1, "frost")
    for i, x in enumerate(range(26, 40, 4)):      # crown spines
        c.rect(x, 8 - (i % 2) * 2, 2, 8, "bone")
    c.outline("void")
    return c


# --- pets (48x48) -------------------------------------------------------------


def _pet_base(body: str, mid: str, dark: str, accent: str, big: bool) -> Canvas:
    c = Canvas(PET, PET)
    size = 13 if big else 10
    cx = PET // 2
    c.disc(cx, 26, size, mid)                     # round body — pets are soft
    c.disc(cx, 25, size - 3, body)
    c.disc(cx - 3, 22, size - 6, accent)
    c.disc(cx, 15, size - 4, mid)                 # head
    c.disc(cx, 15, size - 6, body)
    for foot in (cx - 6, cx + 2):                 # feet
        c.rect(foot, 36, 4, 3, dark)
    c.rect(cx - 5, 13, 3, 3, "void")
    c.rect(cx + 2, 13, 3, 3, "void")
    c.put(cx - 5, 13, accent)
    c.put(cx + 2, 13, accent)
    return c


def pet_ember() -> Canvas:
    c = _pet_base("ember", "crimson", "blood", "gold", big=False)
    for i, x in enumerate(range(18, 31, 4)):      # a small flame tuft
        c.rect(x, 4 + (i % 2) * 2, 3, 5, "gold")
        c.put(x + 1, 4 + (i % 2) * 2, "ivory")
    c.outline("void")
    return c


def pet_blaze() -> Canvas:
    """Ember evolved: bigger, hotter, wings of flame."""
    c = _pet_base("gold", "ember", "crimson", "ivory", big=True)
    for wing in (6, 34):
        for i in range(4):
            c.rect(wing + i, 16 + i * 2, 8 - i, 3, "ember")
            c.rect(wing + i, 16 + i * 2, 6 - i, 2, "gold")
    for i, x in enumerate(range(16, 33, 4)):
        c.rect(x, 1 + (i % 2) * 2, 3, 7, "gold")
        c.put(x + 1, 1 + (i % 2) * 2, "ivory")
    c.outline("void")
    return c


def pet_frostling() -> Canvas:
    c = _pet_base("frost", "azure", "iron", "ivory", big=False)
    for i, x in enumerate(range(19, 30, 4)):      # a crest of ice
        c.rect(x, 3 + (i % 2) * 2, 2, 6, "bone")
    c.outline("void")
    return c


def pet_frostwyrm() -> Canvas:
    """Frostling evolved: serpentine, winged, and the only pet with a tail."""
    c = _pet_base("frost", "azure", "iron", "ivory", big=True)
    for wing in (4, 36):
        for i in range(5):
            c.rect(wing + i, 14 + i * 2, 9 - i, 2, "azure")
            c.rect(wing + i, 14 + i * 2, 7 - i, 1, "frost")
    for i, y in enumerate(range(36, 46, 2)):      # tail
        c.rect(24 + int(4 * math.sin(i)), y, 4 - i // 3, 2, "azure")
    for i, x in enumerate(range(17, 32, 3)):
        c.rect(x, 1 + (i % 2) * 2, 2, 7, "bone")
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
        # Upright, not diagonal. The diagonal version was three pixels wide at
        # every point and read as a dropped stick — a sword is a WIDE blade, a
        # crossguard and a pommel, and all three have to survive at 32px.
        for i, y in enumerate(range(4, 22)):      # blade, tapering to a point
            span = 1 if i < 2 else 3
            c.rect(16 - span, y, span * 2, 1, "ash")
            c.rect(16 - span + 1, y, span * 2 - 2, 1, "bone")
        c.rect(8, 21, 16, 3, "iron")              # crossguard
        c.rect(9, 22, 14, 1, "ash")
        c.rect(14, 24, 4, 5, "iron")              # grip
        c.rect(12, 28, 8, 3, "ash")               # pommel
    return _slot(draw)


def slot_armor() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(8, 6, 16, 4, "iron")
        for y in range(10, 26):
            span = 8 - (y - 10) // 3
            c.rect(16 - span, y, span * 2, 1, "iron")
        c.rect(14, 12, 4, 10, "ash")
    return _slot(draw)


def slot_helmet() -> Canvas:
    def draw(c: Canvas) -> None:
        c.disc(16, 15, 10, "iron")
        c.rect(6, 15, 20, 9, "iron")
        c.rect(10, 14, 12, 4, "void")             # visor
        c.rect(15, 18, 2, 6, "void")
    return _slot(draw)


def slot_gloves() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(9, 12, 14, 14, "iron")
        for x in range(9, 22, 4):                 # fingers
            c.rect(x, 6, 3, 7, "iron")
        c.rect(21, 14, 5, 6, "ash")               # thumb
    return _slot(draw)


def slot_boots() -> Canvas:
    def draw(c: Canvas) -> None:
        c.rect(10, 5, 8, 15, "iron")
        c.rect(10, 20, 16, 6, "iron")
        c.rect(11, 6, 6, 12, "ash")
    return _slot(draw)


def slot_ring() -> Canvas:
    def draw(c: Canvas) -> None:
        c.disc(16, 19, 10, "iron")
        c.disc(16, 19, 7, None)
        c.rect(13, 5, 6, 6, "ash")                # the stone
        c.rect(14, 6, 4, 4, "frost")
    return _slot(draw)


def slot_relic() -> Canvas:
    def draw(c: Canvas) -> None:
        for y in range(-11, 12):
            span = int((11 - abs(y)) * 0.75) + 1
            c.rect(16 - span, 16 + y, span * 2, 1, "iron")
        c.rect(13, 13, 6, 6, "ash")
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
