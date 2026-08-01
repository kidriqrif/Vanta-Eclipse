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


CHECKS = [
    ("no stale palette copies", check_stale_palette),
    ("sprites are referenced", check_sprites_referenced),
    ("theme variations are used", check_variations_used),
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
