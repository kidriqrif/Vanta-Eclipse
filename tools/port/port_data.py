#!/usr/bin/env python3
"""Lift the Godot data layer out of the engine, ahead of the Unity port.

Reads `scripts/data/*.gd` (the 14 Resource subclasses that define the shape of
every piece of content) and `data/**/*.tres` (the 104 content records), and
emits two things:

  Assets/Scripts/Data/*.cs        one ScriptableObject per definition class
  Assets/Editor/PortedData/*.json one array of records per definition class

The JSON is the engine-neutral form: it is the game's whole content library
with no Godot in it. `DefinitionImporter.cs` turns it into .asset files once
Unity is installed. Splitting it this way means the extraction is verifiable
today, with Python, instead of only after a 12 GB editor install.

Run from the repository root:  python tools/port/port_data.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GD_DATA = ROOT / "scripts" / "data"
TRES_DATA = ROOT / "data"
CS_OUT = ROOT / "Assets" / "Scripts" / "Data"
JSON_OUT = ROOT / "Assets" / "Editor" / "PortedData"

# GDScript export type -> (C# type, C# default). Texture2D becomes Sprite:
# every texture in this project is pixel art drawn by tools/make_sprites.py and
# used as a 2D sprite, so Sprite is the honest Unity type, not Texture2D.
TYPE_MAP = {
    "StringName": ("string", '""'),
    "String": ("string", '""'),
    "float": ("float", "0f"),
    "int": ("int", "0"),
    "bool": ("bool", "false"),
    "Color": ("Color", "Color.white"),
    "Texture2D": ("Sprite", "null"),
    "Array[String]": ("string[]", "new string[0]"),
    "Array[Texture2D]": ("Sprite[]", "new Sprite[0]"),
    "PackedStringArray": ("string[]", "new string[0]"),
    "PackedInt32Array": ("int[]", "new int[0]"),
    # Unity cannot serialise a Dictionary. The one use (MinigameDefinition
    # .context) is per-game tuning read as a blob, so it crosses as raw JSON
    # and is parsed at the point of use.
    "Dictionary": ("string", '"{}"'),
}


class Definition:
    """One `extends Resource` class: its name, enums, and exported fields."""

    def __init__(self, class_name: str, source: Path) -> None:
        self.class_name = class_name
        self.source = source
        self.enums: dict[str, list[str]] = {}
        self.fields: list[tuple[str, str, str]] = []  # (name, gd_type, gd_default)
        self.doc = ""


def parse_gd(path: Path) -> Definition | None:
    text = path.read_text(encoding="utf-8")

    m = re.search(r"^class_name\s+(\w+)", text, re.M)
    if not m or "extends Resource" not in text:
        return None
    d = Definition(m.group(1), path)

    doc = re.search(r"^extends Resource\n((?:##.*\n)+)", text, re.M)
    if doc:
        lines = [ln.lstrip("# ").rstrip() for ln in doc.group(1).splitlines()]
        d.doc = " ".join(ln for ln in lines if ln)

    for em in re.finditer(r"^enum\s+(\w+)\s*\{(.*?)\}", text, re.M | re.S):
        name, body = em.group(1), em.group(2)
        members = []
        for line in body.splitlines():
            line = re.sub(r"##.*", "", line).strip().rstrip(",").strip()
            if line and re.fullmatch(r"[A-Z_][A-Z0-9_]*", line):
                members.append(line)
        d.enums[name] = members

    for fm in re.finditer(
        r"^@export\s+var\s+(\w+)\s*:\s*([\w\[\]]+)\s*(?:=\s*(.+?))?$", text, re.M
    ):
        d.fields.append((fm.group(1), fm.group(2), (fm.group(3) or "").strip()))

    return d


# --- .tres value parsing -------------------------------------------------

RES_PREFIX = "res://"


def parse_value(raw: str, ext: dict[str, str]):
    """Turn one .tres right-hand side into a JSON-ready Python value."""
    raw = raw.strip()

    if raw.startswith("ExtResource("):
        key = re.search(r'ExtResource\("([^"]+)"\)', raw).group(1)
        return ext.get(key, "")

    if raw.startswith("&"):  # StringName
        return raw[1:].strip().strip('"')

    if raw.startswith('"'):
        return json.loads(raw)

    if raw in ("true", "false"):
        return raw == "true"

    m = re.fullmatch(r"Color\(([^)]*)\)", raw)
    if m:
        parts = [float(p) for p in m.group(1).split(",")]
        while len(parts) < 4:
            parts.append(1.0)
        return {"r": parts[0], "g": parts[1], "b": parts[2], "a": parts[3]}

    m = re.fullmatch(r"PackedStringArray\((.*)\)", raw, re.S)
    if m:
        inner = m.group(1).strip()
        return json.loads("[" + inner + "]") if inner else []

    m = re.fullmatch(r"PackedInt32Array\((.*)\)", raw, re.S)
    if m:
        inner = m.group(1).strip()
        return [int(x) for x in inner.split(",")] if inner else []

    m = re.fullmatch(r"Array\[\w+\]\(\[(.*)\]\)", raw, re.S)
    if m:
        inner = m.group(1).strip()
        if not inner:
            return []
        return [parse_value(item, ext) for item in split_top_level(inner)]

    if raw.startswith("{"):
        return json.loads(raw)

    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        pass
    return raw


def split_top_level(s: str) -> list[str]:
    """Split a comma list, ignoring commas nested in brackets or quotes."""
    out, depth, cur, in_str = [], 0, "", False
    for ch in s:
        if ch == '"':
            in_str = not in_str
        if not in_str:
            if ch in "([{":
                depth += 1
            elif ch in ")]}":
                depth -= 1
            elif ch == "," and depth == 0:
                out.append(cur)
                cur = ""
                continue
        cur += ch
    if cur.strip():
        out.append(cur)
    return [x.strip() for x in out]


def parse_tres(path: Path) -> tuple[str, dict]:
    text = path.read_text(encoding="utf-8")

    header = re.search(r'script_class="(\w+)"', text)
    class_name = header.group(1) if header else ""

    ext: dict[str, str] = {}
    for m in re.finditer(
        r'\[ext_resource type="([^"]+)" (?:uid="[^"]*" )?path="([^"]+)" id="([^"]+)"\]',
        text,
    ):
        ext[m.group(3)] = m.group(2)

    body = text.split("[resource]", 1)
    if len(body) < 2:
        return class_name, {}

    record: dict = {"_source": str(path.relative_to(ROOT)).replace("\\", "/")}
    key, buf = None, ""
    for line in body[1].splitlines():
        m = re.match(r"^(\w+)\s*=\s*(.*)$", line)
        if m:
            if key and key != "script":
                record[key] = parse_value(buf, ext)
            key, buf = m.group(1), m.group(2)
        elif key is not None:
            buf += "\n" + line
    if key and key != "script":
        record[key] = parse_value(buf, ext)

    return class_name, record


# --- C# generation -------------------------------------------------------

CS_HEADER = """// GENERATED by tools/port/port_data.py from {source}
// Do not edit by hand: edit the Godot definition and re-run the porter, or
// delete the porter once the Godot tree is gone and this becomes the source.
//
// These are `partial` because the Godot definitions carried methods as well as
// fields (get_cost, format_effect, ...) and those cannot be derived from an
// @export list. They live in Methods/{class_name}.Methods.cs and survive
// regeneration.
using UnityEngine;

namespace VantaEclipse.Data
{{
"""


def csharp_default(gd_type: str, gd_default: str, d: Definition) -> str:
    if gd_type in d.enums:
        if "." in gd_default:
            return f"{gd_type}.{gd_default.split('.')[-1]}"
        return f"{gd_type}.{d.enums[gd_type][0]}" if d.enums[gd_type] else "0"

    cs_type, fallback = TYPE_MAP.get(gd_type, ("string", '""'))

    if not gd_default:
        return fallback
    if gd_type in ("StringName", "String"):
        v = gd_default.lstrip("&").strip()
        return v if v.startswith('"') else fallback
    if gd_type == "bool":
        return gd_default
    if gd_type == "int":
        return gd_default if re.fullmatch(r"-?\d+", gd_default) else "0"
    if gd_type == "float":
        return f"{gd_default}f" if re.fullmatch(r"-?[\d.]+", gd_default) else "0f"
    if gd_type == "Color":
        m = re.fullmatch(r"Color\(([^)]*)\)", gd_default)
        if m:
            parts = [p.strip() for p in m.group(1).split(",")]
            while len(parts) < 4:
                parts.append("1")
            return "new Color({}f, {}f, {}f, {}f)".format(*parts[:4])
    return fallback


def wrap_comment(text: str, indent: str) -> list[str]:
    if not text:
        return []
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > 74:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return [f"{indent}/// {ln}" for ln in lines]


def gen_csharp(d: Definition) -> str:
    src = str(d.source.relative_to(ROOT)).replace("\\", "/")
    out = [CS_HEADER.format(source=src, class_name=d.class_name)]

    menu = re.sub(r"(?<!^)(?=[A-Z])", " ", d.class_name.replace("Definition", ""))
    out.extend(wrap_comment(d.doc, "    "))
    out.append(
        f'    [CreateAssetMenu(menuName = "Vanta Eclipse/{menu.strip()}", '
        f'fileName = "New{d.class_name}")]'
    )
    out.append(f"    public partial class {d.class_name} : ScriptableObject")
    out.append("    {")

    for enum_name, members in d.enums.items():
        out.append(f"        public enum {enum_name}")
        out.append("        {")
        for m in members:
            out.append(f"            {m},")
        out.append("        }")
        out.append("")

    for name, gd_type, gd_default in d.fields:
        cs_type = gd_type if gd_type in d.enums else TYPE_MAP.get(gd_type, ("string",))[0]
        field = to_camel(name)
        default = csharp_default(gd_type, gd_default, d)
        out.append(f"        public {cs_type} {field} = {default};")

    out.append("    }")
    out.append("}")
    return "\n".join(out) + "\n"


# C# reserved words. A GDScript @export can legally be named `sealed` (and
# SlotDefinition has one), which generates uncompilable C#. Escaping with a
# verbatim identifier keeps the FIELD NAME itself unchanged — `@sealed` is the
# field `sealed` — so DefinitionImporter's reflection lookup and the plain
# snake->camel mapping both still work. Renaming the field instead would have
# meant teaching the importer about exceptions.
CS_KEYWORDS = {
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char",
    "checked", "class", "const", "continue", "decimal", "default", "delegate",
    "do", "double", "else", "enum", "event", "explicit", "extern", "false",
    "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit",
    "in", "int", "interface", "internal", "is", "lock", "long", "namespace",
    "new", "null", "object", "operator", "out", "override", "params",
    "private", "protected", "public", "readonly", "ref", "return", "sbyte",
    "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct",
    "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong",
    "unchecked", "unsafe", "ushort", "using", "virtual", "void", "volatile",
    "while",
}


def to_camel(snake: str) -> str:
    head, *rest = snake.split("_")
    name = head + "".join(p.capitalize() for p in rest)
    return f"@{name}" if name in CS_KEYWORDS else name


# --- main ----------------------------------------------------------------


def main() -> int:
    if not GD_DATA.is_dir():
        print(f"error: {GD_DATA} not found; run from the repository root", file=sys.stderr)
        return 1

    defs: dict[str, Definition] = {}
    for path in sorted(GD_DATA.glob("*.gd")):
        d = parse_gd(path)
        if d:
            defs[d.class_name] = d

    CS_OUT.mkdir(parents=True, exist_ok=True)
    JSON_OUT.mkdir(parents=True, exist_ok=True)

    for d in defs.values():
        (CS_OUT / f"{d.class_name}.cs").write_text(gen_csharp(d), encoding="utf-8")

    records: dict[str, list[dict]] = {name: [] for name in defs}
    orphans: list[str] = []
    for path in sorted(TRES_DATA.rglob("*.tres")):
        class_name, record = parse_tres(path)
        if class_name in records:
            records[class_name].append(record)
        else:
            orphans.append(f"{path.relative_to(ROOT)} (script_class={class_name!r})")

    total = 0
    for class_name, rows in sorted(records.items()):
        rows.sort(key=lambda r: (r.get("sort_order", 0), r.get("id", "")))
        out = JSON_OUT / f"{class_name}.json"
        out.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        total += len(rows)
        print(f"  {class_name:26s} {len(rows):3d} records -> {out.relative_to(ROOT)}")

    print(f"\n{len(defs)} definition classes -> {CS_OUT.relative_to(ROOT)}")
    print(f"{total} content records -> {JSON_OUT.relative_to(ROOT)}")

    if orphans:
        print("\nUNCLAIMED .tres (no matching definition class):", file=sys.stderr)
        for o in orphans:
            print(f"  {o}", file=sys.stderr)
        return 1

    expected = len(list(TRES_DATA.rglob("*.tres")))
    if total != expected:
        print(f"\nerror: exported {total}, expected {expected}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
