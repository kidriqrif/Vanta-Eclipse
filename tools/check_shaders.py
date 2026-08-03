#!/usr/bin/env python3
"""Contracts for .gdshader files and the materials that drive them.

Shaders were the one unchecked corner of this project: gdparse and gdlint read
GDScript, check_data reads .tres, and nothing at all read a .gdshader. A shader
compiles at load time inside the engine, so a typo there is invisible until the
screen renders — and a MATERIAL typo is worse, because a shader_parameter that
names no uniform is silently discarded and the knob simply does nothing.

  1. structure      — shader_type is declared first, and braces/parens balance.
  2. live uniforms  — every uniform is referenced in the shader body. A uniform
                      nothing reads is a tuning knob wired to nothing.
  3. material keys  — every shader_parameter/<name> in a .tscn/.tres names a
                      uniform the referenced shader actually declares.
  4. runtime keys   — every set_shader_parameter("name") in GDScript names a
                      uniform some shader declares. This is the one that bites:
                      it fails silently and at runtime.

These are static checks, not a compiler. They catch the mistakes that survive
review; they cannot prove a shader compiles.
"""

import pathlib
import re
import sys

from _tree import glob, rglob

ROOT = pathlib.Path(__file__).resolve().parent.parent

LINE_COMMENT = re.compile(r"//[^\n]*")
BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
UNIFORM = re.compile(r"^\s*uniform\s+\w+\s+(\w+)", re.M)
SHADER_TYPE = re.compile(r"^\s*shader_type\s+\w+\s*;", re.M)
# shader = ExtResource("3")  /  shader = SubResource("Shader_x")
EXT_SHADER = re.compile(r'\[ext_resource type="Shader" path="([^"]+)" id="([^"]+)"\]')
PARAM_KEY = re.compile(r"^shader_parameter/(\w+)", re.M)
SET_PARAM = re.compile(r'set_shader_parameter\(\s*&?"(\w+)"')


def strip_comments(text: str) -> str:
    return LINE_COMMENT.sub("", BLOCK_COMMENT.sub("", text))


def shaders() -> list[pathlib.Path]:
    return rglob(ROOT, "*.gdshader")


def uniforms_of(path: pathlib.Path) -> set[str]:
    return set(UNIFORM.findall(strip_comments(path.read_text(encoding="utf-8"))))


def check_structure() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    count = 0
    for shader in shaders():
        count += 1
        raw = shader.read_text(encoding="utf-8")
        body = strip_comments(raw)
        rel = shader.relative_to(ROOT)

        match = SHADER_TYPE.search(body)
        if not match:
            problems.append(f"{rel}: no shader_type declaration")
        elif body[: match.start()].strip():
            problems.append(f"{rel}: shader_type must be the first statement")

        for open_ch, close_ch in [("{", "}"), ("(", ")"), ("[", "]")]:
            if body.count(open_ch) != body.count(close_ch):
                problems.append(
                    f"{rel}: unbalanced {open_ch}{close_ch} "
                    f"({body.count(open_ch)} vs {body.count(close_ch)})"
                )
    return problems, [f"{count} shaders"]


def check_live_uniforms() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    total = 0
    for shader in shaders():
        body = strip_comments(shader.read_text(encoding="utf-8"))
        rel = shader.relative_to(ROOT)
        # Everything after the last uniform declaration is the executable part.
        declarations = list(UNIFORM.finditer(body))
        for match in declarations:
            total += 1
            name = match.group(1)
            after = body[match.end():]
            if not re.search(rf"\b{re.escape(name)}\b", after):
                problems.append(f"{rel}: uniform '{name}' is never read")
    return problems, [f"{total} uniforms"]


def check_material_keys() -> tuple[list[str], list[str]]:
    problems: list[str] = []
    checked = 0
    for scene in rglob(ROOT, "*.tscn") + rglob(ROOT, "*.tres"):
        text = scene.read_text(encoding="utf-8")
        params = PARAM_KEY.findall(text)
        if not params:
            continue
        declared: set[str] = set()
        for path, _ident in EXT_SHADER.findall(text):
            target = ROOT / path.replace("res://", "")
            if target.exists():
                declared |= uniforms_of(target)
        if not declared:
            # Material points at a shader we could not resolve; the key check
            # would produce noise rather than signal.
            continue
        rel = scene.relative_to(ROOT)
        for name in params:
            checked += 1
            if name not in declared:
                problems.append(
                    f"{rel}: shader_parameter/{name} matches no uniform in the "
                    f"referenced shader"
                )
    return problems, [f"{checked} material parameters"]


def check_runtime_keys() -> tuple[list[str], list[str]]:
    known: set[str] = set()
    for shader in shaders():
        known |= uniforms_of(shader)

    problems: list[str] = []
    checked = 0
    for gd in rglob(ROOT, "scripts/**/*.gd"):
        body = strip_comments_gd(gd.read_text(encoding="utf-8"))
        for name in SET_PARAM.findall(body):
            checked += 1
            if name not in known:
                problems.append(
                    f"{gd.relative_to(ROOT)}: set_shader_parameter(\"{name}\") "
                    f"matches no uniform in any shader"
                )
    return problems, [f"{checked} runtime parameter writes"]


def strip_comments_gd(text: str) -> str:
    return re.sub(r"#[^\n]*", "", text)


CHECKS = [
    ("shader structure", check_structure),
    ("uniforms are read", check_live_uniforms),
    ("material parameters resolve", check_material_keys),
    ("runtime parameters resolve", check_runtime_keys),
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
