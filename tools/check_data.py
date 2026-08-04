#!/usr/bin/env python3
"""Integrity checks for the .tres content library under data/.

Godot is forgiving with resources in exactly the ways that hurt: a misspelled
property is dropped without a word, an out-of-range enum is undefined, and a
duplicate id quietly erases whichever definition loaded first. None of it
raises, so the failure reaches the player as content that simply is not there.

  1. property names   — must be an @export on the resource's own script.
  2. enum + paths     — enums in range, path strings resolving on disk.
  3. ids              — present, and unique within a definition class.
  4. cross-references — prereq_id / cosmetic_id must name a real definition,
                        and every res:// a .tres names must exist.
  5. reachability     — every data/ directory is loaded by some manager, so no
                        definition sits on disk invisible to the game.
"""

import collections
import pathlib
import re
import sys

from _tree import glob, rglob

ROOT = pathlib.Path(__file__).resolve().parent.parent

BASE_PROPS = {"resource_local_to_scene", "resource_name", "resource_path", "script"}
EXT_SCRIPT = re.compile(
    r'\[ext_resource type="Script"[^\]]*path="([^"]+)"[^\]]*id="([^"]+)"'
)
SCRIPT_REF = re.compile(r'script\s*=\s*ExtResource\("([^"]+)"\)')
FIELD = re.compile(r"^([a-z_]\w*)\s*=\s*(.+)$", re.M)


def tres_files() -> list[pathlib.Path]:
    return glob(ROOT, "data/**/*.tres")


def definition_classes() -> dict[str, set[str]]:
    """class_name -> exported property names."""
    out: dict[str, set[str]] = {}
    for gd in rglob(ROOT, "scripts/**/*.gd"):
        src = gd.read_text(encoding="utf-8")
        cn = re.search(r"^class_name\s+(\w+)", src, re.M)
        if not cn:
            continue
        props = set(
            re.findall(r"^@export(?:_\w+)?(?:\([^)]*\))?\s+var\s+(\w+)", src, re.M)
        )
        out[cn.group(1)] = props | BASE_PROPS
    return out


def parse(path: pathlib.Path) -> tuple[str, dict[str, str]]:
    """(script stem, {field: raw value}) for one .tres."""
    text = path.read_text(encoding="utf-8")
    ext = {ident: p for p, ident in EXT_SCRIPT.findall(text)}
    m = SCRIPT_REF.search(text)
    stem = pathlib.Path(ext.get(m.group(1), "?")).stem if m else "?"
    body = text.split("[resource]", 1)[-1]
    return stem, dict(FIELD.findall(body))


# --- 1. property names exist on the script ------------------------------------


def check_properties() -> tuple[list[str], list[str]]:
    exports = definition_classes()
    problems: list[str] = []
    checked = 0
    for tres in tres_files():
        text = tres.read_text(encoding="utf-8")
        m = re.search(r'script_class="(\w+)"', text)
        if not m:
            continue
        klass = m.group(1)
        if klass not in exports:
            problems.append(f"{tres.relative_to(ROOT)}: no class_name {klass} anywhere")
            continue
        checked += 1
        body = text.split("[resource]", 1)[-1]
        for pm in re.finditer(r"^(\w+)\s*=", body, re.M):
            if pm.group(1) not in exports[klass]:
                problems.append(
                    f"{tres.relative_to(ROOT)}: '{pm.group(1)}' is not an "
                    f"@export on {klass} — the value is dropped on load"
                )
    return problems, [f"{checked} resources against {len(exports)} classes"]


# --- 2. enum ranges and path strings ------------------------------------------


def check_values() -> tuple[list[str], list[str]]:
    enum_props: dict[str, dict[str, int]] = {}
    path_props: dict[str, set[str]] = {}
    for gd in rglob(ROOT, "scripts/**/*.gd"):
        src = gd.read_text(encoding="utf-8")
        cn = re.search(r"^class_name\s+(\w+)", src, re.M)
        if not cn:
            continue
        enums: dict[str, int] = {}
        for em in re.finditer(r"^enum\s+(\w+)\s*\{(.*?)\}", src, re.M | re.S):
            # Comments are stripped FIRST: a member name usually sits on the
            # line after its doc comment, and splitting on commas before
            # stripping loses the member entirely and undercounts the enum.
            body = "\n".join(line.split("#")[0] for line in em.group(2).splitlines())
            enums[em.group(1)] = len([x for x in body.split(",") if x.strip()])
        props: dict[str, int] = {}
        paths: set[str] = set()
        for pm in re.finditer(r"^@export\s+var\s+(\w+)\s*:\s*(\w+)", src, re.M):
            prop, typ = pm.group(1), pm.group(2)
            if typ in enums:
                props[prop] = enums[typ]
            if typ == "String" and ("path" in prop or "scene" in prop):
                paths.add(prop)
        enum_props[cn.group(1)] = props
        path_props[cn.group(1)] = paths

    problems: list[str] = []
    n_enum = n_path = 0
    for tres in tres_files():
        text = tres.read_text(encoding="utf-8")
        m = re.search(r'script_class="(\w+)"', text)
        if not m or m.group(1) not in enum_props:
            continue
        klass = m.group(1)
        body = text.split("[resource]", 1)[-1]
        for pm in re.finditer(r"^(\w+)\s*=\s*(.+)$", body, re.M):
            prop, raw = pm.group(1), pm.group(2).strip()
            if prop in enum_props[klass]:
                n_enum += 1
                if not re.fullmatch(r"-?\d+", raw):
                    problems.append(f"{tres.relative_to(ROOT)}: {prop} = {raw} is not an int")
                    continue
                high = enum_props[klass][prop]
                if not 0 <= int(raw) < high:
                    problems.append(
                        f"{tres.relative_to(ROOT)}: {prop} = {raw} out of range "
                        f"(enum has {high} members)"
                    )
            if prop in path_props[klass]:
                n_path += 1
                sm = re.match(r'"(res://[^"]+)"', raw)
                if sm and not (ROOT / sm.group(1).removeprefix("res://")).exists():
                    problems.append(
                        f"{tres.relative_to(ROOT)}: {prop} points at missing {sm.group(1)}"
                    )
    return problems, [f"{n_enum} enum values, {n_path} path strings"]


# --- 3 + 4. ids, uniqueness, cross-references ---------------------------------

# .tres field -> the definition class whose ids it must name.
XREF = {
    "prereq_id": "skill_node_definition",
    "cosmetic_id": "cosmetic_definition",
}
# .tres fields holding res:// paths (single or array).
PATH_FIELDS = ("enemy_definition_paths", "boss_definition_paths", "scene_path")


def check_ids() -> tuple[list[str], list[str]]:
    defs: dict[str, dict[str, str]] = collections.defaultdict(dict)
    problems: list[str] = []
    for tres in tres_files():
        cls, fields = parse(tres)
        ident = fields.get("id", "").strip().strip("&").strip('"')
        rel = tres.relative_to(ROOT)
        if not ident:
            problems.append(f"{rel} ({cls}): no id set")
            continue
        if ident in defs[cls]:
            problems.append(
                f"{cls} id '{ident}' used twice: {defs[cls][ident]} and {rel} "
                f"— whichever loads second erases the other"
            )
        defs[cls][ident] = str(rel)

    array_inner = re.compile(r"\[(.*?)\]", re.S)
    for tres in tres_files():
        cls, fields = parse(tres)
        rel = tres.relative_to(ROOT)
        for field, target in XREF.items():
            if field not in fields:
                continue
            inner = array_inner.search(fields[field])
            src = inner.group(1) if inner else fields[field]
            for ident in [s for s in re.findall(r'&?"([^"]+)"', src) if s]:
                if ident not in defs.get(target, {}):
                    problems.append(
                        f"{rel}: {field} names {target} '{ident}', which does not exist"
                    )
        for field in PATH_FIELDS:
            if field not in fields:
                continue
            for ref in re.findall(r'"(res://[^"]+)"', fields[field]):
                if not (ROOT / ref.removeprefix("res://")).exists():
                    problems.append(f"{rel}: {field} points at missing {ref}")

    total = sum(len(v) for v in defs.values())
    info = [f"{total} definitions across {len(defs)} classes"]
    for cls in sorted(defs):
        info.append(f"{cls.replace('_definition', '')}={len(defs[cls])}")
    return problems, ["; ".join(info[:1]) + " (" + ", ".join(info[1:]) + ")"]


# --- 5. every definition is reachable -----------------------------------------


def check_reachability() -> tuple[list[str], list[str]]:
    corpus = "\n".join(p.read_text(encoding="utf-8") for p in glob(ROOT, "scripts/**/*.gd"))
    corpus += "\n" + "\n".join(p.read_text(encoding="utf-8") for p in tres_files())

    problems: list[str] = []
    scanned = named = 0
    directories = sorted({p.parent for p in tres_files()})
    for directory in directories:
        rel = directory.relative_to(ROOT).as_posix()
        files = sorted(directory.glob("*.tres"))
        # A bare directory path, NOT merely the prefix of a longer file path:
        # "res://data/enemies/void_wisp.tres" contains "res://data/enemies".
        if re.search(r"res://" + re.escape(rel) + r"(?![\w/.-])", corpus):
            scanned += 1
            continue
        orphans = [f for f in files if f.name not in corpus]
        if orphans:
            for orphan in orphans:
                problems.append(
                    f"{orphan.relative_to(ROOT)}: neither its directory is scanned "
                    f"nor the file named — invisible in game"
                )
        else:
            named += 1
    return problems, [
        f"{len(directories)} directories ({scanned} scanned, {named} explicitly listed)"
    ]


# --- 6. arrays indexed together stay the same length --------------------------

ARRAY_CALL = re.compile(r"^[A-Za-z_]\w*(?:\[[^\]]*\])?\((.*)\)$", re.S)

# Fields a definition indexes with ONE shared index.
#
# PetManager.get_stage() derives a stage number, and five UI sites push it
# straight into stage_sprites — so a pet given a third stage name before its
# third sprite exists crashes the companion button, which is on screen for the
# entire game. The only thing holding these together was the words "parallel to
# stage_names" in a doc comment, and a comment cannot fail a build.
#
# (script stem, anchor field, partner field, len(partner) - len(anchor))
PARALLEL: list[tuple[str, str, str, int]] = [
    ("pet_definition", "stage_names", "stage_sprites", 0),
    # One threshold BETWEEN each pair of stages. A stage with no threshold to
    # reach it is a name and a sprite no player can ever see.
    ("pet_definition", "stage_names", "evolution_levels", -1),
]


def _split_top(text: str) -> list[str]:
    """Split on commas that are not inside quotes, brackets or parentheses."""
    parts: list[str] = []
    depth = 0
    quote = ""
    current = ""
    for char in text:
        if quote:
            current += char
            if char == quote:
                quote = ""
            continue
        if char in "\"'":
            quote = char
        elif char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(current)
            current = ""
            continue
        current += char
    parts.append(current)
    return [p for p in (piece.strip() for piece in parts) if p]


def count_elements(raw: str) -> int | None:
    """Entries in a .tres array literal, or None if it is not one.

    Covers the three spellings Godot writes: PackedStringArray("a", "b"),
    Array[Texture2D]([ExtResource("1")]) and a bare []. None rather than 0 for
    anything else, because a value this cannot read must fail loudly — silently
    counting it as empty would turn an unparsed field into a passing check.
    """
    text = raw.strip()
    call = ARRAY_CALL.match(text)
    if call:
        text = call.group(1).strip()
    elif not (text.startswith("[") and text.endswith("]")):
        return None
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1].strip()
    if not text:
        return 0
    return len(_split_top(text))


def check_parallel_arrays() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    checked = 0
    for path in tres_files():
        stem, fields = parse(path)
        rules = [rule for rule in PARALLEL if rule[0] == stem]
        if not rules:
            continue
        rel = path.relative_to(ROOT)
        for _stem, anchor, partner, offset in rules:
            checked += 1
            missing = [f for f in (anchor, partner) if f not in fields]
            if missing:
                problems.append(f"{rel}: {stem} never sets {', '.join(missing)}")
                continue
            counts = {field: count_elements(fields[field]) for field in (anchor, partner)}
            unreadable = [f for f, n in counts.items() if n is None]
            if unreadable:
                field = unreadable[0]
                problems.append(f"{rel}: cannot count entries in {field} = {fields[field]}")
                continue
            have_anchor = counts[anchor]
            have_partner = counts[partner]
            if have_anchor == 0:
                problems.append(
                    f"{rel}: {anchor} is empty — every index into it is out of range"
                )
                continue
            if have_partner != have_anchor + offset:
                problems.append(
                    f"{rel}: {partner} has {have_partner} entries, expected "
                    f"{have_anchor + offset} — it is indexed with {anchor} "
                    f"({have_anchor} entries)"
                )
    return problems, [f"{checked} parallel-array constraints"]


CHECKS = [
    ("property names", check_properties),
    ("enum ranges + paths", check_values),
    ("ids + cross-references", check_ids),
    ("definition reachability", check_reachability),
    ("parallel arrays stay parallel", check_parallel_arrays),
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
