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
    """[(autoload name, full res:// script path)] in declaration order.

    The full path, not the basename: check_no_test_autoloads() asserts where an
    autoload's script LIVES, and a basename cannot answer that.
    """
    out: list[tuple[str, str]] = []
    for line in (ROOT / "project.godot").read_text(encoding="utf-8").splitlines():
        m = AUTOLOAD_DECL.match(line.strip())
        if m:
            out.append((m.group(1), m.group(2)))
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
        real_name, real_path = actual[i]
        real_script = real_path.rsplit("/", 1)[-1]
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


# --- files the docs name ------------------------------------------------------
#
# A doc that names a deleted file is the same failure as a stale autoload table:
# a confident wrong answer. The revamp deleted dimensional_sprite.gdshader,
# nebula_background.gdshader, soft_dot.tres and icon.svg, and four documents
# went on describing them — including the architecture section that explained,
# in detail and in the present tense, how the project derives surface normals
# from an alpha channel it no longer has.
#
# Bare basenames resolve anywhere in the tree, because the docs write
# `save_manager.gd` for a file that lives in scripts/managers/ and spelling out
# every path would be worse prose for no more precision.
#
# The rule this establishes: BACKTICKS MEAN A LIVE PATH. A file that used to
# exist and is being described historically is written in bold instead — see
# the "Where the shading lives" section, which names the deleted bevel shader
# because the reason it was deleted is the point of the section.
DOCS = ("docs/ARCHITECTURE.md", "design/TESTING-GUIDE.md",
        "design/RELEASE-CHECKLIST.md", "README.md")
NAMED_FILE = re.compile(
    r"`(?:res://)?([\w./-]+\.(?:gd|gdshader|tres|tscn|png|svg|fnt|ttf|py|sh))`"
)
# Directories whose contents are generated, vendored, or gitignored: a doc
# naming something in here is not evidence the doc is stale.
SKIP_DIRS = {".godot", "android", "build", "node_modules", ".git"}


def _basenames() -> set[str]:
    found: set[str] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if SKIP_DIRS & set(path.relative_to(ROOT).parts):
            continue
        found.add(path.name)
    return found


def check_doc_files_exist() -> tuple[list[str], list[str]]:
    known = _basenames()
    problems: list[str] = []
    inspected = 0
    for name in DOCS:
        doc = ROOT / name
        if not doc.exists():
            problems.append(f"{name}: listed in DOCS but missing")
            continue
        for number, line in enumerate(
            doc.read_text(encoding="utf-8").splitlines(), 1
        ):
            for ref in NAMED_FILE.findall(line):
                inspected += 1
                if (ROOT / ref).exists():
                    continue
                if "/" not in ref and ref in known:
                    continue
                problems.append(
                    f"{name}:{number}: names `{ref}`, which does not exist"
                )
    return problems, [f"{inspected} file references across {len(DOCS)} documents"]


# check_autoload_table() verifies the TABLE. The same number is also written
# out in prose in three other places, and prose is where it rots: README and
# TESTING-GUIDE both still said 19 after the twentieth autoload landed, because
# nothing about adding a manager makes anyone reread a sentence.
AUTOLOAD_COUNT = re.compile(r"\b(\d+)\s+autoload")


def check_doc_counts() -> tuple[list[str], list[str]]:
    actual = len(declared_autoloads())
    problems: list[str] = []
    inspected = 0
    for name in DOCS:
        doc = ROOT / name
        if not doc.exists():
            continue
        for number, line in enumerate(
            doc.read_text(encoding="utf-8").splitlines(), 1
        ):
            for claim in AUTOLOAD_COUNT.findall(line):
                inspected += 1
                if int(claim) != actual:
                    problems.append(
                        f"{name}:{number}: says {claim} autoloads; "
                        f"project.godot declares {actual}"
                    )
    return problems, [f"{inspected} prose counts against {actual} autoloads"]


# Every autoload's script must live under scripts/managers/.
#
# tools/screenshot_run.sh and tools/logic_run.sh each inject an autoload from
# tools/ for the length of a run and remove it on exit. That is safe right up
# until something commits the file mid-run — which is what happened when the
# aspect matrix was left running in the background across a turn boundary and
# the auto-commit hook captured the injected state. The commit shipped an
# autoload that walks every screen and calls get_tree().quit(), in place of the
# game.
#
# This asserts the PROPERTY rather than listing names. A name allowlist only
# ever covers the harnesses somebody remembered: the first version of this
# check named ScreenshotHarness and silently ignored LogicHarness, which is
# injected by the same trick with the same exposure. A path rule needs no
# cooperation from the thing it guards and covers the next one for free.
MANAGER_DIR = "res://scripts/managers/"


def check_no_test_autoloads() -> tuple[list[str], list[str]]:
    declared = declared_autoloads()
    problems: list[str] = []
    for name, path in declared:
        if path.startswith(MANAGER_DIR):
            continue
        problems.append(
            f"project.godot declares {name} ({path}) — every autoload's script "
            f"belongs under {MANAGER_DIR}. A tooling harness is injected for the "
            "length of a run and removed on exit, so this is a commit that "
            "captured a run in progress."
        )
    found = "none" if not problems else str(len(problems))
    return problems, [f"{len(declared)} autoloads, {found} test-only"]


CHECKS = [
    ("no tooling autoload is committed", check_no_test_autoloads),
    ("autoload table matches project.godot", check_autoload_table),
    ("save sections match the code", check_save_sections),
    ("documents only name files that exist", check_doc_files_exist),
    ("prose counts match the code", check_doc_counts),
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
