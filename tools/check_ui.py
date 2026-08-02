#!/usr/bin/env python3
"""Theme discipline and UI asset reachability.

ARCHITECTURE.md states the rule plainly: "All widget styling comes from
ui/theme/main_theme.tres ... set theme_type_variation on a node instead of
hand-overriding fonts and colors." Nothing enforced it, and the project had
drifted to 54 hand-written colour overrides across 20 scenes plus 21 hardcoded
palette literals in GDScript.

That is not a tidiness problem. Half of those overrides were copies of the
theme's OWN defaults, so they were invisible duplication right up until the
palette changed — at which point every copy silently kept the old colour and
the restyle only half-applied. A screen looked wrong and the theme looked fine.

  1. no stale palette   — no scene or script repeats a colour the theme
                          already defines for that role.
  2. sprites reachable  — every sprite is referenced by some scene, script or
                          resource. An unreferenced sprite is either dead
                          weight or, as with forge_icon.svg, art that was
                          drawn and then never wired to anything.
  3. variations used    — every theme type variation is applied by some node.

Colour equality is exact-string, which is enough: these are copied literals,
not independently authored values.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
THEME = ROOT / "ui/theme/main_theme.tres"

OVERRIDE = re.compile(r"theme_override_colors/(\w+)\s*=\s*(Color\([^)]*\))")
THEME_COLOR = re.compile(r"^(\w+)/colors/(\w+)\s*=\s*(Color\([^)]*\))", re.M)
VARIATION = re.compile(r"^(\w+)/base_type", re.M)


def scenes() -> list[pathlib.Path]:
    return sorted(ROOT.rglob("scenes/**/*.tscn"))


def scripts() -> list[pathlib.Path]:
    return sorted(ROOT.rglob("scripts/**/*.gd"))


# Pure white/black/transparent are generic values any script may write; they
# are not palette copies even when the theme happens to contain one.
GENERIC = {"Color(1, 1, 1, 1)", "Color(0, 0, 0, 1)", "Color(1, 1, 1)",
           "Color(0, 0, 0)", "Color(0, 0, 0, 0)"}


def theme_colors() -> dict[str, str]:
    """(type, role) -> Color literal, as the theme declares it."""
    out: dict[str, str] = {}
    for kind, role, value in THEME_COLOR.findall(THEME.read_text(encoding="utf-8")):
        out[f"{kind}/{role}"] = value
    return out


def check_stale_palette() -> tuple[list[str], list[str]]:
    declared = set(theme_colors().values()) - GENERIC
    problems: list[str] = []
    checked = 0

    for scene in scenes():
        for i, line in enumerate(scene.read_text(encoding="utf-8").splitlines(), 1):
            m = OVERRIDE.search(line)
            if not m:
                continue
            checked += 1
            if m.group(2) in declared:
                problems.append(
                    f"{scene.relative_to(ROOT)}:{i}: overrides {m.group(1)} with "
                    f"{m.group(2)}, which the theme already defines — delete the "
                    f"override or use the matching theme_type_variation"
                )

    for gd in scripts():
        if gd.parent.name == "data":
            continue  # resource defaults, not UI chrome
        for i, line in enumerate(gd.read_text(encoding="utf-8").splitlines(), 1):
            for value in re.findall(r"Color\([^)]*\)", line):
                if value in declared:
                    checked += 1
                    problems.append(
                        f"{gd.relative_to(ROOT)}:{i}: hardcodes {value}, which the "
                        f"theme already defines — read it from the theme instead"
                    )
    return problems, [f"{checked} colour sites"]


def check_sprites_referenced() -> tuple[list[str], list[str]]:
    corpus = ""
    for pattern in ("**/*.tscn", "**/*.tres", "scripts/**/*.gd", "project.godot"):
        for p in ROOT.glob(pattern) if pattern == "project.godot" else ROOT.rglob(pattern):
            corpus += p.read_text(encoding="utf-8") + "\n"

    problems: list[str] = []
    count = 0
    for sprite in sorted(ROOT.rglob("sprites/**/*.svg")):
        count += 1
        if f"res://{sprite.relative_to(ROOT).as_posix()}" not in corpus:
            problems.append(f"{sprite.relative_to(ROOT)}: referenced by nothing")
    return problems, [f"{count} sprites"]


def check_variations_used() -> tuple[list[str], list[str]]:
    theme = THEME.read_text(encoding="utf-8")
    variations = sorted(set(VARIATION.findall(theme)))
    corpus = "\n".join(p.read_text(encoding="utf-8") for p in scenes())
    corpus += "\n".join(p.read_text(encoding="utf-8") for p in scripts())

    problems = [
        f"theme variation '{v}' is declared but no node uses it"
        for v in variations
        if f'&"{v}"' not in corpus and f'"{v}"' not in corpus
    ]
    return problems, [f"{len(variations)} type variations"]


# A widget whose look comes from a StyleBox that Godot sizes from its own
# minimum size. Give one no content margins and it draws as a hairline: the
# three volume sliders in Settings rendered as a single 4px dot on an empty
# row — no track, no fill, nothing to say they could be dragged. The theme
# looked complete (the styles WERE assigned) and the screen was empty, which
# is why this survived a full palette pass and two rounds of screenshots.
SIZED_BY_MARGIN = {
    "StyleBoxFlat_slider_track": "HSlider track",
    "StyleBoxFlat_slider_fill": "HSlider fill",
}
MARGIN = re.compile(r"content_margin_(top|bottom)\s*=\s*([\d.]+)")


def check_styleboxes_have_height() -> tuple[list[str], list[str]]:
    text = THEME.read_text(encoding="utf-8")
    problems: list[str] = []
    for box_id, label in sorted(SIZED_BY_MARGIN.items()):
        block = re.search(
            rf'\[sub_resource type="StyleBoxFlat" id="{box_id}"\](.*?)(?=\n\[|\Z)',
            text, re.S,
        )
        if block is None:
            problems.append(f"{label}: no stylebox '{box_id}' in the theme")
            continue
        margins = {k: float(v) for k, v in MARGIN.findall(block.group(1))}
        height = margins.get("top", 0.0) + margins.get("bottom", 0.0)
        if height <= 0.0:
            problems.append(
                f"{label} ('{box_id}'): no vertical content margin, so Godot "
                f"draws it at zero height — it will be invisible on screen"
            )
    return problems, [f"{len(SIZED_BY_MARGIN)} margin-sized styleboxes"]


# Every full screen carries its name in a HeaderRow/TitleLabel node. Six of
# them had drifted onto HeaderLabel — the MUTED SECONDARY TEXT role — so half
# the game's screens announced themselves in dim grey body text while the
# other half used the neon display face. Each scene looked deliberate alone;
# only side by side was it obviously an accident.
TITLE_NODE = re.compile(
    r'\[node name="TitleLabel"[^\]]*\]\n((?:(?!\[node)[^\n]*\n)*)'
)


def check_screen_titles() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    count = 0
    for scene in scenes():
        for body in TITLE_NODE.findall(scene.read_text(encoding="utf-8")):
            count += 1
            variation = re.search(r'theme_type_variation = &"(\w+)"', body)
            got = variation.group(1) if variation else "(none)"
            if got != "TitleLabel":
                problems.append(
                    f"{scene.relative_to(ROOT)}: TitleLabel node uses "
                    f"'{got}' — screen titles all use the TitleLabel variation"
                )
    return problems, [f"{count} screen titles"]


# The scheme is one accent on neutrals. Anything with real chroma must sit in
# the red family; greys, near-whites and near-blacks are unconstrained.
#
# Chroma (max-min) rather than HLS saturation on purpose: the Legendary rarity
# white is Color(0.949, 0.949, 0.965), which HLS calls 19% saturated because of
# a hair of blue, but whose chroma is 0.016 — obviously neutral. A saturation
# threshold tuned to exclude it would sit right next to real colours.
CHROMA_FLOOR = 0.10
## Degrees either side of pure red that still count as the accent family.
RED_ARC = 25.0

COLOR_CALL = re.compile(
    r"Color\(\s*([0-9]*\.?[0-9]+)\s*,\s*([0-9]*\.?[0-9]+)\s*,\s*([0-9]*\.?[0-9]+)"
)
# Creature, world and cosmetic colours are content, not chrome: a green enemy
# and a purple tap trail are deliberate. Only UI surfaces are constrained.
HUE_SCOPES = ("scenes/**/*.tscn", "scripts/ui/**/*.gd", "scripts/minigames/**/*.gd",
              "ui/**/*.tres")


def check_palette_hues() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    inspected = 0
    for scope in HUE_SCOPES:
        for path in sorted(ROOT.glob(scope)):
            for number, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), 1
            ):
                for match in COLOR_CALL.finditer(line):
                    red, green, blue = (float(v) for v in match.groups())
                    inspected += 1
                    # Over-1.0 values are HDR multipliers (hit flashes); judge
                    # them on ratio, which normalising preserves.
                    peak = max(red, green, blue, 1.0)
                    red, green, blue = red / peak, green / peak, blue / peak
                    low = min(red, green, blue)
                    chroma = max(red, green, blue) - low
                    if chroma < CHROMA_FLOOR:
                        continue
                    hue = _hue_degrees(red, green, blue, chroma)
                    if hue <= RED_ARC or hue >= 360.0 - RED_ARC:
                        continue
                    problems.append(
                        f"{path.relative_to(ROOT)}:{number}: "
                        f"Color({red:.3f}, {green:.3f}, {blue:.3f}) is {hue:.0f}deg "
                        f"off-palette (chroma {chroma:.2f}) — the scheme is one "
                        f"red accent on neutrals"
                    )
    return problems, [f"{inspected} colours in UI surfaces"]


def _hue_degrees(red: float, green: float, blue: float, chroma: float) -> float:
    top = max(red, green, blue)
    if top == red:
        hue = ((green - blue) / chroma) % 6.0
    elif top == green:
        hue = (blue - red) / chroma + 2.0
    else:
        hue = (red - green) / chroma + 4.0
    return hue * 60.0


CHECKS = [
    ("no stale palette copies", check_stale_palette),
    ("colours stay in the red family", check_palette_hues),
    ("sprites are referenced", check_sprites_referenced),
    ("theme variations are used", check_variations_used),
    ("margin-sized styleboxes have height", check_styleboxes_have_height),
    ("screen titles use the title style", check_screen_titles),
]


def main() -> int:
    failed = 0
    for label, fn in CHECKS:
        problems, info = fn()
        note = "; ".join(info)
        if problems:
            failed += 1
            print(f"{label}: FAIL ({note})")
            for problem in problems:
                print(f"    {problem}")
        else:
            print(f"{label}: OK ({note})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
