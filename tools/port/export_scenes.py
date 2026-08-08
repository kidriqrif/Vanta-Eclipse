#!/usr/bin/env python3
"""Lift the 32 screens out of Godot as engine-neutral layout trees.

Reads `scenes/**/*.tscn` and writes one JSON file per screen describing its
node tree: type, name, anchors, layout hints, text, and which script was
attached. `SceneBuilder.cs` turns each tree into a real Unity scene.

Same split as the data port, for the same reason: parsing is verifiable here
with Python, and scene construction needs the editor. Doing both in one step
would mean neither could be checked.

This tool is TEMPORARY. It reads .tscn, so it dies with the Godot tree — that
is the point. Run it, build the scenes, then delete it along with scenes/.

Run from the repository root:  python tools/port/export_scenes.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCENE_DIR = ROOT / "scenes"
OUT_DIR = ROOT / "Assets" / "Editor" / "PortedScenes"

# Godot Control type -> what SceneBuilder should make. Anything absent is
# reported rather than silently dropped, so a screen cannot lose a node without
# the run saying so.
TYPE_MAP = {
    "Control": "Control",
    "Label": "Label",
    "Button": "Button",
    "VBoxContainer": "VBox",
    "HBoxContainer": "HBox",
    "GridContainer": "Grid",
    "MarginContainer": "Margin",
    "PanelContainer": "Panel",
    "Panel": "Panel",
    "ScrollContainer": "Scroll",
    "TextureRect": "Texture",
    "ColorRect": "ColorRect",
    "HSlider": "Slider",
    "ProgressBar": "ProgressBar",
    "CheckButton": "Toggle",
    "CanvasLayer": "CanvasLayer",
    # Deliberately dropped: a Godot 2D particle emitter has no UGUI analogue,
    # and the two places it appears are decorative. Rebuilt natively later.
    "CPUParticles2D": None,
}

# Godot anchors_preset -> (anchorMin, anchorMax) in Unity's 0..1 space.
# Only the presets the project actually uses are listed; an unknown one is
# reported rather than guessed, because guessing an anchor silently moves UI.
ANCHOR_PRESETS = {
    0:  ((0.0, 1.0), (0.0, 1.0)),   # top-left
    1:  ((0.0, 1.0), (0.0, 1.0)),   # top-right (offsets carry the rest)
    3:  ((1.0, 0.0), (1.0, 0.0)),   # bottom-right
    4:  ((0.0, 0.0), (0.0, 1.0)),   # center-left
    5:  ((1.0, 0.5), (1.0, 0.5)),   # center-top
    6:  ((1.0, 0.5), (1.0, 0.5)),   # center-right
    7:  ((0.5, 0.0), (0.5, 0.0)),   # center-bottom
    8:  ((0.5, 0.5), (0.5, 0.5)),   # center
    9:  ((0.0, 0.0), (0.0, 1.0)),   # left wide
    10: ((0.0, 1.0), (1.0, 1.0)),   # top wide
    11: ((1.0, 0.0), (1.0, 1.0)),   # right wide
    12: ((0.0, 0.0), (1.0, 0.0)),   # bottom wide
    13: ((0.5, 0.0), (0.5, 1.0)),   # vcenter wide
    14: ((0.0, 0.5), (1.0, 0.5)),   # hcenter wide
    15: ((0.0, 0.0), (1.0, 1.0)),   # full rect
}

# Godot size flags: 1 = fill, 2 = expand, 3 = fill|expand, 4 = shrink center.
SIZE_FLAG_EXPAND = 2


def parse_value(raw: str, ext: dict[str, dict]):
    raw = raw.strip()

    m = re.fullmatch(r'ExtResource\("([^"]+)"\)', raw)
    if m:
        return {"_ext": ext.get(m.group(1), {})}

    m = re.fullmatch(r"Vector2\(([^)]*)\)", raw)
    if m:
        x, y = (float(p) for p in m.group(1).split(","))
        return {"x": x, "y": y}

    m = re.fullmatch(r"Color\(([^)]*)\)", raw)
    if m:
        parts = [float(p) for p in m.group(1).split(",")]
        while len(parts) < 4:
            parts.append(1.0)
        return {"r": parts[0], "g": parts[1], "b": parts[2], "a": parts[3]}

    if raw.startswith("&"):
        return raw[1:].strip().strip('"')
    if raw.startswith('"'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw.strip('"')
    if raw in ("true", "false"):
        return raw == "true"

    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        pass
    return raw


def parse_scene(path: Path, unmapped: set[str], unknown_presets: set[int]) -> dict:
    text = path.read_text(encoding="utf-8")

    ext: dict[str, dict] = {}
    for m in re.finditer(
        r'\[ext_resource type="([^"]+)"(?: uid="[^"]*")? path="([^"]+)" id="([^"]+)"\]', text
    ):
        ext[m.group(3)] = {"type": m.group(1), "path": m.group(2)}

    nodes: list[dict] = []
    # Split on [node ...] headers, keeping the header with its body.
    chunks = re.split(r"\n(?=\[node )", text)
    for chunk in chunks:
        header = re.match(
            r'\[node name="([^"]+)"(?: type="([^"]+)")?(?: parent="([^"]+)")?'
            r'(?: instance=ExtResource\("([^"]+)"\))?[^\]]*\]',
            chunk,
        )
        if not header:
            continue
        name, gd_type, parent, instance = header.groups()

        props: dict = {}
        body = chunk[header.end():]
        for line in body.splitlines():
            m = re.match(r"^([\w/]+)\s*=\s*(.+)$", line)
            if m:
                props[m.group(1)] = parse_value(m.group(2), ext)

        # An instanced sub-scene (VoidBackground, etc.) — record the reference
        # so SceneBuilder can nest the built prefab.
        if instance is not None:
            nodes.append({
                "name": name,
                "kind": "Instance",
                "parent": parent,
                "instance": ext.get(instance, {}).get("path", ""),
            })
            continue

        if gd_type is None:
            continue
        kind = TYPE_MAP.get(gd_type, "MISSING")
        if kind == "MISSING":
            unmapped.add(gd_type)
            continue
        if kind is None:
            continue  # deliberately dropped

        node = {"name": name, "kind": kind, "parent": parent}
        translate(node, props, unknown_presets)
        nodes.append(node)

    return {
        "source": str(path.relative_to(ROOT)).replace("\\", "/"),
        "name": path.stem,
        "nodes": nodes,
    }


def translate(node: dict, props: dict, unknown_presets: set[int]) -> None:
    """Turn Godot Control properties into the neutral fields SceneBuilder reads."""

    preset = props.get("anchors_preset")
    if isinstance(preset, int):
        if preset in ANCHOR_PRESETS:
            (amin, amax) = ANCHOR_PRESETS[preset]
            node["anchorMin"] = {"x": amin[0], "y": amin[1]}
            node["anchorMax"] = {"x": amax[0], "y": amax[1]}
        else:
            unknown_presets.add(preset)

    # Explicit anchors override the preset. Godot's Y axis runs downward and
    # Unity's runs upward, so top/bottom swap AND invert.
    if any(k in props for k in ("anchor_left", "anchor_right", "anchor_top", "anchor_bottom")):
        left = float(props.get("anchor_left", 0.0))
        right = float(props.get("anchor_right", 0.0))
        top = float(props.get("anchor_top", 0.0))
        bottom = float(props.get("anchor_bottom", 0.0))
        node["anchorMin"] = {"x": left, "y": 1.0 - bottom}
        node["anchorMax"] = {"x": right, "y": 1.0 - top}

    if any(k in props for k in ("offset_left", "offset_right", "offset_top", "offset_bottom")):
        node["offset"] = {
            "left": float(props.get("offset_left", 0.0)),
            "right": float(props.get("offset_right", 0.0)),
            "top": float(props.get("offset_top", 0.0)),
            "bottom": float(props.get("offset_bottom", 0.0)),
        }

    size = props.get("custom_minimum_size")
    if isinstance(size, dict) and ("x" in size):
        node["minSize"] = size

    for axis, key in (("h", "size_flags_horizontal"), ("v", "size_flags_vertical")):
        flag = props.get(key)
        if isinstance(flag, int) and flag & SIZE_FLAG_EXPAND:
            node[f"expand{axis.upper()}"] = True

    if "theme_override_constants/separation" in props:
        node["spacing"] = float(props["theme_override_constants/separation"])

    margins = {
        side: float(props[f"theme_override_constants/margin_{side}"])
        for side in ("left", "top", "right", "bottom")
        if f"theme_override_constants/margin_{side}" in props
    }
    if margins:
        node["padding"] = margins

    if "text" in props:
        node["text"] = props["text"]
    if "theme_override_font_sizes/font_size" in props:
        node["fontSize"] = int(props["theme_override_font_sizes/font_size"])
    if "theme_type_variation" in props:
        node["style"] = props["theme_type_variation"]
    if "horizontal_alignment" in props:
        node["hAlign"] = int(props["horizontal_alignment"])
    if "vertical_alignment" in props:
        node["vAlign"] = int(props["vertical_alignment"])
    if "alignment" in props:
        node["align"] = int(props["alignment"])
    if props.get("visible") is False:
        node["hidden"] = True
    if props.get("unique_name_in_owner") is True:
        node["unique"] = True
    if "columns" in props:
        node["columns"] = int(props["columns"])
    if "color" in props and isinstance(props["color"], dict):
        node["color"] = props["color"]

    texture = props.get("texture")
    if isinstance(texture, dict) and texture.get("_ext"):
        node["sprite"] = texture["_ext"].get("path", "")

    script = props.get("script")
    if isinstance(script, dict) and script.get("_ext"):
        node["script"] = script["_ext"].get("path", "")


def main() -> int:
    if not SCENE_DIR.is_dir():
        print(f"error: {SCENE_DIR} not found", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    unmapped: set[str] = set()
    unknown_presets: set[int] = set()

    scenes = sorted(SCENE_DIR.rglob("*.tscn"))
    total_nodes = 0
    for path in scenes:
        scene = parse_scene(path, unmapped, unknown_presets)
        total_nodes += len(scene["nodes"])
        out = OUT_DIR / f"{path.stem}.json"
        out.write_text(json.dumps(scene, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  {path.stem:26s} {len(scene['nodes']):3d} nodes")

    print(f"\n{len(scenes)} scenes, {total_nodes} nodes -> {OUT_DIR.relative_to(ROOT)}")

    failed = False
    if unmapped:
        print(f"\nUNMAPPED node types (would be dropped): {sorted(unmapped)}", file=sys.stderr)
        failed = True
    if unknown_presets:
        print(f"UNKNOWN anchor presets: {sorted(unknown_presets)}", file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
