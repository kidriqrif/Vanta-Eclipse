#!/usr/bin/env python3
"""Contracts between docs/ARCHITECTURE.md and the code it claims to describe.

ARCHITECTURE.md opens with "It is the first thing to read before adding code",
and the thing it documents most precisely — autoload load order — is the thing
the codebase treats as load-bearing. A stale table there is worse than no table:
it is a confident wrong answer about which managers exist when.

It had in fact gone stale. The table listed 11 of 19 autoloads, named
CombatManager twice, invented an ordinal ("6b"), and put PlayerStats at 7 when
it loads at 11. The save-format section documented 6 of 14 sections. Nothing
caught it because nothing compared prose to code.

  1. autoload table  — the table matches project.godot exactly: same names,
                       same order, same script paths.
  2. save sections   — the documented section/owner table matches the
                       register_saveable() calls in scripts/managers/.

Both are pure documentation-drift checks. They never inspect behaviour, so a
failure here always means "the doc lies", never "the game is broken".
"""

import pathlib
import re
import sys

from _tree import glob, rglob

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "docs/ARCHITECTURE.md"

# | 7 | `EquipmentManager` | `equipment_manager.gd` | ... |
AUTOLOAD_ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*`(\w+)`\s*\|\s*`([\w./]+)`\s*\|", re.M
)
# project.godot: Name="*res://scripts/managers/name.gd"
AUTOLOAD_DECL = re.compile(r'^(\w+)="\*(res://[^"]+)"$')
REGISTER = re.compile(r'register_saveable\(\s*"(\w+)"\s*,\s*self\s*\)')
# Two "| `section` | `Owner` |" pairs may share one table row.
SECTION_CELL = re.compile(r"`(\w+)`\s*\|\s*`(\w+)`")


def declared_autoloads() -> list[tuple[str, str]]:
    """[(autoload name, script basename)] in project.godot declaration order."""
    out: list[tuple[str, str]] = []
    for line in (ROOT / "project.godot").read_text(encoding="utf-8").splitlines():
        m = AUTOLOAD_DECL.match(line.strip())
        if m:
            out.append((m.group(1), m.group(2).rsplit("/", 1)[-1]))
    return out


def check_autoload_table() -> tuple[list[str], list[str]]:
    doc = DOC.read_text(encoding="utf-8")
    documented = [
        (int(o), name, path.rsplit("/", 1)[-1])
        for o, name, path in AUTOLOAD_ROW.findall(doc)
    ]
    actual = declared_autoloads()

    problems: list[str] = []
    if len(documented) != len(actual):
        problems.append(
            f"table documents {len(documented)} autoloads, project.godot declares "
            f"{len(actual)}"
        )
        missing = {n for n, _ in actual} - {n for _, n, _ in documented}
        extra = {n for _, n, _ in documented} - {n for n, _ in actual}
        if missing:
            problems.append("missing from the table: " + ", ".join(sorted(missing)))
        if extra:
            problems.append("in the table but not an autoload: " + ", ".join(sorted(extra)))

    for i, (order, name, script) in enumerate(documented):
        if i >= len(actual):
            break
        real_name, real_script = actual[i]
        if order != i + 1:
            problems.append(
                f"row {i + 1} (`{name}`) is numbered {order} — ordinals must run 1..N"
            )
        if name != real_name:
            problems.append(
                f"position {i + 1}: table says `{name}`, project.godot loads `{real_name}`"
            )
        elif script != real_script:
            problems.append(
                f"`{name}`: table says `{script}`, project.godot loads `{real_script}`"
            )

    return problems, [f"{len(actual)} autoloads in declaration order"]


def check_save_sections() -> tuple[list[str], list[str]]:
    registered: dict[str, str] = {}
    for gd in glob(ROOT, "scripts/managers/*.gd"):
        for section in REGISTER.findall(gd.read_text(encoding="utf-8")):
            # save_manager.gd defines register_saveable; it never calls it.
            registered[section] = "".join(
                part.title() for part in gd.stem.split("_")
            )

    doc = DOC.read_text(encoding="utf-8")
    documented = dict(SECTION_CELL.findall(doc))

    problems: list[str] = []
    for section in sorted(set(registered) - set(documented)):
        problems.append(
            f"`{section}` is registered by {registered[section]} but undocumented"
        )
    for section in sorted(set(documented) - set(registered)):
        problems.append(f"`{section}` is documented but no manager registers it")
    for section in sorted(set(documented) & set(registered)):
        if documented[section] != registered[section]:
            problems.append(
                f"`{section}`: doc says {documented[section]}, "
                f"{registered[section]} registers it"
            )

    return problems, [f"{len(registered)} save sections"]


CHECKS = [
    ("autoload table matches project.godot", check_autoload_table),
    ("save sections match the code", check_save_sections),
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
