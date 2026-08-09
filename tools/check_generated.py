#!/usr/bin/env python3
"""Every shipped asset is byte-identical to what its generator produces now.

WHAT THIS ACTUALLY GUARANTEES

"Art is generated, not drawn" is the load-bearing claim of this project's
asset pipeline — it is why a palette change is one edit and one command instead
of 53 files reopened. But nothing was checking that the files on disk were
still the generators' output. The claim was true when each generator last ran
and decayed silently from there.

Three things break it, none of which any other check can see:

  * a hand-edited asset. Someone nudges two pixels in a PNG. It looks right,
    it ships, and it reverts the moment anyone regenerates.
  * a generator edited without being re-run. The source of truth says one
    thing and the shipped bytes say another; whichever you read is wrong.
  * a stale asset from before a generator change — the pre-revamp file that
    nobody deleted because nothing pointed at it any more.

The last one is what this project actually hit: a full art revamp left the
store screenshots, the theme's font sizes and 45 corner radii on their previous
values, all of which read as finished work.

HOW

Each generator is re-run with its output constant pointed at a temp directory,
and the result is hashed against the repository. This depends on generation
being DETERMINISTIC, which it already is by design — make_audio.py seeds its
RNG with a fixed constant for exactly this reason, and everything else is
straight-line drawing code. A generator that stopped being reproducible would
fail here, which is also worth knowing.

Orphans are reported too: a file in the asset directory that no generator
writes is either dead weight or the last survivor of a deleted feature.

This is the slowest check in the sweep at a few seconds, which buys a
guarantee no static scan can offer — that the bytes in the bundle and the code
that claims to produce them are the same thing.
"""

import contextlib
import hashlib
import io
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (module, {output constant: repository directory it writes}, file suffixes)
#
# icon.png is written to make_icons.ROOT rather than to its ICONS directory, so
# that module gets both constants redirected and is compared by basename.
GENERATORS = [
    ("make_sprites", {"OUT": "Assets/Resources/Art"}, (".png",)),
    ("make_audio", {"SFX_DIR": "Assets/Resources/Audio/sfx",
                    "MUSIC_DIR": "Assets/Resources/Audio/music"}, (".wav",)),
    ("make_font", {"OUT": "Assets/Resources/Fonts"}, (".png", ".fnt")),
    ("make_icons", {"ICONS": "production/icons", "LAUNCHER": "Assets/Icons"}, (".png",)),
]


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def run(name: str, mapping: dict[str, str], suffixes: tuple[str, ...]
        ) -> tuple[list[str], int]:
    """Regenerate into a sandbox; return (problems, files compared)."""
    module = __import__(name)
    sandbox = pathlib.Path(tempfile.mkdtemp(prefix=f"vanta_{name}_"))

    # Repository files this generator is responsible for, keyed by basename.
    # Basename is enough: no generator writes two files with the same name.
    #
    # rglob, not glob: make_sprites.py writes into sprites/enemies/,
    # sprites/ui/ and so on, so a top-level glob finds nothing but directories
    # and every sprite reports as "the generator produced a file the repo does
    # not have" — a stack of wrong findings from a check that never compared
    # anything. The zero-comparison guard in main() is what caught it.
    live: dict[str, pathlib.Path] = {}
    for target in mapping.values():
        if target == ".":
            # The repository root contributes only the files sitting directly
            # in it — icon.png. Recursing here sweeps up every PNG in the
            # project, and make_icons then reports all 53 sprites, the font
            # atlas and 34 screenshots as assets it fails to produce.
            directory, walk = ROOT, ROOT.glob("*")
        else:
            directory = ROOT / target
            walk = directory.rglob("*")
        for path in sorted(walk):
            if path.is_file() and path.suffix in suffixes:
                live[path.name] = path

    # The sandbox MIRRORS the repository layout rather than flattening it,
    # because a generator may derive one output path from another: make_icons
    # writes icon.png relative to ROOT and the store icons under ICONS, then
    # calls relative_to() across the two. Give it a fake repo root and the real
    # sub-path under it and its own arithmetic keeps working.
    for constant, target in mapping.items():
        out = sandbox if target == "." else sandbox / target
        out.mkdir(parents=True, exist_ok=True)
        setattr(module, constant, out)

    # Generators print an inventory; it is not this check's output.
    with contextlib.redirect_stdout(io.StringIO()):
        module.main()

    problems: list[str] = []
    compared = 0
    produced: set[str] = set()
    for fresh in sorted(sandbox.rglob("*")):
        if not fresh.is_file() or fresh.suffix not in suffixes:
            continue
        produced.add(fresh.name)
        current = live.get(fresh.name)
        if current is None:
            problems.append(
                f"{name} writes {fresh.name}, which is not in the repository"
            )
            continue
        compared += 1
        if digest(fresh) != digest(current):
            problems.append(
                f"{current.relative_to(ROOT).as_posix()} differs from what "
                f"{name}.py produces — repo {digest(current)}, "
                f"regenerated {digest(fresh)}"
            )
    for orphan in sorted(set(live) - produced):
        problems.append(
            f"{live[orphan].relative_to(ROOT).as_posix()} is in the repository "
            f"but {name}.py does not produce it"
        )
    return problems, compared


def main() -> int:
    failed = 0
    for name, mapping, suffixes in GENERATORS:
        try:
            problems, compared = run(name, mapping, suffixes)
        except Exception as error:                      # noqa: BLE001
            print(f"{name}: FAIL (generator raised {type(error).__name__}: {error})")
            failed += 1
            continue
        # A generator that produced nothing would otherwise report OK, which is
        # the failure mode every check in this project has hit at least once.
        if compared == 0:
            print(f"{name}: FAIL (compared 0 files — the generator wrote nothing)")
            failed += 1
            continue
        if problems:
            failed += 1
            print(f"{name}: FAIL ({compared} files compared)")
            for problem in problems:
                print(f"    {problem}")
        else:
            print(f"{name}: OK ({compared} files byte-identical)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
