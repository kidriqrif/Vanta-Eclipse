"""Which parts of the tree are this project's source, and which are generated.

Installing the Android build template put a COPY of the entire project inside
`android/build/assetPackInstallTime/src/main/assets/` — every scene, script,
sprite, shader and definition, duplicated. Any checker that walks from the
repository root therefore sees two of everything.

Double-counting is the mild half. The dangerous half is that the copy is a
snapshot from whenever the last export ran: edit a scene, and the checkers
start comparing your new file against a stale twin sitting beside it, and
report a conflict in a file you have never opened. `check_shaders.py` reported
"4 shaders" for a project that has two — that was the warning.

`.godot/` (import cache), `build/` (artifacts) and `.godot-shots/`
(screenshots) are excluded for the same reason: generated, not authored.

Import from any tool in this directory:

    from _tree import rglob, glob
    for gd in rglob(ROOT, "*.gd"):
        ...
"""

import pathlib

GENERATED = {"android", ".godot", ".godot-shots", "build", ".git", "__pycache__"}


def is_source(path: pathlib.Path, root: pathlib.Path) -> bool:
    """True if `path` is authored source rather than something a build made."""
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        # Outside the root entirely — not ours to judge.
        return True
    return GENERATED.isdisjoint(parts)


def rglob(root: pathlib.Path, pattern: str) -> list[pathlib.Path]:
    return sorted(p for p in root.rglob(pattern) if is_source(p, root))


def glob(root: pathlib.Path, pattern: str) -> list[pathlib.Path]:
    return sorted(p for p in root.glob(pattern) if is_source(p, root))
