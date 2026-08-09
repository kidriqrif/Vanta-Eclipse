#!/usr/bin/env python3
"""Static invariants of the Unity project that the C# compiler cannot catch.

This replaces four GDScript parsers — check_scripts, check_autoload_calls,
check_architecture and check_wiring — that existed because GDScript resolves
names at runtime. A misspelled autoload member, a signal connected with the
wrong arity, a manager calling a method that no longer existed: all of those
were silent in Godot until the line ran, so they had to be found by reading the
source. In C# every one of them is a compile error, and `Unity -batchmode`
is a stricter and more honest version of those four checks than any parser
written here could be.

What is left is the class of mistake that still compiles cleanly and still
ships broken, because it is a STRING resolved at runtime:

    1. Palette closure   a raw colour outside VantaTheme escapes the 16
    2. Glyph box         a font size that is not a multiple of 9 resamples
    3. Screen names      Scenes.X with no scene, or none in Build Settings
    4. Prefab names      UIPrefabs.Spawn("X") with no X.prefab
    5. Sprite names      UISprites.Get("x/y") with no such file
    6. Content integrity every .asset resolves its script and its sprites

Every one of these fails at runtime as a warning in a log nobody reads and a
blank space on the screen.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "Assets" / "Scripts"
EDITOR = ROOT / "Assets" / "Editor"
RESOURCES = ROOT / "Assets" / "Resources"
SCENES = ROOT / "Assets" / "Scenes"

GLYPH_BOX = 9

# Files allowed to name a colour directly.
#
#   VantaTheme        IS the palette.
#   Assets/Scripts/Data  generated field defaults, transcribed from the content
#                        and overridden by every asset that uses them — a
#                        literal there is data, not a design decision.
#   the two readers   turn a serialized r/g/b/a back into a Color. Rejecting
#                     that would mean the palette rule bans deserialization.
PALETTE_EXEMPT = {"VantaTheme.cs", "DefinitionImporter.cs", "SceneBuilder.cs"}
PALETTE_EXEMPT_DIRS = ("Assets/Scripts/Data",)

COLOR_LITERAL = re.compile(r"\bnew\s+Color\s*\(|(?<![\w.])Color\s*\(\s*\d")
HEX_LITERAL = re.compile(r'Hex\(\s*"([0-9A-Fa-f]{6})"\s*\)')

FONT_SIZE = re.compile(r"\bfontSize\s*=\s*(\d+)")
LABEL_SIZE = re.compile(r"UIBuild\.Label\([^;]*?,\s*(\d+)\s*,", re.S)
SNAPPED = re.compile(r"SnapFontSize\(")

SCENES_CONST = re.compile(r'public\s+const\s+string\s+\w+\s*=\s*"([^"]+)"')
SPAWN_BY_NAME = re.compile(r'UIPrefabs\.Spawn(?:<\w+>)?\(\s*"([^"]+)"')
SPAWN_BY_TYPE = re.compile(r"UIPrefabs\.Spawn<(\w+)>\(")
SPRITE_GET = re.compile(r'UISprites\.Get\(\s*"([^"]+)"')
SPRITE_ARRAY = re.compile(r'"(minigames/[a-z_]+|ui/[a-z_]+)"')


def cs_files(root: pathlib.Path):
    return sorted(root.rglob("*.cs")) if root.exists() else []


def rel(path: pathlib.Path) -> str:
    return path.relative_to(ROOT).as_posix()


def check_palette() -> list[str]:
    """No raw colour outside VantaTheme.

    THE PALETTE IS CLOSED. Sixteen colours, no sixteen-and-a-halves. A screen
    that writes its own Color(...) is how a restyle half-applies: the theme
    changes and that one literal silently keeps the old value.
    """
    problems = []
    for path in cs_files(SCRIPTS) + cs_files(EDITOR):
        if path.name in PALETTE_EXEMPT:
            continue
        if rel(path).startswith(PALETTE_EXEMPT_DIRS):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            stripped = line.lstrip()
            if stripped.startswith(("//", "///", "*", "/*")):
                continue
            if COLOR_LITERAL.search(line):
                problems.append(
                    f"{rel(path)}:{number}: a colour literal outside VantaTheme — "
                    f"use a palette name.\n        {stripped}"
                )
    return problems


def check_font_sizes() -> list[str]:
    """Every rendered size is a whole multiple of the 9px glyph box.

    A bitmap face asked for a size that is not a whole multiple gets resampled,
    and resampling is exactly what pixel art exists to avoid. It is invisible
    in the editor at desktop scale and obvious on a phone.
    """
    problems = []
    for path in cs_files(SCRIPTS) + cs_files(EDITOR):
        text = path.read_text(encoding="utf-8")
        for pattern in (FONT_SIZE, LABEL_SIZE):
            for match in pattern.finditer(text):
                size = int(match.group(1))
                if size % GLYPH_BOX == 0:
                    continue
                # A size handed to SnapFontSize is rounded onto the grid on the
                # way through, which is the sanctioned escape.
                window = text[max(0, match.start() - 60):match.end() + 20]
                if SNAPPED.search(window):
                    continue
                line = text[:match.start()].count("\n") + 1
                problems.append(
                    f"{rel(path)}:{line}: font size {size} is not a multiple of "
                    f"{GLYPH_BOX} and is not snapped"
                )
    return problems


def check_scene_names() -> list[str]:
    """Every Scenes.X names a real scene, and every scene is in Build Settings."""
    problems = []
    scenes_cs = SCRIPTS / "Core" / "Scenes.cs"
    if not scenes_cs.exists():
        return [f"{rel(scenes_cs)}: missing"]

    declared = set(SCENES_CONST.findall(scenes_cs.read_text(encoding="utf-8")))
    on_disk = {p.stem for p in SCENES.glob("*.unity")} if SCENES.exists() else set()

    for name in sorted(declared - on_disk):
        problems.append(f"Scenes.cs names '{name}' but Assets/Scenes/{name}.unity does not exist")
    for name in sorted(on_disk - declared):
        problems.append(f"Assets/Scenes/{name}.unity exists but Scenes.cs does not name it")

    settings = ROOT / "ProjectSettings" / "EditorBuildSettings.asset"
    if settings.exists():
        registered = set(re.findall(r"Assets/Scenes/([\w]+)\.unity",
                                    settings.read_text(encoding="utf-8")))
        for name in sorted(on_disk - registered):
            problems.append(
                f"Assets/Scenes/{name}.unity is not in Build Settings — "
                "ChangeScene to it fails in a player build"
            )
    return problems


def check_prefab_names() -> list[str]:
    """Every UIPrefabs.Spawn resolves to a prefab under Resources/Prefabs."""
    prefabs = RESOURCES / "Prefabs"
    have = {p.stem for p in prefabs.glob("*.prefab")} if prefabs.exists() else set()
    problems = []
    for path in cs_files(SCRIPTS):
        text = path.read_text(encoding="utf-8")
        for name in set(SPAWN_BY_NAME.findall(text)) | set(SPAWN_BY_TYPE.findall(text)):
            if name not in have:
                problems.append(
                    f"{rel(path)}: spawns '{name}' but "
                    f"Assets/Resources/Prefabs/{name}.prefab does not exist"
                )
    # A minigame is chosen by data, so its prefab name comes from a definition
    # rather than from any call site.
    definitions = RESOURCES / "Content" / "MinigameDefinition"
    for path in sorted(definitions.glob("*.asset")) if definitions.exists() else []:
        match = re.search(r"scenePath:\s*(\S+)", path.read_text(encoding="utf-8"))
        if not match:
            continue
        stem = pathlib.PurePosixPath(match.group(1)).stem
        name = "".join(part[:1].upper() + part[1:] for part in stem.split("_") if part)
        if name not in have:
            problems.append(
                f"{rel(path)}: names board '{name}' but "
                f"Assets/Resources/Prefabs/{name}.prefab does not exist"
            )
    return problems


def check_sprite_names() -> list[str]:
    """Every UISprites path resolves to a file under Resources/Art."""
    art = RESOURCES / "Art"
    have = {p.relative_to(art).with_suffix("").as_posix()
            for p in art.rglob("*.png")} if art.exists() else set()
    problems = []
    sprites_cs = SCRIPTS / "UI" / "UISprites.cs"
    if not sprites_cs.exists():
        return [f"{rel(sprites_cs)}: missing"]

    text = sprites_cs.read_text(encoding="utf-8")
    wanted = set(SPRITE_GET.findall(text)) | set(SPRITE_ARRAY.findall(text))
    for name in sorted(wanted - have):
        problems.append(
            f"UISprites names '{name}' but Assets/Resources/Art/{name}.png does not exist"
        )
    return problems


def check_content() -> list[str]:
    """Every content asset resolves its script and its sprite references."""
    content = RESOURCES / "Content"
    if not content.exists():
        return ["Assets/Resources/Content: missing — run the definition importer"]

    guids = {}
    for meta in ROOT.joinpath("Assets").rglob("*.meta"):
        match = re.search(r"^guid:\s*([0-9a-f]{32})", meta.read_text(encoding="utf-8"), re.M)
        if match:
            guids[match.group(1)] = meta.with_suffix("")

    problems = []
    count = 0
    for path in sorted(content.rglob("*.asset")):
        count += 1
        text = path.read_text(encoding="utf-8")
        for guid in re.findall(r"guid:\s*([0-9a-f]{32})", text):
            if guid not in guids:
                problems.append(
                    f"{rel(path)}: references guid {guid}, which no asset in the "
                    "project claims — the reference is broken"
                )
    if count == 0:
        problems.append("Assets/Resources/Content: no definitions found")
    return problems


CHECKS = [
    ("palette closure", check_palette),
    ("glyph-box font sizes", check_font_sizes),
    ("screen names", check_scene_names),
    ("prefab names", check_prefab_names),
    ("sprite names", check_sprite_names),
    ("content integrity", check_content),
]


def main() -> int:
    status = 0
    for label, check in CHECKS:
        problems = check()
        if problems:
            status = 1
            print(f"{label}: FAIL ({len(problems)})")
            for problem in problems:
                print(f"    {problem}")
        else:
            print(f"{label}: OK")
    return status


if __name__ == "__main__":
    sys.exit(main())
