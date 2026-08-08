#!/usr/bin/env python3
"""Cross-check the hand-written definition partials against the generated ones.

There is no Unity and no .NET SDK on this machine, so none of the ported C# has
been compiled. This does the one useful check that does not need a compiler:
a `partial class Foo` in Assets/Scripts/Data/Methods/ addresses Foo's fields
bare, and the class is unambiguous, so every identifier it reads can be
resolved against what the generator emitted. That catches the likeliest port
error — GDScript is snake_case, the C# is camelCase, and the two were
reconciled by hand.

Deliberately narrow. An earlier version also tried to resolve `something.field`
across the managers by guessing the receiver's type from whatever class names
appeared in the file; it could not distinguish a definition field from any
other member, so it reported confident success on 16 arbitrary matches. A check
that cannot fail is worse than no check. Type-checking the managers needs the
compiler, and that is what installing Unity buys.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEN_DIR = ROOT / "Assets" / "Scripts" / "Data"
METHODS_DIR = GEN_DIR / "Methods"

# Identifiers that are C# or Unity, not definition fields.
IGNORE = {
    "value", "level", "total", "tokens", "crystals", "minutes", "decimals",
    "negative", "text", "grouped", "whole", "scaled", "tier", "pct", "v",
    "string", "float", "int", "bool", "var", "return", "if", "else", "switch",
    "case", "default", "public", "partial", "class", "namespace", "using",
    "true", "false", "null", "get", "set", "this", "new", "out", "ref",
}


def strip_literals(text: str) -> str:
    """Blank out comments and string literals, keeping interpolation holes.

    A regex cannot do this. `$"+{tokens} Token{(tokens == 1 ? "" : "s")}"` nests
    quotes inside an interpolation hole, so a naive `".*?"` sweep ends the
    string at the wrong quote and leaves the literal `s` exposed as an
    identifier — which is exactly the false positive this replaced. The holes
    are kept because they hold real code that may reference fields.
    """
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if ch == "/" and nxt == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i < n and not (text[i] == "*" and i + 1 < n and text[i + 1] == "/"):
                i += 1
            i += 2
            continue

        interpolated = ch == "$" and nxt == '"'
        if interpolated or ch == '"':
            i += 2 if interpolated else 1
            depth = 0
            while i < n:
                c = text[i]
                if c == "\\":
                    i += 2
                    continue
                if depth == 0 and c == '"':
                    i += 1
                    break
                if depth > 0 and c == '"':
                    # A string literal nested inside an interpolation hole,
                    # e.g. {(n == 1 ? "" : "s")}. Skip it whole: its contents
                    # are prose, not code, and letting the characters through
                    # is what made a literal "s" look like a field read.
                    i += 1
                    while i < n and text[i] != '"':
                        i += 2 if text[i] == "\\" else 1
                    i += 1
                    out.append(" ")
                    continue
                if interpolated and c == "{":
                    depth += 1
                    out.append(" ")
                elif interpolated and c == "}":
                    depth -= 1
                    out.append(" ")
                elif depth > 0:
                    out.append(c)  # inside a hole: real code, keep it
                i += 1
            out.append(" ")
            continue

        out.append(ch)
        i += 1
    return "".join(out)


def declared_fields(path: Path) -> tuple[str, set[str]]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"public partial class (\w+)", text)
    if not m:
        return "", set()
    fields = set(re.findall(r"^\s+public \S+ (\w+) = ", text, re.M))
    enums = set(re.findall(r"^\s+public enum (\w+)", text, re.M))
    members = set(re.findall(r"^\s+([A-Z_][A-Z0-9_]*),\s*$", text, re.M))
    return m.group(1), fields | enums | members


def main() -> int:
    generated: dict[str, set[str]] = {}
    for path in sorted(GEN_DIR.glob("*.cs")):
        name, fields = declared_fields(path)
        if name:
            generated[name] = fields

    if not generated:
        print("error: no generated classes; run tools/port/port_data.py", file=sys.stderr)
        return 1

    if not METHODS_DIR.is_dir():
        print(f"{len(generated)} generated classes, no hand-written partials yet")
        return 0

    problems: list[str] = []
    checked = 0

    for path in sorted(METHODS_DIR.glob("*.cs")):
        text = path.read_text(encoding="utf-8")
        m = re.search(r"public partial class (\w+)", text)
        if not m:
            continue
        cls = m.group(1)
        rel = path.relative_to(ROOT)

        if cls not in generated:
            problems.append(f"{rel}: {cls} has no generated half")
            continue

        body = strip_literals(text)

        # Everything the file declares itself: locals and method parameters.
        # These are the only bare lowerCamel identifiers that are legitimately
        # NOT fields of the class, so subtracting them turns "is this a field?"
        # into a decidable question.
        local = set(re.findall(r"\b(?:var|float|int|bool|string|double|long)\s+(\w+)\s*=", body))
        for sig in re.findall(r"public\s+[\w<>\[\]]+\s+\w+\s*\(([^)]*)\)", body):
            local |= set(re.findall(r"[\w<>\[\]]+\s+(\w+)", sig))

        # Bare lowerCamel identifiers not preceded by a dot and not a call.
        for name in sorted(set(re.findall(r"(?<![.\w])([a-z][A-Za-z0-9]*)\b(?!\s*\()", body))):
            if name in IGNORE or name in local:
                continue
            checked += 1
            if name not in generated[cls]:
                # An unknown name is a FAILURE, not something to skip. The
                # previous version filtered these out as "probably a local",
                # which is precisely how a typo'd field name got through — the
                # one error this check exists to catch.
                problems.append(f"{rel}: {cls} has no field '{name}'")

        # Enum members addressed as Kind.ACHIEVEMENT.
        for enum_member in sorted(set(re.findall(r"\b[A-Z]\w*\.([A-Z_][A-Z0-9_]*)\b", body))):
            checked += 1
            if enum_member not in generated[cls]:
                problems.append(f"{rel}: {cls} has no enum member '{enum_member}'")

    for p in problems:
        print(f"  {p}", file=sys.stderr)

    print(f"checked {checked} identifiers in {len(list(METHODS_DIR.glob('*.cs')))} "
          f"partials against {len(generated)} generated classes")
    if problems:
        print(f"{len(problems)} unresolved", file=sys.stderr)
        return 1
    print("all resolved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
