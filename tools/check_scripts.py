#!/usr/bin/env python3
"""GDScript semantic checks that gdparse and gdlint both pass cleanly.

Five classes of runtime error, each invisible to syntax and style tooling:

  1. %UniqueName        — a typo is a hard crash the moment the scene loads.
  2. signal arity       — a mismatch throws when the signal FIRES, which may be
                          hours of play after the connect() that caused it.
  3. handler existence  — .connect(_on_typo) parses fine and dies on emit.
  4. res:// literals     — preload() crashes, load() silently returns null.
  5. autoload order     — reading a later autoload during _ready() gets a
                          wrong answer rather than an error.

Run from anywhere; paths resolve against the repository root.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Newline is excluded on purpose. A GDScript string never spans a line, and a
# lone apostrophe in prose ("# doesn't") would otherwise open a fake string
# that swallows every following line until the next apostrophe — deleting real
# code from the text these checks read.
STRING = re.compile(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'')
COMMENT = re.compile(r"#[^\n]*")


def strip_strings(src: str) -> str:
    src = re.sub(r'"""(?:.|\n)*?"""', '""', src)
    return STRING.sub('""', src)


def scripts() -> list[pathlib.Path]:
    return sorted(ROOT.glob("scripts/**/*.gd"))


def func_params(src: str) -> dict[str, tuple[int, int]]:
    """func name -> (required, total) parameter counts.

    The parameter list is matched with [^)]*, which spans newlines on purpose:
    every long handler in this project wraps its signature across lines, and a
    newline-blind pattern silently skips them — which makes the arity check
    below quietly pass anything it cannot see.
    """
    out: dict[str, tuple[int, int]] = {}
    for m in re.finditer(r"^\s*(?:static\s+)?func\s+(\w+)\(([^)]*)\)", src, re.M):
        parts = [p for p in re.split(r",(?![^\[]*\])", m.group(2)) if p.strip()]
        out[m.group(1)] = (sum(1 for p in parts if "=" not in p), len(parts))
    return out


# --- 1. %UniqueName references ------------------------------------------------


def check_unique_names() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    count = 0
    for tscn in sorted(ROOT.rglob("*.tscn")):
        text = tscn.read_text()
        uniques: set[str] = set()
        current = None
        for line in text.splitlines():
            m = re.match(r'\[node name="([^"]+)"', line)
            if m:
                current = m.group(1)
            elif line.strip() == "unique_name_in_owner = true" and current:
                uniques.add(current)
        ext = dict(
            re.findall(r'\[ext_resource type="Script" path="([^"]+)" id="([^"]+)"\]', text)
        )
        body = text.split("[node ", 1)[-1].split("\n[node ")[0]
        ms = re.search(r'script = ExtResource\("([^"]+)"\)', body)
        if not ms:
            continue
        root_script = next((p for p, r in ext.items() if r == ms.group(1)), None)
        if not root_script:
            continue
        gd = ROOT / root_script.removeprefix("res://")
        if not gd.exists():
            problems.append(f"{tscn.name}: script missing on disk: {root_script}")
            continue
        # Strings are stripped so printf specifiers (%d, %s) are not mistaken
        # for node references, and the name must start with a capital.
        src = strip_strings(gd.read_text())
        for m in re.finditer(r"%([A-Z]\w*)", src):
            count += 1
            if m.group(1) in uniques:
                continue
            line_no = src[: m.start()].count("\n") + 1
            problems.append(
                f"{gd.relative_to(ROOT)}:{line_no}  %{m.group(1)} "
                f"not declared unique in {tscn.name}"
            )
    return problems, [f"{count} %Name references resolve"]


# --- 2. EventBus signal arity + dead signals -----------------------------------


def check_signal_arity() -> tuple[list[str], list[str]]:
    bus = (ROOT / "scripts/managers/event_bus.gd").read_text()
    sig: dict[str, int] = {}
    for m in re.finditer(r"^signal (\w+)\s*(?:\(([^)]*)\))?", bus, re.M):
        params = (m.group(2) or "").strip()
        sig[m.group(1)] = len([p for p in params.split(",") if p.strip()]) if params else 0

    problems: list[str] = []
    for gd in scripts():
        src = gd.read_text()
        funcs = func_params(src)
        for m in re.finditer(r"EventBus\.(\w+)\.connect\(\s*([^)\n]+?)\s*\)", src):
            name, target = m.group(1), m.group(2).strip()
            line = src[: m.start()].count("\n") + 1
            where = f"{gd.relative_to(ROOT)}:{line}"
            if name not in sig:
                problems.append(f"{where}  EventBus.{name} — no such signal")
                continue
            arity = sig[name]
            lam = re.match(r"func\s*\(([^)]*)\)", target)
            if lam:
                parts = [p for p in lam.group(1).split(",") if p.strip()]
                if len(parts) != arity:
                    problems.append(
                        f"{where}  {name} emits {arity} arg(s), lambda takes {len(parts)}"
                    )
                continue
            if ".bind(" in target:
                continue  # .bind() supplies trailing args; arity varies legitimately
            fname = target.split(".")[-1]
            if fname not in funcs:
                continue  # defined elsewhere or a builtin
            req, total = funcs[fname]
            if arity < req or arity > total:
                problems.append(
                    f"{where}  {name} emits {arity} arg(s), {fname}() takes {req}..{total}"
                )

    all_src = "\n".join(p.read_text() for p in scripts())
    never = sorted(s for s in sig if f"{s}.emit(" not in all_src)
    if never:
        problems.append("never emitted (dead signals): " + ", ".join(never))
    return problems, [f"{len(sig)} signals scanned"]


# --- 3. connected handlers exist ----------------------------------------------


def check_handlers() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    count = 0
    connect = re.compile(r"\.connect\(\s*([A-Za-z_]\w*)\s*[,)]")
    bound = re.compile(r"\.connect\(\s*([A-Za-z_]\w*)\.bind\(")
    for gd in scripts():
        text = gd.read_text()
        body = COMMENT.sub("", strip_strings(text))
        local = func_params(text)
        for m in list(connect.finditer(body)) + list(bound.finditer(body)):
            name = m.group(1)
            # Only bare local method references; `.connect(other.queue_free)`
            # names a method on another object and cannot be resolved here.
            if not name.startswith("_") and name not in local:
                continue
            count += 1
            if name not in local:
                line = body[: m.start()].count("\n") + 1
                problems.append(
                    f"{gd.relative_to(ROOT)}:{line}  connects to {name}(), "
                    f"which this script does not define"
                )
    return problems, [f"{count} local signal connections"]


# --- 4. literal res:// paths --------------------------------------------------


def check_script_paths() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    files = dirs = 0
    for gd in scripts():
        src = gd.read_text()
        for m in re.finditer(r'"(res://[^"]+)"', src):
            path = m.group(1)
            line = src[: m.start()].count("\n") + 1
            target = ROOT / path.removeprefix("res://")
            if re.search(r"\.\w+$", path):
                files += 1
                if not target.exists():
                    problems.append(f"{gd.relative_to(ROOT)}:{line}  missing: {path}")
            elif re.fullmatch(r"res://[\w/]+", path):
                dirs += 1
                if not target.is_dir():
                    problems.append(f"{gd.relative_to(ROOT)}:{line}  not a directory: {path}")
    return problems, [f"{files} file paths, {dirs} directory paths"]


# --- 5. autoload load order ---------------------------------------------------


def check_load_order() -> tuple[list[str], list[str]]:
    order: list[str] = []
    paths: dict[str, pathlib.Path] = {}
    for line in (ROOT / "project.godot").read_text().splitlines():
        m = re.match(r'^(\w+)="\*(res://[^"]+)"$', line.strip())
        if m:
            order.append(m.group(1))
            paths[m.group(1)] = ROOT / m.group(2).removeprefix("res://")
    rank = {name: i for i, name in enumerate(order)}

    problems: list[str] = []
    for name in order:
        src = paths[name].read_text()
        m = re.search(r"^func _ready\(\).*?(?=^func |\Z)", src, re.M | re.S)
        if not m:
            continue
        body = m.group(0)
        for other in order:
            if rank[other] <= rank[name]:
                continue
            for hit in re.finditer(rf"\b{other}\.(\w+)", body):
                line = body[: hit.start()].count("\n") + 1
                ctx = body.splitlines()[line - 1].strip()
                # Connecting to a later autoload's SIGNAL is fine: the object
                # exists, only its _ready() has not run yet.
                if f"{other}.{hit.group(1)}.connect" in ctx:
                    continue
                problems.append(
                    f"{paths[name].relative_to(ROOT)} _ready(): reads "
                    f"{other}.{hit.group(1)} (declared "
                    f"{rank[other] - rank[name]} slot(s) later)\n      {ctx}"
                )
    return problems, [f"{len(order)} autoloads in declaration order"]


CHECKS = [
    ("unique names", check_unique_names),
    ("signal arity", check_signal_arity),
    ("handler existence", check_handlers),
    ("res:// literals", check_script_paths),
    ("autoload load order", check_load_order),
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
