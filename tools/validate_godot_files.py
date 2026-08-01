#!/usr/bin/env python3
"""Sanity-check Godot .tscn/.tres files and project.godot without Godot.

Checks:
  * load_steps == ext_resource + sub_resource count + 1
  * every ext_resource path exists on disk
  * every ExtResource("id") / SubResource("id") reference is defined
  * every node's parent path refers to a previously declared node
  * project.godot: main scene, icon, autoloads, bus layout files exist
"""
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
errors = []


def res_path(res: str) -> Path:
    return ROOT / res.replace("res://", "")


def check_scene_or_resource(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT)

    header = re.match(r"\[gd_(scene|resource)[^\]]*?format=3", text)
    steps_match = re.search(r"load_steps=(\d+)", text.split("\n", 1)[0])
    if not header:
        errors.append(f"{rel}: missing/invalid gd_scene|gd_resource format=3 header")
        return

    ext_resources = re.findall(r'\[ext_resource type="[^"]+" path="([^"]+)" id="([^"]+)"\]', text)
    sub_resources = re.findall(r'\[sub_resource type="[^"]+" id="([^"]+)"\]', text)

    declared_steps = int(steps_match.group(1)) if steps_match else 1
    actual_steps = len(ext_resources) + len(sub_resources) + 1
    if declared_steps != actual_steps:
        errors.append(f"{rel}: load_steps={declared_steps} but should be {actual_steps}")

    ext_ids = set()
    for res, rid in ext_resources:
        ext_ids.add(rid)
        if not res_path(res).exists():
            errors.append(f"{rel}: ext_resource missing on disk: {res}")

    sub_ids = set(sub_resources)

    for rid in re.findall(r'ExtResource\("([^"]+)"\)', text):
        if rid not in ext_ids:
            errors.append(f'{rel}: ExtResource("{rid}") is not declared')
    for rid in re.findall(r'SubResource\("([^"]+)"\)', text):
        if rid not in sub_ids:
            errors.append(f'{rel}: SubResource("{rid}") is not declared')

    # The other direction: a sub_resource nothing references. Godot does not
    # complain — it loads the orphan, uses it nowhere, and the node silently
    # falls back to an engine default that can look plausible. This is how a
    # theme rewrite dropped all five Button/styles/* lines while still
    # rendering buttons: they were Godot's defaults, not the ones defined
    # right there in the file.
    referenced = set(re.findall(r'SubResource\("([^"]+)"\)', text))
    for rid in sub_resources:
        if rid not in referenced:
            errors.append(f'{rel}: sub_resource "{rid}" is declared but never referenced')

    # Node tree consistency (scenes only).
    nodes = re.findall(r'\[node name="([^"]+)" type="[^"]+"(?: parent="([^"]*)")?\]', text)
    known_paths = set()
    for name, parent in nodes:
        if parent is None or parent == "":
            if "[gd_scene" in text and parent is None:
                known_paths.add(".")  # root
            continue
        if parent == ".":
            node_path = name
        else:
            if parent not in known_paths:
                errors.append(f"{rel}: node '{name}' has unknown parent '{parent}'")
            node_path = f"{parent}/{name}"
        known_paths.add(node_path)


def check_project_godot() -> None:
    text = (ROOT / "project.godot").read_text(encoding="utf-8")
    for key in ("run/main_scene", "config/icon", "buses/default_bus_layout"):
        m = re.search(rf'{re.escape(key)}="(res://[^"]+)"', text)
        if m and not res_path(m.group(1)).exists():
            errors.append(f"project.godot: {key} file missing: {m.group(1)}")
    for m in re.finditer(r'^\w+="\*?(res://[^"]+)"$', text, re.MULTILINE):
        if not res_path(m.group(1)).exists():
            errors.append(f"project.godot: autoload script missing: {m.group(1)}")


check_project_godot()
for f in sorted(ROOT.rglob("*.tscn")) + sorted(ROOT.rglob("*.tres")):
    check_scene_or_resource(f)

if errors:
    print("\n".join(errors))
    sys.exit(1)
print("All Godot files validated OK")
